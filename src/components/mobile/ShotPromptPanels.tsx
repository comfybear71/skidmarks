"use client";

import type { ReactNode } from "react";
import { MobilePrimaryButton, MobileTextInput } from "@/components/mobile/MobileUi";
import { ScratchPromptBible, type ScratchBiblePickMode } from "@/components/scratch";
import { LTX_LIP_SYNC_LEAD } from "@/lib/mobileImageMotion";
import type { ScratchBibleEntry, ScratchBibleSectionId } from "@/lib/scratchBench";

/**
 * Shared Position prompt + Prompt bible — same on /m and /scratch.
 * Bible above the box (matches /m review). Optional Keep / Redo / scratch extras.
 */
export function PositionPromptPanel({
  open,
  onToggle,
  body,
  onChange,
  bibleMode,
  onBibleModeChange,
  bibleActiveId,
  bibleActiveIds,
  onBiblePick,
  bibleDisabled,
  keepDisabled,
  redoDisabled,
  onKeep,
  onRedo,
  keepLabel = "Keep position",
  redoLabel = "Redo still",
  redoBusyLabel = "Drawing + checking…",
  keeping,
  redrawing,
  onAi,
  aiBusy,
  aiError,
  extraActions,
  collapsible = true,
  hint = "Optional — bible already filled this on Draw. Open only to tweak, Keep, then Redo still.",
}: {
  open: boolean;
  onToggle: () => void;
  body: string;
  onChange: (value: string) => void;
  bibleMode: ScratchBiblePickMode;
  onBibleModeChange: (mode: ScratchBiblePickMode) => void;
  bibleActiveId?: string | null;
  bibleActiveIds?: string[];
  onBiblePick: (sectionId: ScratchBibleSectionId, entry: ScratchBibleEntry) => void;
  bibleDisabled?: boolean;
  keepDisabled?: boolean;
  redoDisabled?: boolean;
  onKeep?: () => void;
  onRedo?: () => void;
  keepLabel?: string;
  redoLabel?: string;
  redoBusyLabel?: string;
  keeping?: boolean;
  redrawing?: boolean;
  onAi?: () => void;
  aiBusy?: boolean;
  aiError?: string;
  /** Scratch-only chips (Compile / Clear / Gold) sit with Keep / Redo. */
  extraActions?: ReactNode;
  collapsible?: boolean;
  hint?: string;
}) {
  const showBody = !collapsible || open;

  return (
    <div className="shot-prompt-position">
      {collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          className="shot-prompt-toggle"
        >
          {open ? "▾ Position prompt (Redo still)" : "▸ Position prompt (Redo still)"}
        </button>
      ) : (
        <div className="shot-prompt-toggle is-static">Position prompt (Redo still)</div>
      )}
      {showBody ? (
        <div className="shot-prompt-panel-body">
          {hint ? <p className="shot-prompt-hint">{hint}</p> : null}
          <ScratchPromptBible
            activeId={bibleActiveId}
            activeIds={bibleActiveIds}
            mode={bibleMode}
            onModeChange={onBibleModeChange}
            disabled={bibleDisabled}
            onPick={onBiblePick}
          />
          <MobileTextInput
            value={body}
            onChange={onChange}
            placeholder="Position, emotion, holding, wearing, who is where…"
            multiline
            rows={5}
            onAi={onAi}
            aiBusy={aiBusy}
          />
          {aiError ? (
            <div className="shot-prompt-ai-error">{aiError}</div>
          ) : null}
          <div className="shot-prompt-actions">
            {onKeep ? (
              <MobilePrimaryButton
                size="chip"
                tone="ghost"
                busy={keeping}
                disabled={keepDisabled}
                onClick={onKeep}
              >
                {keeping ? "Saving…" : keepLabel}
              </MobilePrimaryButton>
            ) : null}
            {onRedo ? (
              <MobilePrimaryButton
                size="chip"
                busy={redrawing}
                disabled={redoDisabled}
                onClick={onRedo}
              >
                {redrawing ? redoBusyLabel : redoLabel}
              </MobilePrimaryButton>
            ) : null}
            {extraActions}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Shared LTX Image motion — same on /m and /scratch, every speaking shot.
 * GLOBAL lip-sync lead is display-only (hard-wired on send).
 */
export function LtxImageMotionPanel({
  open,
  onToggle,
  body,
  onChange,
  onKeep,
  keepDisabled,
  keeping,
  dirty,
  onAi,
  aiBusy,
  aiError,
  placeholder = 'Mouth + head + NAME says: "line" — this is the LTX clip prompt.',
}: {
  open: boolean;
  onToggle: () => void;
  body: string;
  onChange: (value: string) => void;
  onKeep: () => void;
  keepDisabled?: boolean;
  keeping?: boolean;
  dirty?: boolean;
  onAi?: () => void;
  aiBusy?: boolean;
  aiError?: string;
  placeholder?: string;
}) {
  return (
    <div className="shot-prompt-ltx scratch-ltx-motion">
      <button
        type="button"
        onClick={onToggle}
        className="shot-prompt-toggle scratch-ltx-motion-toggle"
      >
        {open ? "▾ LTX Image motion" : "▸ LTX Image motion"}
      </button>
      {open ? (
        <div className="shot-prompt-panel-body scratch-ltx-motion-body">
          <p className="shot-prompt-hint scratch-ltx-motion-lead">{LTX_LIP_SYNC_LEAD}</p>
          <MobileTextInput
            value={body}
            onChange={onChange}
            placeholder={placeholder}
            multiline
            rows={8}
            onAi={onAi}
            aiBusy={aiBusy}
          />
          {aiError ? (
            <div className="shot-prompt-ai-error">{aiError}</div>
          ) : null}
          <div className="shot-prompt-actions">
            <MobilePrimaryButton
              size="chip"
              tone="ghost"
              disabled={keepDisabled}
              onClick={onKeep}
            >
              {keeping ? "Keeping…" : "Keep Image motion"}
            </MobilePrimaryButton>
            {dirty ? (
              <span className="shot-prompt-dirty">Unsaved — Keep or Generate will write it</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
