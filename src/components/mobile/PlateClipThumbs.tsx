"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { MobileClipUnit } from "@/lib/mobileGenJob";
import {
  clipFileBasename,
  clipHangStartMs,
  clipTakeDurationSec,
  formatClipTakeStamp,
  mobileClipSrc,
  stackedClipFiles,
} from "@/lib/mobilePlateClips";
import { ClipFrameThumb } from "./ClipFrameThumb";

export {
  clipRailLabels,
  clipsForStillsDesk,
  clipsUnderPlate,
  gatherClipsForStillsRail,
  mobileClipSrc,
  stackedClipFiles,
} from "@/lib/mobilePlateClips";
/** Match the still and the mp4 — this width on a phone. */
export const PLATE_TILE_PX = 160;

/**
 * /m strip: square plate, then 16:9 players under it — same width.
 * `layout="strip"` — oldest take left, newest right, swipe sideways
 * across the full /m Clips bleed (and Scratch pad). New mp4s append.
 * Default stack kept for callers that want it.
 * Labels are clip 1, clip 2, clip 3 in hang / cook order — never story plate 8.
 * Stamp is mp4 length (`16s` / `5s`), with wave start only beside it
 * (`0:15 · 5s`). Never start-only — that read as a 15s file. Never a filename tail.
 * Every Generate take stays. Empty pending slots stay hidden.
 * Off thumbs stay off. No Hang button on the CLIPS row.
 * Play opens a body portal — native controls inside the overflow rail
 * sit under the pad on iPhone.
 */
export function PlateClipThumbs({
  job,
  clips,
  preload,
  poster,
  posterByShotId,
  layout = "stack",
  onRemoveTake,
  removeDisabled,
}: {
  job: {
    id: string;
    styleId: string;
    folderName: string;
    scratchSong?: {
      cuts?: { clipFile?: string; shotId?: string; durationSec?: number }[];
      plateTimings?: { plateId: string; startMs: number; endMs: number; sortIndex: number }[];
    } | null;
    trackDraft?: {
      plateTimings?: { plateId: string; startMs: number; endMs: number; sortIndex: number }[];
    } | null;
  };
  clips: MobileClipUnit[];
  preload?: boolean;
  /** Plate still — first frame stand-in so the box is not black before play. */
  poster?: string;
  /** One still per shot so the Clips rail is not eighteen copies of shot 01. */
  posterByShotId?: Record<string, string>;
  layout?: "stack" | "strip";
  /** /m and Scratch — park one take (mp4 stays in _cleared/ or Blob). */
  onRemoveTake?: (opts: { beatId: string; fileName: string }) => void;
  removeDisabled?: boolean;
}) {
  const songCuts = job.scratchSong?.cuts || [];
  const plateTimings = job.scratchSong?.plateTimings || job.trackDraft?.plateTimings || [];
  const seenFile = new Set<string>();
  const files: {
    key: string;
    file: string;
    beatId: string;
    poster?: string;
    startMs: number | null;
    durationSec: number | null;
    preload: boolean;
  }[] = [];
  clips.forEach((clip, i) => {
    const stacked = stackedClipFiles(clip);
    const shotPoster = (clip.shotId && posterByShotId?.[clip.shotId]) || poster;
    stacked.forEach((file, n) => {
      if (seenFile.has(file)) return;
      seenFile.add(file);
      const clock = {
        fileName: file,
        shotId: clip.shotId,
        durationSec:
          file === clipFileBasename(clip.clipFile || "") ? clip.durationSec : undefined,
        songCuts,
        plateTimings,
      };
      files.push({
        key: `${clip.beatId}-${file}`,
        file,
        beatId: clip.beatId,
        poster: shotPoster,
        startMs: clipHangStartMs(
          { shotId: clip.shotId, clipFile: file, priorClipFiles: [] },
          { cuts: songCuts, plateTimings },
        ),
        durationSec: clipTakeDurationSec(clock),
        preload: Boolean(preload && i === clips.length - 1 && n === stacked.length - 1),
      });
    });
  });
  if (!files.length) return null;
  const row = layout === "strip";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: row ? "row" : "column",
        gap: "6px",
        width: row ? "auto" : `${PLATE_TILE_PX}px`,
        flex: "0 0 auto",
      }}
    >
      {files.map((row, i) => (
        <div key={row.key} className="m-plate-clip-thumb">
          <ClipPlayer
            src={mobileClipSrc(job, row.file)}
            poster={row.poster}
            startMs={row.startMs}
            durationSec={row.durationSec}
            onRemove={
              onRemoveTake
                ? () => onRemoveTake({ beatId: row.beatId, fileName: row.file })
                : undefined
            }
            removeDisabled={removeDisabled}
          />
          <span className="m-plate-clip-plate">{`clip ${i + 1}`}</span>
        </div>
      ))}
    </div>
  );
}

const frame: CSSProperties = {
  width: `${PLATE_TILE_PX}px`,
  aspectRatio: "16 / 9",
  borderRadius: "2px",
  border: "1px solid var(--acid)",
  background: "var(--void)",
  display: "block",
  position: "relative",
  overflow: "hidden",
};

function ClipPlayer({
  src,
  poster,
  startMs,
  durationSec,
  onRemove,
  removeDisabled,
}: {
  src: string;
  poster?: string;
  preload?: boolean;
  startMs: number | null;
  durationSec: number | null;
  onRemove?: () => void;
  removeDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [fileSec, setFileSec] = useState<number | null>(null);
  const takeLabel = formatClipTakeStamp(startMs, fileSec ?? durationSec);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setFileSec(null);
  }, [src]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const overlay =
    mounted && open
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Full screen clip"
            className="scratch-clip-overlay"
            onClick={() => setOpen(false)}
          >
            <video
              src={src}
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                background: "#000",
              }}
            />
            <span className="scratch-clip-overlay-x" aria-hidden>
              ✕
            </span>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div style={frame}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Play clip"
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            padding: 0,
            border: 0,
            background: "transparent",
            cursor: "zoom-in",
          }}
        >
          <ClipFrameThumb
            clipSrc={src}
            stillSrc={poster}
            onDurationSec={(sec) => setFileSec(sec)}
          />
        </button>
        <button type="button" className="scratch-clip-play" aria-label="Play clip" onClick={() => setOpen(true)}>
          ▶
        </button>
        {takeLabel ? (
          <span
            style={{
              position: "absolute",
              top: "4px",
              left: "4px",
              padding: "1px 5px",
              borderRadius: "2px",
              border: "1px solid var(--acid)",
              background: "rgba(0,0,0,0.72)",
              color: "var(--acid)",
              fontSize: "10px",
              fontWeight: 700,
              lineHeight: 1.3,
            }}
          >
            {takeLabel}
          </span>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            aria-label="Remove clip"
            title="Remove from strip. File parks in _cleared/ — not deleted."
            disabled={removeDisabled}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              width: "22px",
              height: "22px",
              padding: 0,
              borderRadius: "2px",
              border: "1px solid var(--acid)",
              background: "rgba(0,0,0,0.72)",
              color: "var(--acid)",
              fontSize: "11px",
              lineHeight: 1,
              cursor: removeDisabled ? "not-allowed" : "pointer",
              opacity: removeDisabled ? 0.45 : 1,
            }}
          >
            ✕
          </button>
        ) : null}
      </div>
      {overlay}
    </>
  );
}
