/**
 * /m Music video song desk — plate runs of 15s, reuse a plate later.
 * Clock math lives in scratchSongWindow (phone-safe).
 */
import type { CrashStoryDoc } from "./crashStoryTypes";
import {
  remainingSongWindows,
  SCRATCH_SONG_SLICE_DEFAULT_SEC,
  type ScratchSongCut,
} from "./scratchSongWindow";

export type SongCutTally = {
  total: number;
  parked: number;
  cooking: number;
  done: number;
  error: number;
};

export function tallySongCuts(cuts: Pick<ScratchSongCut, "status">[] = []): SongCutTally {
  const tally: SongCutTally = { total: cuts.length, parked: 0, cooking: 0, done: 0, error: 0 };
  for (const cut of cuts) {
    if (cut.status === "done") tally.done += 1;
    else if (cut.status === "running") tally.cooking += 1;
    else if (cut.status === "error") tally.error += 1;
    else tally.parked += 1;
  }
  return tally;
}

export function cutsForPlate(
  cuts: ScratchSongCut[] | undefined,
  shotId: string,
  plateFile?: string,
): ScratchSongCut[] {
  const id = (shotId || "").trim();
  const file = (plateFile || "").trim();
  return (cuts || []).filter((c) => {
    if (id && c.shotId === id) return true;
    if (!c.shotId && file && c.plateFile === file) return true;
    return false;
  });
}

/** Pending / fail / stuck cook — not a finished clip. Plate stays. */
export function droppablePlateCuts(
  cuts: Pick<ScratchSongCut, "id" | "status" | "clipFile">[],
): typeof cuts {
  return cuts.filter((c) => {
    if (c.status === "done") return false;
    if (c.status === "running" && (c.clipFile || "").trim()) return false;
    return true;
  });
}

export function withoutPlateParkedCuts(
  cuts: ScratchSongCut[],
  shotId: string,
  plateFile?: string,
): { next: ScratchSongCut[]; dropped: number } {
  const dropIds = new Set(
    droppablePlateCuts(cutsForPlate(cuts, shotId, plateFile)).map((c) => c.id),
  );
  return {
    next: cuts.filter((c) => !dropIds.has(c.id)),
    dropped: dropIds.size,
  };
}

export function skipSongPlateIds(song?: { skipShotIds?: string[] } | null): string[] {
  return [...new Set((song?.skipShotIds || []).map((id) => id.trim()).filter(Boolean))];
}

export function withSkippedSongPlate(skip: string[], shotId: string): string[] {
  const id = shotId.trim();
  if (!id || skip.includes(id)) return skip;
  return [...skip, id];
}

export function withoutSkippedSongPlate(skip: string[], shotId: string): string[] {
  const id = shotId.trim();
  return skip.filter((s) => s !== id);
}

export function songCutTallyLine(tally: SongCutTally): string {
  if (!tally.total) return "no slices yet";
  const bits = [`${tally.done}/${tally.total} done`];
  if (tally.cooking) bits.push(`${tally.cooking} cooking`);
  if (tally.parked) bits.push(`${tally.parked} parked`);
  if (tally.error) bits.push(`${tally.error} fail`);
  return bits.join(" · ");
}

export const MUSIC_VIDEO_SLICE_DEFAULT = 1;
export const MUSIC_VIDEO_SLICE_MAX = 16;

export function isMusicVideoSongJob(job: { styleId?: string }): boolean {
  return job.styleId === "music_video";
}

export function musicVideoCreditLine(job: { artist?: string; songTitle?: string }): string {
  const artist = (job.artist || "").trim();
  const song = (job.songTitle || "").trim();
  if (artist && song) return `${artist} — ${song}`;
  return artist || song;
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
