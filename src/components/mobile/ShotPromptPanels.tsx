"use client";

import { useState, type ReactNode } from "react";
import { MobilePrimaryButton, MobileTextInput } from "@/components/mobile/MobileUi";
import { MathPatternHole } from "@/components/mobile/MathPatternHole";
import { ScratchPromptBible, type ScratchBiblePickMode } from "@/components/scratch";
import {
  LTX_LIP_SYNC_LEAD,
  MUTE_MV_SLOT_PLACEHOLDER,
  muteMvEngineFoldLines,
  muteMvEngineFoldSummary,
  muteMvMotionLabel,
  readMvH3Camera,
  readMvH3LastFrame,
  readMvH3Resolution,
  writeMvH3Camera,
  writeMvH3LastFrame,
  writeMvH3Resolution,
  type MuteMvEngine,
  type MuteMvMotionLock,
} from "@/lib/mobileImageMotion";
import {
  MINIMAX_H3_CAMERAS,
  MINIMAX_H3_RESOLUTIONS,
  applyMinimaxH3CameraToSlot,
  stripMinimaxH3CameraFromSlot,
  type MinimaxH3LastStill,
} from "@/lib/minimaxH3";
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

/**
 * 90% lock + [ ] hole. LTX / H3 on the Add row open this — they are the engine.
 * Switching engines keeps the slot words. Does not cook.
 */
