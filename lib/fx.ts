import { MARKETS, type MarketId } from "./markets";

const FOREX_URL = "https://scanner.tradingview.com/forex/scan";

/** Units of the local currency per 1 USD. */
export type FxRates = Record<string, number>;

let cache: { at: number; rates: FxRates } | null = null;
const TTL_MS = 10 * 60 * 1000;

/**
 * Pulls spot rates from the same TradingView infrastructure as the quotes, so
 * the conversion is consistent with the prices it is applied to.
 *
 * A missing or nonsensical rate throws rather than silently defaulting to 1 —
 * a rate of 1 for KRW would report every Korean company as ~1,300x its true
 * size and quietly corrupt the archive.
 */
export async function fetchFxRates(markets: MarketId[]): Promise<FxRates> {
  const needed = markets
    .map((m) => MARKETS[m])
    .filter((m) => m.fxTicker !== null);

  const rates: FxRates = { USD: 1 };
  if (needed.length === 0) return rates;

  if (cache && Date.now() - cache.at < TTL_MS) {
    if (needed.every((m) => cache!.rates[m.currency] > 0)) {
      return { ...cache.rates };
    }
  }

  const res = await fetch(FOREX_URL, {
    method: "POST",
    // See tradingview.ts — text/plain keeps this a preflight-free CORS request
    // so it works from the browser.
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({
      symbols: { tickers: needed.map((m) => m.fxTicker) },
      columns: ["close"],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Exchange-rate lookup failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { data?: { s: string; d: unknown[] }[] };
  for (const row of json.data ?? []) {
    const market = needed.find((m) => m.fxTicker === row.s);
    const value = row.d?.[0];
    if (market && typeof value === "number" && value > 0) {
      rates[market.currency] = value;
    }
  }

  const missing = needed.filter((m) => !(rates[m.currency] > 0));
  if (missing.length) {
    throw new Error(
      `No exchange rate for ${missing.map((m) => m.currency).join(", ")} — refusing to report unconverted figures.`,
    );
  }

  cache = { at: Date.now(), rates: { ...rates } };
  return rates;
}
