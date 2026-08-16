"use client";

import { MobilePrimaryButton, mobileCard } from "./MobileUi";
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
  referenceSrc,
}: {
  candidate: MobileImageCandidate;
  imageSrc: (c: MobileImageCandidate) => string;
  busy?: boolean;
  onApprove: (c: MobileImageCandidate) => void;
  onReroll: () => void;
  referenceSrc?: string;
}) {
  const src = imageSrc(candidate);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ ...mobileCard, position: "relative", overflow: "hidden", borderRadius: "2px" }}>
        <ZoomableStill src={src} alt="Candidate" height={380} fit="contain" referenceSrc={referenceSrc} />
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

      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
        <div style={{ flex: 1 }}>
          <MobilePrimaryButton tone="ghost" disabled={busy} onClick={onReroll}>
            {busy ? "Generating…" : "Not this one"}
          </MobilePrimaryButton>
        </div>
        <div style={{ flex: 1 }}>
          <MobilePrimaryButton disabled={busy || candidate.approved} onClick={() => onApprove(candidate)}>
            {candidate.approved ? "Picked ✓" : "Pick this one"}
          </MobilePrimaryButton>
        </div>
      </div>
    </div>
  );
}
