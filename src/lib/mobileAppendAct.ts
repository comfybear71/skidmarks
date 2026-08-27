import { createCharactersFromScriptRoster } from "./mobileRoster";
import { readMobileStory, writeMobileStory } from "./mobileStoryStore";
import { findReusableCastCards } from "./mobileCastReuse";
import {
  patchMobileGenJob,
  type MobileGenJob,
  type MobileClipUnit,
  type MobileSceneRef,
  type MobileShotUnit,
} from "./mobileGenJob";
import { phaseAfterScreenplay } from "./mobileJobReady";
import { speakerWasDropped } from "./mobileDropCast";
import { normalizePlaceKey } from "./mobilePasteParse";
import { orderSunnyStoryByScript } from "./sunnyEpisodeOrder";
import type { CrashStoryDoc, CrashStoryScene } from "./crashStoryTypes";
import { newId } from "./types";
import type { ScriptCharacterData } from "./types";

function sceneKey(scene: { placeName?: string; title?: string }): string {
  return normalizePlaceKey(scene.placeName || scene.title || "");
}

/**
 * Append pasted shots onto the live story. Existing Act I shots, plates,
 * and beat ids stay. New shots land on the matching place (BBQ shelter
 * reuses the empty leftover scene). Does not rewrite Act I.
 */
export function mergePastedActIntoStory(opts: {
  existing: CrashStoryDoc;
  pasted: CrashStoryDoc;
  jobScenes?: Array<{ id: string; placeName: string; worldThumbKey?: string }>;
}): CrashStoryDoc {
  const existing = opts.existing;
  if (!existing.scenes.length) {
    throw new Error("Nothing to add onto. Lock Act I first.");
  }
  const incoming = opts.pasted.scenes.flatMap((sc) =>
    sc.shots.map((shot) => ({ placeName: sc.placeName, worldThumbKey: sc.worldThumbKey, shot })),
  );
  if (!incoming.length) {
    throw new Error("Need at least one --- SHOT --- to add.");
  }

  const scenes: CrashStoryScene[] = existing.scenes.map((sc) => ({
    ...sc,
    shots: [...sc.shots],
  }));
  const byId = new Map(scenes.map((sc) => [sc.id, sc]));
  const byPlace = new Map<string, CrashStoryScene>();
  for (const sc of scenes) {
    const key = sceneKey(sc);
    if (key && !byPlace.has(key)) byPlace.set(key, sc);
  }
  for (const row of opts.jobScenes || []) {
    const key = normalizePlaceKey(row.placeName);
    if (!key || byPlace.has(key) || byId.has(row.id)) continue;
    const minted: CrashStoryScene = {
      id: row.id,
      title: row.placeName,
      placeName: row.placeName,
      worldThumbKey: row.worldThumbKey || "",
      shots: [],
    };
    scenes.push(minted);
    byId.set(minted.id, minted);
    byPlace.set(key, minted);
  }

  for (const row of incoming) {
    const key = normalizePlaceKey(row.placeName);
    let scene = key ? byPlace.get(key) : undefined;
    if (!scene) {
      scene = {
        id: newId("scene"),
        title: row.placeName,
        placeName: row.placeName,
        worldThumbKey: row.worldThumbKey || "",
        shots: [],
      };
      scenes.push(scene);
      byId.set(scene.id, scene);
      if (key) byPlace.set(key, scene);
    }
    if (row.worldThumbKey && !scene.worldThumbKey) {
      scene.worldThumbKey = row.worldThumbKey;
    }
    scene.shots.push(row.shot);
  }

  return {
    ...existing,
    updatedAt: new Date().toISOString(),
    scenes,
  };
}

export function keepJobUnitsForStory(opts: {
  story: CrashStoryDoc;
  shots: MobileShotUnit[];
  clips: MobileClipUnit[];
}): { shots: MobileShotUnit[]; clips: MobileClipUnit[] } {
  const shotById = new Map(opts.shots.map((s) => [s.shotId, s]));
  const clipByBeat = new Map(opts.clips.map((c) => [c.beatId, c]));
  const shots: MobileShotUnit[] = [];
  const clips: MobileClipUnit[] = [];
  for (const scene of opts.story.scenes) {
    for (const shot of scene.shots) {
      const old = shotById.get(shot.id);
      shots.push(
        old
          ? { ...old, sceneId: scene.id, plateFile: old.plateFile || shot.plateFile || "" }
          : { shotId: shot.id, sceneId: scene.id, plateFile: shot.plateFile || "" },
      );
      for (const beat of shot.beats) {
        const oldClip = clipByBeat.get(beat.id);
        clips.push(
          oldClip || {
            beatId: beat.id,
            shotId: shot.id,
            sceneId: scene.id,
            clipFile: "",
            clipStatus: "pending",
            error: "",
          },
        );
      }
    }
  }
  return { shots, clips };
}

