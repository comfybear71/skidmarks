"use client";

import { useState } from "react";
import { mobileCard } from "./MobileUi";
import type { MobileImageCandidate } from "@/lib/mobileGenJob";

/**
 * One candidate at a time, not a batch to compare — dud it and a fresh one
 * replaces it outright. Swiping through four near-identical AI guesses read
 * as a chore; "not this one, try again" is the actual decision being made.
 */
export function SingleCandidateCard({
  candidate,
  imageSrc,
  busy,
  onApprove,
  onReroll,
}: {
  candidate: MobileImageCandidate;
  imageSrc: (c: MobileImageCandidate) => string;
  busy?: boolean;
  onApprove: (c: MobileImageCandidate) => void;
  onReroll: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        onClick={() => setZoomed(true)}
        style={{
          ...mobileCard,
          position: "relative",
          height: "300px",
          overflow: "hidden",
          cursor: "zoom-in",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc(candidate)}
          alt="Candidate"
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", userSelect: "none" }}
        />
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
        {candidate.approved ? (
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

      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
        <button
          type="button"
          disabled={busy}
          onClick={onReroll}
          style={{
            flex: 1,
            padding: "14px",
            borderRadius: "10px",
            border: "1px solid var(--line)",
            background: "transparent",
            color: busy ? "var(--chrome-dim)" : "var(--chrome)",
            fontWeight: 600,
            fontSize: "14px",
          }}
        >
          {busy ? "Generating…" : "Not this one"}
        </button>
        <button
          type="button"
          disabled={busy || candidate.approved}
          onClick={() => onApprove(candidate)}
          style={{
            flex: 1,
            padding: "14px",
            borderRadius: "10px",
            border: "none",
            background: candidate.approved ? "var(--panel-2)" : "var(--acid)",
            color: candidate.approved ? "var(--chrome-dim)" : "var(--void)",
            fontWeight: 600,
            fontSize: "14px",
          }}
        >
          {candidate.approved ? "Picked ✓" : "Pick this one"}
        </button>
      </div>

      {zoomed ? (
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
            src={imageSrc(candidate)}
            alt="Candidate, full screen"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
          <span style={{ position: "absolute", top: "16px", right: "18px", color: "var(--chrome)", fontSize: "24px" }}>
            ✕
          </span>
        </div>
      ) : null}
    </div>
  );
}
