import type { MarketId } from "./markets";

export type RawQuote = {
  market: MarketId;
  ticker: string;        // "NASDAQ:AAPL"
  name: string;          // "AAPL"
  description: string;   // "Apple Inc."
  logoid: string | null; // "apple" -> s3-symbol-logo.tradingview.com/apple--big.svg
  exchange: string;
  sector: string | null;
  industry: string | null;
  close: number;         // local currency, as quoted
  closeUsd: number;      // converted, for cross-market gates
  currency: string;      // "JPY"
  change: number;        // today's % change
  marketCap: number;     // ALWAYS USD, so one filter means the same everywhere
  dollarVolume: number;  // avg 30d volume x price, in USD

  perfW: number | null;
  perf1M: number | null;
  perf3M: number | null;
  perf6M: number | null;
  perfY: number | null;
  perfYTD: number | null;

  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi: number | null;

  relVolume: number | null;      // 10d relative volume
  avgVol10d: number | null;
  avgVol30d: number | null;
  valueTraded: number | null;    // today's $ volume

  volatilityM: number | null;    // monthly volatility %
  high52: number | null;
  low52: number | null;
};

export type ScoreBreakdown = {
  relativeStrength: number;  // 0-100 percentile
  riskAdjusted: number;
  consistency: number;
  trendStructure: number;
  volumeThrust: number;
};

export type Flag = "NEW_HIGH" | "EXTENDED" | "PULLBACK" | "VOL_SPIKE" | "ACCELERATING";

export type ScoredStock = RawQuote & {
  score: number;             // 0-100 composite momentum score
  breakdown: ScoreBreakdown;
  rsBlend: number;           // weighted multi-horizon return, %
  legs: number;              // 0-4 positive non-overlapping return legs
  legReturns: (number | null)[];
  pctFromHigh: number | null;
  maStack: number;           // 0-4
  flags: Flag[];
};

export type ScreenerResponse = {
  stocks: ScoredStock[];
  meta: {
    universeSize: number;    // liquid names ranked against, summed over markets
    perMarket: { market: MarketId; universeSize: number; candidateCount: number }[];
    fxRates: Record<string, number>;
    /** Cleared the momentum gates. */
    candidateCount: number;
    /** Survived the post-scoring refinements too. */
    matchedCount: number;
    /** Sectors present in the scored set, for the filter UI. */
    sectors: string[];  // passed momentum gates
    returned: number;
    asOf: string;
    filters: AppliedFilters;
  };
};

export type AppliedFilters = {
  markets: MarketId[];
  minMarketCap: number;
  minPrice: number;
  minDollarVolume: number;
  requireUptrend: boolean;
  maxPctFromHigh: number;
};

/* ---------------------------- snapshots ---------------------------- */

/**
 * One day's captured screen, written by the daily job to
 * `data/snapshots/<date>.json` and committed to the repo.
 *
 * Snapshots always use CANONICAL_FILTERS so that any two days are directly
 * comparable — the interactive filters on the live screener don't affect them.
 */
export type Snapshot = {
  market: MarketId;
  date: string;        // "2026-09-04", exchange-local trading date
  capturedAt: string;  // ISO timestamp of the run
  universeSize: number;
  candidateCount: number;
  filters: AppliedFilters;
  stocks: ScoredStock[];
};

/** What the archive list needs, without loading every stock of every day. */
export type SnapshotSummary = {
  market: MarketId;
  date: string;
  capturedAt: string;
  universeSize: number;
  candidateCount: number;
  stored: number;
  topScore: number | null;
  leaders: { name: string; logoid: string | null; score: number; perf1M: number | null }[];
};

/* --------------------------- refinements --------------------------- */

export type SortField =
  | "score"
  | "perfW"
  | "perf1M"
  | "perf3M"
  | "perf6M"
  | "relVolume"
  | "marketCap"
  | "pctFromHigh"
  | "rsi";

/**
 * Filters applied *after* scoring rather than to the fetched universe.
 *
 * They live apart from AppliedFilters because they must not change the
 * percentile baseline: narrowing to one sector should surface that sector's
 * best names with the scores they earned against the whole market, not
 * re-rank them among themselves.
 */
export type Refinements = {
  sectors: string[]; // empty means every sector
  minScore: number;
  minLegs: number;
  maxRsi: number;
  minRelVolume: number;
  excludeExtended: boolean;
  onlyNewHighs: boolean;
  sortBy: SortField;
};

export const DEFAULT_REFINEMENTS: Refinements = {
  sectors: [],
  minScore: 0,
  minLegs: 0,
  maxRsi: 100,
  minRelVolume: 0,
  excludeExtended: false,
  onlyNewHighs: false,
  sortBy: "score",
};

/* ----------------------------- detail ------------------------------ */

/** Extra per-symbol data, fetched on demand when a row is opened. */
export type StockDetail = {
  ticker: string;
  /** Live close, paired with the live period highs below. */
  close: number | null;
  high52: number | null;
  high1M: number | null;
  low1M: number | null;
  high3M: number | null;
  low3M: number | null;
  high6M: number | null;
  low6M: number | null;
  peRatio: number | null;
  eps: number | null;
  revenue: number | null;
  employees: number | null;
  recommendation: number | null;
  perfY: number | null;
  perf5Y: number | null;
  adx: number | null;
  macd: number | null;
  macdSignal: number | null;
  stochK: number | null;
  beta: number | null;
  nextEarnings: number | null;
  country: string | null;
  volatilityW: number | null;
  vwap: number | null;
};

/** One appearance of a stock in the stored archive. */
export type HistoryPoint = {
  date: string;
  rank: number;
  score: number;
  perf1M: number | null;
  flags: Flag[];
};
