import type { AppliedFilters, Flag, RawQuote, ScoredStock } from "./types";
import type { MarketUniverse } from "./tradingview";
import type { MarketId } from "./markets";

/* ------------------------------------------------------------------ *
 * Momentum model
 *
 * A "hot streak" is not just a big number on one timeframe — a single
 * takeover-pop prints +80% on 1M and looks identical to a stock that has
 * ground higher for six months. The model separates them by scoring five
 * independent dimensions and ranking each one cross-sectionally against the
 * whole liquid US universe:
 *
 *   1. Relative Strength  — multi-horizon blended return
 *   2. Risk-Adjusted      — that return per unit of volatility
 *   3. Consistency        — how many non-overlapping legs were up
 *   4. Trend Structure    — moving-average stack + distance from 52w high
 *   5. Volume Thrust      — is money actually rotating in
 *
 * Percentile ranking (rather than raw z-scores) keeps a handful of manic
 * small caps from dominating the distribution.
 * ------------------------------------------------------------------ */

export const WEIGHTS = {
  relativeStrength: 0.3,
  riskAdjusted: 0.2,
  consistency: 0.15,
  trendStructure: 0.2,
  volumeThrust: 0.15,
} as const;

/** Horizon weights for the blended return. Recent action counts most, but not
 *  so much that a one-week spike outruns a six-month trend. */
const HORIZON = { w: 0.15, m1: 0.35, m3: 0.3, m6: 0.2 } as const;

/** Cumulative % return -> growth multiple (e.g. 12.5 -> 1.125). */
const mult = (pct: number | null): number | null =>
  pct === null ? null : 1 + pct / 100;

/**
 * Decompose overlapping cumulative returns into *non-overlapping* legs:
 *   [last 1W] [rest of the month] [month 2-3] [month 4-6]
 * Four independent windows. Counting how many are positive is a clean proxy
 * for a streak, which TradingView doesn't expose directly.
 */
export function computeLegs(q: RawQuote): {
  legs: number;
  legReturns: (number | null)[];
} {
  const [w, m1, m3, m6] = [q.perfW, q.perf1M, q.perf3M, q.perf6M].map(mult);

  const seg = (outer: number | null, inner: number | null): number | null =>
    outer === null || inner === null || inner === 0 ? null : (outer / inner - 1) * 100;

  const legReturns = [
    q.perfW,
    seg(m1, w),
    seg(m3, m1),
    seg(m6, m3),
  ];

  const legs = legReturns.filter((r) => r !== null && r > 0).length;
  return { legs, legReturns };
}

/** Weighted multi-horizon return, %. Shown in the UI; not used for scoring —
 *  see `weightedHorizonRank` for why. Missing horizons redistribute their weight. */
export function rsBlend(q: RawQuote): number | null {
  const parts: [number | null, number][] = [
    [q.perfW, HORIZON.w],
    [q.perf1M, HORIZON.m1],
    [q.perf3M, HORIZON.m3],
    [q.perf6M, HORIZON.m6],
  ];
  const present = parts.filter(([v]) => v !== null);
  if (present.length === 0) return null;

  const totalWeight = present.reduce((s, [, wt]) => s + wt, 0);
  return present.reduce((s, [v, wt]) => s + (v as number) * wt, 0) / totalWeight;
}

/**
 * Trend-structure points, 0-4. Three checks walk the moving-average stack
 * (close > 20d > 50d > 200d); the fourth re-tests close against the 50d on
 * purpose, so a name that has slipped below its 20-day but is still holding
 * the 50-day scores 3/4 rather than being punished like a broken trend. A
 * shallow pullback inside an uptrend is a setup, not a failure.
 */
export function maStack(q: RawQuote): number {
  const { close, sma20, sma50, sma200 } = q;
  let n = 0;
  if (sma20 !== null && close > sma20) n++;
  if (sma20 !== null && sma50 !== null && sma20 > sma50) n++;
  if (sma50 !== null && sma200 !== null && sma50 > sma200) n++;
  if (sma50 !== null && close > sma50) n++;
  return n;
}

export const pctFromHigh = (q: RawQuote): number | null =>
  q.high52 !== null && q.high52 > 0 ? ((q.close - q.high52) / q.high52) * 100 : null;

/**
 * Percentile rank of each value within the array, 0-100.
 * Nulls land at 0. Ties share the average rank.
 */
