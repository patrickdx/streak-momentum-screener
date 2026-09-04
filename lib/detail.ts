import { MARKETS, type MarketId } from "./markets";
import type { RawQuote, StockDetail } from "./types";

/**
 * Extra columns are fetched per symbol, on demand, rather than being pulled
 * for the whole universe. Adding ~25 fields to the main sweep would inflate
 * every request and every archived snapshot for data that is only ever read
 * one row at a time.
 */
const DETAIL_COLUMNS = [
  // The live close travels with the live period highs on purpose — see
  // breakoutLadder().
  "close",
  "price_52_week_high",
  "High.1M",
  "Low.1M",
  "High.3M",
  "Low.3M",
  "High.6M",
  "Low.6M",
  "price_earnings_ttm",
  "earnings_per_share_diluted_ttm",
  "total_revenue",
  "number_of_employees",
  "Recommend.All",
  "Perf.Y",
  "Perf.5Y",
  "ADX",
  "MACD.macd",
  "MACD.signal",
  "Stoch.K",
  "beta_1_year",
  "earnings_release_next_date",
  "country",
  "Volatility.W",
  "VWAP",
] as const;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export async function fetchDetail(
  market: MarketId,
  ticker: string,
): Promise<StockDetail> {
  const res = await fetch(
    `https://scanner.tradingview.com/${MARKETS[market].scannerId}/scan`,
    {
      method: "POST",
      // See lib/tradingview.ts — text/plain avoids the CORS preflight.
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({
        symbols: { tickers: [ticker] },
        columns: DETAIL_COLUMNS,
      }),
      cache: "no-store",
    },
  );

  if (!res.ok) throw new Error(`Detail lookup failed (${res.status})`);

  const json = (await res.json()) as { data?: { s: string; d: unknown[] }[] };
  const d = json.data?.[0]?.d;
  if (!d) throw new Error("No data returned for this symbol");

  return {
    ticker,
    close: num(d[0]),
    high52: num(d[1]),
    high1M: num(d[2]),
    low1M: num(d[3]),
    high3M: num(d[4]),
    low3M: num(d[5]),
    high6M: num(d[6]),
    low6M: num(d[7]),
    peRatio: num(d[8]),
    eps: num(d[9]),
    revenue: num(d[10]),
    employees: num(d[11]),
    recommendation: num(d[12]),
    perfY: num(d[13]),
    perf5Y: num(d[14]),
    adx: num(d[15]),
    macd: num(d[16]),
    macdSignal: num(d[17]),
    stochK: num(d[18]),
    beta: num(d[19]),
    nextEarnings: num(d[20]),
    country: (d[21] as string) ?? null,
    volatilityW: num(d[22]),
    vwap: num(d[23]),
  };
}

export type BreakoutRung = {
  label: string;
  window: string;
  high: number | null;
  atHigh: boolean;
  pctBelow: number | null;
};

/**
 * How far up its own range the stock is trading, one horizon at a time.
 *
 * This is the closest honest answer to "when did it break out" from the data
 * TradingView exposes: the scanner gives period highs, not a daily series, so
 * a rung reading "at high" means the price is within 0.25% of the highest
 * price of that window — i.e. the breakout is happening now, at that horizon.
 * Clearing longer windows in sequence is what a real breakout looks like;
 * clearing only the 1-month one is a bounce.
 *
 * Both sides of every comparison come from the *same* fetch. On an archive
 * page the row's close is historical while the period highs are live, and
 * mixing them would silently report a stock as far below a high it was sitting
 * on that day. The row's close is only a fallback for before the fetch lands.
 */
export function breakoutLadder(
  quote: RawQuote,
  detail: StockDetail | null,
): BreakoutRung[] {
  const close = detail?.close ?? quote.close;

  const rungs: [string, string, number | null][] = [
    ["1-month high", "past month", detail?.high1M ?? null],
    ["3-month high", "past quarter", detail?.high3M ?? null],
    ["6-month high", "past half-year", detail?.high6M ?? null],
    ["52-week high", "past year", detail ? detail.high52 : quote.high52],
  ];

  return rungs.map(([label, window, high]) => {
    const pctBelow =
      high !== null && high > 0 ? ((close - high) / high) * 100 : null;
    return {
      label,
      window,
      high,
      // 0.25% tolerance: intraday prints and the daily high rarely match exactly.
      atHigh: pctBelow !== null && pctBelow >= -0.25,
      pctBelow,
    };
  });
}
