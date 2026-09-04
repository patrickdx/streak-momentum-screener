/**
 * Captures one day's screen into `data/snapshots/<date>.json`.
 *
 * Run by .github/workflows/daily-snapshot.yml after the US close, but it's an
 * ordinary script — `npm run snapshot` works locally too.
 */
import { fetchUniverse } from "../lib/tradingview";
import { scoreUniverse } from "../lib/momentum";
import {
  CANONICAL_FILTERS,
  SNAPSHOT_SIZE,
  easternDate,
  listSnapshotDates,
  priceFingerprint,
  readSnapshot,
  writeSnapshot,
} from "../lib/snapshots";
import type { Snapshot } from "../lib/types";

async function main() {
  const force = process.argv.includes("--force");
  const dateArg = process.argv.find((a) => a.startsWith("--date="));
  const date = dateArg ? dateArg.slice(7) : easternDate();

  if (!force && (await readSnapshot(date))) {
    console.log(`Snapshot for ${date} already exists — nothing to do.`);
    console.log("::notice::snapshot already present, skipping");
    return;
  }

  console.log(`Fetching universe for ${date}…`);
  const universe = await fetchUniverse({
    minMarketCap: CANONICAL_FILTERS.minMarketCap,
    minPrice: CANONICAL_FILTERS.minPrice,
    minDollarVolume: CANONICAL_FILTERS.minDollarVolume,
  });

  if (universe.length < 200) {
    // A healthy run sees ~1,900 names. Anything close to empty means the
    // upstream API changed shape or rate-limited us; committing that would
    // silently poison the archive.
    throw new Error(
      `Only ${universe.length} names returned — refusing to write a snapshot that looks broken.`,
    );
  }

  const { scored, candidateCount } = scoreUniverse(universe, CANONICAL_FILTERS);

  const snap: Snapshot = {
    date,
    capturedAt: new Date().toISOString(),
    universeSize: universe.length,
    candidateCount,
    filters: CANONICAL_FILTERS,
    stocks: scored.slice(0, SNAPSHOT_SIZE),
  };

  // Market-holiday guard: the cron fires every weekday, but on a closed day
  // the upstream data is byte-for-byte the previous session. Skip rather than
  // record a trading day that never happened.
  const [latest] = (await listSnapshotDates()).filter((d) => d < date);
  if (!force && latest) {
    const prev = await readSnapshot(latest);
    if (prev && priceFingerprint(prev) === priceFingerprint(snap)) {
      console.log(
        `Closing prices are identical to ${latest} — market was almost certainly closed. Skipping.`,
      );
      console.log("::notice::market closed, no snapshot written");
      return;
    }
  }

  const file = await writeSnapshot(snap);
  console.log(
    `Wrote ${file}\n  universe ${universe.length} · passed ${candidateCount} · stored ${snap.stocks.length}`,
  );
  if (snap.stocks[0]) {
    console.log(`  leader ${snap.stocks[0].name} @ ${snap.stocks[0].score.toFixed(1)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
