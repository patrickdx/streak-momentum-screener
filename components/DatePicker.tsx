"use client";

import { useRouter } from "next/navigation";
import type { MarketId } from "@/lib/markets";

/**
 * Jump straight to any stored trading day.
 *
 * Every date is a real prerendered page, so this navigates rather than
 * filtering in place — which also means the chosen day is linkable and
 * survives a reload.
 */
export default function DatePicker({
  market,
  dates,
  current,
}: {
  market: MarketId;
  /** Newest first. */
  dates: string[];
  current: string;
}) {
  const router = useRouter();
  const i = dates.indexOf(current);
  const newer = i > 0 ? dates[i - 1] : null;
  const older = i >= 0 && i < dates.length - 1 ? dates[i + 1] : null;

  const go = (date: string) => router.push(`/archive/${market}/${date}`);

  const pretty = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });

  return (
    <div className="date-picker">
      <button
        className="btn btn-sm"
        onClick={() => older && go(older)}
        disabled={!older}
        aria-label="Previous trading day"
      >
        ←
      </button>

      <label className="date-select-wrap">
        <span className="sr-only">Jump to a trading day</span>
        <select
          className="select date-select"
          value={current}
          onChange={(e) => go(e.target.value)}
        >
          {dates.map((d) => (
            <option key={d} value={d}>
              {pretty(d)}
            </option>
          ))}
        </select>
      </label>

      <button
        className="btn btn-sm"
        onClick={() => newer && go(newer)}
        disabled={!newer}
        aria-label="Next trading day"
      >
        →
      </button>

      <span className="date-count">
        {dates.length} {dates.length === 1 ? "day" : "days"} stored
      </span>
    </div>
  );
}
