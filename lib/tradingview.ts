import type { RawQuote } from "./types";
import { MARKETS, type MarketId } from "./markets";
import { fetchFxRates } from "./fx";

const scanUrl = (scannerId: string) =>
  `https://scanner.tradingview.com/${scannerId}/scan?label-product=screener-stock`;

/**
 * Column order matters — TradingView returns a positional array per row.
 * Keep this list in sync with `parseRow` below.
 */
const COLUMNS = [
  "name",
  "description",
  "logoid",
  "exchange",
  "sector",
  "industry",
  "close",
  "change",
  "market_cap_basic",
  "Perf.W",
  "Perf.1M",
  "Perf.3M",
  "Perf.6M",
  "Perf.Y",
  "Perf.YTD",
  "SMA20",
  "SMA50",
  "SMA200",
  "RSI",
  "relative_volume_10d_calc",
  "average_volume_10d_calc",
  "average_volume_30d_calc",
  "Value.Traded",
  "Volatility.M",
  "price_52_week_high",
  "price_52_week_low",
  "currency",
] as const;

const PAGE_SIZE = 1000;
const MAX_PAGES = 4;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * @param fx units of the row's local currency per 1 USD (1 for US rows).
 */
function parseRow(
  market: MarketId,
  ticker: string,
  d: unknown[],
  fx: number,
): RawQuote | null {
  const close = num(d[6]);
  const marketCapLocal = num(d[8]);
  if (close === null || marketCapLocal === null || fx <= 0) return null;

  const avgVol30d = num(d[21]);

  return {
    market,
    ticker,
    name: String(d[0] ?? ""),
    description: String(d[1] ?? ""),
    logoid: (d[2] as string) || null,
    exchange: String(d[3] ?? ""),
    sector: (d[4] as string) ?? null,
    industry: (d[5] as string) ?? null,
    close,
    closeUsd: close / fx,
    currency: String(d[26] ?? MARKETS[market].currency),
    change: num(d[7]) ?? 0,
    marketCap: marketCapLocal / fx,
    dollarVolume: ((avgVol30d ?? 0) * close) / fx,
    perfW: num(d[9]),
    perf1M: num(d[10]),
    perf3M: num(d[11]),
    perf6M: num(d[12]),
    perfY: num(d[13]),
    perfYTD: num(d[14]),
    sma20: num(d[15]),
    sma50: num(d[16]),
    sma200: num(d[17]),
    rsi: num(d[18]),
    relVolume: num(d[19]),
    avgVol10d: num(d[20]),
    avgVol30d,
    valueTraded: num(d[22]),
    volatilityM: num(d[23]),
    high52: num(d[24]),
    low52: num(d[25]),
  };
}

export type UniverseParams = {
  markets: MarketId[];
  minMarketCap: number;
  minPrice: number;
  minDollarVolume: number;
};

export type MarketUniverse = {
  market: MarketId;
  quotes: RawQuote[];
};

async function fetchMarket(
  market: MarketId,
  fx: number,
  p: UniverseParams,
): Promise<RawQuote[]> {
  const cfg = MARKETS[market];

  // Thresholds arrive in USD and the API filters in local currency, so they
  // are converted on the way in rather than fetching everything and trimming
  // afterwards.
  const filter: Record<string, unknown>[] = [
    { left: "market_cap_basic", operation: "egreater", right: p.minMarketCap * fx },
    { left: "close", operation: "egreater", right: p.minPrice * fx },
    { left: "is_primary", operation: "equal", right: true },
    { left: "typespecs", operation: "has", right: ["common"] },
    // One currency per market: China's board also lists USD/HKD B-shares,
    // which would otherwise be converted with the wrong rate.
    { left: "currency", operation: "equal", right: cfg.currency },
  ];

  if (cfg.exchanges) {
    filter.push({ left: "exchange", operation: "in_range", right: cfg.exchanges });
  }

  // Note there is deliberately no average-share-volume filter. A fixed share
  // count means completely different things across markets — 200k shares is
  // trivial for a Y3,000 Tokyo listing and ~$150M/day for a W1.6M Seoul one,
  // which cut Korea's universe by 40%. Liquidity is gated on USD turnover
  // below instead, which is price- and currency-neutral.

  const rows: RawQuote[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const start = page * PAGE_SIZE;
    const body = {
      filter,
      options: { lang: "en" },
      markets: [cfg.scannerId],
      columns: COLUMNS,
      sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
      range: [start, start + PAGE_SIZE],
    };

    const res = await fetch(scanUrl(cfg.scannerId), {
      method: "POST",
      // text/plain is deliberate. TradingView answers with
      // `Access-Control-Allow-Headers: Referer,Accept`, so a browser POST
      // carrying `Content-Type: application/json` triggers a preflight that
      // fails. text/plain is a CORS-safelisted value, which makes this a
      // "simple request" with no preflight at all — and the server parses the
      // body as JSON regardless. That is what lets this run straight from the
      // browser with no proxy, and therefore what makes a static build viable.
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(
        `TradingView responded ${res.status} ${res.statusText} for ${cfg.label}`,
      );
    }

    const json = (await res.json()) as {
      totalCount: number;
      data?: { s: string; d: unknown[] }[];
    };

    const batch = json.data ?? [];
    for (const r of batch) {
      const parsed = parseRow(market, r.s, r.d, fx);
      if (parsed) rows.push(parsed);
    }

    if (batch.length < PAGE_SIZE || rows.length >= json.totalCount) break;
  }

  // Liquidity gate, in USD. Uses the 30-day average rather than TradingView's
  // Value.Traded, which is a single session and would evict a perfectly liquid
  // name after one quiet day.
  return rows.filter((q) => q.dollarVolume >= p.minDollarVolume);
}

/**
 * Fetches each requested market's full liquid universe. Scoring is
 * cross-sectional, and the ranking is done *per market* by the caller — a
 * Tokyo name's relative strength is only meaningful against other Tokyo names,
 * since the two markets can be in entirely different regimes.
 */
export async function fetchUniverse(
  p: UniverseParams,
): Promise<{ universes: MarketUniverse[]; fxRates: Record<string, number> }> {
  const fxRates = await fetchFxRates(p.markets);

  const universes = await Promise.all(
    p.markets.map(async (market) => ({
      market,
      quotes: await fetchMarket(market, fxRates[MARKETS[market].currency] ?? 1, p),
    })),
  );

  return { universes, fxRates };
}
