import type { CrashStoryBeat, CrashStoryDoc, CrashStoryShot } from "./crashStoryTypes";
import type { MobileClipUnit, MobileGenJob, MobileShotUnit } from "./mobileGenJob";
import { isCampaignShotId, campaignStagingForId } from "./mobilePlateLtxCampaign";
import { newId } from "./types";
import { defaultSoloStaging } from "./mobileImageMotion";
/** One experiment still — many positions, same card. Hidden on /m. */
export const SCRATCH_SHOT_TITLE = "Scratch";

export type ScratchPlateRef = {
  shotId: string;
  sceneId: string;
  /** Who speaks the saved line / lip-sync clip. */
  speaker: string;
  /** Everyone on the still — speaker first when present. */
  cast?: string[];
  poseId?: string;
};

/** In-flight Siray still — browser polls so Vercel does not drop a 3-minute POST. */
export type ScratchDrawTask = {
  taskId: string;
  shotId: string;
  sceneId: string;
  staging: string;
  poseId?: string;
  speaker: string;
  cast: string[];
  castNames: string[];
  placeName: string;
  startedAt: string;
  joPhone?: boolean;
  sendPrompt?: string;
};

/** Reuse the same Siray task if Draw dropped after submit (do not mint a new episode). */
export const SCRATCH_DRAW_RESUME_MS = 240_000;

export function scratchDrawStillInFlight(
  task: ScratchDrawTask | null | undefined,
  want: { shotId: string; staging: string; speaker: string; cast: string[] },
  nowMs = Date.now(),
): boolean {
  if (!task?.taskId) return false;
  const started = Date.parse(task.startedAt);
  if (!Number.isFinite(started) || nowMs - started > SCRATCH_DRAW_RESUME_MS) return false;
  if (task.shotId !== want.shotId) return false;
  if (task.staging !== want.staging) return false;
  if (task.speaker.trim().toLowerCase() !== want.speaker.trim().toLowerCase()) return false;
  const a = task.cast.map((n) => n.trim().toLowerCase()).join("\0");
  const b = want.cast.map((n) => n.trim().toLowerCase()).join("\0");
  return a === b;
}

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

/** Playable clips collected on the scratch pad — scratch + campaign tests.
 * Episode desk clips stay on /m under their plates. */
export function scratchPadClips(
  job: Pick<MobileGenJob, "clips" | "scratchPlate" | "plateLtxCampaign">,
  story?: CrashStoryDoc | null,
): MobileClipUnit[] {
  const seen = new Set<string>();
  const out: MobileClipUnit[] = [];
  for (const clip of job.clips || []) {
    if (!clip.clipFile || seen.has(clip.beatId)) continue;
    if (!isOffEpisodeDeskShot(job, clip.shotId, story)) continue;
    seen.add(clip.beatId);
    out.push(clip);
  }
  return out;
}

export function normalizeScratchCast(speaker: string, cast?: string[]): string[] {
  const primary = speaker.trim();
  const rest = (cast || []).map((n) => n.trim()).filter(Boolean);
  const ordered = primary
    ? [primary, ...rest.filter((n) => n.toLowerCase() !== primary.toLowerCase())]
    : rest;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of ordered) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** Solo = campaign / default. Crowd = everyone locked in frame for lip-sync + pile tests. */
export function scratchStagingForCast(opts: {
  cast: string[];
  speaker: string;
  placeName: string;
  poseId?: string;
  staging?: string;
}): string {
  const cast = normalizeScratchCast(opts.speaker, opts.cast);
  const custom = (opts.staging || "").trim();
  if (custom) return custom;
  const place = (opts.placeName || "this place").trim() || "this place";
  const speaker = (opts.speaker || cast[0] || "").trim();
  if (cast.length <= 1) {
    if (opts.poseId) return campaignStagingForId(opts.poseId, speaker, place);
    return defaultSoloStaging(speaker);
  }
  const names = cast.join(", ");
  const also = cast.filter((n) => n.toLowerCase() !== speaker.toLowerCase()).join(" and ");
  if (opts.poseId === "crowd-pile") {
    return [
      `${names} piled together at ${place}.`,
      `Only ${names} in frame, no one else appears.`,
      `${speaker} is prominent in the pile.`,
      `${also} are pressed in close with them — tangled bodies, using each other and the place.`,
      `Same faces as the face cards. Do not invent extras or a sixth body.`,
    ].join(" ");
  }
  if (opts.poseId === "crowd-two-shot") {
    return [
      `${names} in a tight two-shot at ${place}.`,
      `Only ${names} in frame, no one else appears.`,
      `${speaker} is nearest the camera, speaking.`,
      `${also} stay in frame beside them, reacting.`,
      `Same faces as the face cards. Do not invent extras.`,
    ].join(" ");
  }
  if (opts.poseId === "crowd-surround") {
    return [
      `${names} crowded around each other at ${place}.`,
      `Only ${names} in frame, no one else appears.`,
      `${speaker} is in the middle, prominent.`,
      `${also} flank and lean in — hands, shoulders, close.`,
      `Same faces as the face cards. Do not invent extras.`,
    ].join(" ");
  }
  return [
    `${names} together at ${place}.`,
    `Only ${names} in frame, no one else appears.`,
    `${speaker} is prominent.`,
    `${also} are in the same still with them — close, using the furniture and each other.`,
    `Bodies interact. Same faces as the face cards. Do not invent extras.`,
  ].join(" ");
}

/** One beat per face so compositeShotPlate and LTX see the whole gang. */
export function scratchBeatsForCast(
  cast: string[],
  existing: CrashStoryBeat[] = [],
): CrashStoryBeat[] {
  const names = [...new Set(cast.map((n) => n.trim()).filter(Boolean))];
  const bySpeaker = new Map(
    existing
      .filter((b) => b.speaker.trim())
      .map((b) => [b.speaker.trim().toLowerCase(), b] as const),
  );
  const beats: CrashStoryBeat[] = [];
  for (const name of names) {
    const prev = bySpeaker.get(name.toLowerCase());
    beats.push(prev ? { ...prev, speaker: name } : { id: newId("beat"), speaker: name, text: "" });
  }
  if (!beats.length) beats.push({ id: newId("beat"), speaker: "", text: "" });
  return beats;
}