function mergeSpeakers(job: MobileGenJob, names: string[]): string[] {
  const byLower = new Map<string, string>();
  for (const raw of job.speakers) {
    const key = raw.trim().toLowerCase();
    if (key) byLower.set(key, raw.trim());
  }
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    if (speakerWasDropped(job.droppedCast, name)) continue;
    const key = name.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, name);
  }
  return [...byLower.values()];
}

/** Add the pasted act onto this pack. Does not mint a new folder. */
export async function appendPastedActToJob(opts: {
  job: MobileGenJob;
  pasted: CrashStoryDoc;
  script?: string;
  parsedCharacters: ScriptCharacterData[];
}): Promise<MobileGenJob> {
  const folderName = opts.job.folderName.trim();
  if (!folderName) {
    throw new Error("Lock Act I first, then paste the next act.");
  }

  createCharactersFromScriptRoster(opts.parsedCharacters);

  const existing = await readMobileStory(opts.job.styleId, folderName);
  const pasted =
    opts.job.styleId === "sunny_banks" && opts.script
      ? orderSunnyStoryByScript(opts.pasted, opts.script)
      : opts.pasted;
  const story = mergePastedActIntoStory({
    existing,
    pasted,
    jobScenes: opts.job.scenes,
  });
  await writeMobileStory(story, folderName);

  const { shots, clips } = keepJobUnitsForStory({
    story,
    shots: opts.job.shots || [],
    clips: opts.job.clips || [],
  });

  const beatSpeakers = story.scenes.flatMap((sc) =>
    sc.shots.flatMap((sh) => sh.beats.map((b) => b.speaker.trim())),
  );
  const speakers = mergeSpeakers(opts.job, [
    ...opts.parsedCharacters.map((c) => c.name),
    ...beatSpeakers,
  ]);

  const usedSceneIds = new Set(story.scenes.map((sc) => sc.id));
  const leftoverScenes = opts.job.scenes.filter((s) => !usedSceneIds.has(s.id));
  const scenes: MobileSceneRef[] = [
    ...story.scenes.map((sc) => {
      const prior = opts.job.scenes.find((s) => s.id === sc.id);
      return {
        id: sc.id,
        placeName: sc.placeName,
        worldThumbKey: prior?.worldThumbKey || sc.worldThumbKey || "",
      };
    }),
    ...leftoverScenes,
  ];

  const newSpeakers = speakers.filter((s) => !opts.job.castCandidates[s]?.some((c) => c.approved));
  const reusable = newSpeakers.length
    ? await findReusableCastCards(opts.job.styleId, newSpeakers)
    : {};
  const castCandidates: MobileGenJob["castCandidates"] = { ...opts.job.castCandidates };
  for (const [speaker, card] of Object.entries(reusable)) {
    castCandidates[speaker] = [{ id: card.fileName, fileName: card.fileName, approved: true }];
  }

  const nextPhase = phaseAfterScreenplay({
    speakers,
    castCandidates,
    scenes,
    locationCandidates: opts.job.locationCandidates,
  });
  const stayReview = opts.job.phase === "review" && nextPhase === "plates";
  const updated = await patchMobileGenJob(opts.job.id, {
    folderName,
    phase: stayReview ? "review" : nextPhase,
    castCandidates,
    locationCandidates: opts.job.locationCandidates,
    scenes,
    shots,
    clips,
    speakers,
    roster: opts.parsedCharacters.length
      ? [
          ...(opts.job.roster || []).filter(
            (r) =>
              !opts.parsedCharacters.some(
                (c) => c.name.trim().toLowerCase() === r.name.trim().toLowerCase(),
              ),
          ),
          ...opts.parsedCharacters,
        ]
      : opts.job.roster,
  });
  if (!updated) throw new Error("Job vanished while adding the act");
  return updated;
}
