"use client";

import { useCallback, useEffect, useState } from "react";
import ScreenerTable from "@/components/ScreenerTable";
import Heatmap from "@/components/Heatmap";
import Methodology from "@/components/Methodology";
import { AlertIcon, EmptyIcon } from "@/components/Icons";
import type { ScreenerResponse } from "@/lib/types";

type Filters = {
  minMarketCap: number;
  maxPctFromHigh: number;
  minDollarVolume: number;
  requireUptrend: boolean;
};

const DEFAULTS: Filters = {
  minMarketCap: 1e9,
  maxPctFromHigh: 25,
  minDollarVolume: 1e7,
  requireUptrend: true,
};

/** One-click filter combinations for the common questions people actually ask. */
const PRESETS: { name: string; hint: string; filters: Filters }[] = [
  {
    name: "Balanced",
    hint: "A broad sweep of everything trending with real liquidity",
    filters: DEFAULTS,
  },
  {
    name: "Breaking out",
    hint: "Only names pressing right up against their 52-week high",
    filters: { ...DEFAULTS, maxPctFromHigh: 5 },
  },
  {
    name: "Large caps",
    hint: "$10B+ companies with heavy daily volume",
    filters: { ...DEFAULTS, minMarketCap: 1e10, minDollarVolume: 5e7 },
  },
  {
    name: "Wider net",
    hint: "Includes names still recovering, without the uptrend requirement",
    filters: { ...DEFAULTS, maxPctFromHigh: 50, requireUptrend: false },
  },
];

const CAP_OPTIONS = [
  { label: "$1B and up", value: 1e9 },
  { label: "$2B and up", value: 2e9 },
  { label: "$10B and up", value: 1e10 },
  { label: "$50B and up", value: 5e10 },
  { label: "$200B and up", value: 2e11 },
];

const HIGH_OPTIONS = [
  { label: "At the high (2%)", value: 2 },
  { label: "Very close (5%)", value: 5 },
  { label: "Close (10%)", value: 10 },
  { label: "Within 25%", value: 25 },
  { label: "Within 50%", value: 50 },
  { label: "Any distance", value: 100 },
];

const LIQ_OPTIONS = [
  { label: "$5M a day", value: 5e6 },
  { label: "$10M a day", value: 1e7 },
  { label: "$50M a day", value: 5e7 },
  { label: "$250M a day", value: 2.5e8 },
];

const LIMIT_OPTIONS = [25, 50, 100, 200];

