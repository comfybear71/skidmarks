import type { CrashStoryDoc } from "./crashStoryTypes";
import type { MobileGenJob, MobileShotUnit } from "./mobileGenJob";
import { leftoverHydrateBeat } from "./mobilePlateLines";
import { episodeJobShots } from "./mobileScratch";

/**
 * Episode plate graph — one HTTP step walks one shot, then loops.
 *
 *   pick → compile → draw → qa ─┬─ retry → draw   (QA fail, < 3)
 *                               ├─ next → pick    (pass or max 3)
 *                               └─ halt_lines     (strip done — human speech)
 *
 * Does not Save voices. Does not Generate. Existing plates are not redrawn.
 */
export type PlateGraphNode =
  | "pick"
  | "compile"
  | "draw"
  | "qa"
  | "retry"
  | "next"
  | "halt_lines";

export function shotHasPlate(shot: Pick<MobileShotUnit, "plateFile">): boolean {
  return Boolean(shot.plateFile && shot.plateFile !== "__error__");
}

export function nextUnplatedEpisodeShot(
  job: Pick<MobileGenJob, "shots" | "scratchPlate" | "plateLtxCampaign">,
  story?: CrashStoryDoc | null,
): MobileShotUnit | null {
  return episodeJobShots(job, story).find((s) => !shotHasPlate(s)) || null;
}

export function episodePlateCounts(
  job: Pick<MobileGenJob, "shots" | "scratchPlate" | "plateLtxCampaign">,
  story?: CrashStoryDoc | null,
): { done: number; total: number } {
  const shots = episodeJobShots(job, story);
  return {
    done: shots.filter(shotHasPlate).length,
    total: shots.length,
  };
}

export function storyShotSpeaker(
  story: CrashStoryDoc,
  shotId: string,
): { speaker: string; placeName: string } {
  for (const sc of story.scenes) {
    const sh = sc.shots.find((s) => s.id === shotId);
    if (!sh) continue;
    const speaker =
      sh.beats.find((b) => b.speaker.trim() && !leftoverHydrateBeat(shotId, b.id))?.speaker ||
      sh.beats[0]?.speaker ||
      "";
    return { speaker: speaker.trim(), placeName: sc.placeName || "this place" };
  }
  return { speaker: "", placeName: "this place" };
}
