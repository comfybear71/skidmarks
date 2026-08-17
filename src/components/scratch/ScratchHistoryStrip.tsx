"use client";

import { scoreSummary } from "@/lib/scratchBench/scorecard";
import type { ScratchBenchRun } from "@/lib/scratchBench/types";

export function ScratchHistoryStrip({
  runs,
  selectedId,
  onSelect,
  onClear,
}: {
  runs: ScratchBenchRun[];
  selectedId?: string | null;
  onSelect?: (run: ScratchBenchRun) => void;
  onClear?: () => void;
}) {
  if (!runs.length) {
    return (
      <div className="scratch-history-empty">
        Run history empty — Draw / Generate will log here.
        {onClear ? null : null}
      </div>
    );
  }

  return (
    <div className="scratch-history">
      <div className="scratch-history-head">
        <span>History ({runs.length})</span>
        {onClear ? (
          <button type="button" className="scratch-history-clear" onClick={onClear}>
            Clear log
          </button>
        ) : null}
      </div>
      <div className="scratch-history-strip">
        {runs.map((run) => {
          const thumb = run.plateUrl || run.clipUrl;
          const selected = selectedId === run.id;
          return (
            <button
              key={run.id}
              type="button"
              className={`scratch-history-card${selected ? " is-selected" : ""}`}
              onClick={() => onSelect?.(run)}
              title={scoreSummary(run.tags)}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="scratch-history-thumb" />
              ) : (
                <div className="scratch-history-thumb scratch-history-thumb-empty">{run.kind}</div>
              )}
              <span className="scratch-history-meta">
                {run.kind}
                {run.chaosId !== "none" ? ` · ${run.chaosId}` : ""}
                {run.tags.length ? ` · ${scoreSummary(run.tags)}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
