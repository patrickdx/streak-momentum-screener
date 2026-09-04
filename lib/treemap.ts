/**
 * Squarified treemap layout (Bruls, Huizing & van Wijk, 2000).
 *
 * Lays items out to fill a rectangle with areas proportional to their value,
 * choosing row breaks that keep tiles as close to square as possible — the
 * naive "slice and dice" alternative produces unreadable slivers.
 *
 * All coordinates come back in the same units as the rect passed in; the
 * heatmap passes a 0-100 box and renders with percentage CSS so the result is
 * resolution-independent.
 */

export type Rect = { x: number; y: number; w: number; h: number };
export type Sized<T> = { item: T; value: number };
export type Tile<T> = Rect & { item: T };

/** Aspect ratio of the worst tile in `row` if laid along a side of `side`. */
function worst(areas: number[], side: number): number {
  if (areas.length === 0) return Infinity;
  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  for (const a of areas) {
    sum += a;
    if (a > max) max = a;
    if (a < min) min = a;
  }
  if (sum <= 0 || side <= 0 || min <= 0) return Infinity;
  const s2 = sum * sum;
  const side2 = side * side;
  return Math.max((side2 * max) / s2, s2 / (side2 * min));
}

export function treemap<T>(items: Sized<T>[], rect: Rect): Tile<T>[] {
  const positive = items.filter((i) => i.value > 0);
  const total = positive.reduce((s, i) => s + i.value, 0);
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) return [];

  // Convert values into areas within the target rect.
  const scale = (rect.w * rect.h) / total;
  const queue = positive
    .map((i) => ({ item: i.item, area: i.value * scale }))
    .sort((a, b) => b.area - a.area);

  const out: Tile<T>[] = [];
  let free: Rect = { ...rect };
  let row: { item: T; area: number }[] = [];

  const flush = () => {
    const sum = row.reduce((s, r) => s + r.area, 0);
    if (sum <= 0) {
      row = [];
      return;
    }
    // The row runs along whichever side is currently shorter.
    if (free.w >= free.h) {
      const stripW = sum / free.h;
      let y = free.y;
      for (const r of row) {
        const h = (r.area / sum) * free.h;
        out.push({ item: r.item, x: free.x, y, w: stripW, h });
        y += h;
      }
      free = { x: free.x + stripW, y: free.y, w: free.w - stripW, h: free.h };
    } else {
      const stripH = sum / free.w;
      let x = free.x;
      for (const r of row) {
        const w = (r.area / sum) * free.w;
        out.push({ item: r.item, x, y: free.y, w, h: stripH });
        x += w;
      }
      free = { x: free.x, y: free.y + stripH, w: free.w, h: free.h - stripH };
    }
    row = [];
  };

  for (const entry of queue) {
    const side = Math.min(free.w, free.h);
    const current = row.map((r) => r.area);
    if (row.length === 0 || worst([...current, entry.area], side) <= worst(current, side)) {
      row.push(entry);
    } else {
      flush();
      row.push(entry);
    }
  }
  flush();

  return out;
}

/**
 * Two-level treemap: outer cells per group, inner cells per item.
 *
 * Inner tiles are returned in coordinates **local to their group cell** (0-100
 * on each axis), because they get rendered inside an absolutely-positioned
 * group element — percentages there resolve against the group, not the canvas.
 * Each tile also carries its global width/height so callers can decide whether
 * there is room for a label.
 *
 * `labelPad` reserves room at the top of each cell for the group's name, in
 * the same units as `rect`. It is capped for short cells, which would
 * otherwise have their entire height eaten by the label strip.
 */
export type GroupCell<T> = {
  key: string;
  rect: Rect;
  showLabel: boolean;
  tiles: (Rect & { item: T; globalW: number; globalH: number })[];
};

export function groupedTreemap<T>(
  groups: { key: string; items: Sized<T>[] }[],
  rect: Rect,
  labelPad = 0,
  gutter = 0,
): GroupCell<T>[] {
  const outer = treemap(
    groups.map((g) => ({
      item: g,
      value: g.items.reduce((s, i) => s + i.value, 0),
    })),
    rect,
  );

  return outer.map((cell) => {
    const pad = Math.min(labelPad, cell.h * 0.45);
    const showLabel = pad >= labelPad * 0.9 && cell.w > labelPad * 1.2;

    const inner: Rect = {
      x: cell.x + gutter,
      y: cell.y + (showLabel ? pad : gutter),
      w: Math.max(0, cell.w - gutter * 2),
      h: Math.max(0, cell.h - (showLabel ? pad : gutter) - gutter),
    };

    const tiles = treemap(cell.item.items, inner).map((t) => ({
      item: t.item,
      // Global -> local percentage within the group cell.
      x: ((t.x - cell.x) / cell.w) * 100,
      y: ((t.y - cell.y) / cell.h) * 100,
      w: (t.w / cell.w) * 100,
      h: (t.h / cell.h) * 100,
      globalW: t.w,
      globalH: t.h,
    }));

    return { key: cell.item.key, rect: cell, showLabel, tiles };
  });
}
