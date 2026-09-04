import Link from "next/link";
import type { Metadata } from "next";
import { listStoredMarkets, listSummaries } from "@/lib/snapshots";
import { MARKETS } from "@/lib/markets";
import { fmtPct } from "@/lib/format";
import Logo from "@/components/Logo";
import { Arrow } from "@/components/Icons";

export const metadata: Metadata = {
  title: "Archive",
  description: "Every daily momentum snapshot captured so far, by market.",
};

const prettyDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export default async function ArchiveIndex() {
  const stored = await listStoredMarkets();
  const perMarket = await Promise.all(
    stored.map(async (m) => ({ market: m, days: await listSummaries(m) })),
  );

  const totalDays = perMarket.reduce((n, m) => n + m.days.length, 0);

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
        {totalDays > 0 && (
          <div className="stats">
            <div className="stat">
              <div className="stat-label">Markets</div>
              <div className="stat-value">{perMarket.length}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Snapshots</div>
              <div className="stat-value">{totalDays}</div>
            </div>
          </div>
        )}
      </header>

      {totalDays === 0 ? (
        <div className="state">
          <div className="state-title">No snapshots yet</div>
          <div className="state-body">
            The daily job writes the first ones after the next market close. You
            can also capture them now with <code>npm run snapshot</code>.
          </div>
          <Link href="/screener" className="btn">Open the live screener</Link>
        </div>
      ) : (
        <div className="archive-markets">
          {perMarket.map(({ market, days }) => {
            const latest = days[0];
            return (
              <section className="archive-market" key={market}>
                <div className="archive-market-head">
                  <h2>
                    <span className="market-code">{MARKETS[market].code}</span>
                    {MARKETS[market].label}
                  </h2>
                  <Link href={`/archive/${market}`} className="btn btn-sm">
                    All {days.length} {days.length === 1 ? "day" : "days"} <Arrow />
                  </Link>
                </div>

                {latest && (
                  <Link
                    href={`/archive/${market}/${latest.date}`}
                    className="day-card"
                  >
                    <div className="day-card-top">
                      <span className="day-date">{prettyDate(latest.date)}</span>
                      <Arrow />
                    </div>
                    <div className="day-stats">
                      <span><b>{latest.candidateCount.toLocaleString()}</b> passed</span>
                      <span><b>{latest.universeSize.toLocaleString()}</b> scanned</span>
                      <span>top <b>{latest.topScore?.toFixed(0) ?? "—"}</b></span>
                    </div>
                    <div className="day-leaders">
                      {latest.leaders.map((l) => (
                        <span className="day-leader" key={l.name}>
                          <Logo logoid={l.logoid} name={l.name} size={18} />
                          <span className="day-leader-name">{l.name}</span>
                          <span className="day-leader-perf">{fmtPct(l.perf1M, 0)}</span>
                        </span>
                      ))}
                    </div>
                  </Link>
                )}
              </section>
            );
          })}
        </div>
      )}

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
