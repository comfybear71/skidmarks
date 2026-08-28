"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { MobileClipUnit } from "@/lib/mobileGenJob";
import {
  readMvClipEngine,
  writeMvClipEngine,
  type MvClipEngine,
} from "@/lib/mobileImageMotion";
import { mobileClipSrc, stackedClipFiles, stableClipTakeLabel } from "@/lib/mobilePlateClips";
import { ClipFrameThumb } from "./ClipFrameThumb";

export { clipsForStillsDesk, clipsUnderPlate, mobileClipSrc, stackedClipFiles } from "@/lib/mobilePlateClips";
/** Match the still and the mp4 — this width on a phone. */
export const PLATE_TILE_PX = 160;

/**
 * /m strip: square plate, then 16:9 players under it — same width.
 * `layout="strip"` — oldest take left, newest right, swipe sideways
 * across the full /m Clips bleed (and Scratch pad). Default stack kept
 * for callers that want it.
 * Labels use song clock / file id — never "4/10" that renumbers on delete.
 * Every Generate take stays. Empty pending slots stay hidden.
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
  pickEngine,
}: {
  job: {
    id: string;
    styleId: string;
    folderName: string;
    scratchSong?: { cuts?: { clipFile?: string; startSec?: number }[] } | null;
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
  /** Music-video Clips fold — LTX / H3 for the next Send of this still. */
  pickEngine?: boolean;
}) {
  const [h3Ready, setH3Ready] = useState(false);
  const songCuts = job.scratchSong?.cuts || [];
  const files = clips.flatMap((clip, i) => {
    const stacked = stackedClipFiles(clip);
    const shotPoster = (clip.shotId && posterByShotId?.[clip.shotId]) || poster;
    return stacked.map((file, n) => ({
      key: `${clip.beatId}-${file}`,
      file,
      beatId: clip.beatId,
      shotId: (clip.shotId || "").trim(),
      poster: shotPoster,
      takeLabel: stableClipTakeLabel({ fileName: file, songCuts }),
      preload: Boolean(preload && i === clips.length - 1 && n === stacked.length - 1),
    }));
  });

  useEffect(() => {
    if (!pickEngine) return;
    let cancelled = false;
    fetch("/api/crash/mobile/scratch")
      .then((res) => res.json())
      .then((data: { minimax?: boolean }) => {
        if (!cancelled && typeof data.minimax === "boolean") setH3Ready(data.minimax);
      })
      .catch(() => {
        /* H3 stays dead */
      });
    return () => {
      cancelled = true;
    };
  }, [pickEngine]);

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
      {files.map((item, i) => {
        const lastOfShot =
          Boolean(pickEngine && item.shotId) &&
          !files.slice(i + 1).some((f) => f.shotId === item.shotId);
        return (
          <div key={item.key} className={pickEngine ? "m-plate-clip-unit" : undefined}>
            <ClipPlayer
              src={mobileClipSrc(job, item.file)}
              poster={item.poster}
              takeLabel={item.takeLabel}
              onRemove={
                onRemoveTake
                  ? () => onRemoveTake({ beatId: item.beatId, fileName: item.file })
                  : undefined
              }
              removeDisabled={removeDisabled}
            />
            {lastOfShot ? (
              <ClipEnginePick jobId={job.id} shotId={item.shotId} h3Ready={h3Ready} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ClipEnginePick({
  jobId,
  shotId,
  h3Ready,
}: {
  jobId: string;
  shotId: string;
  h3Ready: boolean;
}) {
  const [engine, setEngine] = useState<MvClipEngine>(() => readMvClipEngine(jobId, shotId));

  useEffect(() => {
    setEngine(readMvClipEngine(jobId, shotId));
  }, [jobId, shotId]);

  useEffect(() => {
    if (h3Ready || engine !== "h3") return;
    writeMvClipEngine(jobId, shotId, "ltx");
    setEngine("ltx");
  }, [engine, h3Ready, jobId, shotId]);

  function pick(next: MvClipEngine) {
    if (next === "h3" && !h3Ready) return;
    writeMvClipEngine(jobId, shotId, next);
    setEngine(next);
  }

  return (
    <div className="m-plate-clip-engines" role="group" aria-label="How to make the next clip">
      <button
        type="button"
        className={`m-plate-clip-engine${engine === "ltx" ? " is-on" : ""}`}
        onClick={() => pick("ltx")}
      >
        LTX
      </button>
      <button
        type="button"
        className={`m-plate-clip-engine${engine === "h3" ? " is-on" : ""}`}
        disabled={!h3Ready}
        title={h3Ready ? "MiniMax H3" : "H3 is not on this Studio"}
        onClick={() => pick("h3")}
      >
        H3
      </button>
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
  takeLabel,
  onRemove,
  removeDisabled,
}: {
  src: string;
  poster?: string;
  preload?: boolean;
  takeLabel?: string;
  onRemove?: () => void;
  removeDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
          <ClipFrameThumb clipSrc={src} stillSrc={poster} />
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
