"use client";

import { useSwipeCarousel } from "@/hooks/useSwipeCarousel";
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
  const current = candidates[index];

  if (!candidates.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div
        {...handlers}
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          borderRadius: "14px",
          overflow: "hidden",
          background: "var(--panel-2)",
          border: "1px solid var(--line)",
          touchAction: "pan-y",
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

      <div style={{ display: "flex", justifyContent: "center", gap: "6px", padding: "10px 0" }}>
        {candidates.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setIndex(i)}
            style={{
              width: i === index ? "20px" : "8px",
              height: "8px",
              borderRadius: "999px",
              border: "none",
              background: i === index ? "var(--acid)" : "var(--line)",
              transition: "width 150ms",
            }}
          />
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
    </div>
  );
}