function percentileRank(values: (number | null)[]): number[] {
  const idx = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v !== null)
    .sort((a, b) => a.v - b.v);

  const out = new Array(values.length).fill(0);
  const n = idx.length;
  if (n === 0) return out;

  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && idx[j + 1].v === idx[i].v) j++;
    // average rank across the tie group, mapped to 0-100
    const rank = n === 1 ? 100 : ((i + j) / 2 / (n - 1)) * 100;
    for (let k = i; k <= j; k++) out[idx[k].i] = rank;
    i = j + 1;
  }
  return out;
}

/** The four horizons, paired with their weights. */
const HORIZONS: [(q: RawQuote) => number | null, number][] = [
  [(q) => q.perfW, HORIZON.w],
  [(q) => q.perf1M, HORIZON.m1],
  [(q) => q.perf3M, HORIZON.m3],
  [(q) => q.perf6M, HORIZON.m6],
];

/**
 * Percentile-rank each horizon separately, *then* apply the horizon weights.
 *
 * Weighting the raw percentages instead would let whichever horizon happens to
 * carry the biggest numbers dominate: a stock up 1% on the month but 250% over
 * six months would swamp the 1M term even though 1M carries more weight. Rank
 * first and a weight of 0.35 really is 35% of the influence.
 *
 * Names missing a horizon (recent listings) redistribute that weight across the
 * horizons they do have, rather than being scored as if they had ranked last.
 */
function weightedHorizonRank(
  universe: RawQuote[],
  value: (q: RawQuote, horizon: (q: RawQuote) => number | null) => number | null,
): number[] {
  const ranked = HORIZONS.map(([get]) =>
    percentileRank(universe.map((q) => value(q, get))),
  );
  const present = HORIZONS.map(([get]) => universe.map((q) => get(q) !== null));

  return universe.map((_, i) => {
    let acc = 0;
    let wt = 0;
    HORIZONS.forEach(([, w], h) => {
      if (!present[h][i]) return;
      acc += ranked[h][i] * w;
      wt += w;
    });
    return wt === 0 ? 0 : acc / wt;
  });
}

function flagsFor(
  q: RawQuote,
  fromHigh: number | null,
  legReturns: (number | null)[],
): Flag[] {
  const flags: Flag[] = [];

  if (fromHigh !== null && fromHigh >= -2) flags.push("NEW_HIGH");

  const stretched = q.sma20 !== null && q.sma20 > 0 && q.close / q.sma20 >= 1.25;
  if ((q.rsi !== null && q.rsi >= 80) || stretched) flags.push("EXTENDED");

  const belowShortMA = q.sma20 !== null && q.close < q.sma20;
  if ((q.rsi !== null && q.rsi < 50) || belowShortMA) flags.push("PULLBACK");

  if ((q.relVolume ?? 0) >= 2) flags.push("VOL_SPIKE");

  // Recent leg outrunning the older ones = the trend is speeding up.
  const [wk, restOfMonth, m2to3] = legReturns;
  if (wk !== null && restOfMonth !== null && m2to3 !== null) {
    const weeklyPace = wk;
    const olderPace = (restOfMonth + m2to3) / 8; // ~8 weeks, crude weekly pace
    if (weeklyPace > 0 && weeklyPace > olderPace * 2) flags.push("ACCELERATING");
  }

  return flags;
}

export type ScoreOptions = AppliedFilters;

/**
 * Ranks the whole universe, then returns only the names that clear the
 * momentum gates. Ranking before filtering is deliberate — a score should mean
 * "top decile of all US large caps", not "top decile of the ones already
 * trending".
 */
