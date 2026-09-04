/**
 * Captures one day's screen per market into
 * `data/snapshots/<market>/<date>.json`.
 *
 * Run by .github/workflows/daily-snapshot.yml after each close, but it's an
 * ordinary script — `npm run snapshot` works locally too.
 *
 *   npm run snapshot                      all markets, today
 *   npm run snapshot -- --markets=japan   one market
 *   npm run snapshot -- --force           overwrite today's file
 */
import { fetchUniverse } from "../lib/tradingview";
import { scoreUniverse } from "../lib/momentum";
import { MARKETS, parseMarkets, type MarketId } from "../lib/markets";
import {
  CANONICAL_FILTERS,
  SNAPSHOT_SIZE,
  listSnapshotDates,
  priceFingerprint,
  readSnapshot,
  tradingDate,
  writeSnapshot,
} from "../lib/snapshots";
import type { Snapshot } from "../lib/types";

/** A healthy market returns hundreds of names; anything near empty is a fault. */
const MIN_HEALTHY_UNIVERSE = 60;

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

async function captureMarket(
  market: MarketId,
  force: boolean,
  dateOverride?: string,
): Promise<"written" | "skipped" | "failed"> {
  const cfg = MARKETS[market];
  const date = dateOverride ?? tradingDate(market);
  const label = `${cfg.label} (${date})`;

  try {
    if (!force && (await readSnapshot(market, date))) {
      console.log(`  ${label}: already captured, skipping.`);
      return "skipped";
    }

    const { universes, fxRates } = await fetchUniverse({
      markets: [market],
      minMarketCap: CANONICAL_FILTERS.minMarketCap,
      minPrice: CANONICAL_FILTERS.minPrice,
      minDollarVolume: CANONICAL_FILTERS.minDollarVolume,
    });

    const quotes = universes[0]?.quotes ?? [];

    if (quotes.length < MIN_HEALTHY_UNIVERSE) {
      // Committing this would silently poison the archive: it means the
      // upstream API changed shape, rate-limited us, or the FX rate is wrong.
      throw new Error(
        `only ${quotes.length} names returned (expected at least ${MIN_HEALTHY_UNIVERSE})`,
      );
    }

    const { scored, candidateCount } = scoreUniverse(quotes, {
      ...CANONICAL_FILTERS,
      markets: [market],
    });

    const snap: Snapshot = {
      market,
      date,
      capturedAt: new Date().toISOString(),
      universeSize: quotes.length,
      candidateCount,
      filters: { ...CANONICAL_FILTERS, markets: [market] },
      stocks: scored.slice(0, SNAPSHOT_SIZE),
    };

    // Market-holiday guard: the cron fires every weekday, but on a closed day
    // the upstream data is the previous session verbatim. Skip rather than
    // record a trading day that never happened.
    const [latest] = (await listSnapshotDates(market)).filter((d) => d < date);
    if (!force && latest) {
      const prev = await readSnapshot(market, latest);
      if (prev && priceFingerprint(prev) === priceFingerprint(snap)) {
        console.log(
          `  ${label}: closing prices identical to ${latest} — market was closed. Skipping.`,
        );
        return "skipped";
      }
    }

    await writeSnapshot(snap);
    const fx = fxRates[cfg.currency];
    console.log(
      `  ${label}: ${quotes.length} scanned · ${candidateCount} passed · ${snap.stocks.length} stored` +
        `${cfg.fxTicker ? ` · 1 USD = ${fx.toLocaleString()} ${cfg.currency}` : ""}` +
        `${snap.stocks[0] ? ` · leader ${snap.stocks[0].name} @ ${snap.stocks[0].score.toFixed(1)}` : ""}`,
    );
    return "written";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ${label}: FAILED — ${message}`);
    return "failed";
  }
}

async function main() {
  const force = process.argv.includes("--force");
  const markets = parseMarkets(arg("markets") ?? null);
  const dateOverride = arg("date");

  console.log(`Capturing ${markets.length} market(s)…`);

  // Sequential rather than parallel: this is a background job with no deadline,
  // and hammering the upstream API with four concurrent paginated sweeps is a
  // good way to get rate-limited into a failed run.
  const results: Record<string, string> = {};
  for (const market of markets) {
    results[market] = await captureMarket(market, force, dateOverride);
  }

  const written = Object.values(results).filter((r) => r === "written").length;
  const failed = Object.entries(results).filter(([, r]) => r === "failed");

  console.log(`\nDone: ${written} written, ${Object.values(results).filter((r) => r === "skipped").length} skipped, ${failed.length} failed.`);

  // Partial success is fine — one market being down shouldn't lose the others.
  // But a total failure should fail the workflow loudly.
  if (failed.length === markets.length) {
    throw new Error(`Every market failed: ${failed.map(([m]) => m).join(", ")}`);
  }
  if (failed.length) {
    console.log(`::warning::${failed.map(([m]) => m).join(", ")} failed; other markets were captured`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
