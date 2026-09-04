import { promises as fs } from "node:fs";
import path from "node:path";
import type { AppliedFilters, Snapshot, SnapshotSummary } from "./types";

export const SNAPSHOT_DIR = path.join(process.cwd(), "data", "snapshots");

/**
 * The daily job always screens with these. Fixing them is the whole point of
 * the archive: if the filters drifted day to day, "yesterday vs. today" would
 * be comparing two different questions.
 */
export const CANONICAL_FILTERS: AppliedFilters = {
  minMarketCap: 1e9,
  minPrice: 5,
  minDollarVolume: 1e7,
  requireUptrend: true,
  maxPctFromHigh: 25,
};

/** How many scored names each snapshot keeps. */
export const SNAPSHOT_SIZE = 100;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isValidDate = (d: string): boolean => DATE_RE.test(d);

/** Trading date in US Eastern terms, which is what a market snapshot means. */
export function easternDate(when: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(when);
}

/** Newest first. Returns [] when nothing has been captured yet. */
export async function listSnapshotDates(): Promise<string[]> {
  try {
    const files = await fs.readdir(SNAPSHOT_DIR);
    return files
      .filter((f) => f.endsWith(".json") && isValidDate(f.slice(0, -5)))
      .map((f) => f.slice(0, -5))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function readSnapshot(date: string): Promise<Snapshot | null> {
  if (!isValidDate(date)) return null;
  try {
    const raw = await fs.readFile(path.join(SNAPSHOT_DIR, `${date}.json`), "utf8");
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

export function summarize(snap: Snapshot): SnapshotSummary {
  return {
    date: snap.date,
    capturedAt: snap.capturedAt,
    universeSize: snap.universeSize,
    candidateCount: snap.candidateCount,
    stored: snap.stocks.length,
    topScore: snap.stocks[0]?.score ?? null,
    leaders: snap.stocks.slice(0, 3).map((s) => ({
      name: s.name,
      logoid: s.logoid,
      score: s.score,
      perf1M: s.perf1M,
    })),
  };
}

export async function listSummaries(limit?: number): Promise<SnapshotSummary[]> {
  const dates = await listSnapshotDates();
  const wanted = limit ? dates.slice(0, limit) : dates;
  const snaps = await Promise.all(wanted.map(readSnapshot));
  return snaps.filter((s): s is Snapshot => s !== null).map(summarize);
}

/**
 * Trims float noise before writing. TradingView hands back full doubles
 * (`39.02439024390244`), which is ~40% of a snapshot's bytes and none of its
 * information. Large magnitudes (market cap, share counts) round to integers;
 * everything else keeps 4 decimals.
 */
function roundDeep(value: unknown): unknown {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    if (Math.abs(value) >= 1e6) return Math.round(value);
    return Math.round(value * 1e4) / 1e4;
  }
  if (Array.isArray(value)) return value.map(roundDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, roundDeep(v)]),
    );
  }
  return value;
}

/**
 * Fingerprint of the day's closing prices. Used to detect a market holiday:
 * the cron fires Mon-Fri regardless, and on a closed day TradingView returns
 * the previous session verbatim. Writing that would put a fake trading day in
 * the archive.
 */
export function priceFingerprint(snap: Snapshot): string {
  return snap.stocks.map((s) => `${s.ticker}:${s.close}`).join("|");
}

export async function writeSnapshot(snap: Snapshot): Promise<string> {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
  const file = path.join(SNAPSHOT_DIR, `${snap.date}.json`);
  // Compact: each day is a new file, never a diff, so readability buys nothing.
  await fs.writeFile(file, `${JSON.stringify(roundDeep(snap))}\n`, "utf8");
  return file;
}