export function scoreUniverse(
  universe: RawQuote[],
  opts: ScoreOptions,
): { scored: ScoredStock[]; candidateCount: number } {
  const blends = universe.map(rsBlend);
  const legData = universe.map(computeLegs);
  const highs = universe.map(pctFromHigh);
  const stacks = universe.map(maStack);

  // 1. Relative strength across horizons.
  const rsRank = weightedHorizonRank(universe, (q, h) => h(q));

  // 2. Risk-adjusted: return per unit of monthly volatility, horizon by
  //    horizon. Steady grinders beat lottery tickets with the same headline
  //    return.
  const riskRank = weightedHorizonRank(universe, (q, h) => {
    const v = h(q);
    const vol = q.volatilityM;
    if (v === null || vol === null || vol <= 0) return null;
    return v / vol;
  });

  // 3. Consistency: positive legs, tie-broken by the weakest leg so that a
  //    4/4 streak with no ugly drawdown outranks a 4/4 that nearly broke.
  const consistency = universe.map((_, i) => {
    const { legs, legReturns } = legData[i];
    const known = legReturns.filter((r): r is number => r !== null);
    const worst = known.length ? Math.min(...known) : 0;
    return legs * 100 + Math.max(-50, Math.min(50, worst));
  });
  const consistencyRank = percentileRank(consistency);

  // 4. Trend structure: MA stack plus proximity to the 52-week high.
  const structure = universe.map((_, i) => {
    const fh = highs[i];
    const proximity = fh === null ? 0 : Math.max(0, 100 + fh); // 100 at the high
    return stacks[i] * 25 * 0.6 + proximity * 0.4;
  });
  const structureRank = percentileRank(structure);

  // 5. Volume thrust: current relative volume plus 10d-vs-30d expansion.
  const thrust = universe.map((q) => {
    const rel = q.relVolume ?? 1;
    const expansion =
      q.avgVol10d !== null && q.avgVol30d !== null && q.avgVol30d > 0
        ? q.avgVol10d / q.avgVol30d
        : 1;
    return rel * 0.5 + expansion * 0.5;
  });
  const thrustRank = percentileRank(thrust);

  const all: ScoredStock[] = universe.map((q, i) => {
    const breakdown = {
      relativeStrength: rsRank[i],
      riskAdjusted: riskRank[i],
      consistency: consistencyRank[i],
      trendStructure: structureRank[i],
      volumeThrust: thrustRank[i],
    };

    const score =
      breakdown.relativeStrength * WEIGHTS.relativeStrength +
      breakdown.riskAdjusted * WEIGHTS.riskAdjusted +
      breakdown.consistency * WEIGHTS.consistency +
      breakdown.trendStructure * WEIGHTS.trendStructure +
      breakdown.volumeThrust * WEIGHTS.volumeThrust;

    return {
      ...q,
      score,
      breakdown,
      rsBlend: blends[i] ?? 0,
      legs: legData[i].legs,
      legReturns: legData[i].legReturns,
      pctFromHigh: highs[i],
      maStack: stacks[i],
      flags: flagsFor(q, highs[i], legData[i].legReturns),
    };
  });

  const candidates = all.filter((s) => passesGates(s, opts));
  candidates.sort((a, b) => b.score - a.score);

  return { scored: candidates, candidateCount: candidates.length };
}

/** Hard requirements to appear at all — a screen, not a leaderboard. */
function passesGates(s: ScoredStock, o: ScoreOptions): boolean {
  if (s.marketCap < o.minMarketCap) return false;
  // In USD: a JPY or KRW price compared against a dollar floor is meaningless.
  if (s.closeUsd < o.minPrice) return false;

  // Must actually be advancing on both the medium and intermediate horizon.
  if ((s.perf1M ?? -1) <= 0) return false;
  if ((s.perf3M ?? -1) <= 0) return false;

  if (o.requireUptrend) {
    // Price above the 50d, and the 50d above the 200d: the long-term trend
    // has to be intact, not just a bounce inside a downtrend.
    if (s.sma50 !== null && s.close < s.sma50) return false;
    if (s.sma50 !== null && s.sma200 !== null && s.sma50 < s.sma200) return false;
  }

  if (s.pctFromHigh !== null && s.pctFromHigh < -o.maxPctFromHigh) return false;

  return true;
}


/**
 * Scores several markets and merges the result.
 *
 * Each market is ranked against **itself**, never against the pooled set. A
 * percentile is a statement about a stock's peers, and Tokyo and New York can
 * be in completely different regimes — pooling them would mean a flat month in
 * a strong market outranking a good month in a weak one purely because of the
 * company it was measured against. Once every name carries a within-market
 * percentile the scores are comparable, so the merged list sorts cleanly.
 */
export function scoreMarkets(
  universes: MarketUniverse[],
  opts: ScoreOptions,
): {
  scored: ScoredStock[];
  perMarket: { market: MarketId; universeSize: number; candidateCount: number }[];
  universeSize: number;
} {
  const perMarket: {
    market: MarketId;
    universeSize: number;
    candidateCount: number;
  }[] = [];
  const merged: ScoredStock[] = [];

  for (const u of universes) {
    const { scored, candidateCount } = scoreUniverse(u.quotes, opts);
    perMarket.push({
      market: u.market,
      universeSize: u.quotes.length,
      candidateCount,
    });
    merged.push(...scored);
  }

  merged.sort((a, b) => b.score - a.score);

  return {
    scored: merged,
    perMarket,
    universeSize: universes.reduce((n, u) => n + u.quotes.length, 0),
  };
}
