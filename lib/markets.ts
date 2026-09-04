/**
 * The markets Streak covers. TradingView exposes one scanner endpoint per
 * market (`/{scannerId}/scan`) and they all accept the same column set, so
 * adding a country is mostly a matter of adding a row here.
 *
 * The catch is currency: every market reports price and market cap in its own
 * currency, and the API has no conversion option (`currency` at the top level,
 * in `options`, and a `col|USD` suffix were all tested and ignored). So market
 * caps and liquidity are converted to USD in `tradingview.ts`, which is what
 * makes a single "$1B and up" filter mean the same thing everywhere.
 */

export const MARKET_IDS = ["us", "japan", "korea", "china"] as const;
export type MarketId = (typeof MARKET_IDS)[number];

export type Market = {
  id: MarketId;
  /** TradingView's path segment. */
  scannerId: string;
  label: string;
  /** Two-to-three letter tag used in dense UI. */
  code: string;
  currency: string;
  /** Forex ticker giving units of `currency` per 1 USD. Null for the US. */
  fxTicker: string | null;
  /** Restricts to the main boards; omitted where the market has just one. */
  exchanges?: string[];
  locale: string;
};

export const MARKETS: Record<MarketId, Market> = {
  us: {
    id: "us",
    scannerId: "america",
    label: "United States",
    code: "US",
    currency: "USD",
    fxTicker: null,
    exchanges: ["NASDAQ", "NYSE", "AMEX"],
    locale: "en-US",
  },
  japan: {
    id: "japan",
    scannerId: "japan",
    label: "Japan",
    code: "JP",
    currency: "JPY",
    fxTicker: "FX_IDC:USDJPY",
    locale: "ja-JP",
  },
  korea: {
    id: "korea",
    scannerId: "korea",
    label: "South Korea",
    code: "KR",
    currency: "KRW",
    fxTicker: "FX_IDC:USDKRW",
    locale: "ko-KR",
  },
  china: {
    id: "china",
    scannerId: "china",
    label: "China",
    code: "CN",
    currency: "CNY",
    // A-shares only. The China board also carries a handful of USD- and
    // HKD-quoted B-shares; filtering on currency keeps the universe to one
    // currency and matches what "the China market" normally means.
    fxTicker: "FX_IDC:USDCNY",
    locale: "zh-CN",
  },
};

export const ALL_MARKETS = MARKET_IDS.map((id) => MARKETS[id]);

export const isMarketId = (v: string): v is MarketId =>
  (MARKET_IDS as readonly string[]).includes(v);

/** Accepts a query-string value, falling back to the US. "all" is handled by callers. */
export function parseMarkets(raw: string | null): MarketId[] {
  if (!raw || raw === "all") return [...MARKET_IDS];
  const wanted = raw.split(",").filter(isMarketId);
  return wanted.length ? wanted : ["us"];
}
