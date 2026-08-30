import path from "path";
import type { CrashStoryDoc, PlateTake } from "./crashStoryTypes";
import type { MobileGenJob } from "./mobileGenJob";
import { candidateLookPrompt } from "./mobileJobReady";
import { leftoverHydrateBeat, dropLeftoverHydrateBeats, shotSpeakersOnCard } from "./mobilePlateLines";
import {
  PLATE_QA_MAX_ATTEMPTS,
  appendPlateQaFix,
  judgePlateStill,
  plateQaStopRetry,
  resolvePlateQaIdentity,
  type PlateQaVerdict,
} from "./mobilePlateQa";
import { resolvePlateStaging } from "./mobilePlateScript";
import { uploadMobileMedia } from "./mobileMediaStore";
import { patchMobileGenJob } from "./mobileGenJob";
import { writeMobileStory } from "./mobileStoryStore";
import { CRASH_DIR } from "./paths";
import { compositeShotPlatePreferSiray } from "./sirayScratchPlate";
import { newId } from "./types";

function patchShotFields(
  story: CrashStoryDoc,
  shotId: string,
  patch: {
    staging?: string;
    summary?: string;
    plateFile?: string;
    plateTakes?: PlateTake[];
    bibleIds?: string[];
  },
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
  bibleIdsIn?: string[];
  qa?: boolean;
}): Promise<{
  job: MobileGenJob;
  story: CrashStoryDoc;
  plateFile: string;
  plateTakes: PlateTake[];
  staging: string;
  bibleIds: string[];
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
  const onCard = shotSpeakersOnCard({
    shotId,
    title: shot.title,
    staging: shot.staging,
    summary: shot.summary,
    plateFile: shot.plateFile,
    jobSpeakers: job.speakers || [],
    beats: cleanedBeats,
    castNames: shot.castNames,
  });
  const speaker =
    onCard[0] ||
    cleanedBeats.find((b) => b.speaker.trim() && !leftoverHydrateBeat(shotId, b.id))?.speaker ||
    cleanedBeats[0]?.speaker ||
    "";
  let staging = resolvePlateStaging({
    stagingIn: opts.stagingIn,
    existingStaging: shot.staging,
    summary: shot.summary,
    speaker,
    speakers: onCard.length ? onCard : cleanedBeats.map((b) => b.speaker),
    place: scene.placeName || "this place",
  });
  if (!staging) throw new Error("Say who sits where — not two people stuck in the front.");
  const bibleIds = [
    ...new Set((opts.bibleIdsIn || shot.bibleIds || []).map((id) => id.trim()).filter(Boolean)),
  ];

  const lookLock =
    candidateLookPrompt(job.castCandidates, speaker) ||
    job.roster.find((c) => c.name.trim().toLowerCase() === speaker.trim().toLowerCase())
      ?.appearance ||
    "";
  const identity = speaker && onCard.length
    ? await resolvePlateQaIdentity({ styleId: job.styleId, name: speaker, job }).catch(() => null)
    : null;
  const expectedPeople = onCard.length;
  const wantQa = opts.qa !== false && onCard.length > 0;

  let working: CrashStoryDoc = {
    ...story,
    scenes: story.scenes.map((sc) => ({
      ...sc,
      shots: sc.shots.map((sh) =>
        sh.id === shotId
          ? { ...sh, staging, bibleIds, plateFile: "", beats: cleanedBeats }
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

    const newTake: PlateTake = {
      id: newId("take"),
      fileName,
      staging,
      bibleIds: bibleIds.length ? bibleIds : undefined,
      approved: false,
    };
    const prevTakes = shot.plateTakes || [];
    plateTakes = [...prevTakes.map((t) => ({ ...t, approved: false })), newTake];
    working = patchShotFields(working, shotId, {
      plateFile: fileName,
      staging,
      bibleIds: bibleIds.length ? bibleIds : undefined,
      plateTakes,
    });
    await writeMobileStory(working, job.folderName);

    if (!wantQa) {
      plateTakes = plateTakes.map((t, i) =>
        i === plateTakes.length - 1 ? { ...t, approved: true } : t,
      );
      working = patchShotFields(working, shotId, { plateTakes });
      await writeMobileStory(working, job.folderName);
      break;
    }
    try {
      qa = await judgePlateStill({
        plateFile: fileName,
        staging,
        speaker,
        lookLock,
        people: expectedPeople,
        identityDataUrl: identity?.dataUrl,
        identitySource: identity?.source,
      });
    } catch {
      qa = null;
      break;
    }
    if (!qa) break;
    if (qa.ok) {
      plateTakes = plateTakes.map((t, i) =>
        i === plateTakes.length - 1 ? { ...t, approved: true } : t,
      );
      working = patchShotFields(working, shotId, { plateTakes });
      await writeMobileStory(working, job.folderName);
      break;
    }
    if (plateQaStopRetry(qa.fails, expectedPeople)) {
      plateTakes = plateTakes.map((t, i) =>
        i === plateTakes.length - 1 ? { ...t, approved: true } : t,
      );
      working = patchShotFields(working, shotId, { plateTakes });
      await writeMobileStory(working, job.folderName);
      qa = { ...qa, ok: true };
      break;
    }
    if (attempt < PLATE_QA_MAX_ATTEMPTS) {
      staging = appendPlateQaFix(staging, qa.fix);
    }
  }

  const qaFailed = Boolean(wantQa && qa && qa.ok === false);
  const qaError = qaFailed
    ? `Still failed proof after ${qaAttempts} tries (${(qa?.fails || []).join(", ") || "anatomy"}). Tweak Position and Redo.`
    : "";
  const shots = job.shots.map((s) =>
    s.shotId === shotId
      ? { ...s, plateFile: fileName, error: qaError }
      : s,
  );
  const updated = (await patchMobileGenJob(job.id, { shots, error: qaFailed ? qaError : "" }))!;
  return {
    job: updated,
    story: working,
    plateFile: fileName,
    plateTakes,
    staging,
    bibleIds,
    qa,
    qaAttempts,
    speaker,
  };
}

/** Land a finished Siray still onto an episode plate. Does not draw. */
export async function landEpisodePlateStill(opts: {
  job: MobileGenJob;
  story: CrashStoryDoc;
  shotId: string;
  fileName: string;
  staging: string;
  bibleIds?: string[];
}): Promise<{
  job: MobileGenJob;
  story: CrashStoryDoc;
  plateFile: string;
  plateTakes: PlateTake[];
  staging: string;
  bibleIds: string[];
}> {
  const { job, shotId, fileName } = opts;
  const staging = opts.staging.trim();
  const bibleIds = [...new Set((opts.bibleIds || []).map((id) => id.trim()).filter(Boolean))];
  const scene = opts.story.scenes.find((sc) => sc.shots.some((sh) => sh.id === shotId));
  const shot = scene?.shots.find((sh) => sh.id === shotId);
  if (!scene || !shot) throw new Error("That shot is not in the story");

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

  const newTake: PlateTake = {
    id: newId("take"),
    fileName,
    staging,
    bibleIds: bibleIds.length ? bibleIds : undefined,
    approved: true,
  };
  const plateTakes = [...(shot.plateTakes || []).map((t) => ({ ...t, approved: false })), newTake];
  const story = patchShotFields(opts.story, shotId, {
    plateFile: fileName,
    staging,
    bibleIds: bibleIds.length ? bibleIds : undefined,
    plateTakes,
  });
  await writeMobileStory(story, job.folderName);
  const shots = job.shots.some((s) => s.shotId === shotId)
    ? job.shots.map((s) =>
        s.shotId === shotId ? { ...s, plateFile: fileName, error: "" } : s,
      )
    : [...job.shots, { shotId, sceneId: scene.id, plateFile: fileName }];
  const updated = (await patchMobileGenJob(job.id, {
    shots,
    error: "",
    plateDraw: null,
  }))!;
  return {
    job: updated,
    story,
    plateFile: fileName,
    plateTakes,
    staging,
    bibleIds,
  };
}
