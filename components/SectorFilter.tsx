"use client";

import { useEffect, useRef, useState } from "react";

export default function SectorFilter({
  available,
  selected,
  onChange,
}: {
  available: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (sector: string) =>
    onChange(
      selected.includes(sector)
        ? selected.filter((s) => s !== sector)
        : [...selected, sector],
    );

  const label =
    selected.length === 0
      ? "All sectors"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} sectors`;

  return (
    <div className="sector-filter" ref={wrap}>
      <button
        className="select sector-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {label}
      </button>

      {open && (
        <div className="sector-pop" role="group" aria-label="Sectors">
          <div className="sector-pop-head">
            <button className="linkish" onClick={() => onChange([])}>
              Select all
            </button>
            <span>{available.length} available</span>
          </div>
          <div className="sector-list">
            {available.map((sector) => (
              <label className="sector-item" key={sector}>
                <input
                  type="checkbox"
                  checked={selected.length === 0 || selected.includes(sector)}
                  onChange={() => toggle(sector)}
                />
                {sector}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
