/**
 * Scratch Generate — Siray i2v spicy models.
 * Client-safe (no env / fs). Same key, only the model string changes.
 * 2.0 is the cheap first pass; 2.5 / Wan are later swaps.
 */

export type SirayI2vId = "seedance-20" | "seedance-25" | "wan-27" | "wan-30";

export type SirayI2vSpec = {
  id: SirayI2vId;
  model: string;
  label: string;
  shortLabel: string;
  hint: string;
  minSec: number;
  maxSec: number;
  size: "720p";
  /** Seedance + Wan 3.0 require this. Wan 2.7 does not accept it. */
  aspectRatio?: "adaptive";
};

export const SIRAY_I2V_DEFAULT: SirayI2vId = "seedance-20";

export const SIRAY_I2V_MODELS: readonly SirayI2vSpec[] = [
  {
    id: "seedance-20",
    model: "bytedance/seedance-2.0-i2v-spicy",
    label: "Seedance 2.0 Spicy",
    shortLabel: "2.0",
    hint: "Cheap first pass. 4–15s from the mp3.",
    minSec: 4,
    maxSec: 15,
    size: "720p",
    aspectRatio: "adaptive",
  },
  {
    id: "seedance-25",
    model: "bytedance/seedance-2.5-i2v-spicy",
    label: "Seedance 2.5 Spicy",
    shortLabel: "2.5",
    hint: "Dearer. Follows the mp3 up to 30s.",
    minSec: 4,
    maxSec: 30,
    size: "720p",
    aspectRatio: "adaptive",
  },
  {
    id: "wan-27",
    model: "alibaba/wan-2.7-i2v-spicy",
    label: "Wan 2.7 Spicy",
    shortLabel: "Wan 2.7",
    hint: "2–15s from the mp3.",
    minSec: 2,
    maxSec: 15,
    size: "720p",
  },
  {
    id: "wan-30",
    model: "alibaba/wan-3.0-i2v-spicy",
    label: "Wan 3.0 Spicy",
    shortLabel: "Wan 3.0",
    hint: "Follows the mp3 up to 30s.",
    minSec: 2,
    maxSec: 30,
    size: "720p",
    aspectRatio: "adaptive",
  },
];

export function isSirayI2vId(value: string): value is SirayI2vId {
  return SIRAY_I2V_MODELS.some((row) => row.id === value);
}

export function sirayI2vSpec(id: string | undefined): SirayI2vSpec {
  return SIRAY_I2V_MODELS.find((row) => row.id === id) || SIRAY_I2V_MODELS[0];
}

/** `siray` / `siray-spicy` stay the cheap 2.0 first pass. */
export function parseScratchClipEngine(raw: string | undefined): "ltx" | SirayI2vId {
  const value = (raw || "ltx").trim().toLowerCase();
  if (!value || value === "ltx") return "ltx";
  if (value === "siray" || value === "siray-spicy" || value === "siray-i2v") return SIRAY_I2V_DEFAULT;
  if (isSirayI2vId(value)) return value;
  throw new Error(`Unknown clip engine: ${raw}`);
}

export function scratchWantsNude(text: string): boolean {
  const t = (text || "").toLowerCase();
  return (
    /\b(fully )?nude\b/.test(t) ||
    /\bnaked\b/.test(t) ||
    /\bpartial nudity\b/.test(t) ||
    /\btopless\b/.test(t) ||
    /\bundress/.test(t) ||
    /\bno clothes\b/.test(t) ||
    /\bwithout clothes\b/.test(t)
  );
}

/** Nude + the pad/look says this is a man — Seedream otherwise draws a woman. */
export function scratchWantsMaleNude(text: string): boolean {
  if (!scratchWantsNude(text)) return false;
  const t = (text || "").toLowerCase();
  const female = /\bwom[ae]n\b|\bfemale\b|\blady\b/.test(t);
  const male = /\bman\b|\bmale\b|\bmen\b|\bbeard\b|\bmoustache\b|\bmustache\b/.test(t);
  return male && !female;
}

export function scratchNudeStillLock(text: string): string {
  return scratchWantsMaleNude(text) ? SCRATCH_NUDE_STILL_LOCK_MALE : SCRATCH_NUDE_STILL_LOCK;
}

