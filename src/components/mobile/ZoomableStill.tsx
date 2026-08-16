"use client";

import { useState, type CSSProperties } from "react";

/** Full-screen still. Tap anywhere to close. */
export function ZoomOverlay({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
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
    </div>
  );
}

/** Still that opens a full-screen enlarge on tap. */
export function ZoomableStill({
  src,
  alt,
  height = 220,
  showHint = true,
  style,
}: {
  src: string;
  alt?: string;
  height?: number | string;
  showHint?: boolean;
  style?: CSSProperties;
}) {
  const [zoomed, setZoomed] = useState(false);

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
          height,
          ...style,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt || ""}
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", userSelect: "none", display: "block" }}
        />
        {showHint ? (
          <span
            style={{
              position: "absolute",
              bottom: "10px",
              right: "10px",
              padding: "4px 8px",
              borderRadius: "999px",
              background: "rgba(0,0,0,0.55)",
              color: "var(--chrome)",
              fontSize: "11px",
              pointerEvents: "none",
            }}
          >
            Tap to enlarge
          </span>
        ) : null}
      </div>
      {zoomed ? <ZoomOverlay src={src} alt={alt} onClose={() => setZoomed(false)} /> : null}
    </>
  );
}
