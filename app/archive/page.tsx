import Link from "next/link";
import type { Metadata } from "next";
import { listStoredMarkets, listSummaries } from "@/lib/snapshots";
import { MARKETS, isMarketId, type MarketId } from "@/lib/markets";
import { fmtPct } from "@/lib/format";
import Logo from "@/components/Logo";
import { Arrow } from "@/components/Icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Archive",
  description: "Every daily momentum snapshot captured so far, by market.",
};

const prettyDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string }>;
}) {
  const { market: raw } = await searchParams;
  const stored = await listStoredMarkets();

  if (stored.length === 0) {
    return (
      <main className="shell">
        <header className="page-head">
          <div>
            <h1 className="page-title">Archive</h1>
            <p className="page-sub">
              Each market&rsquo;s screen is captured automatically after its
              close and committed to the repo.
            </p>
          </div>
        </header>
        <div className="state">
          <div className="state-title">No snapshots yet</div>
          <div className="state-body">
            The daily job writes the first ones after the next market close. You
            can also capture them right now with <code>npm run snapshot</code>.
          </div>
          <Link href="/screener" className="btn">Open the live screener</Link>
        </div>
      </main>
    );
  }

  const selected: MarketId =
    raw && isMarketId(raw) && stored.includes(raw) ? raw : stored[0];
  const days = await listSummaries(selected);

  return (
    <main className="shell">
      <header className="page-head">
        <div>
          <h1 className="page-title">Archive</h1>
          <p className="page-sub">
            Each market&rsquo;s screen is captured after its own close, using
            identical filters every day, so any two days are directly
            comparable. Stocks are always ranked within their own market.
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
            href={`/archive?market=${m}`}
            className={`market-tab${m === selected ? " on" : ""}`}
          >
            <span className="market-code">{MARKETS[m].code}</span>
            {MARKETS[m].label}
          </Link>
        ))}
      </div>

      {days.length === 1 && (
        <div className="notice">
          Only one day is stored for {MARKETS[selected].label} so far — the
          archive fills in one trading day at a time, and day-over-day movement
          appears once there are at least two.
        </div>
      )}

      <div className="day-grid">
        {days.map((d) => (
          <Link
            key={d.date}
            href={`/archive/${selected}/${d.date}`}
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

      <div className="footer">
        <span>
          Snapshots are plain JSON under{" "}
          <code>data/snapshots/&lt;market&gt;/</code> in the repository —
          readable without this app.
        </span>
      </div>
    </main>
  );
}
