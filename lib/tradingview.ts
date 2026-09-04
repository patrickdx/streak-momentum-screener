import type { RawQuote } from "./types";

const SCAN_URL = "https://scanner.tradingview.com/america/scan?label-product=screener-stock";

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
] as const;

const PAGE_SIZE = 1000;
const MAX_PAGES = 4;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function parseRow(ticker: string, d: unknown[]): RawQuote | null {
  const close = num(d[6]);
  const marketCap = num(d[8]);
  if (close === null || marketCap === null) return null;

  return {
    ticker,
    name: String(d[0] ?? ""),
    description: String(d[1] ?? ""),
    logoid: (d[2] as string) || null,
    exchange: String(d[3] ?? ""),
    sector: (d[4] as string) ?? null,
    industry: (d[5] as string) ?? null,
    close,
    change: num(d[7]) ?? 0,
    marketCap,
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
    avgVol30d: num(d[21]),
    valueTraded: num(d[22]),
    volatilityM: num(d[23]),
    high52: num(d[24]),
    low52: num(d[25]),
  };
}

export type UniverseParams = {
  minMarketCap: number;
  minPrice: number;
  minDollarVolume: number;
};

/**
 * Fetches the full *liquid US common-stock universe* — not just the momentum
 * candidates. Scoring is cross-sectional (percentile ranks), so the baseline
 * has to be every comparable name, otherwise ranks are self-referential.
 */
export async function fetchUniverse(p: UniverseParams): Promise<RawQuote[]> {
  const filter = [
    { left: "market_cap_basic", operation: "egreater", right: p.minMarketCap },
    { left: "close", operation: "egreater", right: p.minPrice },
    { left: "exchange", operation: "in_range", right: ["NASDAQ", "NYSE", "AMEX"] },
    { left: "is_primary", operation: "equal", right: true },
    { left: "typespecs", operation: "has", right: ["common"] },
    { left: "average_volume_30d_calc", operation: "egreater", right: 200_000 },
  ];

  const rows: RawQuote[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const start = page * PAGE_SIZE;
    const body = {
      filter,
      options: { lang: "en" },
      markets: ["america"],
      columns: COLUMNS,
      sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
      range: [start, start + PAGE_SIZE],
    };

    const res = await fetch(SCAN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`TradingView responded ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as {
      totalCount: number;
      data?: { s: string; d: unknown[] }[];
    };

    const batch = json.data ?? [];
    for (const r of batch) {
      const parsed = parseRow(r.s, r.d);
      if (parsed) rows.push(parsed);
    }

    if (batch.length < PAGE_SIZE || rows.length >= json.totalCount) break;
  }

  // Dollar-volume gate is applied here rather than server-side: TradingView's
  // Value.Traded is a single-session figure, so a quiet day would wrongly
  // evict an otherwise liquid name. Use the 30d average * price instead.
  return rows.filter((q) => (q.avgVol30d ?? 0) * q.close >= p.minDollarVolume);
}