const sameFilters = (a: Filters, b: Filters) =>
  a.minMarketCap === b.minMarketCap &&
  a.maxPctFromHigh === b.maxPctFromHigh &&
  a.minDollarVolume === b.minDollarVolume &&
  a.requireUptrend === b.requireUptrend;

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="stat" title={title}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export default function ScreenerPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const [limit, setLimit] = useState(50);

  const [view, setView] = useState<"table" | "heatmap">("table");
  const [data, setData] = useState<ScreenerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      minMarketCap: String(filters.minMarketCap),
      maxPctFromHigh: String(filters.maxPctFromHigh),
      minDollarVolume: String(filters.minDollarVolume),
      requireUptrend: String(filters.requireUptrend),
      limit: String(limit),
    });
    try {
      const res = await fetch(`/api/screener?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      setData(json as ScreenerResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const asOf = data
    ? new Date(data.meta.asOf).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

  return (
    <main className="shell">
      <header className="page-head">
        <div>
          <h1 className="page-title">Momentum screener</h1>
          <p className="page-sub">
            Every liquid US stock, scored on five factors and ranked against the
            whole market. Click any column to re-sort; hover the bars and tags
            for detail.
          </p>
        </div>
        <div className="stats">
          <Stat
            label="Scanned"
            value={data ? data.meta.universeSize.toLocaleString() : "—"}
            title="Liquid US common stocks scored on this run"
          />
          <Stat
            label="Passed"
            value={data ? data.meta.candidateCount.toLocaleString() : "—"}
            title="How many cleared every filter"
          />
          <Stat label="Showing" value={data ? String(data.meta.returned) : "—"} />
          <Stat label="Updated" value={asOf} />
        </div>
      </header>

      <div className="presets">
        <span className="presets-label">Quick views:</span>
        {PRESETS.map((p) => (
          <button
            key={p.name}
            title={p.hint}
            aria-label={`${p.name}: ${p.hint}`}
            className={`preset${sameFilters(filters, p.filters) ? " on" : ""}`}
            onClick={() => setFilters(p.filters)}
          >
            {p.name}
          </button>
        ))}
      </div>

      <section className="filters">
        <div className="field">
          <label className="field-label" htmlFor="cap">Company size</label>
          <select
            id="cap"
            className="select"
            value={filters.minMarketCap}
            onChange={(e) => set("minMarketCap", Number(e.target.value))}
          >
            {CAP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="high">Distance from 52-week high</label>
          <select
            id="high"
            className="select"
            value={filters.maxPctFromHigh}
            onChange={(e) => set("maxPctFromHigh", Number(e.target.value))}
          >
            {HIGH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="liq">Minimum trading volume</label>
          <select
            id="liq"
            className="select"
            value={filters.minDollarVolume}
            onChange={(e) => set("minDollarVolume", Number(e.target.value))}
          >
            {LIQ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="limit">Results</label>
          <select
            id="limit"
            className="select"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>Top {n}</option>
            ))}
          </select>
        </div>

        <label
          className="toggle"
          title="Only show stocks trading above their 50-day average, with the 50-day above the 200-day"
        >
          <input
            type="checkbox"
            checked={filters.requireUptrend}
            onChange={(e) => set("requireUptrend", e.target.checked)}
          />
          Uptrend intact
        </label>

        <div className="filters-spacer" />

        <div className="field">
          <span className="field-label">View</span>
          <div className="view-toggle">
            <button
              className={view === "table" ? "on" : ""}
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
            >
              Table
            </button>
            <button
              className={view === "heatmap" ? "on" : ""}
              onClick={() => setView("heatmap")}
              aria-pressed={view === "heatmap"}
            >
              Heatmap
            </button>
          </div>
        </div>

        <button className="btn btn-primary" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </section>

      <div className="legend-strip">
        <span className="legend-bit">
          <b>Score</b> 0–100, ranked against every stock scanned
        </span>
        <span className="legend-bit">
          <b>Streak</b>
          <span className="pips" aria-hidden>
            <span className="pip up" />
            <span className="pip up" />
            <span className="pip up" />
            <span className="pip down" />
          </span>
          three of the last four windows were up
        </span>
        <span className="legend-bit">
          <b>R.Vol</b> today&rsquo;s volume vs. its own average
        </span>
      </div>

      {error ? (
        <div className="state error">
          <AlertIcon />
          <div className="state-title">Couldn&rsquo;t load the data</div>
          <div className="state-body">{error}</div>
          <button className="btn" onClick={load}>Try again</button>
        </div>
      ) : loading && !data ? (
        <div className="table-wrap">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton-row" />
          ))}
        </div>
      ) : data && data.stocks.length === 0 ? (
        <div className="state">
          <EmptyIcon />
          <div className="state-title">Nothing clears these filters</div>
          <div className="state-body">
            Momentum is thin right now, or the filters are tight. Try allowing a
            larger distance from the 52-week high, or switching off
            &ldquo;Uptrend intact.&rdquo;
          </div>
          <button className="btn" onClick={() => setFilters(PRESETS[3].filters)}>
            Widen the search
          </button>
        </div>
      ) : data ? (
        view === "table" ? (
          <ScreenerTable stocks={data.stocks} />
        ) : (
          <Heatmap stocks={data.stocks} />
        )
      ) : null}

      <Methodology />

      <div className="footer">
        <span>
          Data from the TradingView screener, delayed. A research tool, not
          investment advice.
        </span>
        <span>Symbols link out to their TradingView chart.</span>
      </div>
    </main>
  );
}
