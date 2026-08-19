/** Per-beat LTX clip length. Follows the mp3. Cloud IA2V has run past 120s —
 * the old 30s clamp was ours, not the model. Ceiling is a safety stop so a
 * runaway estimate cannot queue a 20-minute job. */
export const LTX_MIN_DURATION_SEC = 2;
/** Quality floor for speaking clips — sub-4s mp3s do not lip-sync. Pad hold, do not rewrite the line. */
export const LTX_LIPSYNC_MIN_SEC = 4;
export const LTX_MAX_DURATION_SEC = 180;
export const LTX_FPS = 24;

export function clampLtxDurationSec(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return LTX_MIN_DURATION_SEC;
  return Math.max(LTX_MIN_DURATION_SEC, Math.min(LTX_MAX_DURATION_SEC, sec));
}

/** Cloud IA2V length: follow the mp3, but never send a speaking clip under 4s. */
export function ltxFollowsMp3DurationSec(mp3Sec: number): number {
  const fromMp3 =
    Number.isFinite(mp3Sec) && mp3Sec > 0
      ? Math.ceil(mp3Sec + 0.25)
      : LTX_LIPSYNC_MIN_SEC;
  return clampLtxDurationSec(Math.max(fromMp3, LTX_LIPSYNC_MIN_SEC));
}

export function ltxDurationFrames(sec: number): number {
  const clamped = clampLtxDurationSec(sec);
  return Math.max(LTX_FPS, Math.round(clamped * LTX_FPS));
}
