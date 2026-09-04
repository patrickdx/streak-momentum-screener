"use client";

import { useState } from "react";
import ScreenerTable from "./ScreenerTable";
import Heatmap from "./Heatmap";
import StockDetail from "./StockDetail";
import type { ScoredStock } from "@/lib/types";

export default function SnapshotView({
  stocks,
  priorScores,
  priorRanks,
  hasPrior,
  asOfDate,
}: {
  stocks: ScoredStock[];
  priorScores: Record<string, number>;
  priorRanks: Record<string, number>;
  hasPrior: boolean;
  asOfDate: string;
}) {
  const [selected, setSelected] = useState<ScoredStock | null>(null);
  const [view, setView] = useState<"table" | "heatmap">("table");

  return (
    <>
      <div className="view-bar">
        <div className="view-toggle">
          <button
            className={view === "table" ? "on" : ""}
            onClick={() => setView("table")}
            aria-pressed={view === "table"}
          >
            Table
          </button>
          <button
            className={view === "heatmap" ? "on" : ""}
            onClick={() => setView("heatmap")}
            aria-pressed={view === "heatmap"}
          >
            Heatmap
          </button>
        </div>
        <span className="view-note">
          {hasPrior
            ? "The Move column shows each name's rank change since the previous snapshot."
            : "No earlier snapshot to compare against yet."}
        </span>
      </div>

      {view === "table" ? (
        <ScreenerTable
          stocks={stocks}
          movement={hasPrior ? { ranks: priorRanks, scores: priorScores } : undefined}
          asOfDate={asOfDate}
        />
      ) : (
        <Heatmap stocks={stocks} onSelect={setSelected} />
      )}

      {selected && (
        <StockDetail
          stock={selected}
          asOfDate={asOfDate}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