export function scratchNudeI2vLock(text: string): string {
  return scratchWantsMaleNude(text) ? SCRATCH_NUDE_I2V_LOCK_MALE : SCRATCH_NUDE_I2V_LOCK;
}

/** Still Draw — spicy ref2i must drop the face-card outfit. */
export const SCRATCH_NUDE_STILL_LOCK =
  "Adults only — no one under 21. Change the clothes from the face cards. Ignore the outfit on the reference images. Same face, hair, age, sex and body. Nude as staged. Do not put the face-card clothes back on. Do not change a man into a woman.";

/** Male nude — Seedream spicy defaults to a woman unless we lock sex. */
export const SCRATCH_NUDE_STILL_LOCK_MALE =
  "Adults only — no one under 21. This person is an adult man. Draw an adult male body: bare male chest, male groin, no clothes. Same face, hair, age as the face card. Ignore the tee, shorts and undies on the reference. Do not redraw him as a woman. Do not add breasts. Do not put clothes back on.";

/** Motion from a nude plate — do not dress them again. */
export const SCRATCH_NUDE_I2V_LOCK =
  "Same bare body as the start image. Do not add clothes. Do not invent a new wardrobe.";

export const SCRATCH_NUDE_I2V_LOCK_MALE =
  "Same adult male body as the start image. Do not add clothes. Do not redraw as a woman.";

export function clampSirayI2vDurationSec(
  sec: number,
  minSec = SIRAY_I2V_MODELS[0].minSec,
  maxSec = SIRAY_I2V_MODELS[0].maxSec,
): number {
  const fallback = Math.min(maxSec, Math.max(minSec, 5));
  if (!Number.isFinite(sec) || sec <= 0) return fallback;
  return Math.max(minSec, Math.min(maxSec, Math.round(sec)));
}

/**
 * LTX Image motion is a speaking prompt. Seedance/Wan chew the plate if we
 * send "says" / lip-sync / mouth while speaking — melted mouth, new face,
 * extra people. Siray i2v is motion only.
 */
export function stripSpeechForSirayMotion(text: string): string {
  return (text || "")
    .replace(/perfect lip sync[^.]*\.\s*/gi, "")
    .replace(/\b[\w .'-]{1,40}\s+says:\s*"[^"]*"/gi, "")
    .replace(/\b[\w .'-]{1,40}\s+is speaking:\s*"[^"]*"/gi, "")
    .replace(/mouth and head move naturally while (?:speaking|she speaks),?\s*/gi, "")
    .replace(/mouth and head move while speaking,?\s*/gi, "")
    .replace(/citing the dialogue[^.]*\.?/gi, "")
    .replace(/clear lip movement,?\s*/gi, "")
    .replace(/facial expressions and hand gestures are lively,?\s*/gi, "")
    .replace(/dication is perfect\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSirayI2vPrompt(opts: {
  speaker: string;
  motion: string;
  staging: string;
  lookLock?: string;
  styleLock?: string;
}): string {
  const who = (opts.speaker || "").trim();
  const look = (opts.lookLock || "").trim();
  const style = (opts.styleLock || "").trim();
  const motion = stripSpeechForSirayMotion(opts.motion || "");
  const staging = stripSpeechForSirayMotion(opts.staging || "");
  const action =
    motion ||
    (staging
      ? staging
      : `${who || "The person"} holds their pose, subtle idle motion, weight shift, breathing.`);
  const whoLook = [who, look].filter(Boolean).join(", ");
  const nudeText = `${opts.staging} ${opts.motion} ${opts.lookLock || ""}`;
  const nude = scratchWantsNude(nudeText);
  return [
    "Use the provided start image as the first frame.",
    whoLook
      ? nude
        ? `${whoLook} is prominent, same face, hair, age and bare body as the start image.`
        : `${whoLook} is prominent, same face, hair, age, wardrobe and body as the start image.`
      : nude
        ? "Keep that face, body and place. Same bare body as the start image."
        : "Keep that face, body, wardrobe and place.",
    nude ? scratchNudeI2vLock(nudeText) : "",
    action,
    "No dialogue. Mouth stays closed. Do not invent a new take or a new face.",
    "Props and background stay exactly as the start image, nothing new enters frame.",
    "Camera holds, no cuts. Same person and objects as the start image. No new people.",
    "No text, no captions, no watermarks.",
    style,
  ]
    .filter(Boolean)
    .join("\n\n");
}
