"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CrashStoryDoc } from "@/lib/crashStoryTypes";
import type { MobileGenJob } from "@/lib/mobileGenJob";
import { mobileLocationStillUrl, mobileMediaFolderName } from "@/lib/mobileCandidateUrls";
import { mobileClipSrc } from "@/lib/mobilePlateClips";
import { episodeJobShots, episodeQueuedClips } from "@/lib/mobileScratch";
import { decodeWaveformPeaks } from "@/lib/decodeWaveformPeaks";
import {
  SCRATCH_SONG_DIRECT_POST_MAX_BYTES,
  dropScratchSongViaBlob,
  probeBrowserAudioDurationSec,
} from "@/lib/scratchSongDrop";
import { readApiJson, studioFetchError } from "@/lib/studioFetchError";
import {
  talkPlaceActsFrom,
  talkActRoman,
  talkCellTakes,
  talkClipClock,
  talkClipDeskFrom,
  talkClipLayout,
  talkDeskInnerWidth,
  talkNextShotTitle,
  talkSceneBands,
  talkSendTake,
  talkSkidmarksActsFrom,
  type TalkClipCell,
  type TalkClipTake,
} from "@/lib/talkClipTimeline";
import { talkFilmChrome, talkFilmTagText, type TalkTimelineEvent } from "@/lib/talkTimeline";
import { copyTextToClipboard } from "@/lib/copyText";
import { skidmarksBlankFromJob } from "@/lib/scriptBlueprint";
import { EPISODE_TEMPLATE_RULES } from "@/lib/episodeTemplate";
import { MobilePrimaryButton } from "./MobileUi";

function CopyBlankIcon({ copied }: { copied: boolean }) {
  return copied ? (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M9.2 16.6 4.8 12.2l1.4-1.4 3 3 8.6-8.6 1.4 1.4z"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M8 4h9a2 2 0 0 1 2 2v11h-2V6H8V4zm-3 4h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2zm0 2v11h9V10H5z"
      />
    </svg>
  );
}

function stillUrl(job: MobileGenJob, plateFile: string): string {
  const file = (plateFile || "").trim();
  if (!file || file === "__error__") return "";
  return mobileLocationStillUrl(job, file);
}

function beatAudioUrl(job: MobileGenJob, beatId: string, voiceFile: string): string {
  const file = (voiceFile || "").trim();
  if (!file || !beatId) return "";
  return (
    `/api/crash/mobile/beat-audio?styleId=${encodeURIComponent(job.styleId)}` +
    `&folderName=${encodeURIComponent(mobileMediaFolderName(job))}` +
    `&jobId=${encodeURIComponent(job.id)}` +
    `&beatId=${encodeURIComponent(beatId)}` +
    `&fileName=${encodeURIComponent(file)}`
  );
}

