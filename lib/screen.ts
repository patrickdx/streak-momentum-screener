import { fetchUniverse } from "./tradingview";
import { scoreMarkets } from "./momentum";
import type {
  AppliedFilters,
  Refinements,
  ScoredStock,
  ScreenerResponse,
} from "./types";

/**
 * Applies the post-scoring refinements and ordering.
 *
 * Runs before the top-N slice, so "top 50 healthcare names" really is the best
 * 50 in healthcare rather than whatever healthcare happened to survive an
 * all-sector cut.
 */
export function refine(stocks: ScoredStock[], r: Refinements): ScoredStock[] {
  const sectors = new Set(r.sectors);

  const kept = stocks.filter((s) => {
    if (sectors.size && !sectors.has(s.sector ?? "Other")) return false;
    if (s.score < r.minScore) return false;
    if (s.legs < r.minLegs) return false;
    if (r.maxRsi < 100 && (s.rsi ?? 0) > r.maxRsi) return false;
    if (r.minRelVolume > 0 && (s.relVolume ?? 0) < r.minRelVolume) return false;
    if (r.excludeExtended && s.flags.includes("EXTENDED")) return false;
    if (r.onlyNewHighs && !s.flags.includes("NEW_HIGH")) return false;
    return true;
  });

  const key = r.sortBy;
  kept.sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    // Nulls sink regardless of direction.
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    // pctFromHigh is negative-is-worse, so descending is right for it too.
    return (bv as number) - (av as number);
  });

  return kept;
}

/**
 * Runs a full screen. Isomorphic on purpose: the browser calls this directly
 * (which is what makes a fully static deployment possible) and the snapshot
 * script calls the same pieces on the server, so there is one code path and
 * one definition of the score.
 */
/**
 * Fetches and scores. Deliberately returns *every* candidate rather than a
 * top-N: refinements and ordering are pure functions of this list, so the UI
 * can re-filter instantly instead of re-sweeping four markets every time a
 * slider moves.
 */
export async function runScreen(
  filters: AppliedFilters,
): Promise<ScreenerResponse> {
  const { universes, fxRates } = await fetchUniverse({
    markets: filters.markets,
    minMarketCap: filters.minMarketCap,
    minPrice: filters.minPrice,
    minDollarVolume: filters.minDollarVolume,
  });

  const { scored, perMarket, universeSize } = scoreMarkets(universes, filters);

  // Every sector present in the scored set, so the UI can offer a sector
  // filter without a hardcoded list that drifts from TradingView's taxonomy.
  const sectors = [...new Set(scored.map((s) => s.sector ?? "Other"))].sort();



  return {
    stocks: scored,
    meta: {
      universeSize,
      perMarket,
      fxRates,
      candidateCount: perMarket.reduce((n, m) => n + m.candidateCount, 0),
      matchedCount: scored.length,
      sectors,
      returned: scored.length,
      asOf: new Date().toISOString(),
      filters,
    },
  };
}
