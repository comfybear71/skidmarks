"use client";

import { useState } from "react";
import { useSwipeCarousel } from "@/hooks/useSwipeCarousel";
import { mobileCard } from "./MobileUi";
import type { MobileImageCandidate } from "@/lib/mobileGenJob";

/** Swipeable candidate picker — one big image at a time, dot trail below. */
export function SwipeCarousel({
  candidates,
  imageSrc,
  onApprove,
  busy,
}: {
  candidates: MobileImageCandidate[];
  imageSrc: (c: MobileImageCandidate) => string;
  onApprove: (c: MobileImageCandidate) => void;
  busy?: boolean;
}) {
  const { index, setIndex, dragOffset, handlers } = useSwipeCarousel(candidates.length);
  const [zoomed, setZoomed] = useState(false);
  const current = candidates[index];

  if (!candidates.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* A card, not the whole screen — the step stays scrollable around it.
          Tap the image for full screen. */}
      <div
        {...handlers}
        onClick={() => setZoomed(true)}
        style={{
          ...mobileCard,
          position: "relative",
          height: "300px",
          overflow: "hidden",
          touchAction: "pan-y",
          cursor: "zoom-in",
        }}
      >
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc(current)}
            alt="Candidate"
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              userSelect: "none",
              transform: `translateX(${dragOffset}px)`,
              opacity: current.approved ? 1 : 0.96,
            }}
          />
        ) : null}
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
        {current?.approved ? (
          <div
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              background: "var(--acid)",
              color: "var(--void)",
              borderRadius: "999px",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
            }}
          >
            ✓
          </div>
        ) : null}
      </div>

      {/* Dots said "there are four" but not what they were, so a picked image
          vanished the moment the batch moved on. Thumbnails keep every
          candidate on screen and let a pick be changed. */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          padding: "10px 2px",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {candidates.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Candidate ${i + 1}${c.approved ? " (picked)" : ""}`}
            aria-current={i === index}
            style={{
              position: "relative",
              flex: "0 0 auto",
              width: "64px",
              height: "64px",
              padding: 0,
              borderRadius: "10px",
              overflow: "hidden",
              background: "var(--panel-2)",
              border:
                i === index
                  ? "2px solid var(--acid)"
                  : c.approved
                    ? "2px solid var(--acid)"
                    : "1px solid var(--line)",
              opacity: i === index || c.approved ? 1 : 0.55,
              transition: "opacity 150ms",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc(c)}
              alt=""
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {c.approved ? (
              <span
                style={{
                  position: "absolute",
                  bottom: "2px",
                  right: "2px",
                  background: "var(--acid)",
                  color: "var(--void)",
                  borderRadius: "999px",
                  width: "16px",
                  height: "16px",
                  fontSize: "10px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✓
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={busy || !current}
        onClick={() => current && onApprove(current)}
        style={{
          padding: "14px",
          borderRadius: "10px",
          border: "none",
          background: current?.approved ? "var(--panel-2)" : "var(--acid)",
          color: current?.approved ? "var(--chrome-dim)" : "var(--void)",
          fontWeight: 600,
          fontSize: "15px",
        }}
      >
        {current?.approved ? "Picked ✓" : "Pick this one"}
      </button>

      {zoomed && current ? (
        <div
          onClick={() => setZoomed(false)}
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
            src={imageSrc(current)}
            alt="Candidate, full screen"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
          <span
            style={{
              position: "absolute",
              top: "16px",
              right: "18px",
              color: "var(--chrome)",
              fontSize: "24px",
            }}
          >
            ✕
          </span>
        </div>
      ) : null}
    </div>
  );
}
