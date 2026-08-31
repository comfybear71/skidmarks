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

import {
  MATH_PATTERN_MODE_PRESETS,
  MATH_PATTERN_MODES,
  MATH_PATTERN_PALETTES,
  clampMathPatternParams,
  type MathPatternParams,
} from "./mathPatternShader";

export type MathPatternEmotion = "calm" | "excited";

export type MathPatternPhaseId = "outbreak" | "shift" | "dissolve";

export type MathPatternSettings = {
  emotion: MathPatternEmotion;
  outbreak: string;
  shift: string;
  dissolve: string;
  /** Set once the operator touches a mode/palette/slider/shuffle control — pins the
   * look and overrides the schedule-hash-driven auto params below. */
  manual?: MathPatternParams | null;
  /** A plate filename picked as the image-warp source. Session-only uploads are
   * held in component state instead, since they have no stable server path. */
  imageFileName?: string;
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
    manual: raw?.manual ? clampMathPatternParams(raw.manual) : null,
    imageFileName: cleanMathPatternLine(raw?.imageFileName || ""),
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

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash a stage's prompt text into a deterministic MathPatternParams set —
 * same text always produces the same look. Mode/palette are drawn from the
 * hash; the numeric fold/zoom/bands/warp start from that mode's preset
 * (jittered by the same hash) rather than being fully random.
 */
export function mathPatternStageParams(text: string): MathPatternParams {
  const seed = Math.floor(mathPatternSeed(text) * 4294967295);
  const rand = mulberry32(seed);
  const mode = MATH_PATTERN_MODES[Math.floor(rand() * MATH_PATTERN_MODES.length)];
  const palette = MATH_PATTERN_PALETTES[Math.floor(rand() * MATH_PATTERN_PALETTES.length)];
  const preset = MATH_PATTERN_MODE_PRESETS[mode];
  const jitter = () => (rand() - 0.5) * 0.12;
  return clampMathPatternParams({
    mode,
    palette,
    bands: preset.bands + jitter(),
    hardEdges: 0.5 + jitter(),
    warp: preset.warp + jitter(),
    zoom: preset.zoom + jitter(),
    fold: preset.fold + jitter(),
    hueShift: rand(),
    intensity: 0.6,
    speed: 0.5,
  });
}

function smoothstep01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Smoothstep the numeric params across the timeline (phase 0 → outbreak,
 * 1 → shift, 2 → dissolve). Mode and palette are discrete: they switch at
 * the stage boundary instead of blending. So do the mode's own geometry
 * knobs (bands/warp/zoom/fold) — two different modes give those numbers
 * different meaning, so cross-fading them mid-transition produces
 * nonsensical, noisy combinations. Only the mode-agnostic style values
 * (hue/intensity/speed) actually crossfade.
 */
export function interpolateMathPatternStage(
  phase: number,
  outbreak: MathPatternParams,
  shift: MathPatternParams,
  dissolve: MathPatternParams,
): MathPatternParams {
  let from = outbreak;
  let to = shift;
  let local = phase;
  if (phase >= 1) {
    from = shift;
    to = dissolve;
    local = phase - 1;
  }
  const t = smoothstep01(local);
  const discrete = t < 0.5 ? from : to;
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    mode: discrete.mode,
    palette: discrete.palette,
    bands: discrete.bands,
    hardEdges: discrete.hardEdges,
    warp: discrete.warp,
    zoom: discrete.zoom,
    fold: discrete.fold,
    hueShift: lerp(from.hueShift, to.hueShift),
    intensity: lerp(from.intensity, to.intensity),
    speed: lerp(from.speed, to.speed),
  };
}
