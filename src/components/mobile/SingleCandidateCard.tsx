"use client";

import { mobileCard } from "./MobileUi";
import { ZoomableStill } from "./ZoomableStill";
import type { MobileImageCandidate } from "@/lib/mobileGenJob";

/**
 * The take on the desk right now. Earlier stills stay on the job — More
 * does not replace them. Undo / the take strip / a dropped photo bring
 * a previous one back.
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
  const src = imageSrc(candidate);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ ...mobileCard, position: "relative", overflow: "hidden" }}>
        <ZoomableStill src={src} alt="Candidate" height={300} />
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
              pointerEvents: "none",
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
    </div>
  );
}
