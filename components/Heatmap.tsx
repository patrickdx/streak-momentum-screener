"use client";

import { useMemo, useState } from "react";
import { groupedTreemap } from "@/lib/treemap";
import { fmtCap, fmtPct } from "@/lib/format";
import type { ScoredStock } from "@/lib/types";

/**
 * Colour buckets for the momentum score. Fixed cut points, deliberately not
 * scaled to whatever is on screen — the archive compares days against each
 * other, and a relative scale would make every day look identical.
 */
const BUCKETS = [
  { min: 96, bg: "#0b6528", fg: "#ffffff", label: "96+" },
  { min: 92, bg: "#17803c", fg: "#ffffff", label: "92" },
  { min: 88, bg: "#3aa35e", fg: "#ffffff", label: "88" },
  { min: 84, bg: "#7fcb9b", fg: "#0b3d1d", label: "84" },
  { min: 78, bg: "#b6e6c6", fg: "#0b3d1d", label: "78" },
  { min: -Infinity, bg: "#e6f6ec", fg: "#0b3d1d", label: "<78" },
];

const bucketFor = (score: number) => BUCKETS.find((b) => score >= b.min) ?? BUCKETS[5];

/** Shorter sector names — TradingView's are long enough to blow out a label. */
const SECTOR_SHORT: Record<string, string> = {
  "Electronic Technology": "Electronic Tech",
  "Technology Services": "Tech Services",
  "Health Technology": "Health Tech",
  "Consumer Non-Durables": "Consumer Staples",
  "Consumer Durables": "Consumer Durables",
  "Non-Energy Minerals": "Materials",
  "Producer Manufacturing": "Manufacturing",
  "Distribution Services": "Distribution",
  "Commercial Services": "Commercial Svcs",
  "Industrial Services": "Industrial Svcs",
  "Health Services": "Health Services",
  "Consumer Services": "Consumer Svcs",
  "Retail Trade": "Retail",
  "Energy Minerals": "Energy",
  "Process Industries": "Process Industry",
  "Miscellaneous": "Other",
};

export default function Heatmap({ stocks }: { stocks: ScoredStock[] }) {
  const [hovered, setHovered] = useState<ScoredStock | null>(null);

  const groups = useMemo(() => {
    const bySector = new Map<string, ScoredStock[]>();
    for (const s of stocks) {
      const key = s.sector ?? "Other";
      const list = bySector.get(key);
      if (list) list.push(s);
      else bySector.set(key, [s]);
    }
    return [...bySector.entries()].map(([key, items]) => ({
      key,
      items: items.map((s) => ({
        item: s,
        // Square-rooted so a $300B name doesn't swallow the whole canvas and
        // leave the $1B names as unreadable slivers.
        value: Math.sqrt(Math.max(s.marketCap, 1)),
      })),
    }));
  }, [stocks]);

  // Canvas is a 100x100 abstract box rendered with percentage CSS. The label
  // strip is 18px inside a ~460px-tall canvas, hence ~4 units.
  const cells = useMemo(
    () => groupedTreemap(groups, { x: 0, y: 0, w: 100, h: 100 }, 4.2, 0.3),
    [groups],
  );

  const pct = (n: number) => `${n}%`;

  return (
    <div className="heatmap-block">
      <div className="heatmap" role="img" aria-label="Momentum heatmap by sector">
        {cells.map((cell) => (
          <div
            key={cell.key}
            className="hm-sector"
            style={{
              left: pct(cell.rect.x),
              top: pct(cell.rect.y),
              width: pct(cell.rect.w),
              height: pct(cell.rect.h),
            }}
          >
            {cell.showLabel && (
              <div className="hm-sector-label">
                {SECTOR_SHORT[cell.key] ?? cell.key}
              </div>
            )}
            {cell.tiles.map((t) => {
              const s = t.item;
              const b = bucketFor(s.score);
              // Label decisions use the tile's real size on the canvas, not its
              // size relative to its sector.
              const showTicker = t.globalW > 4.6 && t.globalH > 5;
              const showPerf = t.globalW > 6 && t.globalH > 8.5;
              return (
                <a
                  key={s.ticker}
                  className="hm-tile"
                  href={`https://www.tradingview.com/symbols/${s.ticker.replace(":", "-")}/`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    left: pct(t.x),
                    top: pct(t.y),
                    width: pct(t.w),
                    height: pct(t.h),
                    background: b.bg,
                    color: b.fg,
                  }}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered((h) => (h === s ? null : h))}
                  onFocus={() => setHovered(s)}
                  onBlur={() => setHovered(null)}
                  title={`${s.name} — ${s.description}\nScore ${s.score.toFixed(1)} · 1M ${fmtPct(s.perf1M)} · ${fmtCap(s.marketCap)} cap`}
                >
                  {showTicker && <span className="hm-ticker">{s.name}</span>}
                  {showPerf && <span className="hm-perf">{fmtPct(s.perf1M, 0)}</span>}
                </a>
              );
            })}
          </div>
        ))}
      </div>

      <div className="hm-footer">
        <div className="hm-legend">
          <span className="hm-legend-label">Momentum score</span>
          {[...BUCKETS].reverse().map((b) => (
            <span key={b.label} className="hm-swatch-wrap">
              <span className="hm-swatch" style={{ background: b.bg }} />
              <span className="hm-swatch-label">{b.label}</span>
            </span>
          ))}
        </div>
        <div className="hm-readout">
          {hovered ? (
            <>
              <strong>{hovered.name}</strong> {hovered.description} · score{" "}
              {hovered.score.toFixed(1)} · 1M {fmtPct(hovered.perf1M)} ·{" "}
              {fmtCap(hovered.marketCap)}
            </>
          ) : (
            "Tile size reflects market cap (square-root scaled). Hover for detail, click to open the chart."
          )}
        </div>
      </div>
    </div>
  );
}
