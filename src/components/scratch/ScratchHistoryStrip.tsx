"use client";

import {
  SCRATCH_STRESS_TAGS,
  runVerdict,
  scoreSummary,
  stressFailCount,
} from "@/lib/scratchBench/scorecard";
import type { ScratchBenchRun, ScratchScoreTag } from "@/lib/scratchBench/types";

const STRESS_LABEL: Partial<Record<ScratchScoreTag, string>> = {
  eye: "Eye",
  fingers: "Fingers",
  melt: "Melt",
  ghost: "Ghost",
};

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
          const verdict = runVerdict(run.tags);
          const fails = stressFailCount(run.tags);
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
                {run.environment ? ` · ${run.environment}` : ""}
              </span>
              {run.dialogue ? (
                <span className="scratch-history-dialogue">“{run.dialogue}”</span>
              ) : null}
              <span className="scratch-history-badges">
                {SCRATCH_STRESS_TAGS.map((tag) => {
                  const on = run.tags.includes(tag);
                  return (
                    <span
                      key={tag}
                      className={`scratch-history-badge${on ? " is-flag" : ""}`}
                    >
                      {STRESS_LABEL[tag] || tag}
                    </span>
                  );
                })}
                <span
                  className={`scratch-history-verdict is-${verdict}`}
                >
                  {verdict === "open" ? (fails ? `${fails} bugs` : "—") : verdict}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
