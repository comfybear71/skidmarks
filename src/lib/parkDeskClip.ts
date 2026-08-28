import type { MobileClipUnit } from "./mobileGenJob";
import {
  clipFileBasename,
  dropClipTakeFromRow,
  stackedClipFiles,
} from "./mobilePlateClips";
import {
  isEpisodeClipPlanError,
  planRemoveEpisodeClipTake,
  type EpisodeClipPlan,
  type EpisodeClipPlanError,
} from "./mobileEpisodeClips";
import type { ScratchSong, ScratchSongCut } from "./scratchSongWindow";

export type DeskClipParkPlan = EpisodeClipPlan & {
  nextSong: ScratchSong | null | undefined;
  /** True when a running cook was flipped to pending so the desk is not locked. */
  stoppedCook: boolean;
};

function pendingCut(cut: ScratchSongCut): ScratchSongCut {
  return { ...cut, status: "pending", clipFile: "", error: "" };
}

function unstickRunningCut(cut: ScratchSongCut): ScratchSongCut {
  if (cut.status === "running" && !(cut.clipFile || "").trim()) {
    return { ...cut, status: "pending", error: "" };
  }
  return cut;
}

function cutFile(cut: ScratchSongCut): string {
  return clipFileBasename(cut.clipFile || "");
}

function matchesCutTarget(
  cut: ScratchSongCut,
  wantCut: string,
  wantBeat: string,
): boolean {
  const id = (cut.id || "").trim();
  if (wantCut && id === wantCut) return true;
  if (wantBeat && id === wantBeat) return true;
  const shotId = (cut.shotId || "").trim();
  if (wantBeat.startsWith("cut:") && shotId && wantBeat === `cut:${shotId}`) return true;
  return false;
}

function matchesCut(
  cut: ScratchSongCut,
  wantCut: string,
  wantBeat: string,
  wantFile: string,
): boolean {
  if (matchesCutTarget(cut, wantCut, wantBeat)) return true;
  if (!wantCut && !wantBeat && wantFile && cutFile(cut) === wantFile) return true;
  return false;
}

function matchesClip(
  clip: MobileClipUnit,
  wantBeat: string,
  wantFile: string,
  matchedFiles: Set<string>,
): boolean {
  if (wantBeat && clip.beatId === wantBeat) return true;
  if (wantBeat) return false;
  const stacked = stackedClipFiles(clip);
  if (wantFile && stacked.includes(wantFile)) return true;
  for (const file of stacked) {
    if (matchedFiles.has(file)) return true;
  }
  return false;
}

/**
 * Park one music-video clip the way Redo does: mp4 to `_cleared/`, still
 * stays, song cut goes pending, TRACK clock stays.
 *
 * The Clips-rail ✕ used to call remove-clip on `job.clips` only. TRACK hang
 * writes the same file onto `scratchSong.cuts`. After a one-sided park the
 * rail drew the cut again — ✕ looked dead. This writes both sides.
 *
 * A fail on another cut, or a batch still going, does not block. Running
 * cooks with no file go pending so the desk is not locked.
 *
 * X on a leftover copy of the same mp4 parks that row only. The hung
 * plate keeps the file. X on the last use parks the file.
 */
export function planParkDeskClipTake(opts: {
  clips: MobileClipUnit[];
  song?: ScratchSong | null;
  beatId?: string;
  cutId?: string;
  fileName?: string;
  isEpisode?: (clip: MobileClipUnit) => boolean;
}): DeskClipParkPlan | EpisodeClipPlanError {
  const wantBeat = (opts.beatId || "").trim();
  const wantCut = (opts.cutId || "").trim();
  const wantFile = clipFileBasename(opts.fileName || "");
  const song = opts.song;
  const cuts = song?.cuts || [];
  const isEpisode = opts.isEpisode || (() => true);

  const targetCuts = cuts.filter((c) => matchesCutTarget(c, wantCut, wantBeat));
  const targetClips = opts.clips.filter((c) => wantBeat && c.beatId === wantBeat);
  const matchedFiles = new Set<string>();
  if (wantFile) matchedFiles.add(wantFile);
  for (const cut of targetCuts) {
    const file = cutFile(cut);
    if (file) matchedFiles.add(file);
  }
  for (const clip of targetClips) {
    for (const file of stackedClipFiles(clip)) matchedFiles.add(file);
  }

  const targetShots = new Set<string>();
  for (const cut of targetCuts) {
    const shot = (cut.shotId || "").trim();
    if (shot) targetShots.add(shot);
  }
  for (const clip of targetClips) {
    const shot = (clip.shotId || "").trim();
    if (shot) targetShots.add(shot);
  }

  const hungOtherPlate = cuts.some((c) => {
    const shot = (c.shotId || "").trim();
    const file = cutFile(c);
    return (
      c.status === "done" &&
      Boolean(file) &&
      matchedFiles.has(file) &&
      Boolean(shot) &&
      !targetShots.has(shot)
    );
  });

  const matchedCuts = hungOtherPlate
    ? targetCuts
    : cuts.filter((c) => matchesCut(c, wantCut, wantBeat, wantFile) || matchedFiles.has(cutFile(c)));

  if (!matchedCuts.length && !targetClips.length) {
    const episode = planRemoveEpisodeClipTake(
      opts.clips,
      wantBeat,
      wantFile || (opts.fileName || ""),
      isEpisode,
    );
    if (isEpisodeClipPlanError(episode)) return episode;
    const stillNeeded = (song?.cuts || []).some(
      (c) => c.status === "done" && wantFile && cutFile(c) === wantFile,
    );
    return {
      ...episode,
      filesToPark: stillNeeded ? [] : episode.filesToPark,
      nextSong: song,
      stoppedCook: false,
    };
  }

  let stoppedCook = false;
  const nextCuts = cuts.map((cut) => {
    const hit = hungOtherPlate
      ? matchesCutTarget(cut, wantCut, wantBeat)
      : matchedCuts.includes(cut) || matchesCut(cut, wantCut, wantBeat, wantFile);
    if (hit) {
      if (cut.status === "running") stoppedCook = true;
      return pendingCut(cut);
    }
    if (cut.status === "running" && !(cut.clipFile || "").trim()) {
      stoppedCook = true;
      return unstickRunningCut(cut);
    }
    return cut;
  });

  const nextClips = opts.clips.map((clip) => {
    const targeted = matchesClip(clip, wantBeat, wantFile, matchedFiles);
    const sameFileGhost =
      !hungOtherPlate && stackedClipFiles(clip).some((f) => matchedFiles.has(f));
    if (!targeted && !sameFileGhost) {
      if (clip.clipStatus === "running" && !clipFileBasename(clip.clipFile || "")) {
        stoppedCook = true;
        return { ...clip, clipStatus: "pending" as const, error: "" };
      }
      return clip;
    }
    if (clip.clipStatus === "running") stoppedCook = true;
    const drop = wantFile || stackedClipFiles(clip).at(-1) || "";
    if (!drop) {
      return { ...clip, clipStatus: "pending" as const, error: "" };
    }
    return dropClipTakeFromRow({ ...clip, clipStatus: "done", error: "" }, drop);
  });

  const fileStillNeeded = nextCuts.some(
    (c) => c.status === "done" && matchedFiles.has(cutFile(c)),
  );

  return {
    next: nextClips,
    nextSong: song ? { ...song, cuts: nextCuts } : song,
    filesToPark: fileStillNeeded || hungOtherPlate ? [] : [...matchedFiles],
    clearedEpisodeErrors: !nextClips.some((c) => isEpisode(c) && c.clipStatus === "error"),
    stoppedCook,
  };
}
