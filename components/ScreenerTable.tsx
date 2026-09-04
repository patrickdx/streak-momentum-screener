"use client";

import { useMemo, useState } from "react";
import type { ScoredStock } from "@/lib/types";
import { FLAG_CLASS, FLAG_HINT, FLAG_LABEL, fmtCap, fmtPct, fmtPrice, signClass } from "@/lib/format";
import { ExternalIcon } from "./Icons";
import Logo from "./Logo";
import { MARKETS } from "@/lib/markets";
import StockDetail from "./StockDetail";

type SortKey =
  | "score"
  | "legs"
  | "perfW"
  | "perf1M"
  | "perf3M"
  | "perf6M"
  | "pctFromHigh"
  | "rsi"
  | "relVolume"
  | "close"
  | "marketCap"
  | "name";

const COLUMNS: { key: SortKey | null; label: string; left?: boolean; title?: string }[] = [
  { key: null, label: "#", left: true },
  { key: "name", label: "Symbol", left: true, title: "Sort alphabetically" },
  { key: "score", label: "Score", title: "Composite momentum score, 0-100, ranked against every stock scanned" },
  { key: "legs", label: "Streak", title: "How many of the four independent time windows were up" },
  { key: "perfW", label: "1W", title: "Return over the past week" },
  { key: "perf1M", label: "1M", title: "Return over the past month" },
  { key: "perf3M", label: "3M", title: "Return over the past three months" },
  { key: "perf6M", label: "6M", title: "Return over the past six months" },
  { key: "pctFromHigh", label: "vs 52W High", title: "How far below the 52-week high it is trading" },
  { key: "rsi", label: "RSI", title: "Relative Strength Index — above 70 is hot, above 80 is stretched" },
  { key: "relVolume", label: "R.Vol", title: "Today's volume versus its own 10-day average" },
  { key: "close", label: "Price" },
  { key: "marketCap", label: "Market cap", title: "Converted to USD so every market is on one scale" },
  { key: null, label: "Signals" },
];

function Score({ value }: { value: number }) {
  const tier = value >= 90 ? "elite" : value >= 75 ? "strong" : "solid";
  const label =
    tier === "elite"
      ? "Top-decile momentum across the whole market"
      : tier === "strong"
        ? "Strong momentum"
        : "Moderate momentum";
  return (
    <div className={`score-cell tier-${tier}`} title={`${value.toFixed(1)} / 100 — ${label}`}>
      <span className="score-num">{value.toFixed(0)}</span>
      <span className="score-track">
        <span className="score-fill" style={{ width: `${Math.max(3, value)}%` }} />
      </span>
    </div>
  );
}

function Streak({ returns }: { returns: (number | null)[] }) {
  const labels = ["Past week", "Weeks 2-4", "Months 2-3", "Months 4-6"];
  // Oldest window on the left so the bars read left-to-right as time passing.
  const ordered = [...returns].reverse();
  const orderedLabels = [...labels].reverse();
  const up = returns.filter((r) => r !== null && r > 0).length;
  const title = `${up} of 4 windows up\n\n${orderedLabels
    .map((l, i) => `${l}: ${fmtPct(ordered[i])}`)
    .join("\n")}`;
  return (
    <span className="pips" title={title}>
      {ordered.map((r, i) => (
        <span
          key={i}
          className={`pip${r === null ? "" : r > 0 ? " up" : " down"}`}
        />
      ))}
    </span>
  );
}

export type Movement = {
  ranks: Record<string, number>;
  scores: Record<string, number>;
};

