import type { MobileClipUnit } from "./mobileGenJob";
import {
  clearClipRowTakes,
  clipFileBasename,
  clipsUnderPlate,
  dropClipTakeFromRow,
  stackedClipFiles,
} from "./mobilePlateClips";

export type EpisodeClipPlanError = { error: string; status: number };

export type EpisodeClipPlan = {
  next: MobileClipUnit[];
  filesToPark: string[];
  /** True when no episode-desk clip is still in error after this plan. */
  clearedEpisodeErrors: boolean;
};

export function isEpisodeClipPlanError(
  v: EpisodeClipPlan | EpisodeClipPlanError,
): v is EpisodeClipPlanError {
  return "status" in v;
}

function episodeErrorsRemain(
  clips: MobileClipUnit[],
  isEpisode: (clip: MobileClipUnit) => boolean,
): boolean {
  return clips.some((c) => isEpisode(c) && c.clipStatus === "error");
}

function planFrom(
  next: MobileClipUnit[],
  filesToPark: string[],
  isEpisode: (clip: MobileClipUnit) => boolean,
): EpisodeClipPlan {
  return {
    next,
    filesToPark,
    clearedEpisodeErrors: !episodeErrorsRemain(next, isEpisode),
  };
}

/** Failed Generate with no mp4 — empty the row so the pink line can go. Keep prior takes. */
export function dismissFailedClipRow(clip: MobileClipUnit): MobileClipUnit {
  if (clip.clipStatus !== "error") return clip;
  const stacked = stackedClipFiles(clip);
  if (!stacked.length) return clearClipRowTakes(clip);
  return { ...clip, clipStatus: "done", error: "" };
}

const alwaysEpisode = () => true;

/** Park one playable take under a beat. Scratch pad uses its own route. */
export function planRemoveEpisodeClipTake(
  clips: MobileClipUnit[],
  beatId: string,
  fileName: string,
  isEpisode: (clip: MobileClipUnit) => boolean = alwaysEpisode,
): EpisodeClipPlan | EpisodeClipPlanError {
  const wantBeat = beatId.trim();
  const wantFile = clipFileBasename(fileName);
  if (!wantBeat || !wantFile) {
    return { error: "Need beatId and fileName", status: 400 };
  }
  const clip = clips.find((c) => c.beatId === wantBeat);
  if (!clip) return { error: "Clip not found", status: 404 };
  if (clip.clipStatus === "running") {
    return { error: "That clip is still rendering", status: 409 };
  }
  if (!stackedClipFiles(clip).includes(wantFile)) {
    return { error: "Clip take not found on this beat", status: 404 };
  }
  const next = clips.map((c) =>
    c.beatId === wantBeat ? dropClipTakeFromRow(c, wantFile) : c,
  );
  return planFrom(next, [wantFile], isEpisode);
}

/**
 * Bin a failed Generate that never wrote an mp4 (no player, only the pink
 * error). Prior takes stay. Running clips stay.
 */
export function planDismissEpisodeClip(
  clips: MobileClipUnit[],
  beatId: string,
  isEpisode: (clip: MobileClipUnit) => boolean = alwaysEpisode,
): EpisodeClipPlan | EpisodeClipPlanError {
  const wantBeat = beatId.trim();
  if (!wantBeat) return { error: "Need beatId", status: 400 };
  const clip = clips.find((c) => c.beatId === wantBeat);
  if (!clip) return { error: "Clip not found", status: 404 };
  if (clip.clipStatus === "running") {
    return { error: "That clip is still rendering", status: 409 };
  }
  if (clip.clipStatus !== "error") {
    if (!stackedClipFiles(clip).length && !clip.error) {
      return planFrom(clips, [], isEpisode);
    }
    return {
      error: "That clip is not a failed take — tap ✕ on the player to park it",
      status: 400,
    };
  }
  const next = clips.map((c) => (c.beatId === wantBeat ? dismissFailedClipRow(c) : c));
  return planFrom(next, [], isEpisode);
}

/**
 * Plate × — park every take under that still. Files go to _cleared/,
 * rows leave the job so Generate does not keep sending them.
 */
export function planParkClipsUnderPlate(
  clips: MobileClipUnit[],
  shotId: string,
  beatIds: string[],
  isEpisode: (clip: MobileClipUnit) => boolean = alwaysEpisode,
): EpisodeClipPlan | EpisodeClipPlanError {
  const wantShot = shotId.trim();
  if (!wantShot) return { error: "Need shotId", status: 400 };
  const under = clipsUnderPlate(wantShot, beatIds, clips);
  if (under.some((c) => c.clipStatus === "running")) {
    return { error: "A clip on this plate is still rendering", status: 409 };
  }
  const ids = new Set(under.map((c) => c.beatId));
  const filesToPark = under.flatMap((c) => stackedClipFiles(c));
  const next = clips.filter((c) => !ids.has(c.beatId));
  return planFrom(next, filesToPark, isEpisode);
}

/** Bin every failed episode-desk clip. Scratch / campaign errors stay. */
export function planBinFailedEpisodeClips(
  clips: MobileClipUnit[],
  isEpisode: (clip: MobileClipUnit) => boolean = alwaysEpisode,
): EpisodeClipPlan {
  const next = clips.map((c) =>
    isEpisode(c) && c.clipStatus === "error" ? dismissFailedClipRow(c) : c,
  );
  return planFrom(next, [], isEpisode);
}
