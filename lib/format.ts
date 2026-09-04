export const fmtPct = (v: number | null, digits = 1): string =>
  v === null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;

export const fmtPrice = (v: number | null): string =>
  v === null || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtCap(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  return v.toFixed(0);
}

export const signClass = (v: number | null): string =>
  v === null || !Number.isFinite(v) || v === 0 ? "" : v > 0 ? "pos" : "neg";

export const FLAG_LABEL: Record<string, string> = {
  NEW_HIGH: "52W High",
  EXTENDED: "Extended",
  PULLBACK: "Pullback",
  VOL_SPIKE: "Vol Spike",
  ACCELERATING: "Accelerating",
};

export const FLAG_HINT: Record<string, string> = {
  NEW_HIGH: "Within 2% of its 52-week high",
  EXTENDED: "RSI ≥ 80 or 25%+ above the 20-day MA — stretched, chase risk",
  PULLBACK: "Cooling off below the 20-day MA or RSI < 50 while the trend holds",
  VOL_SPIKE: "Trading at 2x+ its normal 10-day volume",
  ACCELERATING: "Last week's pace is more than double the prior two months",
};

/** Chip colour per signal — greens for strength, amber/purple for caution. */
export const FLAG_CLASS: Record<string, string> = {
  NEW_HIGH: "chip-green",
  ACCELERATING: "chip-blue",
  EXTENDED: "chip-amber",
  PULLBACK: "chip-purple",
  VOL_SPIKE: "",
};
