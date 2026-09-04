import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listSnapshotDates, listStoredMarkets, readSnapshot } from "@/lib/snapshots";
import { MARKETS, isMarketId } from "@/lib/markets";
import SnapshotView from "@/components/SnapshotView";

/** One static page per stored snapshot. */
export async function generateStaticParams() {
  const stored = await listStoredMarkets();
  const params: { market: string; date: string }[] = [];
  for (const market of stored) {
    for (const date of await listSnapshotDates(market)) {
      params.push({ market, date });
    }
  }
  return params;
}

type Props = { params: Promise<{ market: string; date: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { market, date } = await params;
  const label = isMarketId(market) ? MARKETS[market].label : market;
  return { title: `${label} · ${date}` };
}

const prettyDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export default async function SnapshotPage({ params }: Props) {
  const { market, date } = await params;
  if (!isMarketId(market)) notFound();

  const snap = await readSnapshot(market, date);
  if (!snap) notFound();

  const cfg = MARKETS[market];

  // Neighbours for prev/next navigation. Dates sort newest-first.
  const dates = await listSnapshotDates(market);
  const i = dates.indexOf(date);
  const newer = i > 0 ? dates[i - 1] : null;
  const older = i >= 0 && i < dates.length - 1 ? dates[i + 1] : null;

  const prior = older ? await readSnapshot(market, older) : null;
  const priorScores = new Map(prior?.stocks.map((s) => [s.ticker, s.score]) ?? []);
  const priorRanks = new Map(prior?.stocks.map((s, n) => [s.ticker, n + 1]) ?? []);

  return (
    <main className="shell">
      <header className="page-head">
        <div>
          <div className="crumb">
            <Link href="/archive">Archive</Link> <span>/</span>
            <Link href={`/archive/${market}`}>{cfg.label}</Link>{" "}
            <span>/</span> {date}
          </div>
          <h1 className="page-title">{prettyDate(date)}</h1>
          <p className="page-sub">
            {cfg.label} · captured{" "}
            {new Date(snap.capturedAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            . {snap.universeSize.toLocaleString()} stocks scanned,{" "}
            {snap.candidateCount.toLocaleString()} passed the filters, top{" "}
            {snap.stocks.length} stored.
            {prior && ` Movement is measured against ${older}.`}
          </p>
        </div>
        <div className="day-nav">
          {older ? (
            <Link href={`/archive/${market}/${older}`} className="btn btn-sm">← {older}</Link>
          ) : (
            <span className="btn btn-sm" aria-disabled style={{ opacity: 0.45 }}>← Earlier</span>
          )}
          {newer ? (
            <Link href={`/archive/${market}/${newer}`} className="btn btn-sm">{newer} →</Link>
          ) : (
            <span className="btn btn-sm" aria-disabled style={{ opacity: 0.45 }}>Later →</span>
          )}
        </div>
      </header>

      <SnapshotView
        stocks={snap.stocks}
        priorScores={Object.fromEntries(priorScores)}
        priorRanks={Object.fromEntries(priorRanks)}
        hasPrior={prior !== null}
      />

      <div className="footer">
        <span>
          Filters for every snapshot: ${(snap.filters.minMarketCap / 1e9).toFixed(0)}B+
          market cap and ${(snap.filters.minDollarVolume / 1e6).toFixed(0)}M+ daily
          volume — both in USD — within {snap.filters.maxPctFromHigh}% of the
          52-week high{snap.filters.requireUptrend ? ", uptrend intact" : ""}.
          Prices are quoted in {cfg.currency}.
        </span>
      </div>
    </main>
  );
}
