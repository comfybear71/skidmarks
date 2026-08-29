/**
 * MATH desk — mathematical pattern engine, not image-to-video.
 *
 * Stuie asked for fluid abstract rainbows that morph by "emotion"
 * (sine vs tangent), from empty noise, not a plate into LTX / H3.
 * FizzNodes / AnimateDiff / Comfy custom suites are a local Comfy
 * install. This file is the Studio gold: the three-phase sensory
 * schedule + calm/excited map. The live engine is the browser
 * canvas in mathPatternEngine.ts. Do not generate on Comfy until
 * he says go.
 */

export type MathPatternEmotion = "calm" | "excited";

export type MathPatternPhaseId = "outbreak" | "shift" | "dissolve";

export type MathPatternSettings = {
  emotion: MathPatternEmotion;
  outbreak: string;
  shift: string;
  dissolve: string;
};

/** Frame 0 — organic melt. His words. */
export const MATH_PATTERN_OUTBREAK =
  "An infinite kaleidoscopic array of microscopic iridescent prisms, shifting refraction, infinite tiny rainbows, fluid organic melting, high contrast, ultra detailed math art, deep black background";

/** Frame 40 — crystallization. His words. */
export const MATH_PATTERN_SHIFT =
  "Sharp geometric crystallization, jagged neon light refracting, iridescent shattered glass forming geometric shapes, intense color pressure, mathematical symmetry, sharp edges";

/** Frame 80 — dissolve. His words. */
export const MATH_PATTERN_DISSOLVE =
  "Subtle gaseous diffusion, macro oil-slick bubbles floating, slow chromatic aberration trails, deep silence, fading into dark liquid void";

export const MATH_PATTERN_DEFAULTS: MathPatternSettings = {
  emotion: "calm",
  outbreak: MATH_PATTERN_OUTBREAK,
  shift: MATH_PATTERN_SHIFT,
  dissolve: MATH_PATTERN_DISSOLVE,
};

export function parseMathPatternEmotion(
  value: string | null | undefined,
): MathPatternEmotion {
  return value === "excited" ? "excited" : "calm";
}

export function cleanMathPatternLine(text: string): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

export function normalizeMathPatternSettings(
  raw?: Partial<MathPatternSettings> | null,
): MathPatternSettings {
  return {
    emotion: parseMathPatternEmotion(raw?.emotion),
    outbreak: cleanMathPatternLine(raw?.outbreak || "") || MATH_PATTERN_OUTBREAK,
    shift: cleanMathPatternLine(raw?.shift || "") || MATH_PATTERN_SHIFT,
    dissolve: cleanMathPatternLine(raw?.dissolve || "") || MATH_PATTERN_DISSOLVE,
  };
}

/** What Send writes onto the beat — schedule only. Not an LTX lock. */
export function composeMathPatternMotion(settings: MathPatternSettings): string {
  const s = normalizeMathPatternSettings(settings);
  return [
    `MATH · ${s.emotion === "excited" ? "excited tangent" : "calm sine"}`,
    `Frame 0: ${s.outbreak}`,
    `Frame 40: ${s.shift}`,
    `Frame 80: ${s.dissolve}`,
  ].join("\n");
}

export function mathPatternMotionLooksLike(text: string): boolean {
  const t = (text || "").trim();
  return /^MATH\s*·/i.test(t) || /^MATH ·/i.test(t);
}

export function muteMvMathFoldSummary(): string {
  return "MATH · noise + feedback · not a plate · not LTX / H3";
}

export function muteMvMathFoldLines(): string[] {
  return [
    "Empty latent. Perlin / fractal noise, then a feedback trail (tiny zoom + spin).",
    "Calm = low contrast + sine. Excited = high contrast + tangent spikes.",
    "The three boxes are the sensory schedule (outbreak → crystal → dissolve). They seed the math. They are not sent to LTX.",
    "Send records this canvas silent and hangs it on the existing TRACK clock. No Comfy generate. No start image.",
    "FizzNodes / AnimateDiff / ControlNet live in a local Comfy install — not this button.",
  ];
}

export function muteMvMathMotionLabel(): string {
  return "MATH pattern";
}

function mathSettingsKey(jobId: string, shotId: string): string {
  return `skidmarks.mathPattern.${(jobId || "").trim()}.${(shotId || "").trim()}`;
}

export function readMathPatternSettings(
  jobId: string,
  shotId: string,
): MathPatternSettings {
  if (typeof window === "undefined") return { ...MATH_PATTERN_DEFAULTS };
  try {
    const raw = window.sessionStorage.getItem(mathSettingsKey(jobId, shotId));
    if (!raw) return { ...MATH_PATTERN_DEFAULTS };
    return normalizeMathPatternSettings(JSON.parse(raw) as Partial<MathPatternSettings>);
  } catch {
    return { ...MATH_PATTERN_DEFAULTS };
  }
}

export function writeMathPatternSettings(
  jobId: string,
  shotId: string,
  settings: MathPatternSettings,
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      mathSettingsKey(jobId, shotId),
      JSON.stringify(normalizeMathPatternSettings(settings)),
    );
  } catch {
    /* private mode */
  }
}

/** Hash a prompt into 0..1 so the words actually change the field. */
export function mathPatternSeed(text: string): number {
  const s = cleanMathPatternLine(text);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * Live preview loops 12s. A Send stretches outbreak→dissolve once
 * across the hung bar. Do not invent 15s.
 */
export const MATH_PATTERN_PREVIEW_CYCLE_SEC = 12;

export function mathPatternPhase01(elapsedSec: number, cycleSec: number): number {
  const cycle = cycleSec > 0 ? cycleSec : MATH_PATTERN_PREVIEW_CYCLE_SEC;
  const t = ((elapsedSec % cycle) + cycle) % cycle;
  return t / cycle;
}

/** 0 outbreak → 1 crystal → 2 dissolve. */
export function mathPatternPhaseValue(elapsedSec: number, cycleSec: number): number {
  return mathPatternPhase01(elapsedSec, cycleSec) * 2;
}

export function mathPatternPhaseId(phase: number): MathPatternPhaseId {
  if (phase < 0.7) return "outbreak";
  if (phase < 1.4) return "shift";
  return "dissolve";
}
