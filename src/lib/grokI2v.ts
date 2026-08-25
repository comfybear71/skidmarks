/**
 * Scratch Generate — Grok Imagine image-to-video.
 * Client-safe (no env / fs). Same XAI_API_KEY as stills.
 * Short 2 / 3 / 5s clips for music-video cuts. Siray stays the
 * uncensored-still shop — this is the cheap mover.
 */

export const GROK_I2V_ID = "grok" as const;
export type GrokI2vId = typeof GROK_I2V_ID;

export const GROK_I2V_MODEL = "grok-imagine-video-1.5";
export const GROK_I2V_LABEL = "Grok Imagine video";
export const GROK_I2V_SHORT_LABEL = "Grok";
export const GROK_I2V_HINT =
  "1–15s from the still (official max 15). Desk chips 2 / 3 / 5 / 8 / 15. Invented sound is stripped. Keep Siray for uncensored stills.";

/** Official Imagine video range. */
export const GROK_I2V_MIN_SEC = 1;
export const GROK_I2V_MAX_SEC = 15;
/** Default music-video cut. */
export const GROK_I2V_DEFAULT_SEC = 5;
/** Desk chips — short keeps plus the official 8s / 15s ceiling. Not 30s. */
export const GROK_I2V_SHORT_SECS = [2, 3, 5, 8, 15] as const;
export type GrokI2vShortSec = (typeof GROK_I2V_SHORT_SECS)[number];

export const GROK_I2V_RESOLUTION = "720p" as const;

export function isGrokI2vId(value: string | undefined): value is GrokI2vId {
  return (value || "").trim().toLowerCase() === GROK_I2V_ID;
}

/** Tokens the Scratch clip picker / POST body may send for Grok I2V. */
export function isGrokClipEngineToken(raw: string | undefined): boolean {
  const value = (raw || "").trim().toLowerCase();
  return (
    value === GROK_I2V_ID ||
    value === "grok-i2v" ||
    value === "xai-i2v" ||
    value === "grok-imagine-video"
  );
}

export function isGrokI2vShortSec(sec: number): sec is GrokI2vShortSec {
  return (GROK_I2V_SHORT_SECS as readonly number[]).includes(sec);
}

export function snapGrokI2vDurationSec(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return GROK_I2V_DEFAULT_SEC;
  return Math.max(GROK_I2V_MIN_SEC, Math.min(GROK_I2V_MAX_SEC, Math.round(sec)));
}
