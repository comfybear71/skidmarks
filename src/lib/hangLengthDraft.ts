import {
  clampHangLengthSec,
  SCRATCH_SONG_SLICE_DEFAULT_SEC,
} from "./scratchSongWindow";

/**
 * Seconds on the plate slider. Add reads this so TRACK hangs 20 when
 * the box says 20 — not the leftover 15s default.
 */
const drafts = new Map<string, number>();

function draftKey(jobId: string, shotId: string): string {
  return `${(jobId || "").trim()}:${(shotId || "").trim()}`;
}

export function writeHangLengthDraft(jobId: string, shotId: string, sec: number): number {
  const n = clampHangLengthSec(sec);
  const key = draftKey(jobId, shotId);
  if (key !== ":") drafts.set(key, n);
  return n;
}

export function readHangLengthDraft(jobId: string, shotId: string, fallback?: number): number {
  const hit = drafts.get(draftKey(jobId, shotId));
  if (hit != null) return hit;
  return clampHangLengthSec(fallback ?? SCRATCH_SONG_SLICE_DEFAULT_SEC);
}

/** Still-only Add clock. Slider 20 → 20. Missing / junk → 15. Never H3's 15 cap. */
export function addPlateHangDurationSec(durationSec?: number): number {
  return clampHangLengthSec(
    Number.isFinite(Number(durationSec)) && Number(durationSec) > 0
      ? Number(durationSec)
      : SCRATCH_SONG_SLICE_DEFAULT_SEC,
  );
}
