export type RawQuote = {
  ticker: string;        // "NASDAQ:AAPL"
  name: string;          // "AAPL"
  description: string;   // "Apple Inc."
  logoid: string | null; // "apple" -> s3-symbol-logo.tradingview.com/apple--big.svg
  exchange: string;
  sector: string | null;
  industry: string | null;
  close: number;
  change: number;        // today's % change
  marketCap: number;

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
    universeSize: number;    // liquid US names ranked against
    candidateCount: number;  // passed momentum gates
    returned: number;
    asOf: string;
    filters: AppliedFilters;
  };
};

export type AppliedFilters = {
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
  date: string;        // "2026-09-04", US Eastern trading date
  capturedAt: string;  // ISO timestamp of the run
  universeSize: number;
  candidateCount: number;
  filters: AppliedFilters;
  stocks: ScoredStock[];
};

/** What the archive list needs, without loading every stock of every day. */
export type SnapshotSummary = {
  date: string;
  capturedAt: string;
  universeSize: number;
  candidateCount: number;
  stored: number;
  topScore: number | null;
  leaders: { name: string; logoid: string | null; score: number; perf1M: number | null }[];
};
