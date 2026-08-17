/** Chaos presets — inject into position / LTX prompts for boundary tests. */

import type { ScratchChaosId } from "./types";

export type ScratchChaosPreset = {
  id: ScratchChaosId;
  label: string;
  /** Short desk hint. */
  hint: string;
  /** Appended to still / position staging. */
  stillSuffix: string;
  /** Appended to LTX / motion prompt. */
  motionSuffix: string;
};

export const SCRATCH_CHAOS_PRESETS: ScratchChaosPreset[] = [
  {
    id: "none",
    label: "None",
    hint: "Clean baseline — no chaos inject.",
    stillSuffix: "",
    motionSuffix: "",
  },
  {
    id: "wardrobe-melt",
    label: "Wardrobe melt",
    hint: "Fabric fails / slips / dissolves under motion.",
    stillSuffix:
      "Wardrobe is unstable: fabric edges soft, straps slipping, cloth starting to fail while the body stays solid.",
    motionSuffix:
      "Clothes melt and slip off during the shot; fabric dissolves while skin and pose stay continuous. No sudden teleport.",
  },
  {
    id: "gravity-off",
    label: "Gravity off",
    hint: "Float / tip / lean past normal balance.",
    stillSuffix: "Body leans past balance; weight feels wrong; heels barely grounded.",
    motionSuffix:
      "Subject drifts and tips as if gravity is wrong; hair and cloth float; feet leave the floor briefly then settle.",
  },
  {
    id: "too-close",
    label: "Too close",
    hint: "Extreme proximity — face/body fills frame.",
    stillSuffix: "Camera is uncomfortably close; face and torso dominate the frame; background crushed.",
    motionSuffix:
      "Camera breathes in too close; mouth and eyes fill the frame while speaking; slight handheld shake.",
  },
  {
    id: "wrong-room",
    label: "Wrong room",
    hint: "Place ref fights the staging — mismatch stress test.",
    stillSuffix:
      "Ignore matching the place card exactly — stage them in a conflicting corner of the same location language.",
    motionSuffix:
      "Environment feels like the wrong room for the line; light and walls disagree with the cast pose.",
  },
  {
    id: "mirror-trap",
    label: "Mirror trap",
    hint: "Reflection / double — identity bleed.",
    stillSuffix: "A mirror or glass catches a second copy of the subject at the edge of frame.",
    motionSuffix:
      "Reflection moves a half-beat late; mirror double almost speaks then freezes. Keep one real mouth as hero.",
  },
  {
    id: "crowd-bleed",
    label: "Crowd bleed",
    hint: "Extra bodies / hands in frame.",
    stillSuffix: "Extra shoulders or hands crowd the edges; someone almost in shot behind them.",
    motionSuffix:
      "Background figures drift into frame then out; elbows and hands appear at the borders during the line.",
  },
  {
    id: "prop-possession",
    label: "Prop possession",
    hint: "Object moves with intent.",
    stillSuffix: "One prop in frame feels alive — angled toward the speaker, slightly wrong.",
    motionSuffix:
      "The prop twitches and turns toward the speaker mid-line as if listening; subtle, not cartoon.",
  },
];

export function chaosPreset(id: ScratchChaosId): ScratchChaosPreset {
  return SCRATCH_CHAOS_PRESETS.find((p) => p.id === id) || SCRATCH_CHAOS_PRESETS[0]!;
}

/** Append chaos still text to a position prompt (idempotent-ish). */
export function injectChaosStill(positionPrompt: string, id: ScratchChaosId): string {
  const p = chaosPreset(id);
  if (!p.stillSuffix) return positionPrompt.trim();
  const base = positionPrompt.trim();
  if (!base) return p.stillSuffix;
  if (base.includes(p.stillSuffix.slice(0, 24))) return base;
  return `${base} ${p.stillSuffix}`.trim();
}

/** Append chaos motion text to an LTX prompt. */
export function injectChaosMotion(motionPrompt: string, id: ScratchChaosId): string {
  const p = chaosPreset(id);
  if (!p.motionSuffix) return motionPrompt.trim();
  const base = motionPrompt.trim();
  if (!base) return p.motionSuffix;
  if (base.includes(p.motionSuffix.slice(0, 24))) return base;
  return `${base} ${p.motionSuffix}`.trim();
}
