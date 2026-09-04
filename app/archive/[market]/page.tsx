import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listStoredMarkets, listSummaries } from "@/lib/snapshots";
import { MARKETS, isMarketId } from "@/lib/markets";
import { fmtPct } from "@/lib/format";
import Logo from "@/components/Logo";
import { Arrow } from "@/components/Icons";

/** One static page per market that has snapshots. */
export async function generateStaticParams() {
  const stored = await listStoredMarkets();
  return stored.map((market) => ({ market }));
}

type Props = { params: Promise<{ market: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { market } = await params;
  const label = isMarketId(market) ? MARKETS[market].label : market;
  return { title: `${label} archive` };
}

const prettyDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export default async function MarketArchive({ params }: Props) {
  const { market } = await params;
  if (!isMarketId(market)) notFound();

  const cfg = MARKETS[market];
  const days = await listSummaries(market);
  const stored = await listStoredMarkets();

  return (
    <main className="shell">
      <header className="page-head">
        <div>
          <div className="crumb">
            <Link href="/archive">Archive</Link> <span>/</span> {cfg.label}
          </div>
          <h1 className="page-title">{cfg.label}</h1>
          <p className="page-sub">
            Every captured trading day, newest first. Prices are quoted in{" "}
            {cfg.currency}; market caps are converted to USD.
          </p>
        </div>
        <div className="stats">
          <div className="stat">
            <div className="stat-label">Days stored</div>
            <div className="stat-value">{days.length}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Latest</div>
            <div className="stat-value">{days[0]?.date ?? "—"}</div>
          </div>
        </div>
      </header>

      <div className="market-tabs">
        {stored.map((m) => (
          <Link
            key={m}
            href={`/archive/${m}`}
            className={`market-tab${m === market ? " on" : ""}`}
          >
            <span className="market-code">{MARKETS[m].code}</span>
            {MARKETS[m].label}
          </Link>
        ))}
      </div>

      {days.length === 1 && (
        <div className="notice">
          Only one day is stored for {cfg.label} so far — the archive fills in
          one trading day at a time, and day-over-day movement appears once
          there are at least two.
        </div>
      )}

      <div className="day-grid">
        {days.map((d) => (
          <Link
            key={d.date}
            href={`/archive/${market}/${d.date}`}
            className="day-card"
          >
            <div className="day-card-top">
              <span className="day-date">{prettyDate(d.date)}</span>
              <Arrow />
            </div>
            <div className="day-stats">
              <span><b>{d.candidateCount.toLocaleString()}</b> passed</span>
              <span><b>{d.universeSize.toLocaleString()}</b> scanned</span>
              <span>top <b>{d.topScore?.toFixed(0) ?? "—"}</b></span>
            </div>
            <div className="day-leaders">
              {d.leaders.map((l) => (
                <span className="day-leader" key={l.name}>
                  <Logo logoid={l.logoid} name={l.name} size={18} />
                  <span className="day-leader-name">{l.name}</span>
                  <span className="day-leader-perf">{fmtPct(l.perf1M, 0)}</span>
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
