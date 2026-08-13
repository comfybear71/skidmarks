"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  beatDraftFields,
  beatReady,
  CRASH_COMFY_DEFAULT_GLOBAL,
  ensureLtxStyleLock,
  formatShotComfyPack,
  listComfyBeats,
  readComfyDraft,
  shotGroups,
  writeComfyDraft,
  type ComfyBeatRow,
  type ComfyDraft,
} from "@/lib/crashComfyStack";
import type { CrashStoryDoc } from "@/lib/crashStoryTypes";
import { CRASH_STORY_SAVED, dispatchStorySaved } from "@/lib/crashStyleSync";
import type { ShowStyleId } from "@/lib/showStylePresets";
import { crashDeskStoryFetchUrl } from "@/lib/crashActiveEpisode";
import { LTX_CLOUD_SKIP_BEAT_IDS } from "@/lib/ltxCloudSkip";
import { MediaThumb } from "@/components/MediaThumb";
import { AnimateTimeline } from "@/components/AnimateTimeline";

type AnimatePanelMode = "ltx" | "lipsync";

type Props = {
  styleId: ShowStyleId;
  mode: AnimatePanelMode;
  onActivityChange?: (activity: {
    ltxRunning: boolean;
    lipsyncRunning: boolean;
  }) => void;
};

/** Columns from Animate panel width (floating card), not the browser window. */
function animateShotCols(width: number): number {
  if (width >= 1100) return 4;
  if (width >= 820) return 3;
  if (width >= 520) return 2;
  return 1;
}

type LtxBeatUi = {
  step:
    | "resolving"
    | "uploading"
    | "converting"
    | "queued"
    | "running"
    | "pulling"
    | "done"
    | "error";
  message: string;
  promptId?: string;
  url?: string;
  error?: string;
  comfyUrl?: string;
  inFlight: boolean;
  verdict?: "pass" | "fail";
};

function hiddenKey(styleId: string): string {
  return `crash-comfy-hidden-${styleId}`;
}

