/**
 * Builds per-market ticker history indexes into `public/history/<market>.json`.
 *
 * The detail card wants "which days has this name been in the screen, and where
 * did it rank" — that lives across every snapshot file, so answering it in the
 * browser would mean downloading the whole archive. This inverts the data once
 * at build time into ticker -> appearances, which the card fetches lazily.
 *
 * Run automatically via the `prebuild` script.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { MARKET_IDS } from "../lib/markets";
import { listSnapshotDates, readSnapshot } from "../lib/snapshots";
import type { HistoryPoint } from "../lib/types";

/** Cap the window so the index stays small enough to fetch on demand. */
const MAX_DAYS = 90;

const OUT_DIR = path.join(process.cwd(), "public", "history");

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  for (const market of MARKET_IDS) {
    const dates = (await listSnapshotDates(market)).slice(0, MAX_DAYS);
    const index: Record<string, HistoryPoint[]> = {};

    // Oldest first so each ticker's array reads chronologically.
    for (const date of [...dates].reverse()) {
      const snap = await readSnapshot(market, date);
      if (!snap) continue;
      snap.stocks.forEach((s, i) => {
        (index[s.ticker] ??= []).push({
          date,
          rank: i + 1,
          score: Math.round(s.score * 10) / 10,
          perf1M: s.perf1M === null ? null : Math.round(s.perf1M * 10) / 10,
          flags: s.flags,
        });
      });
    }

    const file = path.join(OUT_DIR, `${market}.json`);
    await fs.writeFile(file, JSON.stringify(index), "utf8");
    const kb = Math.round((await fs.stat(file)).size / 1024);
    console.log(
      `  ${market}: ${dates.length} day(s), ${Object.keys(index).length} tickers -> ${kb}KB`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
