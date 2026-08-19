"use client";

import {
  SCRATCH_STRESS_TAGS,
  runVerdict,
  scoreSummary,
  stressFailCount,
} from "@/lib/scratchBench/scorecard";
import { scratchBlobFolderForRun } from "@/lib/scratchBench/blobFolder";
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
  padPlateFile,
  blobFallback,
  onSelect,
  onRemove,
  onClear,
  onExportCsv,
}: {
  runs: ScratchBenchRun[];
  selectedId?: string | null;
  /** Current plate on the pad — highlights matching history still. */
  padPlateFile?: string;
  blobFallback?: { styleId?: string; folder?: string };
  onSelect?: (run: ScratchBenchRun) => void;
  onRemove?: (run: ScratchBenchRun) => void;
  onClear?: () => void;
  onExportCsv?: () => void;
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
        <span>History ({runs.length}) — tap a still to put it back on the pad</span>
        <div className="scratch-history-actions">
          {onExportCsv ? (
            <button type="button" className="scratch-history-clear" onClick={onExportCsv}>
              Export CSV
            </button>
          ) : null}
          {onClear ? (
            <button type="button" className="scratch-history-clear" onClick={onClear}>
              Clear log
            </button>
          ) : null}
        </div>
      </div>
      <div className="scratch-history-strip">
        {runs.map((run) => {
          const thumb = run.plateUrl || run.clipUrl;
          const selected = selectedId === run.id;
          const onPad = Boolean(
            padPlateFile && run.plateFile && padPlateFile === run.plateFile && run.kind === "still",
          );
          const verdict = runVerdict(run.tags);
          const fails = stressFailCount(run.tags);
          const blob = scratchBlobFolderForRun(run, blobFallback);
          return (
            <div
              key={run.id}
              className={`scratch-history-card${selected ? " is-selected" : ""}${onPad ? " is-on-pad" : ""}`}
            >
              <button
                type="button"
                className="scratch-history-pick"
                onClick={() => onSelect?.(run)}
                title={
                  run.plateFile
                    ? "Put this still on the pad — next Draw refines it"
                    : scoreSummary(run.tags)
                }
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="scratch-history-thumb" />
                ) : (
                  <div className="scratch-history-thumb scratch-history-thumb-empty">{run.kind}</div>
                )}
                {onPad ? <span className="scratch-history-on-pad">On pad</span> : null}
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
                      <span key={tag} className={`scratch-history-badge${on ? " is-flag" : ""}`}>
                        {STRESS_LABEL[tag] || tag}
                      </span>
                    );
                  })}
                  <span className={`scratch-history-verdict is-${verdict}`}>
                    {verdict === "open" ? (fails ? `${fails} bugs` : "—") : verdict}
                  </span>
                </span>
              </button>
              {onRemove ? (
                <button
                  type="button"
                  className="scratch-history-remove"
                  title="Remove from history. The file stays in Blob."
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(run);
                  }}
                >
                  Remove
                </button>
              ) : null}
              {blob ? (
                blob.href ? (
                  <a
                    className="scratch-history-blob"
                    href={blob.href}
                    target="_blank"
                    rel="noreferrer"
                    title={blob.path}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {blob.path}
                  </a>
                ) : (
                  <span className="scratch-history-blob" title={blob.path}>
                    {blob.path}
                  </span>
                )
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
