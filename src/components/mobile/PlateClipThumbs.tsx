"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { MobileClipUnit } from "@/lib/mobileGenJob";
import { mobileClipSrc, stackedClipFiles, stableClipTakeLabel } from "@/lib/mobilePlateClips";

export { clipsUnderPlate, mobileClipSrc, stackedClipFiles } from "@/lib/mobilePlateClips";
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
  layout = "stack",
  onRemoveTake,
  removeDisabled,
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
  layout?: "stack" | "strip";
  /** /m and Scratch — park one take (mp4 stays in _cleared/ or Blob). */
  onRemoveTake?: (opts: { beatId: string; fileName: string }) => void;
  removeDisabled?: boolean;
}) {
  const songCuts = job.scratchSong?.cuts || [];
  const files = clips.flatMap((clip, i) => {
    const stacked = stackedClipFiles(clip);
    return stacked.map((file, n) => ({
      key: `${clip.beatId}-${file}`,
      file,
      beatId: clip.beatId,
      takeLabel: stableClipTakeLabel({ fileName: file, songCuts }),
      preload: Boolean(preload && i === clips.length - 1 && n === stacked.length - 1),
    }));
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
      {files.map((row) => (
        <ClipPlayer
          key={row.key}
          src={mobileClipSrc(job, row.file)}
          takeLabel={row.takeLabel}
          onRemove={
            onRemoveTake
              ? () => onRemoveTake({ beatId: row.beatId, fileName: row.file })
              : undefined
          }
          removeDisabled={removeDisabled}
        />
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
        <video
          src={src}
          playsInline
          muted
          preload="metadata"
          onClick={() => setOpen(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            background: "#000",
            cursor: "zoom-in",
          }}
        />
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
