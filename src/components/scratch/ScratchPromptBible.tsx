"use client";

import { useState } from "react";
import {
  SCRATCH_PROMPT_BIBLE,
  type ScratchBibleEntry,
  type ScratchBibleSectionId,
} from "@/lib/scratchBench/promptBible";

export type ScratchBiblePickMode = "replace" | "append";

/**
 * Prompt bible — two-column accordion. Titles only until one opens.
 * Pick a chip → insert text (Draw is separate). Highlights every picked chip.
 */
export function ScratchPromptBible({
  activeIds = [],
  activeId,
  mode,
  onModeChange,
  onPick,
  disabled,
}: {
  activeIds?: string[];
  activeId?: string | null;
  mode: ScratchBiblePickMode;
  onModeChange: (mode: ScratchBiblePickMode) => void;
  onPick: (sectionId: ScratchBibleSectionId, entry: ScratchBibleEntry) => void;
  disabled?: boolean;
}) {
  const [openId, setOpenId] = useState<ScratchBibleSectionId | null>(null);
  const highlighted = new Set([...activeIds, ...(activeId ? [activeId] : [])]);

  function setMode(next: ScratchBiblePickMode) {
    onModeChange(next);
  }

  function pick(sectionId: ScratchBibleSectionId, entry: ScratchBibleEntry) {
    onPick(sectionId, entry);
    setOpenId(null);
  }

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
            onClick={() => setMode("replace")}
          >
            Replace
          </button>
          <button
            type="button"
            className={`scratch-bible-mode${mode === "append" ? " is-on" : ""}`}
            disabled={disabled}
            aria-pressed={mode === "append"}
            onClick={() => setMode("append")}
          >
            Append
          </button>
        </div>
      </div>
      <div className="scratch-bible-grid" role="list">
        {SCRATCH_PROMPT_BIBLE.map((section) => {
          const open = openId === section.id;
          const panelId = `scratch-bible-panel-${section.id}`;
          const sectionActive = section.entries.some((entry) => highlighted.has(entry.id));
          return (
            <section
              key={section.id}
              className={`scratch-bible-section${open ? " is-open" : ""}${sectionActive ? " has-picks" : ""}`}
              role="listitem"
            >
              <button
                type="button"
                className="scratch-bible-acc"
                disabled={disabled}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? null : section.id)}
              >
                <span className="scratch-bible-acc-mark" aria-hidden="true">
                  {open ? "▾" : "▸"}
                </span>
                <span className="scratch-bible-acc-label">{section.label}</span>
              </button>
              <div id={panelId} className="scratch-bible-panel" aria-hidden={!open}>
                <div className="scratch-bible-panel-inner">
                  <p className="scratch-bible-section-hint">{section.hint}</p>
                  <div className="scratch-bible-chips">
                    {section.entries.map((entry) => {
                      const on = highlighted.has(entry.id);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          tabIndex={open ? 0 : -1}
                          className={`scratch-bible-chip${on ? " is-on" : ""}`}
                          disabled={disabled || !open}
                          title={entry.template}
                          onClick={() => pick(section.id, entry)}
                        >
                          {entry.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
