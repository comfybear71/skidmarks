/**
 * /m Music video song desk — plate runs of 15s, reuse a plate later.
 * Clock math lives in scratchSongWindow (phone-safe).
 */
import type { CrashStoryDoc } from "./crashStoryTypes";
import {
  remainingSongWindows,
  SCRATCH_SONG_SLICE_DEFAULT_SEC,
} from "./scratchSongWindow";

export const MUSIC_VIDEO_SLICE_DEFAULT = 4;
export const MUSIC_VIDEO_SLICE_MAX = 16;

export function isMusicVideoSongJob(job: { styleId?: string }): boolean {
  return job.styleId === "music_video";
}

export function clampPlateSliceCount(n: number): number {
  if (!Number.isFinite(n)) return MUSIC_VIDEO_SLICE_DEFAULT;
  return Math.max(1, Math.min(MUSIC_VIDEO_SLICE_MAX, Math.floor(n)));
}

export function plateSliceWindows(
  cuts: { durationSec: number }[],
  songSec: number,
  count: number,
): { startSec: number; durationSec: number }[] {
  return remainingSongWindows(cuts, songSec, clampPlateSliceCount(count));
}

export function findSongCarrierBeatId(
  story: CrashStoryDoc | null | undefined,
  songFile?: string,
  preferShotId?: string,
): string {
  const file = (songFile || "").trim();
  const shots = (story?.scenes || []).flatMap((sc) => sc.shots);
  const prefer = preferShotId
    ? shots.find((sh) => sh.id === preferShotId)
    : undefined;
  const pool = prefer ? [prefer, ...shots.filter((sh) => sh.id !== prefer.id)] : shots;
  if (file) {
    for (const sh of pool) {
      const hit = sh.beats.find((b) => (b.voiceFile || "").trim() === file);
      if (hit) return hit.id;
    }
  }
  return pool[0]?.beats[0]?.id || "";
}

export function plateLabel(
  story: CrashStoryDoc | null | undefined,
  shotId: string,
  fallbackIndex: number,
): string {
  for (const scene of story?.scenes || []) {
    const i = scene.shots.findIndex((sh) => sh.id === shotId);
    if (i >= 0) {
      const title = (scene.shots[i]?.title || "").trim();
      return title || `Plate ${i + 1}`;
    }
  }
  return `Plate ${fallbackIndex}`;
}

export { SCRATCH_SONG_SLICE_DEFAULT_SEC };
