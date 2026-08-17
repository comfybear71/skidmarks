"use client";

import { SCRATCH_SCORE_OPTIONS, toggleScoreTag } from "@/lib/scratchBench/scorecard";
import type { ScratchScoreTag } from "@/lib/scratchBench/types";

export function ScratchScoreToggles({
  tags,
  onChange,
  disabled,
}: {
  tags: ScratchScoreTag[];
  onChange: (next: ScratchScoreTag[]) => void;
  disabled?: boolean;
}) {
  const verdicts = SCRATCH_SCORE_OPTIONS.filter((o) => o.group === "verdict");
  const stress = SCRATCH_SCORE_OPTIONS.filter((o) => o.group === "stress");
  const why = SCRATCH_SCORE_OPTIONS.filter((o) => o.group === "fail-why");
  const meta = SCRATCH_SCORE_OPTIONS.filter((o) => o.group === "meta");

  function chipRow(opts: typeof SCRATCH_SCORE_OPTIONS) {
    return (
      <div className="scratch-score-row">
        {opts.map((o) => {
          const on = tags.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              className={`scratch-score-chip${on ? " is-on" : ""}`}
              disabled={disabled}
              aria-pressed={on}
              title={o.hint}
              onClick={() => onChange(toggleScoreTag(tags, o.id))}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="scratch-score">
      <div className="scratch-score-label">Score</div>
      {chipRow(verdicts)}
      <div className="scratch-score-label scratch-score-sub">Stress flags</div>
      <div className="scratch-score-stress">
        {stress.map((o) => {
          const on = tags.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              className={`scratch-score-stress-chip${on ? " is-on" : ""}`}
              disabled={disabled}
              aria-pressed={on}
              onClick={() => onChange(toggleScoreTag(tags, o.id))}
            >
              <span className="scratch-score-stress-title">{o.label}</span>
              {o.hint ? <span className="scratch-score-stress-hint">{o.hint}</span> : null}
            </button>
          );
        })}
      </div>
      {chipRow(why)}
      {chipRow(meta)}
    </div>
  );
}
