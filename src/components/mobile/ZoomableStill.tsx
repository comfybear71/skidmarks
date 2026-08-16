"use client";

import { useState, type CSSProperties } from "react";

/** Thin 4-view sheet on the still — reference only, not a second page. */
function CharacterPlateRibbon({ src, tall }: { src: string; tall?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: tall ? "72px" : "52px",
        background: "rgba(0,0,0,0.72)",
        pointerEvents: "none",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
    </div>
  );
}

/** Full-screen still. Tap anywhere to close. */
export function ZoomOverlay({
  src,
  alt,
  onClose,
  referenceSrc,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
  referenceSrc?: string;
}) {
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-label="Full screen image"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(0,0,0,0.94)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px",
        paddingBottom: referenceSrc ? "84px" : "12px",
        cursor: "zoom-out",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || "Full screen"}
        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
      />
      <span style={{ position: "absolute", top: "16px", right: "18px", color: "var(--chrome)", fontSize: "24px" }}>
        ✕
      </span>
      {referenceSrc ? <CharacterPlateRibbon src={referenceSrc} tall /> : null}
    </div>
  );
}

/** Still that opens a full-screen enlarge on tap. */
export function ZoomableStill({
  src,
  alt,
  height = 220,
  showHint = true,
  fit = "contain",
  referenceSrc,
  style,
}: {
  src: string;
  alt?: string;
  height?: number | string;
  showHint?: boolean;
  /** contain = whole still (cast/place). cover crops to a torso. */
  fit?: "contain" | "cover";
  /** Series 4-view sheet — a ribbon on the still, not its own section. */
  referenceSrc?: string;
  style?: CSSProperties;
}) {
  const [zoomed, setZoomed] = useState(false);
  const maxH = typeof height === "number" ? height : 380;

  return (
    <>
      <div
        onClick={() => setZoomed(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setZoomed(true);
          }
        }}
        style={{
          position: "relative",
          overflow: "hidden",
          cursor: "zoom-in",
          background: "var(--void)",
          height: fit === "cover" ? height : "auto",
          ...style,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt || ""}
          draggable={false}
          style={{
            width: "100%",
            height: fit === "cover" ? "100%" : "auto",
            maxHeight: fit === "contain" ? maxH : undefined,
            objectFit: fit,
            objectPosition: "center top",
            userSelect: "none",
            display: "block",
          }}
        />
        {showHint ? (
          <span
            style={{
              position: "absolute",
              bottom: referenceSrc ? "58px" : "10px",
              right: "10px",
              padding: "4px 8px",
              borderRadius: "2px",
              background: "rgba(0,0,0,0.55)",
              color: "var(--chrome)",
              fontSize: "11px",
              pointerEvents: "none",
            }}
          >
            Tap to enlarge
          </span>
        ) : null}
        {referenceSrc ? <CharacterPlateRibbon src={referenceSrc} /> : null}
      </div>
      {zoomed ? (
        <ZoomOverlay src={src} alt={alt} onClose={() => setZoomed(false)} referenceSrc={referenceSrc} />
      ) : null}
    </>
  );
}
