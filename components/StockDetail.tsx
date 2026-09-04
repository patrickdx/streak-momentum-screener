"use client";

import { useEffect, useState } from "react";
import Logo from "./Logo";
import TradingViewChart from "./TradingViewChart";
import { ExternalIcon } from "./Icons";
import { breakoutLadder, fetchDetail } from "@/lib/detail";
import { fetchHistory } from "@/lib/history";
import { MARKETS } from "@/lib/markets";
import { WEIGHTS } from "@/lib/momentum";
import { FLAG_CLASS, FLAG_HINT, FLAG_LABEL, fmtCap, fmtPct, fmtPrice } from "@/lib/format";
import type { HistoryPoint, ScoredStock, StockDetail as Detail } from "@/lib/types";

const COMPONENTS = [
  ["Relative strength", "relativeStrength", WEIGHTS.relativeStrength],
  ["Risk-adjusted", "riskAdjusted", WEIGHTS.riskAdjusted],
  ["Streak consistency", "consistency", WEIGHTS.consistency],
  ["Trend structure", "trendStructure", WEIGHTS.trendStructure],
  ["Volume thrust", "volumeThrust", WEIGHTS.volumeThrust],
] as const;

/** Labels for the four non-overlapping windows, oldest first. */
const WINDOWS = [
  { label: "Months 4–6", span: "~90 days" },
  { label: "Months 2–3", span: "~60 days" },
  { label: "Weeks 2–4", span: "~23 days" },
  { label: "Past week", span: "7 days" },
];

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="kv" title={hint}>
      <span className="kv-label">{label}</span>
      <span className="kv-value">{value}</span>
    </div>
  );
}

/** Analyst consensus arrives as -1..1; turn it into words. */
function ratingLabel(v: number | null): string {
  if (v === null) return "—";
  if (v >= 0.5) return "Strong buy";
  if (v >= 0.1) return "Buy";
  if (v > -0.1) return "Neutral";
  if (v > -0.5) return "Sell";
  return "Strong sell";
}

