/** Per-beat LTX clip length. Follows the mp3, not the old 2–7s Comfy short. */
export const LTX_MIN_DURATION_SEC = 2;
export const LTX_MAX_DURATION_SEC = 30;
export const LTX_FPS = 24;

export function clampLtxDurationSec(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return LTX_MIN_DURATION_SEC;
  return Math.max(LTX_MIN_DURATION_SEC, Math.min(LTX_MAX_DURATION_SEC, sec));
}

export function ltxDurationFrames(sec: number): number {
  const clamped = clampLtxDurationSec(sec);
  return Math.max(LTX_FPS, Math.round(clamped * LTX_FPS));
}
