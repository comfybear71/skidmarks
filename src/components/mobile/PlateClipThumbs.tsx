"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { MobileClipUnit } from "@/lib/mobileGenJob";
import { mobileClipSrc, stackedClipFiles } from "@/lib/mobilePlateClips";

export { clipsUnderPlate, mobileClipSrc, stackedClipFiles } from "@/lib/mobilePlateClips";
/** Match the still and the mp4 — controls need this width on a phone. */
export const PLATE_TILE_PX = 160;

/**
 * /m strip: square plate, then 16:9 players stacked under it — same width.
 * Scratch pad uses `layout="strip"` — oldest take left, newest right, swipe sideways.
 * Every Generate take stays. Empty pending slots stay hidden.
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
  job: { id: string; styleId: string; folderName: string };
  clips: MobileClipUnit[];
  preload?: boolean;
  /** Plate still — first frame stand-in so the box is not black before play. */
  poster?: string;
  layout?: "stack" | "strip";
  /** Scratch — park one bad take off the strip (mp4 stays in _cleared/ or Blob). */
  onRemoveTake?: (opts: { beatId: string; fileName: string }) => void;
  removeDisabled?: boolean;
}) {
  const files = clips.flatMap((clip, i) => {
    const stacked = stackedClipFiles(clip);
    return stacked.map((file, n) => ({
      key: `${clip.beatId}-${n}-${file}`,
      file,
      beatId: clip.beatId,
      takeLabel: stacked.length > 1 ? `${n + 1}/${stacked.length}` : "",
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
          poster={poster}
          preload={row.preload}
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
  poster,
  preload,
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
  const ref = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (el) el.pause();
  }, [open]);

  return (
    <>
      <div style={frame}>
        <video
          ref={ref}
          src={src}
          poster={poster || undefined}
          controls
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            if (el.currentTime < 0.05) el.currentTime = 0.08;
          }}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            background: "#000",
          }}
        />
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
        <button
          type="button"
          aria-label="Enlarge clip"
          onClick={() => setOpen(true)}
          style={{
            position: "absolute",
            top: "4px",
            right: onRemove ? "30px" : "4px",
            width: "22px",
            height: "22px",
            padding: 0,
            borderRadius: "2px",
            border: "1px solid var(--acid)",
            background: "rgba(0,0,0,0.72)",
            color: "var(--acid)",
            fontSize: "12px",
            lineHeight: 1,
            cursor: "zoom-in",
          }}
        >
          ⤢
        </button>
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
      {open ? (
        <div
          role="dialog"
          aria-label="Full screen clip"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            background: "rgba(0,0,0,0.94)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px",
            cursor: "zoom-out",
          }}
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
          <span style={{ position: "absolute", top: "16px", right: "18px", color: "var(--chrome)", fontSize: "24px" }}>
            ✕
          </span>
        </div>
      ) : null}
    </>
  );
}
