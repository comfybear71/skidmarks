import path from "path";
import type { CrashStoryDoc, PlateTake } from "./crashStoryTypes";
import type { MobileGenJob } from "./mobileGenJob";
import { candidateLookPrompt } from "./mobileJobReady";
import { leftoverHydrateBeat, dropLeftoverHydrateBeats } from "./mobilePlateLines";
import {
  PLATE_QA_MAX_ATTEMPTS,
  appendPlateQaFix,
  compileScriptedPosition,
  judgePlateStill,
  resolvePlateQaIdentity,
  type PlateQaVerdict,
} from "./mobilePlateQa";
import { uploadMobileMedia } from "./mobileMediaStore";
import { patchMobileGenJob } from "./mobileGenJob";
import { writeMobileStory } from "./mobileStoryStore";
import { CRASH_DIR } from "./paths";
import { compositeShotPlatePreferSiray } from "./sirayScratchPlate";
import { newId } from "./types";

function patchShotFields(
  story: CrashStoryDoc,
  shotId: string,
  patch: { staging?: string; summary?: string; plateFile?: string; plateTakes?: PlateTake[] },
): CrashStoryDoc {
  return {
    ...story,
    scenes: story.scenes.map((sc) => ({
      ...sc,
      shots: sc.shots.map((sh) => (sh.id === shotId ? { ...sh, ...patch } : sh)),
    })),
  };
}

export async function rebuildShotPlate(opts: {
  job: MobileGenJob;
  story: CrashStoryDoc;
  shotId: string;
  stagingIn?: string;
  qa?: boolean;
}): Promise<{
  job: MobileGenJob;
  story: CrashStoryDoc;
  plateFile: string;
  plateTakes: PlateTake[];
  staging: string;
  qa: PlateQaVerdict | null;
  qaAttempts: number;
  speaker: string;
}> {
  const { job, shotId } = opts;
  let story = opts.story;
  let scene = story.scenes.find((sc) => sc.shots.some((sh) => sh.id === shotId));
  let shot = scene?.shots.find((sh) => sh.id === shotId);
  if (!scene || !shot) throw new Error("That shot is not in the story");

  const cleanedBeats = dropLeftoverHydrateBeats(shotId, shot.beats);
  const speaker =
    cleanedBeats.find((b) => b.speaker.trim() && !leftoverHydrateBeat(shotId, b.id))?.speaker ||
    cleanedBeats[0]?.speaker ||
    "";
  let staging = (opts.stagingIn || "").trim();
  if (!staging && speaker) {
    staging = compileScriptedPosition({
      name: speaker,
      place: scene.placeName || "this place",
    });
  }
  if (!staging) throw new Error("Say who sits where — not two people stuck in the front.");

  const lookLock =
    candidateLookPrompt(job.castCandidates, speaker) ||
    job.roster.find((c) => c.name.trim().toLowerCase() === speaker.trim().toLowerCase())
      ?.appearance ||
    "";
  const identity = speaker
    ? await resolvePlateQaIdentity({ styleId: job.styleId, name: speaker, job }).catch(() => null)
    : null;
  const wantQa = opts.qa !== false;

  let working: CrashStoryDoc = {
    ...story,
    scenes: story.scenes.map((sc) => ({
      ...sc,
      shots: sc.shots.map((sh) =>
        sh.id === shotId
          ? { ...sh, staging, plateFile: "", beats: cleanedBeats }
          : sh,
      ),
    })),
  };
  await writeMobileStory(working, job.folderName);

  let fileName = "";
  let plateTakes: PlateTake[] = [];
  let qa: PlateQaVerdict | null = null;
  let qaAttempts = 0;

  for (let attempt = 1; attempt <= PLATE_QA_MAX_ATTEMPTS; attempt++) {
    qaAttempts = attempt;
    scene = working.scenes.find((sc) => sc.shots.some((sh) => sh.id === shotId))!;
    shot = { ...scene.shots.find((sh) => sh.id === shotId)!, staging };

    const drawn = await compositeShotPlatePreferSiray(job.styleId, scene, shot, {
      silentCast: [],
      styleRealism: job.styleRealism,
      job,
    });
    fileName = drawn.fileName;
    try {
      await uploadMobileMedia({
        styleId: job.styleId,
        folderName: job.folderName,
        kind: "plates",
        localPath: path.join(CRASH_DIR, "gen", fileName),
      });
    } catch {
      /* still usable this request */
    }

    const newTake: PlateTake = { id: newId("take"), fileName, staging, approved: true };
    const prevTakes = shot.plateTakes || [];
    plateTakes = [...prevTakes.map((t) => ({ ...t, approved: false })), newTake];
    working = patchShotFields(working, shotId, { plateFile: fileName, staging, plateTakes });
    await writeMobileStory(working, job.folderName);

    if (!wantQa || attempt >= PLATE_QA_MAX_ATTEMPTS) break;
    try {
      qa = await judgePlateStill({
        plateFile: fileName,
        staging,
        speaker,
        lookLock,
        identityDataUrl: identity?.dataUrl,
        identitySource: identity?.source,
      });
    } catch {
      qa = null;
      break;
    }
    if (!qa || qa.ok) break;
    staging = appendPlateQaFix(staging, qa.fix);
  }

  const shots = job.shots.map((s) =>
    s.shotId === shotId ? { ...s, plateFile: fileName, error: "" } : s,
  );
  const updated = (await patchMobileGenJob(job.id, { shots, error: "" }))!;
  return {
    job: updated,
    story: working,
    plateFile: fileName,
    plateTakes,
    staging,
    qa,
    qaAttempts,
    speaker,
  };
}
