import type { CrashStoryDoc, CrashStoryShot } from "./crashStoryTypes";
import type { MobileGenJob, MobileShotUnit } from "./mobileGenJob";
import {
  classifyCastPlace,
  classifyCastRoster,
  requiredCastPlacePlates,
  type MissingCastPlacePlate,
} from "./mobileCastPlaces";
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
 * Cast is the roster. Each picked face gets a solo card at their rooms
 * (two-house bible). Existing plates stay. Wrong-house first-scene dump
 * is not a plate.
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
  const tagA = classifyCastRoster(left);
  const tagB = classifyCastRoster(right);
  if (tagA && tagB) return tagA === tagB;
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

function speakerHasShotAtPlace(
  job: PlateGraphJob,
  story: CrashStoryDoc,
  speaker: string,
  sceneId: string,
): boolean {
  const scene =
    story.scenes.find((sc) => sc.id === sceneId) ||
    job.scenes.find((s) => s.id === sceneId);
  const wantKind = classifyCastPlace(scene?.placeName || "");
  for (const unit of episodeJobShots(job, story)) {
    const unitScene =
      story.scenes.find((sc) => sc.id === unit.sceneId) ||
      job.scenes.find((s) => s.id === unit.sceneId);
    const unitKind = classifyCastPlace(unitScene?.placeName || "");
    const samePlace =
      unit.sceneId === sceneId || (wantKind && unitKind === wantKind);
    if (!samePlace) continue;
    const sh = story.scenes
      .flatMap((sc) => sc.shots)
      .find((s) => s.id === unit.shotId);
    if (!sh) continue;
    const onShot = sh.beats.some((b) => {
      const who = b.speaker.trim();
      return Boolean(who && !leftoverHydrateBeat(unit.shotId, b.id) && speakerNamesMatch(who, speaker));
    });
    if (onShot) return true;
  }
  return false;
}

/** Approved faces still missing a card at one of their rooms. */
export function missingCastPlacePlates(
  job: PlateGraphJob,
  story?: CrashStoryDoc | null,
): MissingCastPlacePlate[] {
  if (!story) return [];
  const speakers = (job.speakers || []).filter((name) =>
    Boolean(approvedCandidateFileName(job.castCandidates || {}, name)),
  );
  const sceneById = new Map<string, { id: string; placeName: string }>();
  for (const s of [...job.scenes, ...story.scenes]) {
    if (!sceneById.has(s.id)) sceneById.set(s.id, { id: s.id, placeName: s.placeName });
  }
  return requiredCastPlacePlates(speakers, [...sceneById.values()]).filter(
    (need) => !speakerHasShotAtPlace(job, story, need.speaker, need.sceneId),
  );
}

/** Speakers who still need at least one house plate. */
export function speakersMissingEpisodeShot(
  job: PlateGraphJob,
  story?: CrashStoryDoc | null,
): string[] {
  const names: string[] = [];
  for (const row of missingCastPlacePlates(job, story)) {
    if (!names.some((n) => speakerNamesMatch(n, row.speaker))) names.push(row.speaker);
  }
  return names;
}

export function episodePlateCounts(
  job: PlateGraphJob,
  story?: CrashStoryDoc | null,
): { done: number; total: number } {
  const shots = episodeJobShots(job, story);
  const missing = missingCastPlacePlates(job, story);
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
  sceneId: string,
): { sceneId: string; placeName: string; story: CrashStoryDoc } {
  const want = sceneId.trim();
  const inStory = story.scenes.find((sc) => sc.id === want);
  if (inStory) {
    return { sceneId: inStory.id, placeName: inStory.placeName || "this place", story };
  }
  const jobScene = job.scenes.find((s) => s.id === want);
  if (!jobScene) throw new Error("That place is not on this episode");
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

/** Append a solo talking card at one house room. Does not draw. */
export function appendSoloCastShot(opts: {
  job: Pick<MobileGenJob, "scenes" | "shots">;
  story: CrashStoryDoc;
  speaker: string;
  sceneId: string;
}): {
  story: CrashStoryDoc;
  shots: MobileShotUnit[];
  shotId: string;
  sceneId: string;
  placeName: string;
} {
  const speaker = opts.speaker.trim();
  if (!speaker) throw new Error("Need a character");
  const picked = pickCastPlateScene(opts.job, opts.story, opts.sceneId);
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
