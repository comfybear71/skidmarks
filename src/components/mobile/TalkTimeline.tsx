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
  talkClipClock,
  talkClipDeskFrom,
  talkClipLayout,
  talkDeskInnerWidth,
  talkSceneBands,
  type TalkClipCell,
} from "@/lib/talkClipTimeline";
import { MobilePrimaryButton } from "./MobileUi";

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

function TalkClipTools({
  job,
  cell,
  onJobChange,
}: {
  job: MobileGenJob;
  cell: TalkClipCell;
  onJobChange?: (job: MobileGenJob) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const poster = stillUrl(job, cell.plateFile);
  const audioSrc = beatAudioUrl(job, cell.beatId, cell.voiceFile);
  const clipSrc = cell.clipFile ? mobileClipSrc(job, cell.clipFile) : "";

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
    <div className="m-talk-tools">
      <div className="m-talk-tools-who">
        <span className="m-talk-tools-title">{cell.title}</span>
        <span className="m-talk-tools-speaker">{cell.speaker || "No speaker"}</span>
        <span className="m-talk-tools-clock">{talkClipClock(cell.durationSec)}</span>
      </div>
      <p className="m-talk-tools-line">{cell.line || "No line yet"}</p>
      {clipSrc ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          className="m-talk-tools-video"
          src={clipSrc}
          poster={poster || undefined}
          controls
          playsInline
          preload="metadata"
        />
      ) : null}
      {audioSrc ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio className="m-talk-tools-audio" src={audioSrc} controls preload="metadata" />
      ) : (
        <p className="m-talk-tools-hint">Change audio on this clip, then Redo — not a song drop.</p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="audio/mpeg,.mp3"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void onPickAudio(file);
        }}
      />
      <div className="m-talk-tools-row">
        <MobilePrimaryButton
          size="chip"
          tone="ghost"
          disabled={Boolean(busy) || !cell.beatId}
          onClick={() => fileRef.current?.click()}
        >
          {busy === "audio" ? "…" : "Change audio"}
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
  );
}

/**
 * Skidmarks / talking shows: speech wave + clips on one sideways desk.
 * Not the music-video song TRACK. Plates / faces / places are built off
 * this strip — this is the cut.
 */
export function TalkTimeline({
  job,
  story,
  plated,
  compact = false,
  onOpenPlate,
  onJobChange,
}: {
  job: MobileGenJob;
  story: CrashStoryDoc | null;
  plated?: { shotId: string; sceneId: string; plateFile: string }[];
  compact?: boolean;
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
  const [measured, setMeasured] = useState<Record<string, number>>({});
  const cells = useMemo(() => talkClipLayout(desk.cells, measured), [desk.cells, measured]);
  const bands = talkSceneBands(cells);
  const innerW = talkDeskInnerWidth(cells);
  const selected = cells.find((c) => c.key === pickedKey) || cells[0] || null;

  if (!cells.length) {
    return (
      <div className="m-talk">
        <p className="m-talk-empty">
          Talking desk — clips sit here by length, speech and picture the same
          width. Not a song. Plates land when they are ready.
        </p>
      </div>
    );
  }

  return (
    <div className="m-talk">
      <div className="m-talk-head">
        <span className="m-talk-kicker">Talking timeline</span>
        <span className="m-talk-hint">Swipe sideways — speech and picture, same width.</span>
      </div>
      <div className="m-talk-desk-scroll">
        <div className="m-talk-desk-inner" style={{ width: `${innerW}px` }}>
          <div className="m-talk-scene-lane" aria-hidden>
            {bands.map((band) => (
              <span
                key={`${band.sceneId}-${band.title}`}
                className="m-talk-scene-band"
                style={{ width: `${band.widthPx}px`, color: band.color, borderColor: band.color }}
              >
                {band.title}
              </span>
            ))}
          </div>
          <TalkSpeechLane job={job} cells={cells} widthPx={innerW} />
          <div className="m-talk-film">
            {cells.map((cell) => {
              const src = stillUrl(job, cell.plateFile);
              const on = selected?.key === cell.key;
              return (
                <button
                  type="button"
                  key={cell.key}
                  className={`m-talk-film-cell${on ? " is-on" : ""}`}
                  style={{ width: `${cell.widthPx}px`, borderColor: cell.sceneColor }}
                  onClick={() => {
                    setPickedKey(cell.key);
                    onOpenPlate?.(cell.shotId);
                  }}
                  title={cell.title}
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="m-talk-film-still" />
                  ) : (
                    <span className="m-talk-film-empty" />
                  )}
                  {cell.clipFile ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video
                      className="m-talk-film-probe"
                      src={mobileClipSrc(job, cell.clipFile)}
                      preload="metadata"
                      muted
                      playsInline
                      onLoadedMetadata={(e) => {
                        const sec = e.currentTarget.duration;
                        if (!Number.isFinite(sec) || sec <= 0) return;
                        setMeasured((cur) =>
                          cur[cell.key] === sec ? cur : { ...cur, [cell.key]: sec },
                        );
                      }}
                    />
                  ) : null}
                  <span className="m-talk-film-label">
                    {cell.title}
                    <em>{talkClipClock(cell.durationSec)}</em>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {!compact && selected ? (
        <TalkClipTools job={job} cell={selected} onJobChange={onJobChange} />
      ) : null}
    </div>
  );
}