/** Rank delta against the previous snapshot. Lower rank number = better. */
function Move({ ticker, index, movement }: { ticker: string; index: number; movement: Movement }) {
  const was = movement.ranks[ticker];
  if (was === undefined) {
    return <span className="move move-new" title="Not in the previous snapshot">NEW</span>;
  }
  const delta = was - (index + 1);
  if (delta === 0) return <span className="move move-flat" title="Unchanged">—</span>;
  return (
    <span
      className={`move ${delta > 0 ? "move-up" : "move-down"}`}
      title={`Was #${was}, now #${index + 1}`}
    >
      {delta > 0 ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}

export default function ScreenerTable({
  stocks,
  movement,
  showMarket = false,
  asOfDate,
}: {
  stocks: ScoredStock[];
  movement?: Movement;
  /** Adds a market column — only useful when several markets are merged. */
  showMarket?: boolean;
  /** Set on archive pages so the detail card can flag its data as historical. */
  asOfDate?: string;
}) {
  const [opened, setOpened] = useState<ScoredStock | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "score",
    dir: "desc",
  });

  const rows = useMemo(() => {
    const copy = [...stocks];
    copy.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      let cmp: number;
      if (typeof av === "string" || typeof bv === "string") {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      } else {
        // Nulls always sink, regardless of direction.
        const an = av as number | null;
        const bn = bv as number | null;
        if (an === null && bn === null) cmp = 0;
        else if (an === null) return 1;
        else if (bn === null) return -1;
        else cmp = an - bn;
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [stocks, sort]);

  // The movement column only exists on archive pages, where a previous
  // snapshot is available to compare against.
  const columns = [
    COLUMNS[0],
    COLUMNS[1],
    ...(showMarket
      ? [{ key: null, label: "Market", title: "Listing market. Stocks are ranked within their own market." }]
      : []),
    ...(movement
      ? [{ key: null, label: "Move", title: "Change in rank since the previous snapshot" }]
      : []),
    ...COLUMNS.slice(2),
  ] as typeof COLUMNS;

  const toggle = (key: SortKey | null) => {
    if (!key) return;
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "desc" ? "asc" : "desc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );
  };

  return (
    <>
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.label}
                title={c.title}
                className={[
                  c.left ? "left" : "",
                  c.key ? "sortable" : "",
                  sort.key === c.key ? "sorted" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => toggle(c.key)}
              >
                {c.label}
                {sort.key === c.key && (
                  <span className="sort-arrow">{sort.dir === "desc" ? "↓" : "↑"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <tr
              key={s.ticker}
              className="row-click"
              tabIndex={0}
              role="button"
              aria-label={`Open details for ${s.name}`}
              onClick={() => setOpened(s)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpened(s);
                }
              }}
            >
              <td className="left rank">{i + 1}</td>
              <td className="left">
                <div className="sym-cell">
                  <Logo logoid={s.logoid} name={s.name} />
                  <div className="sym-text">
                <a
                  className="sym"
                  href={`https://www.tradingview.com/symbols/${s.ticker.replace(":", "-")}/`}
                  target="_blank"
                  rel="noreferrer"
                  title={`Open ${s.name} on TradingView`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {s.name}
                  <ExternalIcon />
                </a>
                <div className="co">{s.description}</div>
                  </div>
                </div>
              </td>
              {showMarket && (
                <td>
                  <span className="mkt-tag" title={MARKETS[s.market].label}>
                    {MARKETS[s.market].code}
                  </span>
                </td>
              )}
              {movement && (
                <td>
                  <Move ticker={s.ticker} index={i} movement={movement} />
                </td>
              )}
              <td>
                <Score value={s.score} />
              </td>
              <td>
                <Streak returns={s.legReturns} />
              </td>
              <td className={signClass(s.perfW)}>{fmtPct(s.perfW)}</td>
              <td className={signClass(s.perf1M)}>{fmtPct(s.perf1M)}</td>
              <td className={signClass(s.perf3M)}>{fmtPct(s.perf3M)}</td>
              <td className={signClass(s.perf6M)}>{fmtPct(s.perf6M)}</td>
              <td className="muted">{fmtPct(s.pctFromHigh)}</td>
              <td className="muted">{s.rsi === null ? "—" : s.rsi.toFixed(0)}</td>
              <td className="muted">
                {s.relVolume === null ? "—" : `${s.relVolume.toFixed(1)}x`}
              </td>
              <td
                title={
                  s.currency === "USD"
                    ? undefined
                    : `${fmtPrice(s.close)} ${s.currency} ≈ $${fmtPrice(s.closeUsd)}`
                }
              >
                {fmtPrice(s.close)}
                {s.currency !== "USD" && <span className="cur">{s.currency}</span>}
              </td>
              <td className="muted">{fmtCap(s.marketCap)}</td>
              <td>
                <div className="chips">
                  {s.flags.map((f) => (
                    <span
                      key={f}
                      title={FLAG_HINT[f]}
                      className={`chip ${FLAG_CLASS[f]}`}
                    >
                      {FLAG_LABEL[f]}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {opened && (
      <StockDetail
        stock={opened}
        asOfDate={asOfDate}
        onClose={() => setOpened(null)}
      />
    )}
    </>
  );
}
