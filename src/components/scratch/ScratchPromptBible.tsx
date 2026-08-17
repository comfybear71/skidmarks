"use client";

import {
  SCRATCH_PROMPT_BIBLE,
  type ScratchBibleEntry,
  type ScratchBibleSectionId,
} from "@/lib/scratchBench/promptBible";

export type ScratchBiblePickMode = "replace" | "append";

/**
 * Dense PC chip bank for the Scratch prompt bible.
 * All sections stay visible — no collapse / off-screen menus.
 */
export function ScratchPromptBible({
  activeId,
  mode,
  onModeChange,
  onPick,
  disabled,
}: {
  activeId?: string | null;
  mode: ScratchBiblePickMode;
  onModeChange: (mode: ScratchBiblePickMode) => void;
  onPick: (sectionId: ScratchBibleSectionId, entry: ScratchBibleEntry) => void;
  disabled?: boolean;
}) {
  return (
    <div className="scratch-bible">
      <div className="scratch-bible-head">
        <span className="scratch-bible-title">Prompt bible</span>
        <div className="scratch-bible-modes" role="group" aria-label="Insert mode">
          <button
            type="button"
            className={`scratch-bible-mode${mode === "replace" ? " is-on" : ""}`}
            disabled={disabled}
            aria-pressed={mode === "replace"}
            onClick={() => onModeChange("replace")}
          >
            Replace
          </button>
          <button
            type="button"
            className={`scratch-bible-mode${mode === "append" ? " is-on" : ""}`}
            disabled={disabled}
            aria-pressed={mode === "append"}
            onClick={() => onModeChange("append")}
          >
            Append
          </button>
        </div>
      </div>
      <div className="scratch-bible-grid">
        {SCRATCH_PROMPT_BIBLE.map((section) => (
          <section key={section.id} className="scratch-bible-section" aria-label={section.label}>
            <div className="scratch-bible-section-label">
              {section.label}
              <span className="scratch-bible-section-hint">{section.hint}</span>
            </div>
            <div className="scratch-bible-chips">
              {section.entries.map((entry) => {
                const on = activeId === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={`scratch-bible-chip${on ? " is-on" : ""}`}
                    disabled={disabled}
                    title={entry.template}
                    onClick={() => onPick(section.id, entry)}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