function TalkSpeechLane({
  job,
  cells,
  widthPx,
}: {
  job: MobileGenJob;
  cells: TalkClipCell[];
  widthPx: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [peaks, setPeaks] = useState<Record<string, number[]>>({});
  const voiceKey = cells
    .map((c) =>
      talkCellTakes(c)
        .map((t) => `${t.beatId}:${t.voiceFile}:${t.durationSec}`)
        .join(","),
    )
    .join("|");

  useEffect(() => {
    let dead = false;
    const want = cells.flatMap((cell) =>
      talkCellTakes(cell)
        .filter((t) => t.voiceFile && t.beatId)
        .map((take) => ({ cell, take })),
    );
    if (!want.length) {
      setPeaks({});
      return;
    }
    void (async () => {
      const next: Record<string, number[]> = {};
      for (const { cell, take } of want) {
        const src = beatAudioUrl(job, take.beatId, take.voiceFile);
        if (!src) continue;
        try {
          const res = await fetch(src);
          if (!res.ok) continue;
          const blob = await res.blob();
          const slicePx = Math.max(
            16,
            Math.round(cell.widthPx * (take.durationSec / Math.max(cell.durationSec, 0.2))),
          );
          const samples = Math.max(16, Math.round(slicePx / 2));
          next[take.key] = await decodeWaveformPeaks(blob, samples);
        } catch {
          /* silent I2V / missing mp3 — lane stays flat */
        }
        if (dead) return;
      }
      if (!dead) setPeaks(next);
    })();
    return () => {
      dead = true;
    };
  }, [job, voiceKey, cells]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || widthPx < 8) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const cssH = 56;
    canvas.width = Math.round(widthPx * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, widthPx, cssH);
    ctx.fillStyle = "#0a0a0c";
    ctx.fillRect(0, 0, widthPx, cssH);
    let x = 0;
    for (const cell of cells) {
      ctx.fillStyle = `${cell.sceneColor}22`;
      ctx.fillRect(x, 0, cell.widthPx, cssH);
      ctx.strokeStyle = `${cell.sceneColor}66`;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, cssH);
      ctx.stroke();
      const takes = talkCellTakes(cell);
      let tx = x;
      const total = Math.max(
        cell.durationSec,
        takes.reduce((n, t) => n + t.durationSec, 0),
        0.2,
      );
      let drew = false;
      for (const take of takes) {
        const slice = Math.max(8, (take.durationSec / total) * cell.widthPx);
        const bars = peaks[take.key] || [];
        if (bars.length) {
          drew = true;
          const gap = slice / bars.length;
          ctx.fillStyle = cell.sceneColor;
          for (let i = 0; i < bars.length; i += 1) {
            const h = Math.max(2, (bars[i] || 0) * (cssH - 10));
            ctx.fillRect(tx + i * gap + 0.5, (cssH - h) / 2, Math.max(1, gap - 1), h);
          }
        }
        tx += slice;
      }
      if (!drew) {
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(x + 8, cssH / 2 - 1, Math.max(8, cell.widthPx - 16), 2);
      }
      x += cell.widthPx;
    }
  }, [cells, peaks, widthPx]);

  return (
    <canvas
      ref={canvasRef}
      className="m-talk-wave"
      width={widthPx}
      height={56}
      style={{ width: `${widthPx}px`, height: "56px" }}
      aria-hidden
    />
  );
}

function TalkFilmTag({ ev }: { ev: TalkTimelineEvent }) {
  return <em className={`m-talk-tag is-${ev.kind}`}>{talkFilmTagText(ev)}</em>;
}

