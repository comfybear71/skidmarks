/** Per-beat LTX clip length. Follows the mp3. Cloud IA2V has run past 120s —
 * the old 30s clamp was ours, not the model. Ceiling is a safety stop so a
 * runaway estimate cannot queue a 20-minute job. */
export const LTX_MIN_DURATION_SEC = 2;
export const LTX_MAX_DURATION_SEC = 180;
export const LTX_FPS = 24;

export function clampLtxDurationSec(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return LTX_MIN_DURATION_SEC;
  return Math.max(LTX_MIN_DURATION_SEC, Math.min(LTX_MAX_DURATION_SEC, sec));
}

export function ltxDurationFrames(sec: number): number {
  const clamped = clampLtxDurationSec(sec);
  return Math.max(LTX_FPS, Math.round(clamped * LTX_FPS));
}
