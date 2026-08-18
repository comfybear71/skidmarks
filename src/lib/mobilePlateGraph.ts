import type { CrashStoryDoc, CrashStoryShot } from "./crashStoryTypes";
import type { MobileGenJob, MobileShotUnit } from "./mobileGenJob";
import { leftoverHydrateBeat } from "./mobilePlateLines";
import { approvedCandidateFileName } from "./mobileJobReady";
import { episodeJobShots } from "./mobileScratch";
import { newId } from "./types";
import { voiceNamesMatch } from "./voiceNameMatch";

/**
 * Episode plate graph — one HTTP step walks one shot, then loops.
 *
 *   pick → compile → draw → qa ─┬─ retry → draw   (QA fail, < 3)
 *                               ├─ next → pick    (pass or max 3)
 *                               └─ halt_lines     (strip done — human speech)
 *
 * Cast is the roster. A speaker with a picked face and no episode shot
 * gets a solo card, then the same draw → qa loop. Existing plates stay.
 *
 * Does not Save voices. Does not Generate.
 */
export type PlateGraphNode =
  | "pick"
  | "compile"
  | "draw"
  | "qa"
  | "retry"
  | "next"
  | "halt_lines";

export type PlateGraphJob = Pick<
  MobileGenJob,
  "shots" | "scratchPlate" | "plateLtxCampaign" | "speakers" | "castCandidates" | "scenes"
>;

export function shotHasPlate(shot: Pick<MobileShotUnit, "plateFile">): boolean {
  return Boolean(shot.plateFile && shot.plateFile !== "__error__");
}

export function nextUnplatedEpisodeShot(
  job: Pick<MobileGenJob, "shots" | "scratchPlate" | "plateLtxCampaign">,
  story?: CrashStoryDoc | null,
): MobileShotUnit | null {
  return episodeJobShots(job, story).find((s) => !shotHasPlate(s)) || null;
}

function speakerNamesMatch(a: string, b: string): boolean {
  const left = a.trim();
  const right = b.trim();
  if (!left || !right) return false;
  return (
    left.toLowerCase() === right.toLowerCase() || voiceNamesMatch(left, right)
  );
}

export function episodeShotSpeakerNames(
  job: Pick<MobileGenJob, "shots" | "scratchPlate" | "plateLtxCampaign">,
  story?: CrashStoryDoc | null,
): string[] {
  if (!story) return [];
  const names: string[] = [];
  for (const unit of episodeJobShots(job, story)) {
    for (const sc of story.scenes) {
      const sh = sc.shots.find((s) => s.id === unit.shotId);
      if (!sh) continue;
      for (const b of sh.beats) {
        const speaker = b.speaker.trim();
        if (!speaker || leftoverHydrateBeat(unit.shotId, b.id)) continue;
        if (!names.some((n) => speakerNamesMatch(n, speaker))) names.push(speaker);
      }
    }
  }
  return names;
}

/** Approved Cast faces that are not on any episode shot yet. */
export function speakersMissingEpisodeShot(
  job: PlateGraphJob,
  story?: CrashStoryDoc | null,
): string[] {
  const speakers = (job.speakers || []).map((s) => s.trim()).filter(Boolean);
  if (!speakers.length || !story) return [];
  const covered = episodeShotSpeakerNames(job, story);
  return speakers.filter((name) => {
    if (covered.some((c) => speakerNamesMatch(c, name))) return false;
    return Boolean(approvedCandidateFileName(job.castCandidates || {}, name));
  });
}

export function episodePlateCounts(
  job: PlateGraphJob,
  story?: CrashStoryDoc | null,
): { done: number; total: number } {
  const shots = episodeJobShots(job, story);
  const missing = speakersMissingEpisodeShot(job, story);
  return {
    done: shots.filter(shotHasPlate).length,
    total: shots.length + missing.length,
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

function pickCastPlateScene(
  job: Pick<MobileGenJob, "scenes">,
  story: CrashStoryDoc,
): { sceneId: string; placeName: string; story: CrashStoryDoc } {
  const inStory =
    job.scenes.find((s) => story.scenes.some((sc) => sc.id === s.id)) ||
    null;
  if (inStory) {
    const scene = story.scenes.find((sc) => sc.id === inStory.id)!;
    return { sceneId: scene.id, placeName: scene.placeName || inStory.placeName, story };
  }
  if (story.scenes[0]) {
    return {
      sceneId: story.scenes[0].id,
      placeName: story.scenes[0].placeName || "this place",
      story,
    };
  }
  const jobScene = job.scenes[0];
  if (!jobScene) throw new Error("Need a place before the rest of the cast can plate");
  const scene = {
    id: jobScene.id,
    title: jobScene.placeName,
    placeName: jobScene.placeName,
    worldThumbKey: jobScene.worldThumbKey || "",
    shots: [] as CrashStoryShot[],
  };
  return {
    sceneId: scene.id,
    placeName: scene.placeName,
    story: { ...story, scenes: [...story.scenes, scene] },
  };
}

/** Append a solo talking card for one Cast face. Does not draw. */
export function appendSoloCastShot(opts: {
  job: Pick<MobileGenJob, "scenes" | "shots">;
  story: CrashStoryDoc;
  speaker: string;
}): {
  story: CrashStoryDoc;
  shots: MobileShotUnit[];
  shotId: string;
  sceneId: string;
  placeName: string;
} {
  const speaker = opts.speaker.trim();
  if (!speaker) throw new Error("Need a character");
  const picked = pickCastPlateScene(opts.job, opts.story);
  const newShot: CrashStoryShot = {
    id: newId("shot"),
    title: speaker,
    summary: `${speaker}, solo. Only ${speaker} in frame, no one else appears.`,
    staging: "",
    plateFile: "",
    beats: [{ id: newId("beat"), speaker, text: "" }],
    sfx: [],
  };
  const story: CrashStoryDoc = {
    ...picked.story,
    scenes: picked.story.scenes.map((sc) =>
      sc.id === picked.sceneId ? { ...sc, shots: [...sc.shots, newShot] } : sc,
    ),
  };
  const shots = [
    ...opts.job.shots,
    { shotId: newShot.id, sceneId: picked.sceneId, plateFile: "" },
  ];
  return {
    story,
    shots,
    shotId: newShot.id,
    sceneId: picked.sceneId,
    placeName: picked.placeName,
  };
}
