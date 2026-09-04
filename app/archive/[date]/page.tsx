import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listSnapshotDates, readSnapshot } from "@/lib/snapshots";
import SnapshotView from "@/components/SnapshotView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ date: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  return { title: `${date} snapshot` };
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
  const { date } = await params;
  const snap = await readSnapshot(date);
  if (!snap) notFound();

  // Neighbours for prev/next navigation. Dates sort newest-first.
  const dates = await listSnapshotDates();
  const i = dates.indexOf(date);
  const newer = i > 0 ? dates[i - 1] : null;
  const older = i >= 0 && i < dates.length - 1 ? dates[i + 1] : null;

  const prior = older ? await readSnapshot(older) : null;
  const priorScores = new Map(prior?.stocks.map((s) => [s.ticker, s.score]) ?? []);
  const priorRanks = new Map(prior?.stocks.map((s, n) => [s.ticker, n + 1]) ?? []);

  return (
    <main className="shell">
      <header className="page-head">
        <div>
          <div className="crumb">
            <Link href="/archive">Archive</Link> <span>/</span> {date}
          </div>
          <h1 className="page-title">{prettyDate(date)}</h1>
          <p className="page-sub">
            Captured{" "}
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
            <Link href={`/archive/${older}`} className="btn btn-sm">← {older}</Link>
          ) : (
            <span className="btn btn-sm" aria-disabled style={{ opacity: 0.45 }}>← Earlier</span>
          )}
          {newer ? (
            <Link href={`/archive/${newer}`} className="btn btn-sm">{newer} →</Link>
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
          market cap, ${(snap.filters.minDollarVolume / 1e6).toFixed(0)}M+ daily
          volume, within {snap.filters.maxPctFromHigh}% of the 52-week high
          {snap.filters.requireUptrend ? ", uptrend intact" : ""}.
        </span>
      </div>
    </main>
  );
}
