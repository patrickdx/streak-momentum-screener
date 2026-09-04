import { promises as fs } from "node:fs";
import path from "node:path";
import type { AppliedFilters, Snapshot, SnapshotSummary } from "./types";
import { MARKETS, isMarketId, type MarketId } from "./markets";

const ROOT = path.join(process.cwd(), "data", "snapshots");

/** One directory per market: data/snapshots/<market>/<date>.json */
export const marketDir = (market: MarketId) => path.join(ROOT, market);

/**
 * The daily job always screens with these. Fixing them is the whole point of
 * the archive: if the filters drifted day to day, "yesterday vs. today" would
 * be comparing two different questions.
 */
export const CANONICAL_FILTERS: Omit<AppliedFilters, "markets"> = {
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

/**
 * Where each market trades, and the local hour its session opens.
 *
 * Both matter for labelling. A single UTC cron fires at a different local
 * calendar date in each market: at 22:00 UTC it is already tomorrow morning in
 * Tokyo, so naively taking the local date would file Monday's close under
 * Tuesday. Capturing before the open means the freshest data is still the
 * *previous* session, so the date rolls back.
 */
const MARKET_SESSION: Record<MarketId, { tz: string; opensAtHour: number }> = {
  us: { tz: "America/New_York", opensAtHour: 9 },
  japan: { tz: "Asia/Tokyo", opensAtHour: 9 },
  korea: { tz: "Asia/Seoul", opensAtHour: 9 },
  china: { tz: "Asia/Shanghai", opensAtHour: 9 },
};

/** Local Y/M/D/H/weekday for an instant, in a given timezone. */
function localParts(tz: string, when: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(when);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    hour: Number(get("hour")),
    weekday: get("weekday"),
  };
}

const iso = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;

/**
 * The trading date a capture taken *now* actually represents, in the market's
 * own calendar. Rolls back before the open and across weekends, so the same
 * cron produces correct labels for every market regardless of when it fires.
 *
 * Public holidays are not encoded — the price fingerprint in the capture script
 * catches those by noticing the data is unchanged.
 */
export function tradingDate(market: MarketId, when: Date = new Date()): string {
  const { tz, opensAtHour } = MARKET_SESSION[market];
  const p = localParts(tz, when);

  // Work in UTC purely as a calendar for the rollback arithmetic.
  const cursor = new Date(Date.UTC(p.y, p.m - 1, p.d));
  if (p.hour < opensAtHour) cursor.setUTCDate(cursor.getUTCDate() - 1);

  // 0 = Sunday, 6 = Saturday.
  while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return iso(cursor);
}

/** Markets that have at least one stored snapshot. */
export async function listStoredMarkets(): Promise<MarketId[]> {
  try {
    const entries = await fs.readdir(ROOT, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && isMarketId(e.name))
      .map((e) => e.name as MarketId)
      .sort((a, b) => Object.keys(MARKETS).indexOf(a) - Object.keys(MARKETS).indexOf(b));
  } catch {
    return [];
  }
}

/** Newest first. Returns [] when nothing has been captured yet. */
export async function listSnapshotDates(market: MarketId): Promise<string[]> {
  try {
    const files = await fs.readdir(marketDir(market));
    return files
      .filter((f) => f.endsWith(".json") && isValidDate(f.slice(0, -5)))
      .map((f) => f.slice(0, -5))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function readSnapshot(
  market: MarketId,
  date: string,
): Promise<Snapshot | null> {
  if (!isValidDate(date)) return null;
  try {
    const raw = await fs.readFile(path.join(marketDir(market), `${date}.json`), "utf8");
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

export function summarize(snap: Snapshot): SnapshotSummary {
  return {
    market: snap.market,
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

export async function listSummaries(
  market: MarketId,
  limit?: number,
): Promise<SnapshotSummary[]> {
  const dates = await listSnapshotDates(market);
  const wanted = limit ? dates.slice(0, limit) : dates;
  const snaps = await Promise.all(wanted.map((d) => readSnapshot(market, d)));
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
  const dir = marketDir(snap.market);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${snap.date}.json`);
  // Compact: each day is a new file, never a diff, so readability buys nothing.
  await fs.writeFile(file, `${JSON.stringify(roundDeep(snap))}\n`, "utf8");
  return file;
}