function TalkFilmCell({
  job,
  cell,
  selected,
  playing,
  onPick,
  onRemove,
  onPlayEnded,
  onMeasured,
}: {
  job: MobileGenJob;
  cell: TalkClipCell;
  selected: boolean;
  playing: boolean;
  onPick: () => void;
  onRemove?: () => void;
  onPlayEnded?: () => void;
  onMeasured: (sec: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const takes = talkCellTakes(cell);
  const playlist = takes.filter((t) => t.clipFile || t.voiceFile);
  const [playIdx, setPlayIdx] = useState(0);
  const active = playlist[playing ? playIdx : 0] || playlist[0] || null;
  const poster = stillUrl(job, cell.plateFile);
  const clipSrc = active?.clipFile ? mobileClipSrc(job, active.clipFile) : "";
  const audioSrc = active ? beatAudioUrl(job, active.beatId, active.voiceFile) : "";
  const canPlay = Boolean(clipSrc || audioSrc);
  const chrome = talkFilmChrome(cell.events);
  const clipCount = takes.filter((t) => t.clipFile).length || takes.length;

  useEffect(() => {
    if (playing) return;
    setPlayIdx(0);
  }, [playing]);

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (playing) {
      if (video) void video.play().catch(() => undefined);
      // Plate-only still plays the line. A take plays its own picture —
      // do not stack the mp3 on top of a cooked clip.
      if (audio && !clipSrc) void audio.play().catch(() => undefined);
      return;
    }
    video?.pause();
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [playing, clipSrc, playIdx]);

  function advance() {
    if (playIdx + 1 < playlist.length) {
      setPlayIdx((n) => n + 1);
      return;
    }
    onPlayEnded?.();
  }

  return (
    <div
      className={`m-talk-film-cell${selected ? " is-on" : ""}${playing ? " is-play" : ""}`}
      style={{ width: `${cell.widthPx}px`, borderColor: cell.sceneColor }}
    >
      <div className="m-talk-film-head">
        {chrome.act ? <TalkFilmTag ev={chrome.act} /> : null}
        <span className="m-talk-film-title">{cell.title}</span>
      </div>
      <div
        className="m-talk-film-stage"
        role="button"
        tabIndex={0}
        title={cell.title}
        onClick={onPick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPick();
          }
        }}
      >
        {clipSrc ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={videoRef}
            className="m-talk-film-video"
            src={clipSrc}
            poster={poster || undefined}
            playsInline
            preload="metadata"
            onEnded={advance}
            onLoadedMetadata={(e) => {
              if (playlist.length > 1) return;
              const sec = e.currentTarget.duration;
              if (!Number.isFinite(sec) || sec <= 0) return;
              onMeasured(sec);
            }}
          />
        ) : poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="m-talk-film-still" />
        ) : (
          <span className="m-talk-film-empty" />
        )}
        {audioSrc && !clipSrc ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio
            ref={audioRef}
            className="m-talk-film-audio"
            src={audioSrc}
            preload="metadata"
            onEnded={advance}
            onLoadedMetadata={(e) => {
              if (playlist.length > 1) return;
              const sec = e.currentTarget.duration;
              if (!Number.isFinite(sec) || sec <= 0) return;
              onMeasured(sec);
            }}
          />
        ) : null}
        <span className="m-talk-film-play" aria-hidden>
          {canPlay ? (playing ? "❚❚" : "▶") : "+"}
        </span>
        {selected && onRemove ? (
          <button
            type="button"
            className="m-talk-film-x"
            aria-label={`Remove ${cell.title} from the talking desk`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            ×
          </button>
        ) : null}
        {clipCount > 1 ? (
          <span className="m-talk-film-n">
            {clipCount} clips
          </span>
        ) : null}
        <span className="m-talk-film-clock">{talkClipClock(cell.durationSec)}</span>
      </div>
      {chrome.sfx.length ? (
        <div className="m-talk-film-sfx">
          {chrome.sfx.map((ev) => (
            <TalkFilmTag key={ev.id} ev={ev} />
          ))}
        </div>
      ) : null}
      {chrome.notes.length ? (
        <details
          className="m-talk-film-notes"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <summary>notes</summary>
          <span className="m-talk-film-notes-body">
            {chrome.notes.map((ev) => (
              <TalkFilmTag key={ev.id} ev={ev} />
            ))}
          </span>
        </details>
      ) : null}
    </div>
  );
}

