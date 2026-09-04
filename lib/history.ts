"use client";

import type { MarketId } from "./markets";
import type { HistoryPoint } from "./types";

type Index = Record<string, HistoryPoint[]>;

// One fetch per market per session, shared by every card that opens.
const cache = new Map<MarketId, Promise<Index>>();

function basePath(): string {
  // Set at build time for project pages; empty locally.
  return process.env.NEXT_PUBLIC_BASE_PATH ?? "";
}

async function loadIndex(market: MarketId): Promise<Index> {
  let pending = cache.get(market);
  if (!pending) {
    pending = fetch(`${basePath()}/history/${market}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Index>) : {}))
      // A missing index just means no archive yet; the card degrades quietly.
      .catch(() => ({}) as Index);
    cache.set(market, pending);
  }
  return pending;
}

type Calendar = Partial<Record<MarketId, string[]>>;

let calendar: Promise<Calendar> | null = null;

/** Stored snapshot dates per market, newest first. */
export async function fetchCalendar(): Promise<Calendar> {
  calendar ??= fetch(`${basePath()}/history/dates.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Calendar>) : {}))
    // No calendar yet just means nothing has been captured.
    .catch(() => ({}) as Calendar);
  return calendar;
}

export async function fetchHistory(
  market: MarketId,
  ticker: string,
): Promise<HistoryPoint[]> {
  const index = await loadIndex(market);
  return index[ticker] ?? [];
}