export default function StockDetail({
  stock,
  onClose,
  asOfDate,
}: {
  stock: ScoredStock;
  onClose: () => void;
  /** Set on archive pages, where the row data is historical. */
  asOfDate?: string;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);

  const cfg = MARKETS[stock.market];
  const tvUrl = `https://www.tradingview.com/symbols/${stock.ticker.replace(":", "-")}/`;

  // Close on Escape, and stop the page behind from scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    let live = true;
    setDetail(null);
    setDetailError(null);
    setHistory(null);

    fetchDetail(stock.market, stock.ticker)
      .then((d) => live && setDetail(d))
      .catch((e) => live && setDetailError(e instanceof Error ? e.message : "Lookup failed"));

    fetchHistory(stock.market, stock.ticker)
      .then((h) => live && setHistory(h))
      .catch(() => live && setHistory([]));

    return () => {
      live = false;
    };
  }, [stock.market, stock.ticker]);

  const ladder = breakoutLadder(stock, detail);

  // Where the price sits in its 52-week range, as a percentage.
  const rangePos =
    stock.high52 !== null && stock.low52 !== null && stock.high52 > stock.low52
      ? ((stock.close - stock.low52) / (stock.high52 - stock.low52)) * 100
      : null;

  const mas: [string, number | null][] = [
    ["20-day", stock.sma20],
    ["50-day", stock.sma50],
    ["200-day", stock.sma200],
  ];

  const breakoutDays = (history ?? []).filter((h) => h.flags.includes("NEW_HIGH"));

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${stock.name} detail`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="sheet-close" onClick={onClose} aria-label="Close">×</button>

        <header className="sheet-head">
          <Logo logoid={stock.logoid} name={stock.name} size={40} />
          <div className="sheet-title">
            <div className="sheet-name">
              <a href={tvUrl} target="_blank" rel="noreferrer">
                {stock.name} <ExternalIcon />
              </a>
              <span className="mkt-tag">{cfg.code}</span>
            </div>
            <div className="sheet-sub">{stock.description}</div>
            <div className="sheet-meta">
              {stock.sector ?? "—"}
              {stock.industry ? ` · ${stock.industry}` : ""}
            </div>
          </div>
          <div className="sheet-price">
            <div className="sheet-price-main">
              {fmtPrice(stock.close)}
              <span className="cur">{stock.currency}</span>
            </div>
            <div className={`sheet-price-chg ${stock.change > 0 ? "pos" : stock.change < 0 ? "neg" : ""}`}>
              {fmtPct(stock.change)} today
            </div>
            <div className="sheet-cap">${fmtCap(stock.marketCap)} cap</div>
          </div>
        </header>

        {asOfDate && (
          <div className="sheet-asof">
            Momentum figures are from the <strong>{asOfDate}</strong> snapshot.
            Fundamentals and the chart below are live.
          </div>
        )}

        <div className="sheet-body">
          {/* ---- score ---- */}
          <section className="sheet-section">
            <h3>Momentum score</h3>
            <div className="score-hero">
              <div className="score-hero-num">{stock.score.toFixed(1)}</div>
              <div className="score-hero-label">
                out of 100
                <span>ranked against every liquid {cfg.label} stock</span>
              </div>
            </div>
            <div className="breakdown">
              {COMPONENTS.map(([label, key, weight]) => (
                <div className="breakdown-row" key={key}>
                  <span className="breakdown-label">
                    {label} <span className="breakdown-weight">{(weight * 100).toFixed(0)}%</span>
                  </span>
                  <span className="breakdown-bar">
                    <span
                      className="breakdown-fill"
                      style={{ width: `${Math.max(2, stock.breakdown[key])}%` }}
                    />
                  </span>
                  <span className="breakdown-val">{stock.breakdown[key].toFixed(0)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ---- streak ---- */}
          <section className="sheet-section">
            <h3>Streak — {stock.legs} of 4 windows up</h3>
            <p className="sheet-note">
              The last six months split into four non-overlapping windows, so one
              strong week can&rsquo;t inflate every number at once.
            </p>
            <div className="windows">
              {[...stock.legReturns].reverse().map((r, i) => (
                <div
                  key={i}
                  className={`window-cell ${r === null ? "flat" : r > 0 ? "up" : "down"}`}
                >
                  <div className="window-label">{WINDOWS[i].label}</div>
                  <div className="window-val">{fmtPct(r)}</div>
                  <div className="window-span">{WINDOWS[i].span}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ---- breakout ladder ---- */}
          <section className="sheet-section">
            <h3>Breakout ladder</h3>
            <p className="sheet-note">
              Whether today&rsquo;s price is at the top of each window&rsquo;s range.
              Clearing longer windows in sequence is what a real breakout looks
              like — clearing only the shortest is a bounce.
              {asOfDate && " Computed from live prices, not the snapshot."}
            </p>
            <div className="ladder">
              {ladder.map((rung) => (
                <div key={rung.label} className={`rung${rung.atHigh ? " on" : ""}`}>
                  <span className="rung-dot" />
                  <span className="rung-label">{rung.label}</span>
                  <span className="rung-val">
                    {rung.high === null
                      ? detailError
                        ? "unavailable"
                        : "…"
                      : rung.atHigh
                        ? "at the high"
                        : `${fmtPct(rung.pctBelow)} below`}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ---- levels ---- */}
          <section className="sheet-section">
            <h3>Where it sits</h3>
            {rangePos !== null && (
              <div className="range">
                <div className="range-track">
                  <div className="range-fill" style={{ width: `${rangePos}%` }} />
                  <div className="range-marker" style={{ left: `${rangePos}%` }} />
                </div>
                <div className="range-ends">
                  <span>{fmtPrice(stock.low52)} 52w low</span>
                  <span>{rangePos.toFixed(0)}% of range</span>
                  <span>52w high {fmtPrice(stock.high52)}</span>
                </div>
              </div>
            )}
            <div className="ma-ladder">
              {mas.map(([label, value]) => {
                const above = value !== null && stock.close > value;
                const dist = value !== null && value > 0
                  ? ((stock.close - value) / value) * 100
                  : null;
                return (
                  <div key={label} className={`ma ${above ? "above" : "below"}`}>
                    <span className="ma-label">{label} MA</span>
                    <span className="ma-val">{fmtPrice(value)}</span>
                    <span className="ma-dist">{above ? "above" : "below"} {fmtPct(dist)}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ---- signals ---- */}
          {stock.flags.length > 0 && (
            <section className="sheet-section">
              <h3>Signals</h3>
              <div className="sheet-signals">
                {stock.flags.map((f) => (
                  <div key={f} className="sheet-signal">
                    <span className={`chip ${FLAG_CLASS[f]}`}>{FLAG_LABEL[f]}</span>
                    <span className="sheet-signal-text">{FLAG_HINT[f]}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---- chart ---- */}
          <section className="sheet-section">
            <TradingViewChart symbol={stock.ticker} />
          </section>

          {/* ---- archive history ---- */}
          <section className="sheet-section">
            <h3>In the archive</h3>
            {history === null ? (
              <p className="sheet-note">Loading history…</p>
            ) : history.length === 0 ? (
              <p className="sheet-note">
                This name hasn&rsquo;t appeared in a stored snapshot yet. The
                archive fills in one trading day at a time.
              </p>
            ) : (
              <>
                <p className="sheet-note">
                  Appeared in <strong>{history.length}</strong>{" "}
                  {history.length === 1 ? "snapshot" : "snapshots"}
                  {breakoutDays.length > 0 && (
                    <>
                      {" "}· flagged at a 52-week high on{" "}
                      <strong>{breakoutDays.map((d) => d.date).join(", ")}</strong>
                    </>
                  )}
                  .
                </p>
                <div className="hist">
                  {history.map((h) => (
                    <div className="hist-row" key={h.date}>
                      <span className="hist-date">{h.date}</span>
                      <span className="hist-rank">#{h.rank}</span>
                      <span className="hist-bar">
                        <span className="hist-fill" style={{ width: `${h.score}%` }} />
                      </span>
                      <span className="hist-score">{h.score.toFixed(0)}</span>
                      <span className="hist-flags">
                        {h.flags.map((f) => (
                          <span key={f} className={`chip ${FLAG_CLASS[f]}`}>
                            {FLAG_LABEL[f]}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* ---- fundamentals ---- */}
          <section className="sheet-section">
            <h3>Fundamentals &amp; technicals</h3>
            {detailError ? (
              <p className="sheet-note">Couldn&rsquo;t load: {detailError}</p>
            ) : !detail ? (
              <p className="sheet-note">Loading…</p>
            ) : (
              <div className="kv-grid">
                <Row label="P/E (TTM)" value={detail.peRatio?.toFixed(1) ?? "—"} />
                <Row label="EPS (TTM)" value={detail.eps?.toFixed(2) ?? "—"} />
                <Row label="Revenue" value={detail.revenue ? `$${fmtCap(detail.revenue)}` : "—"} />
                <Row label="Employees" value={detail.employees?.toLocaleString() ?? "—"} />
                <Row label="Analyst view" value={ratingLabel(detail.recommendation)} hint="TradingView's aggregated analyst consensus" />
                <Row label="Beta (1y)" value={detail.beta?.toFixed(2) ?? "—"} />
                <Row label="1-year" value={fmtPct(detail.perfY)} />
                <Row label="5-year" value={fmtPct(detail.perf5Y)} />
                <Row label="RSI (14)" value={stock.rsi?.toFixed(1) ?? "—"} />
                <Row label="ADX" value={detail.adx?.toFixed(1) ?? "—"} hint="Trend strength; above 25 is a strong trend" />
                <Row label="Stochastic %K" value={detail.stochK?.toFixed(1) ?? "—"} />
                <Row label="Monthly volatility" value={stock.volatilityM ? `${stock.volatilityM.toFixed(1)}%` : "—"} />
                <Row label="Rel. volume" value={stock.relVolume ? `${stock.relVolume.toFixed(2)}x` : "—"} />
                <Row
                  label="Avg $ volume"
                  value={stock.dollarVolume ? `$${fmtCap(stock.dollarVolume)}` : "—"}
                  hint="30-day average, converted to USD"
                />
                <Row
                  label="Next earnings"
                  value={
                    detail.nextEarnings
                      ? new Date(detail.nextEarnings * 1000).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        })
                      : "—"
                  }
                />
                <Row label="Listed in" value={detail.country ?? cfg.label} />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
