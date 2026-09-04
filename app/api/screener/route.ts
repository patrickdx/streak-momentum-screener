import { NextResponse } from "next/server";
import { fetchUniverse } from "@/lib/tradingview";
import { scoreUniverse } from "@/lib/momentum";
import type { AppliedFilters, ScreenerResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Quotes are delayed anyway; a short cache keeps us off TradingView's rate limit.
export const revalidate = 0;

const clampNum = (
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number => {
  const n = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const filters: AppliedFilters = {
    minMarketCap: clampNum(searchParams.get("minMarketCap"), 1e9, 5e7, 5e12),
    minPrice: clampNum(searchParams.get("minPrice"), 5, 0, 10_000),
    minDollarVolume: clampNum(searchParams.get("minDollarVolume"), 1e7, 0, 1e10),
    requireUptrend: searchParams.get("requireUptrend") !== "false",
    maxPctFromHigh: clampNum(searchParams.get("maxPctFromHigh"), 25, 1, 100),
  };
  const limit = clampNum(searchParams.get("limit"), 50, 10, 300);

  try {
    const universe = await fetchUniverse({
      minMarketCap: filters.minMarketCap,
      minPrice: filters.minPrice,
      minDollarVolume: filters.minDollarVolume,
    });

    const { scored, candidateCount } = scoreUniverse(universe, filters);
    const stocks = scored.slice(0, limit);

    const payload: ScreenerResponse = {
      stocks,
      meta: {
        universeSize: universe.length,
        candidateCount,
        returned: stocks.length,
        asOf: new Date().toISOString(),
        filters,
      },
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to load screener data: ${message}` },
      { status: 502 },
    );
  }
}
