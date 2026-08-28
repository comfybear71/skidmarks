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

function matchesCut(
  cut: ScratchSongCut,
  wantCut: string,
  wantBeat: string,
  wantFile: string,
): boolean {
  const id = (cut.id || "").trim();
  if (wantCut && id === wantCut) return true;
  if (wantBeat && id === wantBeat) return true;
  if (wantFile && cutFile(cut) === wantFile) return true;
  const shotId = (cut.shotId || "").trim();
  if (wantBeat.startsWith("cut:") && shotId && wantBeat === `cut:${shotId}`) return true;
  return false;
}

function matchesClip(
  clip: MobileClipUnit,
  wantBeat: string,
  wantFile: string,
  matchedFiles: Set<string>,
): boolean {
  if (wantBeat && clip.beatId === wantBeat) return true;
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

  const matchedCuts = cuts.filter((c) => matchesCut(c, wantCut, wantBeat, wantFile));
  const matchedFiles = new Set<string>();
  if (wantFile) matchedFiles.add(wantFile);
  for (const cut of matchedCuts) {
    const file = cutFile(cut);
    if (file) matchedFiles.add(file);
  }

  if (!matchedCuts.length) {
    const episode = planRemoveEpisodeClipTake(
      opts.clips,
      wantBeat,
      wantFile || (opts.fileName || ""),
      isEpisode,
    );
    if (isEpisodeClipPlanError(episode)) return episode;
    return { ...episode, nextSong: song, stoppedCook: false };
  }

  const filesToPark = [...matchedFiles];
  let stoppedCook = false;
  const nextCuts = cuts.map((cut) => {
    if (matchesCut(cut, wantCut, wantBeat, wantFile)) {
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
    if (!matchesClip(clip, wantBeat, wantFile, matchedFiles)) {
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

  return {
    next: nextClips,
    nextSong: song ? { ...song, cuts: nextCuts } : song,
    filesToPark,
    clearedEpisodeErrors: !nextClips.some((c) => isEpisode(c) && c.clipStatus === "error"),
    stoppedCook,
  };
}
