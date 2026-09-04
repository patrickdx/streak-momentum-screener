import { fetchUniverse } from "./tradingview";
import { scoreMarkets } from "./momentum";
import type { AppliedFilters, ScreenerResponse } from "./types";

/**
 * Runs a full screen. Isomorphic on purpose: the browser calls this directly
 * (which is what makes a fully static deployment possible) and the snapshot
 * script calls the same pieces on the server, so there is one code path and
 * one definition of the score.
 */
export async function runScreen(
  filters: AppliedFilters,
  limit: number,
): Promise<ScreenerResponse> {
  const { universes, fxRates } = await fetchUniverse({
    markets: filters.markets,
    minMarketCap: filters.minMarketCap,
    minPrice: filters.minPrice,
    minDollarVolume: filters.minDollarVolume,
  });

  const { scored, perMarket, universeSize } = scoreMarkets(universes, filters);
  const stocks = scored.slice(0, limit);

  return {
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
}
