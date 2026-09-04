"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScreenerTable from "@/components/ScreenerTable";
import Heatmap from "@/components/Heatmap";
import StockDetail from "@/components/StockDetail";
import Methodology from "@/components/Methodology";
import { AlertIcon, EmptyIcon } from "@/components/Icons";
import { ALL_MARKETS, MARKET_IDS, MARKETS, type MarketId } from "@/lib/markets";
import { refine, runScreen } from "@/lib/screen";
import SectorFilter from "@/components/SectorFilter";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from "@/lib/prefs";
import { DEFAULT_REFINEMENTS } from "@/lib/types";
import type {
  Refinements,
  ScoredStock,
  ScreenerResponse,
  SortField,
} from "@/lib/types";

type MarketChoice = MarketId | "all";

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

const SORT_OPTIONS: { label: string; value: SortField }[] = [
  { label: "Momentum score", value: "score" },
  { label: "1-week return", value: "perfW" },
  { label: "1-month return", value: "perf1M" },
  { label: "3-month return", value: "perf3M" },
  { label: "6-month return", value: "perf6M" },
  { label: "Relative volume", value: "relVolume" },
  { label: "Market cap", value: "marketCap" },
  { label: "Closest to 52w high", value: "pctFromHigh" },
];

const SCORE_STEPS = [0, 70, 80, 85, 90];
const RSI_STEPS = [100, 80, 70, 60];
const RVOL_STEPS = [0, 1, 1.5, 2, 3];


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
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  /** Preferences live in localStorage, which only exists after mount. */
  const [hydrated, setHydrated] = useState(false);

  const filters: Filters = {
    minMarketCap: prefs.minMarketCap,
    maxPctFromHigh: prefs.maxPctFromHigh,
    minDollarVolume: prefs.minDollarVolume,
    requireUptrend: prefs.requireUptrend,
  };
  const { limit, view, market, refinements } = prefs;

  const patch = (next: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...next }));
  const setRefine = (next: Partial<Refinements>) =>
    setPrefs((p) => ({ ...p, refinements: { ...p.refinements, ...next } }));
  const setFilters = (next: Filters | ((f: Filters) => Filters)) =>
    setPrefs((p) => ({
      ...p,
      ...(typeof next === "function"
        ? next({
            minMarketCap: p.minMarketCap,
            maxPctFromHigh: p.maxPctFromHigh,
            minDollarVolume: p.minDollarVolume,
            requireUptrend: p.requireUptrend,
          })
        : next),
    }));

  const [data, setData] = useState<ScreenerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Guards against out-of-order responses when filters change quickly. */
  const runId = useRef(0);
  const [picked, setPicked] = useState<ScoredStock | null>(null);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    setPrefs(loadPrefs());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) savePrefs(prefs);
  }, [prefs, hydrated]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Fetched and scored in the browser: TradingView answers CORS-simple
    // requests, so there is no server to route through and the whole app can
    // ship as static files.
    const run = ++runId.current;
    try {
      const result = await runScreen({
        ...filters,
        minPrice: 5,
        markets: market === "all" ? [...MARKET_IDS] : [market],
      });
      // A slower earlier run must not overwrite a newer one.
      if (run !== runId.current) return;
      setData(result);
    } catch (e) {
      if (run !== runId.current) return;
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong reaching the market data",
      );
      setData(null);
    } finally {
      if (run === runId.current) setLoading(false);
    }
    // Refinements are applied below, not here: they are a pure function of
    // this result, so moving a slider must not re-sweep four markets.
  }, [
    filters.minMarketCap,
    filters.maxPctFromHigh,
    filters.minDollarVolume,
    filters.requireUptrend,
    market,
  ]);

  useEffect(() => {
    if (hydrated) load();
  }, [load, hydrated]);

  /** Refined and ordered client-side, instantly. */
  const shown = useMemo(
    () => (data ? refine(data.stocks, refinements).slice(0, limit) : []),
    [data, refinements, limit],
  );
  const matched = useMemo(
    () => (data ? refine(data.stocks, refinements).length : 0),
    [data, refinements],
  );

  const refineActive =
    JSON.stringify(refinements) !== JSON.stringify(DEFAULT_REFINEMENTS);

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
            Every liquid stock in the selected market, scored on five factors
            and ranked against that market. Market caps and liquidity are
            converted to USD; prices stay in local currency.
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
            title="Cleared the momentum gates"
          />
          <Stat
            label="Matched"
            value={data ? matched.toLocaleString() : "—"}
            title="Also survived the refinements below"
          />
          <Stat label="Showing" value={data ? String(shown.length) : "—"} />
          <Stat label="Updated" value={asOf} />
        </div>
      </header>

      <div className="market-tabs">
        {ALL_MARKETS.map((m) => (
          <button
            key={m.id}
            className={`market-tab${market === m.id ? " on" : ""}`}
            onClick={() => patch({ market: m.id })}
            aria-pressed={market === m.id}
          >
            <span className="market-code">{m.code}</span>
            {m.label}
          </button>
        ))}
        <button
          className={`market-tab${market === "all" ? " on" : ""}`}
          onClick={() => patch({ market: "all" })}
          aria-pressed={market === "all"}
          title="Every market at once. Each stock is still ranked against its own market, never pooled."
        >
          <span className="market-code">ALL</span>
          All markets
        </button>
      </div>

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
            onChange={(e) => patch({ limit: Number(e.target.value) })}
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
              onClick={() => patch({ view: "table" })}
              aria-pressed={view === "table"}
            >
              Table
            </button>
            <button
              className={view === "heatmap" ? "on" : ""}
              onClick={() => patch({ view: "heatmap" })}
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


      <section className="refine-bar">
        <div className="field">
          <label className="field-label" htmlFor="sortby">Sort by</label>
          <select
            id="sortby"
            className="select"
            value={refinements.sortBy}
            onChange={(e) => setRefine({ sortBy: e.target.value as SortField })}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="field-label">Sector</span>
          <SectorFilter
            available={data?.meta.sectors ?? []}
            selected={refinements.sectors}
            onChange={(sectors) => setRefine({ sectors })}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="minscore">Minimum score</label>
          <select
            id="minscore"
            className="select"
            value={refinements.minScore}
            onChange={(e) => setRefine({ minScore: Number(e.target.value) })}
          >
            {SCORE_STEPS.map((n) => (
              <option key={n} value={n}>{n === 0 ? "Any" : `${n}+`}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="minlegs">Streak windows up</label>
          <select
            id="minlegs"
            className="select"
            value={refinements.minLegs}
            onChange={(e) => setRefine({ minLegs: Number(e.target.value) })}
          >
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n === 0 ? "Any" : `${n} of 4+`}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="maxrsi">RSI below</label>
          <select
            id="maxrsi"
            className="select"
            value={refinements.maxRsi}
            onChange={(e) => setRefine({ maxRsi: Number(e.target.value) })}
          >
            {RSI_STEPS.map((n) => (
              <option key={n} value={n}>{n === 100 ? "Any" : n}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="minrvol">Rel. volume</label>
          <select
            id="minrvol"
            className="select"
            value={refinements.minRelVolume}
            onChange={(e) => setRefine({ minRelVolume: Number(e.target.value) })}
          >
            {RVOL_STEPS.map((n) => (
              <option key={n} value={n}>{n === 0 ? "Any" : `${n}x+`}</option>
            ))}
          </select>
        </div>

        <label className="toggle" title="Hide names that are stretched far above their 20-day average or with RSI over 80">
          <input
            type="checkbox"
            checked={refinements.excludeExtended}
            onChange={(e) => setRefine({ excludeExtended: e.target.checked })}
          />
          Hide extended
        </label>

        <label className="toggle" title="Only names within 2% of their 52-week high">
          <input
            type="checkbox"
            checked={refinements.onlyNewHighs}
            onChange={(e) => setRefine({ onlyNewHighs: e.target.checked })}
          />
          At 52w highs only
        </label>

        <div className="filters-spacer" />

        {refineActive && (
          <button
            className="btn btn-sm"
            onClick={() => setPrefs((p) => ({ ...p, refinements: DEFAULT_REFINEMENTS }))}
          >
            Clear refinements
          </button>
        )}
      </section>

      {data && data.meta.perMarket.length > 1 && (
        <div className="legend-strip market-counts">
          {data.meta.perMarket.map((m) => (
            <span className="market-count" key={m.market}>
              <b>{MARKETS[m.market].code}</b> {m.candidateCount} of{" "}
              {m.universeSize.toLocaleString()} passed
            </span>
          ))}
        </div>
      )}

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
      ) : data && shown.length === 0 ? (
        <div className="state">
          <EmptyIcon />
          <div className="state-title">Nothing clears these filters</div>
          <div className="state-body">
            {refineActive ? (
              <>
                {data.meta.candidateCount.toLocaleString()} names cleared the
                momentum gates, but none survived the refinements. Try relaxing
                the sector, score or RSI settings.
              </>
            ) : (
              <>
                Momentum is thin right now, or the filters are tight. Try
                allowing a larger distance from the 52-week high, or switching
                off &ldquo;Uptrend intact.&rdquo;
              </>
            )}
          </div>
          <button
            className="btn"
            onClick={() =>
              refineActive
                ? setPrefs((p) => ({ ...p, refinements: DEFAULT_REFINEMENTS }))
                : setFilters(PRESETS[3].filters)
            }
          >
            {refineActive ? "Clear refinements" : "Widen the search"}
          </button>
        </div>
      ) : data ? (
        view === "table" ? (
          <ScreenerTable stocks={shown} showMarket={market === "all"} />
        ) : (
          <Heatmap
            stocks={shown}
            groupBy={market === "all" ? "market" : "sector"}
            onSelect={setPicked}
          />
        )
      ) : null}

      {picked && (
        <StockDetail stock={picked} onClose={() => setPicked(null)} />
      )}

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
