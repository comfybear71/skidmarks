"use client";

import { useRef, useState, type CSSProperties, type MouseEvent } from "react";
import type { MobileClipUnit } from "@/lib/mobileGenJob";
import { mobileClipSrc } from "@/lib/mobilePlateClips";

export { clipsUnderPlate, mobileClipSrc } from "@/lib/mobilePlateClips";
export const PLATE_TILE_PX = 96;

const box: CSSProperties = {
  width: `${PLATE_TILE_PX}px`,
  aspectRatio: "16 / 9",
  borderRadius: "2px",
  background: "var(--void)",
  display: "block",
  position: "relative",
  overflow: "hidden",
  flex: "0 0 auto",
};

/**
 * /m strip: square plate, then unlabeled 16:9 thumbs stacked under it.
 * Done clip = play button. Empty = dashed box. No CLIP text.
 */
export function PlateClipThumbs({
  job,
  clips,
  preload,
}: {
  job: { styleId: string; folderName: string };
  clips: MobileClipUnit[];
  preload?: boolean;
}) {
  if (!clips.length) return null;
  return (
    <>
      {clips.map((clip) =>
        clip.clipFile ? (
          <ClipThumb
            key={clip.beatId}
            src={mobileClipSrc(job, clip.clipFile)}
            preload={preload}
          />
        ) : (
          <div
            key={clip.beatId}
            style={{ ...box, border: "1px dashed var(--line)" }}
          />
        ),
      )}
    </>
  );
}

function ClipThumb({ src, preload }: { src: string; preload?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? "Pause clip" : "Play clip"}
      style={{
        ...box,
        border: "1px solid var(--line)",
        padding: 0,
        cursor: "pointer",
      }}
    >
      <video
        ref={ref}
        src={src}
        playsInline
        preload={preload ? "metadata" : "none"}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          pointerEvents: "none",
        }}
      />
      {playing ? null : (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "999px",
              background: "rgba(20,20,24,0.78)",
              color: "#fff",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              paddingLeft: "2px",
            }}
          >
            ▶
          </span>
        </span>
      )}
    </button>
  );
}