function readHiddenBeats(styleId: string): string[] {
  try {
    const raw = localStorage.getItem(hiddenKey(styleId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function writeHiddenBeats(styleId: string, ids: string[]): void {
  try {
    localStorage.setItem(hiddenKey(styleId), JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Short status for the one-line strip — Queued → Running → Pulling → Done / Error */
function statusLabel(status: LtxBeatUi): string {
  switch (status.step) {
    case "resolving":
    case "uploading":
    case "converting":
      return "Queued";
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "pulling":
      return "Pulling";
    case "done":
      return "Done";
    case "error":
      return status.message?.trim() || "Error";
    default:
      return status.message || "…";
  }
}

function LtxStatusLine({
  status,
  elapsedSec,
}: {
  status: LtxBeatUi;
  elapsedSec: number;
}) {
  const isErr = status.step === "error";
  const isDone = status.step === "done";
  const pulse = status.inFlight;
  const label = statusLabel(status);

  return (
    <div
      className={`mt-1 rounded-sm border px-1.5 py-1 ${
        isErr
          ? "border-[var(--magenta-hot)]/60 bg-[var(--magenta-hot)]/10"
          : isDone
            ? "border-[var(--acid)]/50 bg-[var(--acid)]/10"
            : "border-[var(--line)] bg-[var(--void)]/30"
      }`}
    >
      <p
        className={`text-[9px] leading-snug ${
          isErr
            ? "text-[var(--magenta-hot)]"
            : isDone
              ? "text-[var(--acid)]"
              : "text-[var(--chrome-dim)]"
        } ${pulse ? "animate-pulse" : ""}`}
      >
        {status.inFlight ? (
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--acid)] align-middle" />
        ) : null}
        {label}
        {status.inFlight && elapsedSec > 0 ? (
          <span className="ml-1 text-[var(--mute)]">{elapsedSec}s</span>
        ) : null}
      </p>
    </div>
  );
}

/** After smoke test — up to 3 LTX jobs in flight (not unlimited parallel). */
const LTX_PARALLEL_MAX = 3;

function BeatComfyRow({
  mode,
  styleId,
  row,
  draft,
  onDraftChange,
  onSendLtx,
  onPullLtx,
  onClearBeat,
  onAttachMp4,
  onSendLipsync,
  onPullLipsync,
  onClearLipsync,
  ltxStatus,
  lipsyncStatus,
  ltxInFlightCount,
  anyLipsyncInFlight,
  ltxElapsedSec,
  lipsyncElapsedSec,
  comfyReady,
  lipsyncReady,
  queueBusy,
  onVerdict,
}: {
  mode: AnimatePanelMode;
  styleId: ShowStyleId;
  row: ComfyBeatRow;
  draft: ComfyDraft;
  onDraftChange: (next: ComfyDraft) => void;
  onSendLtx: (beatId: string) => void;
  onPullLtx: (beatId: string) => void;
  onClearBeat: (beatId: string) => void;
  onAttachMp4: (beatId: string, file: File) => void | Promise<void>;
  onSendLipsync: (beatId: string) => void;
  onPullLipsync: (beatId: string) => void;
  onClearLipsync: (beatId: string) => void;
  ltxStatus: LtxBeatUi | undefined;
  lipsyncStatus: LtxBeatUi | undefined;
  ltxInFlightCount: number;
  anyLipsyncInFlight: boolean;
  ltxElapsedSec: number;
  lipsyncElapsedSec: number;
  comfyReady: boolean;
  lipsyncReady: boolean;
  /** Send-all queue running — lock per-card Send */
  queueBusy: boolean;
  onVerdict: (beatId: string, verdict: "pass" | "fail") => void;
}) {
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [attachBusy, setAttachBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fields = beatDraftFields(row, draft);
  const ready = beatReady(row);
  const plateSrc = row.plateFile
    ? `/api/crash/gen/file?name=${encodeURIComponent(row.plateFile)}`
    : null;
  const thisInFlight = Boolean(ltxStatus?.inFlight);
  const lipsyncInFlight = Boolean(lipsyncStatus?.inFlight);
  const hasVideo = Boolean(ltxStatus?.url && ltxStatus.step === "done");
  const hasLipsync = Boolean(
    lipsyncStatus?.url && lipsyncStatus.step === "done",
  );
  /** Prefer lipsync mp4, then LTX — first frame is the card thumb. */
  const thumbVideoSrc =
    (hasLipsync && lipsyncStatus?.url) ||
    (hasVideo && ltxStatus?.url) ||
    null;
  const showPull = Boolean(
    ltxStatus &&
      !thisInFlight &&
      !hasVideo &&
      (ltxStatus.promptId || ltxStatus.step === "error"),
  );
  const showLipsyncPull = Boolean(
    lipsyncStatus &&
      !lipsyncInFlight &&
      !hasLipsync &&
      (lipsyncStatus.promptId || lipsyncStatus.step === "error"),
  );
  const showOpen = Boolean(ltxStatus?.url);
  const slotsFull =
    !thisInFlight && ltxInFlightCount >= LTX_PARALLEL_MAX;
  const canSendLtx =
    ready.ok &&
    comfyReady &&
    !thisInFlight &&
    !slotsFull &&
    !anyLipsyncInFlight &&
    !queueBusy;
  const waitingLtx = mode === "lipsync" && !hasVideo;
  const lipsyncBusy =
    ltxInFlightCount > 0 || anyLipsyncInFlight || lipsyncInFlight;
  const canAttach =
    mode === "ltx" && !thisInFlight && !anyLipsyncInFlight && !attachBusy;

  async function takeMp4(file: File | null | undefined) {
    if (!file || !canAttach) return;
    if (!/\.mp4$/i.test(file.name) && !file.type.includes("mp4")) {
      window.alert("Need an .mp4 file");
      return;
    }
    setAttachBusy(true);
    try {
      await onAttachMp4(row.beatId, file);
    } finally {
      setAttachBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function patchBeat(partial: Partial<{ imageMotion: string; segmentText: string }>) {
    onDraftChange({
      ...draft,
      beats: {
        ...draft.beats,
        [row.beatId]: { ...fields, ...partial },
      },
    });
  }

  return (
    <li
      className={`rounded-sm border border-[var(--line)] bg-[var(--panel)] p-1.5 ${
        waitingLtx ? "opacity-45" : ""
      }`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] uppercase text-[var(--mute)]">
          Beat {row.beatIndex + 1}
        </span>
        <span className="text-[13px] font-medium text-[var(--acid)]">
          {row.speaker || "?"}
        </span>
        {mode === "ltx" ? (
          ready.ok ? (
            <span className="text-[11px] text-[var(--acid)]">Ready ✓</span>
          ) : (
            <span className="text-[11px] text-[var(--mute)]">
              Need {ready.missing.join(", ")}
            </span>
          )
        ) : hasVideo ? (
          <span className="text-[11px] text-[var(--acid)]">LTX ready ✓</span>
        ) : (
          <span className="text-[11px] text-[var(--mute)]">Waiting on LTX</span>
        )}
      </div>

      <div className="mb-1">
        <div className="relative mx-auto mb-1 aspect-[3/2] w-1/2 overflow-hidden rounded-sm border border-[var(--line)] bg-black/50">
          {thumbVideoSrc ? (
            <video
              key={thumbVideoSrc}
              src={thumbVideoSrc}
              controls
              playsInline
              preload="metadata"
              muted
              className="h-full w-full bg-black object-contain"
              title="mp4 thumb — play here"
            />
          ) : plateSrc ? (
            <MediaThumb
              stillSrc={plateSrc}
              className="h-full w-full object-contain"
              title="Click for full size"
              onClick={() =>
                window.open(plateSrc, "_blank", "noopener,noreferrer")
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[12px] text-[var(--mute)]">
              plate missing
            </div>
          )}
        </div>
        <p className="line-clamp-3 text-[13px] leading-snug text-[var(--chrome)]">
          {row.text || "(no line yet)"}
        </p>
      </div>

      {mode === "ltx" ? (
        <>
          <div className="mb-1 flex flex-wrap items-center gap-1">
            <button
              type="button"
              disabled={!canSendLtx}
              onClick={() => onSendLtx(row.beatId)}
              className={`rounded-sm border border-[var(--magenta-hot)]/60 px-2.5 py-1 text-[12px] font-medium text-[var(--magenta-hot)] hover:bg-[var(--magenta-hot)]/10 disabled:opacity-40 ${
                thisInFlight ? "animate-pulse" : ""
              }`}
              title={
                !comfyReady
                  ? "Comfy missing Hotshot nodes — fix pod first (see status above)"
                  : slotsFull
                    ? `Already ${LTX_PARALLEL_MAX} LTX running — wait for one to finish`
                    : anyLipsyncInFlight
                      ? "Wait for lipsync to finish"
                      : "Upload plate + mp3 to Comfy, queue Hotshot for this beat, pull mp4"
              }
            >
              {thisInFlight ? "LTX…" : "Send"}
            </button>
            {showPull ? (
              <button
                type="button"
                disabled={thisInFlight || anyLipsyncInFlight}
                onClick={() => onPullLtx(row.beatId)}
                className="rounded-sm border border-[var(--acid)]/50 px-2.5 py-1 text-[12px] text-[var(--acid)] hover:bg-[var(--acid)]/10 disabled:opacity-40"
                title="Comfy already finished — pull video/LTX_Director mp4 without re-running"
              >
                Pull
              </button>
            ) : null}
            {showOpen && ltxStatus?.url ? (
              <a
                href={ltxStatus.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-sm border border-[var(--line)] px-2.5 py-1 text-[12px] text-[var(--chrome-dim)] hover:border-[var(--acid)]/50 hover:text-[var(--acid)]"
              >
                Open
              </a>
            ) : null}
            {hasVideo || ltxStatus?.step === "error" ? (
              <button
                type="button"
                disabled={thisInFlight || anyLipsyncInFlight}
                onClick={() => onClearBeat(row.beatId)}
                className="ml-auto rounded-sm border border-[var(--line)] px-2 py-1 text-[11px] text-[var(--mute)] hover:text-[var(--chrome)] disabled:opacity-40"
                title="Clear this beat’s LTX status; parks mp4 in data/crash/ltx/_cleared/"
              >
                Clear LTX
              </button>
            ) : null}
          </div>

          <div
            className={`mb-1 rounded-sm border border-dashed px-2 py-1.5 ${
              dragOver
                ? "border-[var(--acid)] bg-[var(--acid)]/10"
                : "border-[var(--line)] bg-[var(--void)]/30"
            }`}
            onDragEnter={(e) => {
              e.preventDefault();
              if (canAttach) setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (canAttach) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              void takeMp4(f);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,.mp4"
              className="hidden"
              onChange={(e) => void takeMp4(e.target.files?.[0])}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={!canAttach}
                onClick={() => fileRef.current?.click()}
                className="rounded-sm border border-[var(--acid)]/50 px-2 py-0.5 text-[11px] text-[var(--acid)] hover:bg-[var(--acid)]/10 disabled:opacity-40"
                title="Copy an mp4 onto this beat — your file stays where it is"
              >
                {attachBusy ? "Adding…" : "Add mp4"}
              </button>
              <span className="text-[10px] text-[var(--mute)]">
                or drop .mp4 here · copy only
              </span>
            </div>
          </div>

          {ltxStatus ? (
            <LtxStatusLine status={ltxStatus} elapsedSec={ltxElapsedSec} />
          ) : null}

          {hasVideo ? (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className="text-[10px] uppercase text-[var(--mute)]">
                QC
              </span>
              <button
                type="button"
                disabled={queueBusy}
                onClick={() => onVerdict(row.beatId, "pass")}
                className={`rounded-sm border px-2 py-0.5 text-[11px] disabled:opacity-40 ${
                  ltxStatus?.verdict === "pass"
                    ? "border-[var(--acid)] bg-[var(--acid)]/20 text-[var(--acid)]"
                    : "border-[var(--line)] text-[var(--chrome-dim)] hover:border-[var(--acid)]/50 hover:text-[var(--acid)]"
                }`}
                title="Pass — keep this take"
              >
                Pass
              </button>
              <button
                type="button"
                disabled={queueBusy}
                onClick={() => onVerdict(row.beatId, "fail")}
                className={`rounded-sm border px-2 py-0.5 text-[11px] disabled:opacity-40 ${
                  ltxStatus?.verdict === "fail"
                    ? "border-[var(--magenta-hot)] bg-[var(--magenta-hot)]/20 text-[var(--magenta-hot)]"
                    : "border-[var(--line)] text-[var(--chrome-dim)] hover:border-[var(--magenta-hot)]/50 hover:text-[var(--magenta-hot)]"
                }`}
                title="Fail — wrong speaker / photo / plate. Send all will redo."
              >
                Fail · redo
              </button>
              {ltxStatus?.verdict === "fail" ? (
                <span className="text-[10px] text-[var(--magenta-hot)]">
                  Will redo on Send all
                </span>
              ) : null}
              <span
                className="w-full text-[10px] text-[var(--mute)]"
                title="Whoever looks biggest / nearest on the plate should be the speaker. Wrong lips = Fail · redo."
              >
                Speaker = prominent on plate. Wrong lips → Fail · redo.
              </span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setPromptsOpen((v) => !v)}
            className="mt-1 text-[11px] text-[var(--chrome-dim)] hover:text-[var(--acid)]"
          >
            Edit prompts {promptsOpen ? "▴" : "▾"}
          </button>
          {promptsOpen ? (
            <>
              <label className="mb-0.5 mt-1 block text-[11px] uppercase text-[var(--mute)]">
                IMAGE — [VISUAL] / [SPEECH]
              </label>
              <textarea
                rows={3}
                value={fields.imageMotion}
                onChange={(e) => patchBeat({ imageMotion: e.target.value })}
                className="mb-1 w-full resize-y rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-1.5 py-1 font-mono text-[12px] text-[var(--chrome)]"
              />
              <label className="mb-0.5 block text-[11px] uppercase text-[var(--mute)]">
                SEGMENT TEXT — Add Text action
              </label>
              <textarea
                rows={2}
                value={fields.segmentText}
                onChange={(e) => patchBeat({ segmentText: e.target.value })}
                className="w-full resize-y rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-1.5 py-1 text-[12px] text-[var(--chrome)]"
              />
            </>
          ) : null}
        </>
      ) : (
        <>
          <div className="mb-1 flex flex-wrap items-center gap-1">
            <button
              type="button"
              disabled={
                !hasVideo || !row.voiceFile || lipsyncBusy || !lipsyncReady
              }
              onClick={() => onSendLipsync(row.beatId)}
              className={`rounded-sm border border-[var(--acid)]/60 px-2.5 py-1 text-[12px] font-medium text-[var(--acid)] hover:bg-[var(--acid)]/10 disabled:opacity-40 ${
                lipsyncInFlight ? "animate-pulse" : ""
              }`}
              title={
                !lipsyncReady
                  ? "Pod/Comfy MuseTalk not ready — Start pod + Recheck MuseTalk"
                  : !hasVideo
                    ? "Send to LTX first — Lipsync needs that mp4"
                    : !row.voiceFile
                      ? "Need beat mp3"
                      : "Queue MuseTalk lipsync (WF_lipsync_v1d) on LTX mp4 + mp3"
              }
            >
              {lipsyncInFlight
                ? "Lipsync…"
                : !lipsyncReady
                  ? "Lipsync (pod not ready)"
                  : "Lipsync"}
            </button>
            {showLipsyncPull ? (
              <button
                type="button"
                disabled={lipsyncBusy}
                onClick={() => onPullLipsync(row.beatId)}
                className="rounded-sm border border-[var(--acid)]/50 px-2.5 py-1 text-[12px] text-[var(--acid)] hover:bg-[var(--acid)]/10 disabled:opacity-40"
                title="Pull lipsync_v1d mp4 from Comfy without re-running"
              >
                Pull LS
              </button>
            ) : null}
            {hasLipsync && lipsyncStatus?.url ? (
              <a
                href={lipsyncStatus.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-sm border border-[var(--line)] px-2.5 py-1 text-[12px] text-[var(--chrome-dim)] hover:border-[var(--acid)]/50 hover:text-[var(--acid)]"
              >
                Open LS
              </a>
            ) : null}
            {hasLipsync || lipsyncStatus?.step === "error" ? (
              <button
                type="button"
                disabled={lipsyncBusy}
                onClick={() => onClearLipsync(row.beatId)}
                className="ml-auto rounded-sm border border-[var(--line)] px-2 py-1 text-[11px] text-[var(--mute)] hover:text-[var(--chrome)] disabled:opacity-40"
                title="Clear lipsync status; parks mp4 in data/crash/lipsync/_cleared/"
              >
                Clear LS
              </button>
            ) : null}
          </div>

          {lipsyncStatus ? (
            <LtxStatusLine status={lipsyncStatus} elapsedSec={lipsyncElapsedSec} />
          ) : null}
        </>
      )}
    </li>
  );
}

async function readLtxNdjsonStream(
  res: Response,
  onEvent: (ev: Record<string, unknown>) => void,
): Promise<void> {
  if (!res.body) {
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(text.slice(0, 300) || `HTTP ${res.status}`);
    }
    if (data.error) throw new Error(String(data.error));
    onEvent({ step: "done", ...data });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let sawTerminal = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        continue;
      }
      onEvent(ev);
      if (ev.step === "done" || ev.step === "error") sawTerminal = true;
    }
  }

  const tail = buf.trim();
  if (tail) {
    try {
      const ev = JSON.parse(tail) as Record<string, unknown>;
      onEvent(ev);
      if (ev.step === "done" || ev.step === "error") sawTerminal = true;
    } catch {
      /* ignore trailing junk */
    }
  }

  if (!sawTerminal) {
    throw new Error(
      "LTX stream ended with no Done/Error — check Comfy queue/history (job may still be running)",
    );
  }
}

export function StyleComfyPanel({ styleId, mode, onActivityChange }: Props) {
  const [story, setStory] = useState<CrashStoryDoc | null>(null);
  const [draft, setDraft] = useState<ComfyDraft>(() => readComfyDraft(styleId));
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [ltxByBeat, setLtxByBeat] = useState<Record<string, LtxBeatUi>>({});
  const [lipsyncByBeat, setLipsyncByBeat] = useState<Record<string, LtxBeatUi>>(
    {},
  );
  const [ltxTick, setLtxTick] = useState(0);
  const [ltxStartedAt, setLtxStartedAt] = useState<Record<string, number>>({});
  const [lipsyncStartedAt, setLipsyncStartedAt] = useState<
    Record<string, number>
  >({});
  const [comfyPreflight, setComfyPreflight] = useState<{
    ok: boolean;
    missing: string[];
    hint: string;
    reachable: boolean;
    checking: boolean;
  } | null>(null);
  const [lipsyncPreflight, setLipsyncPreflight] = useState<{
    ok: boolean;
    missing: string[];
    hint: string;
    reachable: boolean;
    checking: boolean;
  } | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>(() =>
    typeof window !== "undefined" ? readHiddenBeats(styleId) : [],
  );
  const [showHidden, setShowHidden] = useState(false);
  const [panelW, setPanelW] = useState(0);
  const shotGridRef = useRef<HTMLDivElement>(null);
  const sendAllCancelRef = useRef(false);
  const storySaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storyLatestRef = useRef<CrashStoryDoc | null>(null);
  /** Kill hung LTX fetch/stream on Unlock */
  const ltxAbortRef = useRef<AbortController | null>(null);
  /** Bumped on Unlock — ignore late stream patches */
  const ltxEpochRef = useRef(0);
  const [sendAllProgress, setSendAllProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);
  const [comfyLive, setComfyLive] = useState<{
    busy: boolean;
    running: number;
    pending: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = crashDeskStoryFetchUrl(styleId);
      if (!url) {
        setStory(null);
        return;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.story) setStory(data.story as CrashStoryDoc);
    } finally {
      setLoading(false);
    }
  }, [styleId]);

  /** Restore video players after hard refresh (server results.json). */
  const loadLtxResults = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/crash/comfy/ltx?styleId=${encodeURIComponent(styleId)}`,
      );
      const data = (await res.json()) as {
        results?: Array<{
          beatId: string;
          url: string;
          promptId?: string;
          verdict?: "pass" | "fail";
        }>;
      };
      if (!res.ok || !Array.isArray(data.results)) return;
      setLtxByBeat((prev) => {
        const next = { ...prev };
        for (const r of data.results!) {
          if (!r.beatId || !r.url) continue;
          if (next[r.beatId]?.inFlight) continue;
          next[r.beatId] = {
            step: "done",
            message: "Done",
            url: r.url,
            promptId: r.promptId,
            inFlight: false,
            verdict: r.verdict === "pass" || r.verdict === "fail" ? r.verdict : undefined,
          };
        }
        return next;
      });
    } catch {
      /* ignore */
    }
  }, [styleId]);

  const loadLipsyncResults = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/crash/comfy/lipsync?styleId=${encodeURIComponent(styleId)}`,
      );
      const data = (await res.json()) as {
        results?: Array<{ beatId: string; url: string; promptId?: string }>;
      };
      if (!res.ok || !Array.isArray(data.results)) return;
      setLipsyncByBeat((prev) => {
        const next = { ...prev };
        for (const r of data.results!) {
          if (!r.beatId || !r.url) continue;
          if (next[r.beatId]?.inFlight) continue;
          next[r.beatId] = {
            step: "done",
            message: "Done",
            url: r.url,
            promptId: r.promptId,
            inFlight: false,
          };
        }
        return next;
      });
    } catch {
      /* ignore */
    }
  }, [styleId]);

  const runComfyPreflight = useCallback(async (): Promise<{
    ok: boolean;
    missing: string[];
    hint: string;
    reachable: boolean;
  }> => {
    setComfyPreflight((prev) => ({
      ok: prev?.ok ?? false,
      missing: prev?.missing ?? [],
      hint: prev?.hint ?? "",
      reachable: prev?.reachable ?? false,
      checking: true,
    }));
    try {
      const res = await fetch("/api/crash/ltx/preflight", { method: "GET" });
      const data = (await res.json()) as {
        ok?: boolean;
        missing?: string[];
        hint?: string;
        reachable?: boolean;
        error?: string;
      };
      const missing = Array.isArray(data.missing) ? data.missing : [];
      const next = {
        ok: Boolean(data.ok),
        missing,
        hint: String(data.hint || data.error || ""),
        reachable: data.reachable !== false,
        checking: false,
      };
      setComfyPreflight(next);
      return next;
    } catch (e) {
      const next = {
        ok: false,
        missing: [] as string[],
        hint:
          e instanceof Error
            ? e.message
            : "Preflight failed — is Studio running?",
        reachable: false,
        checking: false,
      };
      setComfyPreflight(next);
      return next;
    }
  }, []);

  const runLipsyncPreflight = useCallback(async (): Promise<{
    ok: boolean;
    missing: string[];
    hint: string;
    reachable: boolean;
  }> => {
    setLipsyncPreflight((prev) => ({
      ok: prev?.ok ?? false,
      missing: prev?.missing ?? [],
      hint: prev?.hint ?? "",
      reachable: prev?.reachable ?? false,
      checking: true,
    }));
    try {
      const res = await fetch("/api/crash/lipsync/preflight", {
        method: "GET",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        missing?: string[];
        hint?: string;
        reachable?: boolean;
        error?: string;
      };
      const missing = Array.isArray(data.missing) ? data.missing : [];
      const next = {
        ok: Boolean(data.ok),
        missing,
        hint: String(data.hint || data.error || ""),
        reachable: data.reachable !== false,
        checking: false,
      };
      setLipsyncPreflight(next);
      return next;
    } catch (e) {
      const next = {
        ok: false,
        missing: [] as string[],
        hint:
          e instanceof Error
            ? e.message
            : "MuseTalk preflight failed — is Studio running?",
        reachable: false,
        checking: false,
      };
      setLipsyncPreflight(next);
      return next;
    }
  }, []);

  useEffect(() => {
    setDraft(readComfyDraft(styleId));
    setLtxByBeat({});
    setLipsyncByBeat({});
    setHiddenIds(readHiddenBeats(styleId));
    setShowHidden(false);
    setSelectedBeatId(null);
    void load();
    void loadLtxResults();
    void loadLipsyncResults();
    void runComfyPreflight();
    void runLipsyncPreflight();
    const onStory = () => {
      // Don't wipe LTX / draft — Story edits from Animate must keep the cut queue.
      void load();
      void loadLtxResults();
      void loadLipsyncResults();
    };
    window.addEventListener(CRASH_STORY_SAVED, onStory);
    return () => window.removeEventListener(CRASH_STORY_SAVED, onStory);
  }, [
    styleId,
    load,
    loadLtxResults,
    loadLipsyncResults,
    runComfyPreflight,
    runLipsyncPreflight,
  ]);

  useEffect(() => {
    writeComfyDraft(styleId, draft);
  }, [styleId, draft]);

  const ltxInFlightCount = Object.values(ltxByBeat).filter((s) => s.inFlight).length;
  const anyLtxInFlight = ltxInFlightCount > 0;
  const anyLipsyncInFlight = Object.values(lipsyncByBeat).some(
    (s) => s.inFlight,
  );

  useEffect(() => {
    onActivityChange?.({ ltxRunning: anyLtxInFlight, lipsyncRunning: anyLipsyncInFlight });
  }, [anyLtxInFlight, anyLipsyncInFlight, onActivityChange]);

  useEffect(() => {
    if (!anyLtxInFlight && !anyLipsyncInFlight) return;
    const id = window.setInterval(() => setLtxTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [anyLtxInFlight, anyLipsyncInFlight]);

  const rows = story ? listComfyBeats(story) : [];
  const visibleRows = useMemo(() => {
    if (showHidden) return rows;
    const hide = new Set(hiddenIds);
    return rows.filter((r) => !hide.has(r.beatId));
  }, [rows, hiddenIds, showHidden]);
  const groups = shotGroups(visibleRows);
  const cols = animateShotCols(panelW);
  const doneCount = Object.values(ltxByBeat).filter((s) => s.step === "done").length;
  const lipsyncDoneCount = Object.values(lipsyncByBeat).filter(
    (s) => s.step === "done",
  ).length;
  void ltxTick; // re-render clock while a job is in flight

  const storyReady = Boolean(story);
  useEffect(() => {
    if (!storyReady) return;
    const el = shotGridRef.current;
    if (!el) return;
    const apply = () => setPanelW(el.clientWidth);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [storyReady, styleId]);

  function patchLtx(beatId: string, partial: Partial<LtxBeatUi>) {
    setLtxByBeat((prev) => {
      const cur = prev[beatId];
      return {
        ...prev,
        [beatId]: {
          step: partial.step || cur?.step || "resolving",
          message: partial.message ?? cur?.message ?? "…",
          promptId: partial.promptId ?? cur?.promptId,
          url: partial.url !== undefined ? partial.url : cur?.url,
          error: partial.error !== undefined ? partial.error : cur?.error,
          comfyUrl: partial.comfyUrl ?? cur?.comfyUrl,
          inFlight: partial.inFlight ?? cur?.inFlight ?? false,
          verdict:
            partial.verdict !== undefined ? partial.verdict : cur?.verdict,
        },
      };
    });
  }

  async function setLtxVerdict(beatId: string, verdict: "pass" | "fail") {
    patchLtx(beatId, { verdict });
    try {
      const res = await fetch("/api/crash/comfy/ltx/verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId, beatId, verdict }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(data.error || "Could not save pass/fail");
        return;
      }
      setMsg(
        verdict === "pass"
          ? "Marked pass"
          : "Marked fail — Send all will redo this one",
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Verdict failed");
    }
  }

  function patchLipsync(beatId: string, partial: Partial<LtxBeatUi>) {
    setLipsyncByBeat((prev) => {
      const cur = prev[beatId];
      return {
        ...prev,
        [beatId]: {
          step: partial.step || cur?.step || "resolving",
          message: partial.message ?? cur?.message ?? "…",
          promptId: partial.promptId ?? cur?.promptId,
          url: partial.url !== undefined ? partial.url : cur?.url,
          error: partial.error !== undefined ? partial.error : cur?.error,
          comfyUrl: partial.comfyUrl ?? cur?.comfyUrl,
          inFlight: partial.inFlight ?? cur?.inFlight ?? false,
        },
      };
    });
  }

  function unhideAll() {
    writeHiddenBeats(styleId, []);
    setHiddenIds([]);
    setShowHidden(false);
  }

  function hideDoneBeats() {
    const doneIds = Object.entries(ltxByBeat)
      .filter(([, s]) => s.step === "done")
      .map(([id]) => id);
    if (doneIds.length === 0) {
      setMsg("No done beats to hide");
      return;
    }
    setHiddenIds((prev) => {
      const next = Array.from(new Set([...prev, ...doneIds]));
      writeHiddenBeats(styleId, next);
      return next;
    });
    setMsg(`Hid ${doneIds.length} done beat${doneIds.length === 1 ? "" : "s"} from list`);
  }

  function hideDoneLipsyncBeats() {
    const doneIds = Object.entries(lipsyncByBeat)
      .filter(([, s]) => s.step === "done")
      .map(([id]) => id);
    if (doneIds.length === 0) {
      setMsg("No done lipsync beats to hide");
      return;
    }
    setHiddenIds((prev) => {
      const next = Array.from(new Set([...prev, ...doneIds]));
      writeHiddenBeats(styleId, next);
      return next;
    });
    setMsg(
      `Hid ${doneIds.length} done lipsync beat${doneIds.length === 1 ? "" : "s"} from list`,
    );
  }

  async function clearLtxResults(beatId?: string) {
    if (anyLtxInFlight || anyLipsyncInFlight) return;
    setMsg(beatId ? "Clearing beat LTX…" : "Clearing LTX for this show…");
    try {
      const res = await fetch("/api/crash/comfy/ltx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId,
          clear: true,
          ...(beatId ? { beatId } : {}),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        cleared?: number;
        moved?: string[];
      };
      if (!res.ok) throw new Error(data.error || "Clear failed");

      if (beatId) {
        setLtxByBeat((prev) => {
          const next = { ...prev };
          delete next[beatId];
          return next;
        });
      } else {
        setLtxByBeat({});
      }

      const moved = data.moved?.length || 0;
      const cleared = data.cleared || 0;
      setMsg(
        cleared === 0 && moved === 0
          ? "Nothing to clear"
          : `Cleared ${cleared} · parked ${moved} mp4 → data\\crash\\ltx\\_cleared\\`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Clear failed");
    }
  }

  async function attachMp4(beatId: string, file: File) {
    if (anyLtxInFlight || anyLipsyncInFlight) return;
    setMsg(`Adding mp4 to beat…`);
    try {
      const fd = new FormData();
      fd.set("styleId", styleId);
      fd.set("beatId", beatId);
      fd.set("file", file, file.name);
      const res = await fetch("/api/crash/comfy/ltx/attach", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as {
        error?: string;
        url?: string;
        file?: string;
      };
      if (!res.ok || !data.url) throw new Error(data.error || "Attach failed");
      setLtxByBeat((prev) => ({
        ...prev,
        [beatId]: {
          step: "done",
          message: "Attached",
          url: data.url!,
          promptId: "attach",
          inFlight: false,
        },
      }));
      setMsg(`mp4 on beat · ${data.file || "ok"} (copy in data\\crash\\ltx\\)`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Attach failed");
    }
  }

  async function clearLipsyncResults(beatId?: string) {
    if (anyLtxInFlight || anyLipsyncInFlight) return;
    setMsg(beatId ? "Clearing beat lipsync…" : "Clearing lipsync for this show…");
    try {
      const res = await fetch("/api/crash/comfy/lipsync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId,
          clear: true,
          ...(beatId ? { beatId } : {}),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        cleared?: number;
        moved?: string[];
      };
      if (!res.ok) throw new Error(data.error || "Clear failed");

      if (beatId) {
        setLipsyncByBeat((prev) => {
          const next = { ...prev };
          delete next[beatId];
          return next;
        });
      } else {
        setLipsyncByBeat({});
      }

      const moved = data.moved?.length || 0;
      const cleared = data.cleared || 0;
      setMsg(
        cleared === 0 && moved === 0
          ? "Nothing to clear"
          : `Cleared ${cleared} · parked ${moved} mp4 → data\\crash\\lipsync\\_cleared\\`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Clear failed");
    }
  }

  async function copyShot(shotId: string) {
    const text = formatShotComfyPack({ shotId, rows, draft, styleId });
    if (await copyText(text)) setMsg("Shot copied — paste into Comfy");
  }

  async function copyAll() {
    const allGroups = shotGroups(rows);
    const parts = allGroups.map((g) =>
      formatShotComfyPack({ shotId: g.shotId, rows, draft, styleId }),
    );
    if (await copyText(parts.filter(Boolean).join("\n\n==========\n\n"))) {
      setMsg("Full stack copied");
    }
  }

  async function exportFolder() {
    setMsg("Exporting…");
    try {
      const res = await fetch("/api/crash/comfy/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export failed");
      setMsg(
        `Exported → blueprint\\planner\\data\\crash\\comfy-export\\${styleId}\\…\\ (${data.shots?.length || 0} shots)`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Export failed");
    }
  }

  async function pullLtx(beatId: string) {
    setLtxStartedAt((prev) => ({ ...prev, [beatId]: Date.now() }));
    patchLtx(beatId, {
      step: "pulling",
      message: "Pulling",
      inFlight: true,
      error: undefined,
    });
    setMsg("");
    try {
      const res = await fetch("/api/crash/comfy/ltx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId, beatId, recover: true }),
      });
      const data = (await res.json()) as {
        error?: string;
        url?: string;
        comfyFile?: string;
      };
      if (!res.ok) throw new Error(data.error || `Pull failed (HTTP ${res.status})`);
      patchLtx(beatId, {
        step: "done",
        message: "Done",
        url: typeof data.url === "string" ? data.url : undefined,
        inFlight: false,
        error: undefined,
      });
      setMsg("Pulled mp4 from Comfy");
    } catch (e) {
      const err = e instanceof Error ? e.message : "Pull failed";
      patchLtx(beatId, {
        step: "error",
        message: err,
        error: err,
        inFlight: false,
      });
    }
  }

  async function sendLtx(
    beatId: string,
    opts?: { fromQueue?: boolean },
  ): Promise<boolean> {
    const row = rows.find((r) => r.beatId === beatId);
    if (!row) return false;
    if (!opts?.fromQueue) {
      const flying = Object.values(ltxByBeat).filter((s) => s.inFlight).length;
      if (ltxByBeat[beatId]?.inFlight) return false;
      if (flying >= LTX_PARALLEL_MAX) {
        setMsg(`Already ${LTX_PARALLEL_MAX} LTX running — wait for one to finish`);
        return false;
      }
    }
    const fields = beatDraftFields(row, draft);

    // Fresh preflight — never queue into missing-node /prompt rejects
    const pre = await runComfyPreflight();
    if (!pre.ok) {
      const miss =
        pre.missing.length > 0
          ? `Comfy missing: ${pre.missing.slice(0, 4).join(", ")}${
              pre.missing.length > 4 ? "…" : ""
            }`
          : "Comfy not ready";
      const err = `${miss}. ${pre.hint}`.trim();
      patchLtx(beatId, {
        step: "error",
        message: err,
        error: err,
        inFlight: false,
      });
      setMsg(err);
      return false;
    }

    setLtxStartedAt((prev) => ({ ...prev, [beatId]: Date.now() }));
    patchLtx(beatId, {
      step: "resolving",
      message: "Queued",
      inFlight: true,
      url: undefined,
      error: undefined,
      promptId: undefined,
      verdict: undefined,
    });
    setMsg("");

    try {
      // No AbortSignal — wait out the whole LTX run. Never cancel mid-job.
      const res = await fetch("/api/crash/comfy/ltx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId,
          beatId,
          plateFile: row.plateFile,
          imageMotion: fields.imageMotion,
          segmentText: fields.segmentText,
          global: ensureLtxStyleLock(
            (draft.global || "").trim() || CRASH_COMFY_DEFAULT_GLOBAL,
          ),
        }),
      });

      const ct = res.headers.get("content-type") || "";
      const isStream = ct.includes("ndjson");

      if (!isStream) {
        let data: { error?: string; url?: string; promptId?: string } = {};
        try {
          data = (await res.json()) as typeof data;
        } catch {
          throw new Error(
            res.status === 0
              ? "Network failed — is Studio running? Is Comfy up?"
              : `LTX failed (HTTP ${res.status}) — empty/non-JSON reply`,
          );
        }
        if (!res.ok) {
          throw new Error(data.error || `LTX failed (HTTP ${res.status})`);
        }
        patchLtx(beatId, {
          step: "done",
          message: "Done",
          url: typeof data.url === "string" ? data.url : undefined,
          promptId: typeof data.promptId === "string" ? data.promptId : undefined,
          inFlight: false,
          error: undefined,
        });
        return true;
      }

      let ok = false;
      let sawError = false;
      await readLtxNdjsonStream(res, (ev) => {
        const step = String(ev.step || "");
        const message = String(ev.message || ev.error || step || "…");
        const promptId =
          typeof ev.promptId === "string" ? ev.promptId : undefined;
        const comfyUrl =
          typeof ev.comfyUrl === "string" ? ev.comfyUrl : undefined;

        if (step === "error") {
          const err = String(ev.error || message);
          sawError = true;
          ok = false;
          patchLtx(beatId, {
            step: "error",
            message: err,
            error: err,
            promptId,
            comfyUrl,
            inFlight: false,
          });
          return;
        }

        if (step === "done") {
          ok = true;
          patchLtx(beatId, {
            step: "done",
            message: "Done",
            url: typeof ev.url === "string" ? ev.url : undefined,
            promptId,
            comfyUrl,
            inFlight: false,
            error: undefined,
          });
          return;
        }

        const known = [
          "resolving",
          "uploading",
          "converting",
          "queued",
          "running",
          "pulling",
        ] as const;
        const nextStep = (known as readonly string[]).includes(step)
          ? (step as LtxBeatUi["step"])
          : "running";
        patchLtx(beatId, {
          step: nextStep,
          message,
          promptId,
          comfyUrl,
          inFlight: true,
          error: undefined,
        });
      });
      return ok && !sawError;
    } catch (e) {
      const err =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "LTX failed";
      const nice =
        /Failed to fetch|NetworkError|Load failed/i.test(err)
          ? `${err} — Studio server or Comfy unreachable (check pod + COMFY_URL)`
          : err;
      patchLtx(beatId, {
        step: "error",
        message: nice,
        error: nice,
        inFlight: false,
      });
      return false;
    }
  }

  async function sendAllLtx() {
    if (sendAllProgress) return;
    if (anyLipsyncInFlight) {
      setMsg("Wait for lipsync to finish before Send all");
      return;
    }
    if (anyLtxInFlight) {
      setMsg("Wait for running LTX to finish before Send all");
      return;
    }

    sendAllCancelRef.current = false;
    const pending = visibleRows.filter((r) => {
      if (LTX_CLOUD_SKIP_BEAT_IDS.has(r.beatId)) return false;
      if (!beatReady(r).ok) return false;
      const st = ltxByBeat[r.beatId];
      if (st?.inFlight) return false;
      // Done + pass (or unmarked) = skip; fail = redo
      if (st?.step === "done" && st.url && st.verdict !== "fail") return false;
      return true;
    });

    if (!pending.length) {
      setMsg(
        "Nothing to Send all — dam + laundry Dazza skipped; rest already done or not ready",
      );
      return;
    }

    setSendAllProgress({
      current: 0,
      total: pending.length,
      label: "Starting Cloud…",
    });
    let okN = 0;
    let failN = 0;
    setMsg(
      `Send all → Comfy Cloud IA2V · ${pending.length} beats (dam + laundry Dazza skipped)`,
    );

    for (let i = 0; i < pending.length; i += 1) {
      if (sendAllCancelRef.current) {
        setMsg(
          `Send all stopped after current — ${okN} ok, ${failN} failed, ${pending.length - i} left`,
        );
        break;
      }
      const row = pending[i]!;
      const label = row.shotTitle || row.speaker || row.beatId;
      setSendAllProgress({
        current: i + 1,
        total: pending.length,
        label,
      });
      setMsg(`Send all ${i + 1}/${pending.length}: ${label}`);
      const ok = await sendLtx(row.beatId, { fromQueue: true });
      if (ok) okN += 1;
      else failN += 1;
    }

    setSendAllProgress(null);
    if (!sendAllCancelRef.current) {
      setMsg(`Send all finished — ${okN} ok, ${failN} failed`);
    }
  }

  /** Stuck Run / greyed buttons — clear local in-flight (Comfy queue may already be empty). */
  const forceUnlockStuckLtx = useCallback(() => {
    sendAllCancelRef.current = true;
    setSendAllProgress(null);
    setLtxByBeat((prev) => {
      const next = { ...prev };
      for (const [id, st] of Object.entries(next)) {
        if (!st?.inFlight) continue;
        next[id] = {
          ...st,
          inFlight: false,
          step: "error",
          message: "Unlocked — Send again",
          error: "Unlocked stuck job",
        };
      }
      return next;
    });
    setMsg("Unlocked stuck LTX — select the clip and Send again");
  }, []);

  /** Poll real Comfy queue — WORKING vs IDLE only. Never auto-kill Studio jobs. */
  useEffect(() => {
    if (mode !== "ltx") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/crash/comfy/status", {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          busy?: boolean;
          running?: number;
          pending?: number;
        };
        if (cancelled) return;
        setComfyLive({
          busy: Boolean(data.busy),
          running: Number(data.running) || 0,
          pending: Number(data.pending) || 0,
        });
      } catch {
        if (!cancelled) setComfyLive(null);
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [mode]);

  async function replacePlateKeepFail(shotId: string, plateFile: string) {
    if (!story || shotId.startsWith("__")) return;
    if (anyLtxInFlight || anyLipsyncInFlight) {
      setMsg("Wait for LTX to finish before replacing plates");
      return;
    }

    const beatIds = listComfyBeats(story)
      .filter((r) => r.shotId === shotId)
      .map((r) => r.beatId);

    // Park old mp4s first so a story-save reload can't put them back
    for (const id of beatIds) {
      try {
        await fetch("/api/crash/comfy/ltx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ styleId, clear: true, beatId: id }),
        });
      } catch {
        /* keep going */
      }
    }

    setLtxByBeat((prev) => {
      const out = { ...prev };
      for (const id of beatIds) {
        out[id] = {
          step: "done",
          message: "New plate — Fail, waiting Send all",
          url: undefined,
          inFlight: false,
          verdict: "fail",
        };
      }
      return out;
    });

    const scenes = story.scenes.map((sc) => ({
      ...sc,
      shots: sc.shots.map((sh) =>
        sh.id === shotId ? { ...sh, plateFile } : sh,
      ),
    }));
    const next = { ...story, scenes, updatedAt: new Date().toISOString() };
    await saveStoryDoc(
      next,
      `Plate replaced · ${beatIds.length} Fail — Send all when ready`,
      true,
    );
  }

  async function reorderShotsById(fromShotId: string, toShotId: string) {
    if (!story || fromShotId === toShotId) return;
    if (fromShotId.startsWith("__") || toShotId.startsWith("__")) return;

    let fromSceneIdx = -1;
    let fromShotIdx = -1;
    let toSceneIdx = -1;
    let toShotIdx = -1;
    for (let si = 0; si < story.scenes.length; si += 1) {
      const shots = story.scenes[si]!.shots;
      const fi = shots.findIndex((s) => s.id === fromShotId);
      if (fi >= 0) {
        fromSceneIdx = si;
        fromShotIdx = fi;
      }
      const ti = shots.findIndex((s) => s.id === toShotId);
      if (ti >= 0) {
        toSceneIdx = si;
        toShotIdx = ti;
      }
    }
    if (fromSceneIdx < 0 || toSceneIdx < 0 || fromShotIdx < 0 || toShotIdx < 0) {
      return;
    }

    const scenes = story.scenes.map((sc) => ({
      ...sc,
      shots: [...sc.shots],
    }));
    const [moved] = scenes[fromSceneIdx]!.shots.splice(fromShotIdx, 1);
    if (!moved) return;

    if (fromSceneIdx === toSceneIdx) {
      scenes[toSceneIdx]!.shots.splice(toShotIdx, 0, moved);
    } else {
      scenes[toSceneIdx]!.shots.splice(toShotIdx, 0, moved);
    }

    const next = { ...story, scenes, updatedAt: new Date().toISOString() };
    await saveStoryDoc(next, `Moved shot: ${moved.title}`, true);
  }

  function saveStoryDoc(
    next: CrashStoryDoc,
    okMsg?: string,
    flush?: boolean,
  ): Promise<void> {
    setStory(next);
    storyLatestRef.current = next;
    if (okMsg) setMsg(okMsg);

    const doPut = async () => {
      const doc = storyLatestRef.current || next;
      try {
        const res = await fetch("/api/crash/story", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ story: doc }),
        });
        const data = (await res.json()) as {
          error?: string;
          story?: CrashStoryDoc;
        };
        if (!res.ok) {
          setMsg(data.error || "Could not save story");
          void load();
          return;
        }
        if (data.story) {
          setStory(data.story);
          storyLatestRef.current = data.story;
        }
        dispatchStorySaved();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Could not save story");
        void load();
      }
    };

    if (flush) {
      if (storySaveTimer.current) {
        clearTimeout(storySaveTimer.current);
        storySaveTimer.current = null;
      }
      return doPut();
    }

    if (storySaveTimer.current) clearTimeout(storySaveTimer.current);
    return new Promise((resolve) => {
      storySaveTimer.current = setTimeout(() => {
        void doPut().finally(() => resolve());
      }, 450);
    });
  }

  async function pullLipsync(beatId: string) {
    const prior = lipsyncByBeat[beatId];
    setLipsyncStartedAt((prev) => ({ ...prev, [beatId]: Date.now() }));
    patchLipsync(beatId, {
      step: "pulling",
      message: "Pulling",
      inFlight: true,
      error: undefined,
    });
    setMsg("");
    try {
      const res = await fetch("/api/crash/comfy/lipsync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId,
          beatId,
          recover: true,
          promptId: prior?.promptId,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        url?: string;
        promptId?: string;
      };
      if (!res.ok) throw new Error(data.error || `Pull failed (HTTP ${res.status})`);
      patchLipsync(beatId, {
        step: "done",
        message: "Done",
        url: typeof data.url === "string" ? data.url : undefined,
        promptId:
          typeof data.promptId === "string" ? data.promptId : prior?.promptId,
        inFlight: false,
        error: undefined,
      });
      setMsg("Pulled lipsync mp4 from Comfy");
    } catch (e) {
      const err = e instanceof Error ? e.message : "Pull failed";
      patchLipsync(beatId, {
        step: "error",
        message: err,
        error: err,
        inFlight: false,
      });
    }
  }

  async function sendLipsync(beatId: string) {
    const row = rows.find((r) => r.beatId === beatId);
    if (!row) return;
    const ltx = ltxByBeat[beatId];
    if (!ltx?.url || ltx.step !== "done") {
      const err = "Send to LTX first — Lipsync needs that mp4";
      patchLipsync(beatId, {
        step: "error",
        message: err,
        error: err,
        inFlight: false,
      });
      setMsg(err);
      return;
    }

    const pre = await runLipsyncPreflight();
    if (!pre.ok) {
      const miss =
        pre.missing.length > 0
          ? `MuseTalk missing: ${pre.missing.slice(0, 4).join(", ")}${
              pre.missing.length > 4 ? "…" : ""
            }`
          : "Pod/Comfy MuseTalk not ready";
      const err = `${miss}. ${pre.hint}`.trim();
      patchLipsync(beatId, {
        step: "error",
        message: err,
        error: err,
        inFlight: false,
      });
      setMsg(err);
      return;
    }

    setLipsyncStartedAt((prev) => ({ ...prev, [beatId]: Date.now() }));
    patchLipsync(beatId, {
      step: "resolving",
      message: "Queued",
      inFlight: true,
      url: undefined,
      error: undefined,
      promptId: undefined,
    });
    setMsg("");

    try {
      const res = await fetch("/api/crash/comfy/lipsync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId, beatId }),
      });

      const ct = res.headers.get("content-type") || "";
      const isStream = ct.includes("ndjson");

      if (!isStream) {
        let data: { error?: string; url?: string; promptId?: string } = {};
        try {
          data = (await res.json()) as typeof data;
        } catch {
          throw new Error(
            res.status === 0
              ? "Network failed — is Studio running? Is Comfy up?"
              : `Lipsync failed (HTTP ${res.status}) — empty/non-JSON reply`,
          );
        }
        if (!res.ok) {
          throw new Error(data.error || `Lipsync failed (HTTP ${res.status})`);
        }
        patchLipsync(beatId, {
          step: "done",
          message: "Done",
          url: typeof data.url === "string" ? data.url : undefined,
          promptId:
            typeof data.promptId === "string" ? data.promptId : undefined,
          inFlight: false,
          error: undefined,
        });
        return;
      }

      await readLtxNdjsonStream(res, (ev) => {
        const step = String(ev.step || "");
        const message = String(ev.message || ev.error || step || "…");
        const promptId =
          typeof ev.promptId === "string" ? ev.promptId : undefined;
        const comfyUrl =
          typeof ev.comfyUrl === "string" ? ev.comfyUrl : undefined;

        if (step === "error") {
          const err = String(ev.error || message);
          patchLipsync(beatId, {
            step: "error",
            message: err,
            error: err,
            promptId,
            comfyUrl,
            inFlight: false,
          });
          return;
        }

        if (step === "done") {
          patchLipsync(beatId, {
            step: "done",
            message: "Done",
            url: typeof ev.url === "string" ? ev.url : undefined,
            promptId,
            comfyUrl,
            inFlight: false,
            error: undefined,
          });
          return;
        }

        const known = [
          "resolving",
          "uploading",
          "converting",
          "queued",
          "running",
          "pulling",
        ] as const;
        const nextStep = (known as readonly string[]).includes(step)
          ? (step as LtxBeatUi["step"])
          : "running";
        patchLipsync(beatId, {
          step: nextStep,
          message,
          promptId,
          comfyUrl,
          inFlight: true,
          error: undefined,
        });
      });
    } catch (e) {
      const err =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "Lipsync failed";
      const nice = /Failed to fetch|NetworkError|Load failed/i.test(err)
        ? `${err} — Studio server or Comfy unreachable (check pod + COMFY_URL)`
        : err;
      patchLipsync(beatId, {
        step: "error",
        message: nice,
        error: nice,
        inFlight: false,
      });
    }
  }

  if (loading && !story) {
    return (
      <p className="min-h-0 flex-1 text-[10px] text-[var(--mute)]">
        Loading story…
      </p>
    );
  }

  if (!story) {
    return (
      <p className="min-h-0 flex-1 text-[10px] text-[var(--mute)]">
        No story yet — fill Story for {mode === "ltx" ? "LTX" : "Lipsync"}.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-2 overflow-hidden">
      {mode === "ltx" ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-[13px]">
          {comfyPreflight?.checking || !comfyPreflight ? (
            <span className="text-[var(--mute)]">Checking Comfy…</span>
          ) : !comfyPreflight.ok ? (
            <span className="font-semibold text-[var(--magenta-hot)]">
              Comfy missing:{" "}
              {comfyPreflight.missing.length
                ? comfyPreflight.missing.slice(0, 5).join(", ") +
                  (comfyPreflight.missing.length > 5 ? "…" : "")
                : "unreachable"}
            </span>
          ) : comfyLive?.busy ? (
            <span className="animate-pulse font-bold text-[var(--acid)]">
              WORKING · {comfyLive.running} run
              {comfyLive.pending
                ? ` · ${comfyLive.pending} queued`
                : ""}
            </span>
          ) : (
            <span className="font-semibold text-[var(--chrome-dim)]">
              {/cloud/i.test(comfyPreflight.hint || "")
                ? "IDLE · Comfy Cloud ready"
                : "IDLE · Comfy ready"}
            </span>
          )}
          <button
            type="button"
            onClick={() => void runComfyPreflight()}
            disabled={Boolean(comfyPreflight?.checking)}
            className="text-[12px] text-[var(--chrome-dim)] underline hover:text-[var(--acid)] disabled:opacity-40"
            title="Re-check Hotfix nodes before Send"
          >
            Recheck
          </button>
          {comfyPreflight && !comfyPreflight.ok && comfyPreflight.hint ? (
            <span className="basis-full text-[12px] leading-snug text-[var(--mute)]">
              {comfyPreflight.hint}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-[9px]">
          {lipsyncPreflight?.checking || !lipsyncPreflight ? (
            <span className="text-[var(--mute)]">Checking MuseTalk…</span>
          ) : lipsyncPreflight.ok ? (
            <span className="text-[var(--acid)]">MuseTalk ready</span>
          ) : (
            <span className="text-[var(--magenta-hot)]">
              MuseTalk missing:{" "}
              {lipsyncPreflight.missing.length
                ? lipsyncPreflight.missing.slice(0, 5).join(", ") +
                  (lipsyncPreflight.missing.length > 5 ? "…" : "")
                : "pod/Comfy not ready"}
            </span>
          )}
          <button
            type="button"
            onClick={() => void runLipsyncPreflight()}
            disabled={Boolean(lipsyncPreflight?.checking)}
            className="text-[8px] text-[var(--chrome-dim)] underline hover:text-[var(--acid)] disabled:opacity-40"
            title="Re-check MuseTalk nodes before Lipsync"
          >
            Recheck MuseTalk
          </button>
          {lipsyncPreflight &&
          !lipsyncPreflight.ok &&
          lipsyncPreflight.hint ? (
            <span className="basis-full text-[8px] leading-snug text-[var(--mute)]">
              {lipsyncPreflight.hint}
            </span>
          ) : null}
        </div>
      )}

      {mode === "ltx" ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <span className="text-[13px] text-[var(--chrome-dim)]">
            {sendAllProgress
              ? `Send all ${sendAllProgress.current}/${sendAllProgress.total}`
              : `LTX ${ltxInFlightCount}/${LTX_PARALLEL_MAX} running`}
          </span>
          <button
            type="button"
            disabled={
              !comfyPreflight?.ok ||
              anyLtxInFlight ||
              anyLipsyncInFlight ||
              Boolean(sendAllProgress) ||
              Boolean(comfyPreflight?.checking)
            }
            onClick={() => void sendAllLtx()}
            className="rounded-sm border border-[var(--magenta-hot)]/60 bg-[var(--magenta-hot)]/15 px-2.5 py-1 text-[13px] font-medium text-[var(--magenta-hot)] hover:bg-[var(--magenta-hot)]/25 disabled:opacity-40"
            title="Send every ready beat one-by-one (skips Done unless Fail)"
          >
            Send all
          </button>
          {sendAllProgress || anyLtxInFlight ? (
            <button
              type="button"
              onClick={() => forceUnlockStuckLtx()}
              className="rounded-sm border border-[var(--magenta-hot)]/60 px-2.5 py-1 text-[13px] font-medium text-[var(--magenta-hot)] hover:bg-[var(--magenta-hot)]/10"
              title="Unlock greyed buttons if Comfy is idle but Studio still says Run"
            >
              Unlock stuck
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void copyAll()}
            className="rounded-sm border border-[var(--acid)] bg-[var(--acid)]/15 px-2.5 py-1 text-[13px] font-medium text-[var(--acid)]"
          >
            Copy all
          </button>
          <button
            type="button"
            onClick={() => void exportFolder()}
            className="rounded-sm border border-[var(--line)] px-2.5 py-1 text-[13px] text-[var(--chrome-dim)] hover:border-[var(--magenta-hot)]/50 hover:text-[var(--magenta-hot)]"
          >
            Export
          </button>
          <button
            type="button"
            disabled={doneCount === 0}
            onClick={() => hideDoneBeats()}
            className="rounded-sm border border-[var(--line)] px-2.5 py-1 text-[13px] text-[var(--chrome-dim)] hover:text-[var(--chrome)] disabled:opacity-40"
            title="Hide done beats from this list (browser only — Story untouched)"
          >
            Hide done
          </button>
          <button
            type="button"
            disabled={
              anyLtxInFlight || anyLipsyncInFlight || Boolean(sendAllProgress)
            }
            onClick={() => void clearLtxResults()}
            className="rounded-sm border border-[var(--line)] px-2.5 py-1 text-[13px] text-[var(--chrome-dim)] hover:text-[var(--chrome)] disabled:opacity-40"
            title="Clear LTX status; park mp4s in data/crash/ltx/_cleared/ (never deletes)"
          >
            Clear LTX
          </button>
          {hiddenIds.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setShowHidden((v) => !v)}
                className="text-[8px] text-[var(--mute)] underline hover:text-[var(--chrome)]"
              >
                {showHidden
                  ? "Hide hidden"
                  : `Show hidden (${hiddenIds.length})`}
              </button>
              <button
                type="button"
                onClick={() => unhideAll()}
                className="text-[8px] text-[var(--mute)] underline hover:text-[var(--chrome)]"
              >
                Unhide all
              </button>
            </>
          ) : null}
        </div>
      ) : (
        <div className="shrink-0 flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={lipsyncDoneCount === 0}
            onClick={() => hideDoneLipsyncBeats()}
            className="rounded-sm border border-[var(--line)] px-2 py-0.5 text-[9px] text-[var(--chrome-dim)] hover:text-[var(--chrome)] disabled:opacity-40"
            title="Hide lipsync-done beats from this list (browser only)"
          >
            Hide done
          </button>
          <button
            type="button"
            disabled={anyLtxInFlight || anyLipsyncInFlight}
            onClick={() => void clearLipsyncResults()}
            className="rounded-sm border border-[var(--line)] px-2 py-0.5 text-[9px] text-[var(--chrome-dim)] hover:text-[var(--chrome)] disabled:opacity-40"
            title="Clear lipsync status; park mp4s in data/crash/lipsync/_cleared/ (never deletes)"
          >
            Clear LS
          </button>
          {hiddenIds.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setShowHidden((v) => !v)}
                className="text-[8px] text-[var(--mute)] underline hover:text-[var(--chrome)]"
              >
                {showHidden
                  ? "Hide hidden"
                  : `Show hidden (${hiddenIds.length})`}
              </button>
              <button
                type="button"
                onClick={() => unhideAll()}
                className="text-[8px] text-[var(--mute)] underline hover:text-[var(--chrome)]"
              >
                Unhide all
              </button>
            </>
          ) : null}
        </div>
      )}

      {msg ? (
        <p className="shrink-0 break-words text-[12px] text-[var(--magenta-hot)]">
          {msg}
        </p>
      ) : null}

      {mode === "ltx" ? (
        <AnimateTimeline
          styleId={styleId}
          story={story}
          onSaveStory={(next, opts) => saveStoryDoc(next, undefined, opts?.flush)}
          rows={visibleRows}
          draft={draft}
          onDraftChange={setDraft}
          ltxByBeat={ltxByBeat}
          ltxStartedAt={ltxStartedAt}
          selectedBeatId={selectedBeatId}
          onSelectBeat={setSelectedBeatId}
          onSendLtx={(id) => void sendLtx(id)}
          onClearBeat={(id) => void clearLtxResults(id)}
          onVerdict={(id, v) => void setLtxVerdict(id, v)}
          onReorderShots={(from, to) => void reorderShotsById(from, to)}
          onReplacePlateKeepFail={replacePlateKeepFail}
          comfyReady={Boolean(comfyPreflight?.ok)}
          queueBusy={Boolean(sendAllProgress)}
          ltxInFlightCount={ltxInFlightCount}
          parallelMax={LTX_PARALLEL_MAX}
        />
      ) : (
        <div
          ref={shotGridRef}
          className="crash-tray-scroll min-h-0 flex-1 overflow-y-auto pr-0.5"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: "0.5rem",
            width: "100%",
            alignContent: "start",
          }}
        >
          {groups.length === 0 ? (
            <p className="col-span-full text-[9px] text-[var(--mute)]">
              {hiddenIds.length > 0
                ? "All beats hidden — Show hidden / Unhide all above."
                : "No beats yet."}
            </p>
          ) : null}
          {groups.map((group) => (
            <section
              key={group.shotId}
              className="min-w-0 rounded-sm border border-[var(--acid)]/30 bg-[var(--acid)]/5 p-1.5"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase text-[var(--acid-deep)]">
                  Shot
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--chrome)]">
                  {group.shotTitle}
                </span>
              </div>
              <p className="mb-1 text-[11px] text-[var(--mute)]">
                {group.placeName}
              </p>
              <ul className="space-y-1.5">
                {group.rows.map((row) => (
                  <BeatComfyRow
                    key={row.beatId}
                    mode={mode}
                    styleId={styleId}
                    row={row}
                    draft={draft}
                    onDraftChange={setDraft}
                    onSendLtx={(id) => void sendLtx(id)}
                    onPullLtx={(id) => void pullLtx(id)}
                    onClearBeat={(id) => void clearLtxResults(id)}
                    onAttachMp4={(id, file) => attachMp4(id, file)}
                    onSendLipsync={(id) => void sendLipsync(id)}
                    onPullLipsync={(id) => void pullLipsync(id)}
                    onClearLipsync={(id) => void clearLipsyncResults(id)}
                    ltxStatus={ltxByBeat[row.beatId]}
                    lipsyncStatus={lipsyncByBeat[row.beatId]}
                    ltxInFlightCount={ltxInFlightCount}
                    anyLipsyncInFlight={anyLipsyncInFlight}
                    comfyReady={Boolean(comfyPreflight?.ok)}
                    lipsyncReady={Boolean(lipsyncPreflight?.ok)}
                    queueBusy={Boolean(sendAllProgress)}
                    onVerdict={(id, v) => void setLtxVerdict(id, v)}
                    ltxElapsedSec={
                      ltxByBeat[row.beatId]?.inFlight &&
                      ltxStartedAt[row.beatId]
                        ? Math.floor(
                            (Date.now() - ltxStartedAt[row.beatId]) / 1000,
                          )
                        : 0
                    }
                    lipsyncElapsedSec={
                      lipsyncByBeat[row.beatId]?.inFlight &&
                      lipsyncStartedAt[row.beatId]
                        ? Math.floor(
                            (Date.now() - lipsyncStartedAt[row.beatId]) / 1000,
                          )
                        : 0
                    }
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {mode === "ltx" ? (
        <details className="shrink-0 rounded-sm border border-[var(--line)]/70 bg-[var(--panel-2)]/80 px-1.5 py-1">
          <summary className="cursor-pointer text-[8px] uppercase tracking-wider text-[var(--mute)] hover:text-[var(--chrome-dim)]">
            Global prompt — whole queue
          </summary>
          <div className="mt-1 flex items-center justify-end">
            <button
              type="button"
              className="text-[8px] text-[var(--chrome-dim)] hover:text-[var(--acid)]"
              onClick={() =>
                setDraft((d) => ({ ...d, global: CRASH_COMFY_DEFAULT_GLOBAL }))
              }
            >
              Reset
            </button>
          </div>
          <textarea
            rows={2}
            value={draft.global}
            onChange={(e) =>
              setDraft((d) => ({ ...d, global: e.target.value }))
            }
            className="mt-0.5 w-full resize-y rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-1.5 py-0.5 text-[9px] text-[var(--chrome)]"
          />
        </details>
      ) : null}

      <p className="shrink-0 text-[8px] text-[var(--chrome-dim)]">
        {mode === "ltx"
          ? "Viewer → cut → shot line (drag shots) → edits. Fix plates in Story. Send all skips Done unless Fail."
          : "Edits save in this browser. SFX stays in Resolve — never in these boxes."}
      </p>
    </div>
  );
}