function TalkClipTray({
  job,
  cell,
  onJobChange,
}: {
  job: MobileGenJob;
  cell: TalkClipCell;
  onJobChange?: (job: MobileGenJob) => void;
}) {
  const audioRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLInputElement | null>(null);
  const takes = talkCellTakes(cell);
  const [open, setOpen] = useState(false);
  const [takeIdx, setTakeIdx] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const take: TalkClipTake = takes[takeIdx] || takes[0];
  const audioSrc = take ? beatAudioUrl(job, take.beatId, take.voiceFile) : "";

  async function onPickAudio(file: File) {
    if (!take?.beatId) {
      setError("This slot has no line yet — wait for the plate beat.");
      return;
    }
    setBusy("audio");
    setError("");
    try {
      const durationSec = await probeBrowserAudioDurationSec(file);
      let data: { job?: MobileGenJob; error?: string };
      if (file.size > SCRATCH_SONG_DIRECT_POST_MAX_BYTES) {
        data = await dropScratchSongViaBlob({
          jobId: job.id,
          beatId: take.beatId,
          file,
          durationSec,
        });
      } else {
        const form = new FormData();
        form.set("jobId", job.id);
        form.set("beatId", take.beatId);
        form.set("file", file);
        const res = await fetch("/api/crash/mobile/beat-audio/upload", { method: "POST", body: form });
        data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      }
      if (data.job) onJobChange?.(data.job);
    } catch (e) {
      setError(studioFetchError(e, "Couldn't change that clip's audio"));
    } finally {
      setBusy("");
    }
  }

  async function onPickVideo(file: File) {
    if (!take?.beatId) {
      setError("This slot has no line yet — wait for the plate beat.");
      return;
    }
    setBusy("add");
    setError("");
    try {
      const form = new FormData();
      form.set("jobId", job.id);
      form.set("beatId", take.beatId);
      form.set("file", file);
      const res = await fetch("/api/crash/mobile/clip/upload", { method: "POST", body: form });
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (data.job) onJobChange?.(data.job);
    } catch (e) {
      setError(studioFetchError(e, "Couldn't add that video"));
    } finally {
      setBusy("");
    }
  }

  async function removeClip() {
    if (!take?.beatId || !take.clipFile) return;
    setBusy("remove");
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          action: "remove-clip",
          beatId: take.beatId,
          fileName: take.clipFile,
        }),
      });
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (data.job) onJobChange?.(data.job);
    } catch (e) {
      setError(studioFetchError(e, "Couldn't park that clip"));
    } finally {
      setBusy("");
    }
  }

  async function redoClip() {
    if (!take?.beatId) return;
    setBusy("redo");
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, approveReview: true, beatId: take.beatId }),
      });
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (data.job) onJobChange?.(data.job);
    } catch (e) {
      setError(studioFetchError(e, "Couldn't redo that clip"));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="m-talk-tray">
      <button
        type="button"
        className="m-talk-tray-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="m-talk-tray-kicker">{open ? "Hide clip" : "Clip"}</span>
        <span className="m-talk-tray-title">{cell.title}</span>
        <span className="m-talk-tray-clock">
          {takes.length > 1 ? `${takes.length} clips · ` : ""}
          {talkClipClock(cell.durationSec)}
        </span>
      </button>
      {open ? (
        <div className="m-talk-tray-body">
          {takes.length > 1 ? (
            <div className="m-talk-take-list">
              {takes.map((t, i) => (
                <button
                  key={t.key}
                  type="button"
                  className={`m-talk-take-chip${takeIdx === i ? " is-on" : ""}`}
                  onClick={() => setTakeIdx(i)}
                >
                  {i + 1}. {t.speaker || "Line"}
                  {t.clipFile ? "" : " · no clip"}
                </button>
              ))}
            </div>
          ) : null}
          <p className="m-talk-tools-line">
            {take?.speaker ? `${take.speaker} — ` : ""}
            {take?.line || "No line yet"}
          </p>
          {audioSrc ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio className="m-talk-tools-audio" src={audioSrc} controls preload="metadata" />
          ) : (
            <p className="m-talk-tools-hint">
              Plate-only is fine. Add the mp3 here — or drop a video on this slot.
            </p>
          )}
          <input
            ref={audioRef}
            type="file"
            accept="audio/mpeg,.mp3"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void onPickAudio(file);
            }}
          />
          <input
            ref={videoRef}
            type="file"
            accept="video/mp4,.mp4"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void onPickVideo(file);
            }}
          />
          <div className="m-talk-tools-row">
            <MobilePrimaryButton
              size="chip"
              tone="ghost"
              disabled={Boolean(busy) || !take?.beatId}
              onClick={() => videoRef.current?.click()}
            >
              {busy === "add" ? "…" : take?.clipFile ? "Replace video" : "Add video"}
            </MobilePrimaryButton>
            <MobilePrimaryButton
              size="chip"
              tone="ghost"
              disabled={Boolean(busy) || !take?.clipFile}
              onClick={() => void removeClip()}
            >
              {busy === "remove" ? "…" : "Remove video"}
            </MobilePrimaryButton>
            <MobilePrimaryButton
              size="chip"
              tone="ghost"
              disabled={Boolean(busy) || !take?.beatId}
              onClick={() => audioRef.current?.click()}
            >
              {busy === "audio" ? "…" : take?.voiceFile ? "Change audio" : "Add audio"}
            </MobilePrimaryButton>
            <MobilePrimaryButton
              size="chip"
              disabled={Boolean(busy) || !take?.beatId || !take?.voiceFile}
              onClick={() => void redoClip()}
            >
              {busy === "redo" ? "…" : "Redo clip"}
            </MobilePrimaryButton>
          </div>
          {error ? <p className="m-talk-tools-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

type TalkPickWho = { name: string; faceUrl: string };
type TalkPickWhere = { sceneId: string; name: string; thumbUrl: string };

/**
 * Skidmarks / talking shows: speech wave + clips on one sideways desk.
 * Tap plays in the cell. + / × / Send is the cut — not the music-video song TRACK.
 */
export function TalkTimeline({
  job,
  story,
  plated,
  compact = false,
  castOptions = [],
  placeOptions = [],
  actId,
  onActIdChange,
  onJobChange,
}: {
  job: MobileGenJob;
  story: CrashStoryDoc | null;
  plated?: { shotId: string; sceneId: string; plateFile: string }[];
  compact?: boolean;
  castOptions?: TalkPickWho[];
  placeOptions?: TalkPickWhere[];
  onOpenPlate?: (shotId: string) => void;
  /** Open act chip — parent uses this to scope the animate meter. */
  actId?: string;
  onActIdChange?: (id: string) => void;
  onJobChange?: (job: MobileGenJob) => void;
}) {
  const desk = useMemo(
    () =>
      talkClipDeskFrom({
        story,
        styleId: job.styleId,
        plated:
          plated && plated.length
            ? plated
            : episodeJobShots(job, story).filter((s) => s.plateFile !== "__error__"),
        clips: episodeQueuedClips(job, story),
      }),
    [job, story, plated],
  );
  const [pickedKey, setPickedKey] = useState("");
  const [playingKey, setPlayingKey] = useState("");
  const [measured, setMeasured] = useState<Record<string, number>>({});
  const [pickOpen, setPickOpen] = useState(false);
  const [pickWho, setPickWho] = useState("");
  const [pickWhere, setPickWhere] = useState("");
  const [deskBusy, setDeskBusy] = useState("");
  const [deskError, setDeskError] = useState("");
  const [addActOpen, setAddActOpen] = useState(false);
  const [addActName, setAddActName] = useState("");
  const isSkidmarks = job.styleId === "skidmarks";
  const [openActId, setOpenActIdState] = useState(isSkidmarks ? "stage-1" : "");
  function setOpenActId(id: string) {
    setOpenActIdState(id);
    onActIdChange?.(id);
  }
  const [openDoc, setOpenDoc] = useState<"" | "rules" | "blank">("");
  const [blankCopied, setBlankCopied] = useState(false);
  const cells = useMemo(() => talkClipLayout(desk.cells, measured), [desk.cells, measured]);
  const acts = useMemo(
    () =>
      isSkidmarks
        ? talkSkidmarksActsFrom(cells)
        : talkPlaceActsFrom(job.scenes, cells),
    [cells, isSkidmarks, job.scenes],
  );
  const resolvedActId = actId || openActId || acts[0]?.id || "";
  const openAct = acts.find((a) => a.id === resolvedActId) || null;
  const visibleCells = useMemo(() => {
    if (compact || !openAct) return cells;
    const keys = new Set(openAct.cellKeys);
    return cells.filter((c) => keys.has(c.key));
  }, [cells, compact, openAct]);
  const bands = talkSceneBands(visibleCells);
  const skidBlank = useMemo(
    () => (isSkidmarks ? skidmarksBlankFromJob(job) : ""),
    [isSkidmarks, job],
  );
  const innerW = talkDeskInnerWidth(visibleCells);
  const selected =
    visibleCells.find((c) => c.key === pickedKey) || visibleCells[0] || null;
  const actSceneId = openAct?.sceneId || "";

  async function addActPlace() {
    const name = addActName.trim();
    if (!name || !job.id) return;
    setDeskBusy("add-act");
    setDeskError("");
    try {
      const res = await fetch("/api/crash/mobile/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          kind: "location",
          action: "add",
          name,
        }),
      });
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (!data.job) throw new Error(data.error || "Couldn't add that act");
      const newest = data.job.scenes[data.job.scenes.length - 1];
      onJobChange?.(data.job);
      if (newest?.id) {
        setOpenActId(`place-${newest.id}`);
        setPickedKey("");
        setPlayingKey("");
      }
      setAddActOpen(false);
      setAddActName("");
    } catch (e) {
      setDeskError(studioFetchError(e, "Couldn't add that act"));
    } finally {
      setDeskBusy("");
    }
  }

  async function addSlot() {
    const sceneId = pickWhere || actSceneId;
    if (!pickWho || !sceneId || !job.folderName) return;
    setDeskBusy("add");
    setDeskError("");
    try {
      const title = talkNextShotTitle(cells, pickWho);
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          action: "add",
          sceneId,
          speaker: pickWho,
          title,
          reuseScene: true,
        }),
      });
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (data.job) onJobChange?.(data.job);
      setOpenActId(`place-${sceneId}`);
      setPickOpen(false);
      setPickWho("");
      setPickWhere("");
    } catch (e) {
      setDeskError(studioFetchError(e, "Couldn't add that slot"));
    } finally {
      setDeskBusy("");
    }
  }

  async function removeSlot(cell: TalkClipCell) {
    if (!cell.shotId) return;
    setDeskBusy("remove-slot");
    setDeskError("");
    try {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, action: "remove", shotId: cell.shotId }),
      });
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (data.job) onJobChange?.(data.job);
      setPickedKey("");
      setPlayingKey("");
    } catch (e) {
      setDeskError(studioFetchError(e, "Couldn't park that slot"));
    } finally {
      setDeskBusy("");
    }
  }

  async function sendSlot(cell: TalkClipCell) {
    const take = talkSendTake(cell);
    if (!take?.beatId || !take.voiceFile) {
      setDeskError("Add the mp3 on this slot first, then Send.");
      return;
    }
    setDeskBusy("send");
    setDeskError("");
    try {
      const res = await fetch("/api/crash/mobile/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, approveReview: true, beatId: take.beatId }),
      });
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (data.job) onJobChange?.(data.job);
    } catch (e) {
      setDeskError(studioFetchError(e, "Couldn't send that clip"));
    } finally {
      setDeskBusy("");
    }
  }

  const picker = !compact && pickOpen ? (
    <div className="m-plate-pick">
      <div className="m-plate-pick-row">
        {castOptions.map((who) => (
          <button
            type="button"
            key={who.name}
            className={`m-plate-pick-cell${pickWho === who.name ? " is-on" : ""}`}
            onClick={() => setPickWho(who.name)}
          >
            {who.faceUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={who.faceUrl} alt="" />
            ) : (
              <span className="m-plate-pick-blank" />
            )}
            <span className="m-plate-pick-name">{who.name}</span>
          </button>
        ))}
      </div>
      <div className="m-plate-pick-row">
        {placeOptions.map((place) => (
          <button
            type="button"
            key={place.sceneId}
            className={`m-plate-pick-cell${pickWhere === place.sceneId ? " is-on" : ""}`}
            onClick={() => setPickWhere(place.sceneId)}
          >
            {place.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={place.thumbUrl} alt="" />
            ) : (
              <span className="m-plate-pick-blank" />
            )}
            <span className="m-plate-pick-name">{place.name}</span>
          </button>
        ))}
      </div>
      <div className="m-plate-pick-actions">
        <MobilePrimaryButton
          size="chip"
          disabled={Boolean(deskBusy) || !pickWho || !(pickWhere || actSceneId) || !job.folderName}
          onClick={() => void addSlot()}
        >
          {deskBusy === "add" ? "…" : `Add ${pickWho || "clip"}`}
        </MobilePrimaryButton>
        <button type="button" className="m-track-btn" onClick={() => setPickOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  ) : null;

  const actions = !compact ? (
    <div className="m-talk-desk-actions">
      <MobilePrimaryButton
        size="chip"
        tone="ghost"
        disabled={Boolean(deskBusy) || !job.folderName}
        onClick={() => {
          setPickOpen((v) => !v);
          if (!pickWhere && actSceneId) setPickWhere(actSceneId);
        }}
      >
        {pickOpen ? "Hide add" : "+ Add clip"}
      </MobilePrimaryButton>
      <MobilePrimaryButton
        size="chip"
        disabled={Boolean(deskBusy) || !talkSendTake(selected)}
        onClick={() => selected && void sendSlot(selected)}
      >
        {deskBusy === "send" ? "…" : "Send this"}
      </MobilePrimaryButton>
      <MobilePrimaryButton
        size="chip"
        tone="ghost"
        disabled={Boolean(deskBusy) || !selected?.shotId}
        onClick={() => selected && void removeSlot(selected)}
      >
        {deskBusy === "remove-slot" ? "…" : "Remove slot"}
      </MobilePrimaryButton>
    </div>
  ) : null;

  return (
    <div className="m-talk">
      <div className="m-talk-head">
        <span className="m-talk-kicker">Talking timeline</span>
        <span className="m-talk-hint">
          Tap an act — only that act is on the strip. + Act names the next place
          when you need another one. Tap a box to play it — every clip on that shot,
          in order. + adds a slot. × parks it — files stay. Send cooks the next
          line.
        </span>
      </div>
      {!compact && (acts.length || isSkidmarks) ? (
        <div className="m-talk-acts">
          {acts.map((act) => (
            <button
              type="button"
              key={act.id}
              className={`m-mv-lyr-toggle m-talk-act-chip${resolvedActId === act.id ? " is-open" : ""}`}
              aria-pressed={resolvedActId === act.id}
              onClick={() => {
                setOpenActId(act.id);
                setPlayingKey("");
                const first = act.cellKeys[0];
                setPickedKey(first || "");
              }}
            >
              <span className="m-talk-act-roman">
                Act {act.roman}
                <span className="m-talk-act-count">{act.lineCount}</span>
              </span>
              {act.title ? <span className="m-talk-act-place">{act.title}</span> : null}
            </button>
          ))}
          {!isSkidmarks ? (
            addActOpen ? (
              <form
                className="m-talk-add-act"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addActPlace();
                }}
              >
                <input
                  className="m-talk-add-act-input"
                  value={addActName}
                  onChange={(e) => setAddActName(e.target.value)}
                  placeholder="Place — Back shed"
                  aria-label="Place for the next act"
                  autoFocus
                />
                <button
                  type="submit"
                  className="m-mv-lyr-toggle is-open"
                  disabled={Boolean(deskBusy) || !addActName.trim()}
                >
                  {deskBusy === "add-act" ? "…" : `Add Act ${talkActRoman(acts.length + 1)}`}
                </button>
                <button
                  type="button"
                  className="m-track-btn"
                  onClick={() => {
                    setAddActOpen(false);
                    setAddActName("");
                  }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="m-mv-lyr-toggle m-talk-act-add"
                disabled={Boolean(deskBusy) || !job.id}
                onClick={() => setAddActOpen(true)}
              >
                + Act {talkActRoman(acts.length + 1)}
              </button>
            )
          ) : null}
          {isSkidmarks ? (
            <div className="m-talk-template-link m-talk-doc-chips">
              <button
                type="button"
                className={`m-mv-lyr-toggle${openDoc === "rules" ? " is-open" : ""}`}
                aria-expanded={openDoc === "rules"}
                onClick={() => setOpenDoc((cur) => (cur === "rules" ? "" : "rules"))}
              >
                House rules <span className="m-mv-lyr-caret">{openDoc === "rules" ? "▾" : "▸"}</span>
              </button>
              <button
                type="button"
                className={`m-mv-lyr-toggle${openDoc === "blank" ? " is-open" : ""}`}
                aria-expanded={openDoc === "blank"}
                onClick={() => setOpenDoc((cur) => (cur === "blank" ? "" : "blank"))}
              >
                Blank <span className="m-mv-lyr-caret">{openDoc === "blank" ? "▾" : "▸"}</span>
              </button>
              <button
                type="button"
                className={`m-talk-copy-icon${blankCopied ? " is-copied" : ""}`}
                aria-label={blankCopied ? "Blank template copied" : "Copy blank template"}
                title={blankCopied ? "Copied" : "Copy blank"}
                onClick={() => {
                  void copyTextToClipboard(skidBlank)
                    .then(() => {
                      setBlankCopied(true);
                      window.setTimeout(() => setBlankCopied(false), 2000);
                    })
                    .catch(() => setBlankCopied(false));
                }}
              >
                <CopyBlankIcon copied={blankCopied} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {!compact && isSkidmarks && openDoc ? (
        <div className="m-talk-doc-fold">
          {openDoc === "rules" ? (
            <textarea
              className="m-talk-act-script"
              value={EPISODE_TEMPLATE_RULES}
              rows={8}
              spellCheck={false}
              readOnly
              aria-label="Skidmarks house rules"
            />
          ) : (
            <>
              <div className="m-mv-lyrics-note">
                This pack&apos;s cast and places. Copy into an outside AI. Does not change
                this episode.
              </div>
              <textarea
                className="m-talk-act-script"
                value={skidBlank}
                rows={10}
                spellCheck={false}
                readOnly
                aria-label="Skidmarks blank construction template"
              />
            </>
          )}
        </div>
      ) : null}
      {cells.length ? (
        visibleCells.length ? (
        <div className="m-talk-desk-scroll">
          <div className="m-talk-desk-inner" style={{ width: `${innerW + 56}px` }}>
            <div className="m-talk-scene-lane" aria-hidden>
              {bands.map((band, i) => (
                <span
                  key={`${band.sceneId}-${i}`}
                  className="m-talk-scene-band"
                  style={{ width: `${band.widthPx}px`, color: band.color, borderColor: band.color }}
                >
                  {band.title}
                </span>
              ))}
            </div>
            <TalkSpeechLane job={job} cells={visibleCells} widthPx={innerW} />
            <div className="m-talk-film">
              {visibleCells.map((cell) => (
                <TalkFilmCell
                  key={cell.key}
                  job={job}
                  cell={cell}
                  selected={selected?.key === cell.key}
                  playing={playingKey === cell.key}
                  onPlayEnded={() => setPlayingKey("")}
                  onPick={() => {
                    setPickedKey(cell.key);
                    const playable = talkCellTakes(cell).some((t) => t.clipFile || t.voiceFile);
                    if (!playable) {
                      setPlayingKey("");
                      return;
                    }
                    setPlayingKey((cur) => (cur === cell.key ? "" : cell.key));
                  }}
                  onRemove={!compact ? () => void removeSlot(cell) : undefined}
                  onMeasured={(sec) => {
                    setMeasured((cur) => (cur[cell.key] === sec ? cur : { ...cur, [cell.key]: sec }));
                  }}
                />
              ))}
              {!compact ? (
                <button
                  type="button"
                  className={`m-talk-film-add${pickOpen ? " is-open" : ""}`}
                  aria-label="Add a talking clip"
                  aria-expanded={pickOpen}
                  disabled={Boolean(deskBusy) || !job.folderName}
                  onClick={() => {
                    setPickOpen((v) => !v);
                    if (!pickWhere && actSceneId) setPickWhere(actSceneId);
                  }}
                >
                  +
                </button>
              ) : null}
            </div>
          </div>
        </div>
        ) : (
          <p className="m-talk-empty">
            {openAct
              ? `No clips on Act ${openAct.roman}${openAct.title ? ` · ${openAct.title}` : ""} yet.`
              : "Tap an act to see its clips."}
          </p>
        )
      ) : (
        <p className="m-talk-empty">
          Talking desk — + adds a slot. Plate-only is fine. Send cooks the clip. Not a song.
        </p>
      )}
      {actions}
      {picker}
      {deskError ? <p className="m-talk-tools-error">{deskError}</p> : null}
      {!compact && selected ? (
        <TalkClipTray key={selected.key} job={job} cell={selected} onJobChange={onJobChange} />
      ) : null}
    </div>
  );
}
