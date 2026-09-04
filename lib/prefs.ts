"use client";

import { DEFAULT_REFINEMENTS, type Refinements } from "./types";
import { isMarketId, type MarketId } from "./markets";

export type Prefs = {
  market: MarketId | "all";
  minMarketCap: number;
  maxPctFromHigh: number;
  minDollarVolume: number;
  requireUptrend: boolean;
  limit: number;
  view: "table" | "heatmap";
  refinements: Refinements;
};

export const DEFAULT_PREFS: Prefs = {
  market: "us",
  minMarketCap: 1e9,
  maxPctFromHigh: 25,
  minDollarVolume: 1e7,
  requireUptrend: true,
  limit: 50,
  view: "table",
  refinements: DEFAULT_REFINEMENTS,
};

// Bumping the version retires incompatible saved shapes instead of trying to
// migrate them — preferences are cheap to re-set and expensive to get wrong.
const KEY = "streak.prefs.v1";

/** Coerces whatever is in storage into a valid Prefs, field by field. */
function sanitize(raw: unknown): Prefs {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFS;
  const o = raw as Record<string, unknown>;
  const d = DEFAULT_PREFS;

  const numOr = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  const boolOr = (v: unknown, fallback: boolean) =>
    typeof v === "boolean" ? v : fallback;

  const rIn = (o.refinements ?? {}) as Record<string, unknown>;
  const dr = d.refinements;

  return {
    market:
      typeof o.market === "string" && (o.market === "all" || isMarketId(o.market))
        ? (o.market as MarketId | "all")
        : d.market,
    minMarketCap: numOr(o.minMarketCap, d.minMarketCap),
    maxPctFromHigh: numOr(o.maxPctFromHigh, d.maxPctFromHigh),
    minDollarVolume: numOr(o.minDollarVolume, d.minDollarVolume),
    requireUptrend: boolOr(o.requireUptrend, d.requireUptrend),
    limit: numOr(o.limit, d.limit),
    view: o.view === "heatmap" ? "heatmap" : "table",
    refinements: {
      sectors: Array.isArray(rIn.sectors)
        ? rIn.sectors.filter((x): x is string => typeof x === "string")
        : dr.sectors,
      minScore: numOr(rIn.minScore, dr.minScore),
      minLegs: numOr(rIn.minLegs, dr.minLegs),
      maxRsi: numOr(rIn.maxRsi, dr.maxRsi),
      minRelVolume: numOr(rIn.minRelVolume, dr.minRelVolume),
      excludeExtended: boolOr(rIn.excludeExtended, dr.excludeExtended),
      onlyNewHighs: boolOr(rIn.onlyNewHighs, dr.onlyNewHighs),
      sortBy: typeof rIn.sortBy === "string" ? (rIn.sortBy as Refinements["sortBy"]) : dr.sortBy,
    },
  };
}

/**
 * Reads saved preferences. Every access is guarded: storage throws outright in
 * some privacy modes, and the stored value may predate a schema change or have
 * been edited by hand.
 */
export function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Full quota or blocked storage: preferences simply don't persist.
  }
}

export function clearPrefs(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}