export function MuteMvMotionHole({
  engine,
  motionLock,
  motionSlot,
  onMotionSlot,
  disabled,
  mute = true,
  singingBody,
  onSingingBody,
  jobId,
  shotId,
  h3LastStills,
}: {
  engine: MuteMvEngine;
  motionLock: MuteMvMotionLock;
  motionSlot: string;
  onMotionSlot: (value: string) => void;
  disabled?: boolean;
  /** No lips on — mute tail. Off shows the singing stack. */
  mute?: boolean;
  singingBody?: string;
  /** Singing / hum stack — was a locked paragraph. */
  onSingingBody?: (value: string) => void;
  jobId?: string;
  shotId?: string;
  h3LastStills?: MinimaxH3LastStill[];
}) {
  const [h3Camera, setH3Camera] = useState(() =>
    jobId && shotId ? readMvH3Camera(jobId, shotId) : "",
  );
  const [h3Last, setH3Last] = useState(() =>
    jobId && shotId ? readMvH3LastFrame(jobId, shotId) : "",
  );
  const [h3Res, setH3Res] = useState<(typeof MINIMAX_H3_RESOLUTIONS)[number]>(() =>
    jobId && shotId ? readMvH3Resolution(jobId, shotId) : "768P",
  );

  function pickCamera(command: string) {
    const next = h3Camera === command ? "" : command;
    setH3Camera(next);
    if (jobId && shotId) writeMvH3Camera(jobId, shotId, next);
    onMotionSlot(next ? applyMinimaxH3CameraToSlot(motionSlot, next) : stripMinimaxH3CameraFromSlot(motionSlot));
  }

  function pickLast(fileName: string) {
    const next = h3Last === fileName ? "" : fileName;
    setH3Last(next);
    if (jobId && shotId) writeMvH3LastFrame(jobId, shotId, next);
  }

  function pickRes(res: (typeof MINIMAX_H3_RESOLUTIONS)[number]) {
    setH3Res(res);
    if (jobId && shotId) writeMvH3Resolution(jobId, shotId, res);
  }

  return (
    <div className="m-plate-motion-hole" data-engine={engine} data-mute={mute ? "yes" : "no"}>
      <div className="m-plate-motion-label">
        {muteMvMotionLabel(engine)}
      </div>
      <details className="m-plate-motion-fold">
        <summary>{muteMvEngineFoldSummary(engine)}</summary>
        <div className="m-plate-motion-fold-body">
          {muteMvEngineFoldLines(engine).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </details>
      {engine === "h3" ? (
        <div className="m-plate-h3-caps">
          <p className="m-plate-h3-caps-label">Camera — official [Command] into the hole</p>
          <div className="m-plate-h3-chips" role="group" aria-label="H3 camera">
            {MINIMAX_H3_CAMERAS.map((cam) => (
              <button
                key={cam.id}
                type="button"
                className={`m-plate-h3-chip${h3Camera === cam.command ? " is-on" : ""}`}
                disabled={disabled}
                title={cam.command}
                onClick={() => pickCamera(cam.command)}
              >
                {cam.label}
              </button>
            ))}
          </div>
          <p className="m-plate-h3-caps-label">H3 output</p>
          <div className="m-plate-h3-chips" role="group" aria-label="H3 resolution">
            {MINIMAX_H3_RESOLUTIONS.map((res) => (
              <button
                key={res}
                type="button"
                className={`m-plate-h3-chip${h3Res === res ? " is-on" : ""}`}
                disabled={disabled}
                onClick={() => pickRes(res)}
              >
                {res}
              </button>
            ))}
          </div>
          {(h3LastStills || []).length ? (
            <>
              <p className="m-plate-h3-caps-label">Last frame — optional. Not the first still.</p>
              <div className="m-plate-h3-lasts" role="group" aria-label="H3 last frame">
                {(h3LastStills || []).map((still) => (
                  <button
                    key={still.fileName}
                    type="button"
                    className={`m-plate-h3-last${h3Last === still.fileName ? " is-on" : ""}`}
                    disabled={disabled}
                    title={still.label}
                    onClick={() => pickLast(still.fileName)}
                  >
                    <span
                      className="m-plate-h3-last-thumb"
                      style={{
                        backgroundImage: `url(/api/crash/gen/file?name=${encodeURIComponent(still.fileName)})`,
                      }}
                      aria-hidden
                    />
                    <span>{still.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="m-plate-h3-caps-note">No other still for last frame yet. Draw another take or plate.</p>
          )}
        </div>
      ) : null}
      {mute ? (
        <>
          <p className="m-plate-motion-lock">{motionLock.lead}</p>
          <label className="m-plate-motion-slot">
            <span className="m-plate-motion-slot-mark" aria-hidden>
              [
            </span>
            <textarea
              value={motionSlot}
              placeholder={MUTE_MV_SLOT_PLACEHOLDER}
              rows={2}
              disabled={disabled}
              onChange={(e) => onMotionSlot(e.target.value)}
            />
            <span className="m-plate-motion-slot-mark" aria-hidden>
              ]
            </span>
          </label>
          <p className="m-plate-motion-lock">{motionLock.tail}</p>
        </>
      ) : (
        <label className="m-plate-motion-slot m-plate-motion-sing">
          <textarea
            aria-label="LTX Image motion"
            value={singingBody || ""}
            rows={8}
            disabled={disabled || !onSingingBody}
            onChange={(e) => onSingingBody?.(e.target.value)}
          />
        </label>
      )}
    </div>
  );
}

/**
 * Music-video plate block — LTX / H3 sit where “LTX Image motion” was.
 * Pick the engine, then type motion in the [ ] hole. Does not cook.
 */
export function MuteMvEnginePanel({
  engine,
  onEngine,
  h3Ready,
  motionLock,
  motionSlot,
  onMotionSlot,
  disabled,
  jobId,
  shotId,
  h3LastStills,
}: {
  engine: MuteMvEngine;
  onEngine: (engine: MuteMvEngine) => void;
  h3Ready: boolean;
  motionLock: MuteMvMotionLock;
  motionSlot: string;
  onMotionSlot: (value: string) => void;
  disabled?: boolean;
  jobId?: string;
  shotId?: string;
  h3LastStills?: MinimaxH3LastStill[];
}) {
  return (
    <div className="shot-prompt-ltx shot-prompt-mv-engines">
      <div className="shot-prompt-engines" role="group" aria-label="How to make this clip">
        <button
          type="button"
          className={`shot-prompt-engine${engine === "ltx" ? " is-on" : ""}`}
          disabled={disabled}
          onClick={() => onEngine("ltx")}
        >
          LTX
        </button>
        <button
          type="button"
          className={`shot-prompt-engine${engine === "h3" ? " is-on" : ""}`}
          disabled={disabled || !h3Ready}
          title={h3Ready ? "MiniMax H3" : "H3 is not on this Studio"}
          onClick={() => h3Ready && onEngine("h3")}
        >
          H3
        </button>
        <button
          type="button"
          className={`shot-prompt-engine${engine === "math" ? " is-on" : ""}`}
          disabled={disabled}
          title="Mathematical noise. Not a plate into LTX."
          onClick={() => onEngine("math")}
        >
          MATH
        </button>
      </div>
      {engine === "math" && jobId && shotId ? (
        <MathPatternHole jobId={jobId} shotId={shotId} disabled={disabled} />
      ) : (
      <MuteMvMotionHole
        engine={engine}
        motionLock={motionLock}
        motionSlot={motionSlot}
        onMotionSlot={onMotionSlot}
        disabled={disabled}
        jobId={jobId}
        shotId={shotId}
        h3LastStills={h3LastStills}
      />
      )}
    </div>
  );
}

