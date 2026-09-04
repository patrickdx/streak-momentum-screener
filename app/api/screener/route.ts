import { NextResponse } from "next/server";
import { fetchUniverse } from "@/lib/tradingview";
import { scoreMarkets } from "@/lib/momentum";
import { parseMarkets } from "@/lib/markets";
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
    markets: parseMarkets(searchParams.get("markets")),
    minMarketCap: clampNum(searchParams.get("minMarketCap"), 1e9, 5e7, 5e12),
    minPrice: clampNum(searchParams.get("minPrice"), 5, 0, 10_000),
    minDollarVolume: clampNum(searchParams.get("minDollarVolume"), 1e7, 0, 1e10),
    requireUptrend: searchParams.get("requireUptrend") !== "false",
    maxPctFromHigh: clampNum(searchParams.get("maxPctFromHigh"), 25, 1, 100),
  };
  const limit = clampNum(searchParams.get("limit"), 50, 10, 300);

  try {
    const { universes, fxRates } = await fetchUniverse({
      markets: filters.markets,
      minMarketCap: filters.minMarketCap,
      minPrice: filters.minPrice,
      minDollarVolume: filters.minDollarVolume,
    });

    const { scored, perMarket, universeSize } = scoreMarkets(universes, filters);
    const stocks = scored.slice(0, limit);

    const payload: ScreenerResponse = {
      stocks,
      meta: {
        universeSize,
        perMarket,
        fxRates,
        candidateCount: perMarket.reduce((n, m) => n + m.candidateCount, 0),
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
