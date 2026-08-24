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
  talkActScriptsFrom,
  talkClipClock,
  talkClipDeskFrom,
  talkClipLayout,
  talkDeskInnerWidth,
  talkNextShotTitle,
  talkSceneBands,
  talkSkidmarksActsFrom,
  type TalkClipCell,
} from "@/lib/talkClipTimeline";
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
  const voiceKey = cells.map((c) => `${c.key}:${c.voiceFile}:${c.widthPx}`).join("|");

  useEffect(() => {
    let dead = false;
    const want = cells.filter((c) => c.voiceFile && c.beatId);
    if (!want.length) {
      setPeaks({});
      return;
    }
    void (async () => {
      const next: Record<string, number[]> = {};
      for (const cell of want) {
        const src = beatAudioUrl(job, cell.beatId, cell.voiceFile);
        if (!src) continue;
        try {
          const res = await fetch(src);
          if (!res.ok) continue;
          const blob = await res.blob();
          const samples = Math.max(24, Math.round(cell.widthPx / 2));
          next[cell.key] = await decodeWaveformPeaks(blob, samples);
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
      const bars = peaks[cell.key] || [];
      if (bars.length) {
        const gap = cell.widthPx / bars.length;
        ctx.fillStyle = cell.sceneColor;
        for (let i = 0; i < bars.length; i += 1) {
          const h = Math.max(2, (bars[i] || 0) * (cssH - 10));
          ctx.fillRect(x + i * gap + 0.5, (cssH - h) / 2, Math.max(1, gap - 1), h);
        }
      } else {
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

function TalkFilmCell({
  job,
  cell,
  selected,
  playing,
  onPick,
  onRemove,
  onMeasured,
}: {
  job: MobileGenJob;
  cell: TalkClipCell;
  selected: boolean;
  playing: boolean;
  onPick: () => void;
  onRemove?: () => void;
  onMeasured: (sec: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const poster = stillUrl(job, cell.plateFile);
  const clipSrc = cell.clipFile ? mobileClipSrc(job, cell.clipFile) : "";
  const audioSrc = beatAudioUrl(job, cell.beatId, cell.voiceFile);
  const canPlay = Boolean(clipSrc || audioSrc);

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
  }, [playing, clipSrc]);

  return (
    <div
      className={`m-talk-film-cell${selected ? " is-on" : ""}${playing ? " is-play" : ""}`}
      style={{ width: `${cell.widthPx}px`, borderColor: cell.sceneColor }}
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
          onLoadedMetadata={(e) => {
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
          onLoadedMetadata={(e) => {
            const sec = e.currentTarget.duration;
            if (!Number.isFinite(sec) || sec <= 0) return;
            onMeasured(sec);
          }}
        />
      ) : null}
      <span className="m-talk-film-play" aria-hidden>
        {canPlay ? (playing ? "❚❚" : "▶") : "+"}
      </span>
      {cell.events.length ? (
        <span className="m-talk-film-tags">
          {cell.events.map((ev) => (
            <em key={ev.id} className={`m-talk-tag is-${ev.kind}`}>
              [{ev.tag}]{ev.detail ? ` ${ev.detail}` : ""}
            </em>
          ))}
        </span>
      ) : null}
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
      <span className="m-talk-film-label">
        {cell.title}
        <em>{talkClipClock(cell.durationSec)}</em>
      </span>
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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const audioSrc = beatAudioUrl(job, cell.beatId, cell.voiceFile);

  async function onPickAudio(file: File) {
    if (!cell.beatId) {
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
          beatId: cell.beatId,
          file,
          durationSec,
        });
      } else {
        const form = new FormData();
        form.set("jobId", job.id);
        form.set("beatId", cell.beatId);
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
    if (!cell.beatId) {
      setError("This slot has no line yet — wait for the plate beat.");
      return;
    }
    setBusy("add");
    setError("");
    try {
      const form = new FormData();
      form.set("jobId", job.id);
      form.set("beatId", cell.beatId);
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
    if (!cell.beatId || !cell.clipFile) return;
    setBusy("remove");
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          action: "remove-clip",
          beatId: cell.beatId,
          fileName: cell.clipFile,
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
    if (!cell.beatId) return;
    setBusy("redo");
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, approveReview: true, beatId: cell.beatId }),
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
        <span className="m-talk-tray-clock">{talkClipClock(cell.durationSec)}</span>
      </button>
      {open ? (
        <div className="m-talk-tray-body">
          <p className="m-talk-tools-line">
            {cell.speaker ? `${cell.speaker} — ` : ""}
            {cell.line || "No line yet"}
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
              disabled={Boolean(busy) || !cell.beatId}
              onClick={() => videoRef.current?.click()}
            >
              {busy === "add" ? "…" : cell.clipFile ? "Replace video" : "Add video"}
            </MobilePrimaryButton>
            <MobilePrimaryButton
              size="chip"
              tone="ghost"
              disabled={Boolean(busy) || !cell.clipFile}
              onClick={() => void removeClip()}
            >
              {busy === "remove" ? "…" : "Remove video"}
            </MobilePrimaryButton>
            <MobilePrimaryButton
              size="chip"
              tone="ghost"
              disabled={Boolean(busy) || !cell.beatId}
              onClick={() => audioRef.current?.click()}
            >
              {busy === "audio" ? "…" : cell.voiceFile ? "Change audio" : "Add audio"}
            </MobilePrimaryButton>
            <MobilePrimaryButton
              size="chip"
              disabled={Boolean(busy) || !cell.beatId || !cell.voiceFile}
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
  onJobChange,
}: {
  job: MobileGenJob;
  story: CrashStoryDoc | null;
  plated?: { shotId: string; sceneId: string; plateFile: string }[];
  compact?: boolean;
  castOptions?: TalkPickWho[];
  placeOptions?: TalkPickWhere[];
  onOpenPlate?: (shotId: string) => void;
  onJobChange?: (job: MobileGenJob) => void;
}) {
  const desk = useMemo(
    () =>
      talkClipDeskFrom({
        story,
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
  const [openActId, setOpenActId] = useState("");
  const [openDoc, setOpenDoc] = useState<"" | "rules" | "blank">("");
  const [blankCopied, setBlankCopied] = useState(false);
  const cells = useMemo(() => talkClipLayout(desk.cells, measured), [desk.cells, measured]);
  const bands = talkSceneBands(cells);
  const isSkidmarks = job.styleId === "skidmarks";
  const acts = useMemo(
    () => (isSkidmarks ? talkSkidmarksActsFrom(cells) : talkActScriptsFrom(cells)),
    [cells, isSkidmarks],
  );
  const openAct = acts.find((a) => a.id === openActId) || null;
  const skidBlank = useMemo(
    () => (isSkidmarks ? skidmarksBlankFromJob(job) : ""),
    [isSkidmarks, job],
  );
  const innerW = talkDeskInnerWidth(cells);
  const selected = cells.find((c) => c.key === pickedKey) || cells[0] || null;

  async function addSlot() {
    if (!pickWho || !pickWhere || !job.folderName) return;
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
          sceneId: pickWhere,
          speaker: pickWho,
          title,
        }),
      });
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (data.job) onJobChange?.(data.job);
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
    if (!cell.beatId || !cell.voiceFile) {
      setDeskError("Add the mp3 on this slot first, then Send.");
      return;
    }
    setDeskBusy("send");
    setDeskError("");
    try {
      const res = await fetch("/api/crash/mobile/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, approveReview: true, beatId: cell.beatId }),
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
          disabled={Boolean(deskBusy) || !pickWho || !pickWhere || !job.folderName}
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
        onClick={() => setPickOpen((v) => !v)}
      >
        {pickOpen ? "Hide add" : "+ Add clip"}
      </MobilePrimaryButton>
      <MobilePrimaryButton
        size="chip"
        disabled={Boolean(deskBusy) || !selected?.beatId || !selected?.voiceFile}
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
          Tap a box to play it. + adds a slot. × parks it — files stay. Send cooks that clip.
        </span>
      </div>
      {!compact && (acts.length || isSkidmarks) ? (
        <div className="m-talk-acts">
          {acts.map((act) => (
            <button
              type="button"
              key={act.id}
              className={`m-mv-lyr-toggle${openActId === act.id ? " is-open" : ""}`}
              aria-expanded={openActId === act.id}
              onClick={() => {
                setOpenActId((cur) => (cur === act.id ? "" : act.id));
                const first = act.cellKeys[0];
                if (first) setPickedKey(first);
              }}
            >
              Act {act.roman} <span className="m-mv-lyr-caret">{openActId === act.id ? "▾" : "▸"}</span>
            </button>
          ))}
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
      {!compact && openAct ? (
        <div className="m-talk-act-panel">
          <div className="m-talk-act-main">
            <div className="m-mv-lyrics-note">
              Act {openAct.roman} · {openAct.title}
              {openAct.stageNote ? ` · ${openAct.stageNote}` : ""} · {openAct.lineCount}{" "}
              {openAct.lineCount === 1 ? "line" : "lines"} — live pack on this stage, not a
              new episode
            </div>
            <textarea
              className="m-talk-act-script"
              value={openAct.script}
              rows={Math.min(12, Math.max(4, openAct.lineCount * 3 || 4))}
              spellCheck={false}
              readOnly
              aria-label={`Script for Act ${openAct.roman}`}
            />
          </div>
        </div>
      ) : null}
      {cells.length ? (
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
            <TalkSpeechLane job={job} cells={cells} widthPx={innerW} />
            <div className="m-talk-film">
              {cells.map((cell) => (
                <TalkFilmCell
                  key={cell.key}
                  job={job}
                  cell={cell}
                  selected={selected?.key === cell.key}
                  playing={playingKey === cell.key}
                  onPick={() => {
                    setPickedKey(cell.key);
                    if (!cell.clipFile && !cell.voiceFile) {
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
                  onClick={() => setPickOpen((v) => !v)}
                >
                  +
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <p className="m-talk-empty">
          Talking desk — + adds a slot. Plate-only is fine. Send cooks the clip. Not a song.
        </p>
      )}
      {actions}
      {picker}
      {deskError ? <p className="m-talk-tools-error">{deskError}</p> : null}
      {!compact && selected ? (
        <TalkClipTray job={job} cell={selected} onJobChange={onJobChange} />
      ) : null}
    </div>
  );
}
