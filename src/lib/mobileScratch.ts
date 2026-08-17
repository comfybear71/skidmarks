import type { CrashStoryDoc, CrashStoryShot } from "./crashStoryTypes";
import type { MobileClipUnit, MobileGenJob, MobileShotUnit } from "./mobileGenJob";
import { isCampaignShotId } from "./mobilePlateLtxCampaign";

/** One experiment still — many positions, same card. Hidden on /m. */
export const SCRATCH_SHOT_TITLE = "Scratch";

export type ScratchPlateRef = {
  shotId: string;
  sceneId: string;
  speaker: string;
  poseId?: string;
};

export function isScratchShotTitle(title?: string): boolean {
  return (title || "").trim().toLowerCase() === SCRATCH_SHOT_TITLE.toLowerCase();
}

export function findScratchShot(story: CrashStoryDoc | null | undefined): {
  sceneId: string;
  shot: CrashStoryShot;
} | null {
  if (!story) return null;
  for (const sc of story.scenes) {
    const shot = sc.shots.find((sh) => isScratchShotTitle(sh.title));
    if (shot) return { sceneId: sc.id, shot };
  }
  return null;
}

export function scratchShotId(job: Pick<MobileGenJob, "scratchPlate">): string {
  return (job.scratchPlate?.shotId || "").trim();
}

export function isScratchShotId(
  job: Pick<MobileGenJob, "scratchPlate">,
  shotId: string,
  story?: CrashStoryDoc | null,
): boolean {
  const id = (shotId || "").trim();
  if (!id) return false;
  if (scratchShotId(job) && scratchShotId(job) === id) return true;
  if (!story) return false;
  for (const sc of story.scenes) {
    const sh = sc.shots.find((s) => s.id === id);
    if (sh) return isScratchShotTitle(sh.title);
  }
  return false;
}

/** Scratch + the 20-position campaign — not the episode desk on /m. */
export function isOffEpisodeDeskShot(
  job: Pick<MobileGenJob, "scratchPlate" | "plateLtxCampaign">,
  shotId: string,
  story?: CrashStoryDoc | null,
): boolean {
  return isScratchShotId(job, shotId, story) || isCampaignShotId(job.plateLtxCampaign, shotId, story);
}

/** Episode strip — scratch and campaign tests live on /scratch, not here. */
export function episodeJobShots(
  job: Pick<MobileGenJob, "shots" | "scratchPlate" | "plateLtxCampaign">,
  story?: CrashStoryDoc | null,
): MobileShotUnit[] {
  return job.shots.filter((s) => !isOffEpisodeDeskShot(job, s.shotId, story));
}

export function episodeQueuedClips(
  job: Pick<MobileGenJob, "clips" | "scratchPlate" | "plateLtxCampaign">,
  story?: CrashStoryDoc | null,
): MobileClipUnit[] {
  return (job.clips || []).filter((c) => !isOffEpisodeDeskShot(job, c.shotId, story));
}
