/**
 * Scratch Generate — MiniMax H3 first / last frame video.
 * Client-safe (no env / fs). Mid-length cuts only (desk 5 / 8 / 15).
 * Floor is 4s — this is not the 2s/3s Grok shop. Invented stereo is stripped.
 * Do not hand the Saved mp3 to H3 on a lyric film.
 */

export const MINIMAX_H3_ID = "h3" as const;
export type MinimaxH3Id = typeof MINIMAX_H3_ID;

export const MINIMAX_H3_MODEL = "MiniMax-H3";
export const MINIMAX_H3_LABEL = "MiniMax H3";
export const MINIMAX_H3_SHORT_LABEL = "H3";
export const MINIMAX_H3_HINT =
  "5–15s from the still. Optional last still. Invented sound is stripped. Not the 2s chorus shop.";

/** Official H3 range — integer seconds only. */
export const MINIMAX_H3_MIN_SEC = 4;
export const MINIMAX_H3_MAX_SEC = 15;
export const MINIMAX_H3_DEFAULT_SEC = 5;
/** Desk chips — mid-length. Grok keeps 2 / 3 / 5. */
export const MINIMAX_H3_SHORT_SECS = [5, 8, 15] as const;
export type MinimaxH3ShortSec = (typeof MINIMAX_H3_SHORT_SECS)[number];

/** Cheaper H3 tier. 2K is $0.13/s. */
export const MINIMAX_H3_RESOLUTION = "768P" as const;

export function isMinimaxH3Id(value: string | undefined): value is MinimaxH3Id {
  return (value || "").trim().toLowerCase() === MINIMAX_H3_ID;
}

export function isMinimaxH3ClipEngineToken(raw: string | undefined): boolean {
  const value = (raw || "").trim().toLowerCase();
  return (
    value === MINIMAX_H3_ID ||
    value === "minimax" ||
    value === "minimax-h3" ||
    value === "hailuo-h3" ||
    value === "h3-i2v"
  );
}

export function isMinimaxH3ShortSec(sec: number): sec is MinimaxH3ShortSec {
  return (MINIMAX_H3_SHORT_SECS as readonly number[]).includes(sec);
}

export function snapMinimaxH3DurationSec(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return MINIMAX_H3_DEFAULT_SEC;
  return Math.max(MINIMAX_H3_MIN_SEC, Math.min(MINIMAX_H3_MAX_SEC, Math.round(sec)));
}

/** Hung bar → H3 seconds. 7 and 9 stay 7 and 9. Never swap a real hang for the 5s default. */
export function clampMinimaxH3HangSec(sec: number): { durationSec: number; note: string } {
  const durationSec = snapMinimaxH3DurationSec(sec);
  if (!Number.isFinite(sec) || sec <= 0) {
    return { durationSec, note: `H3 needs a hung length — cooking ${durationSec}` };
  }
  if (sec > MINIMAX_H3_MAX_SEC) {
    return { durationSec, note: `H3 max ${MINIMAX_H3_MAX_SEC} — cooking ${durationSec}` };
  }
  if (sec < MINIMAX_H3_MIN_SEC) {
    return { durationSec, note: `H3 min ${MINIMAX_H3_MIN_SEC} — cooking ${durationSec}` };
  }
  return { durationSec, note: "" };
}

/** Do not send 25 to MiniMax. Say so — do not snap and pretend it cooked 25. */
export const MINIMAX_H3_OVER_MAX_NOTE = "H3 max 15 — use LTX for 25";

export function refuseMinimaxH3OverMax(sec: number): string | null {
  if (Number.isFinite(sec) && sec > MINIMAX_H3_MAX_SEC) return MINIMAX_H3_OVER_MAX_NOTE;
  return null;
}
