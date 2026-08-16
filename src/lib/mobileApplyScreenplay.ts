import { createCharactersFromScriptRoster } from "./mobileRoster";
import { openCrashLabEpisode } from "./crashLabEpisodes";
import { writeMobileStory } from "./mobileStoryStore";
import { findReusableCastCards } from "./mobileCastReuse";
import {
  patchMobileGenJob,
  type MobileGenJob,
  type MobileClipUnit,
  type MobileSceneRef,
  type MobileShotUnit,
} from "./mobileGenJob";
import { phaseAfterScreenplay } from "./mobileJobReady";
import { normalizePlaceKey } from "./mobilePasteScript";
import type { CrashStoryDoc } from "./crashStoryTypes";
import type { ScriptCharacterData } from "./types";

/**
 * Pack is already imported. Reuse pre-built place ids, keep leftover
 * locations, mint shots/clips, and skip pick screens that are already chosen.
 */
export async function applyImportedStoryToJob(opts: {
  job: MobileGenJob;
  folderName: string;
  story: CrashStoryDoc;
  parsedCharacters: ScriptCharacterData[];
}): Promise<MobileGenJob> {
  const { job, folderName, parsedCharacters } = opts;

  createCharactersFromScriptRoster(parsedCharacters);

  const opened = openCrashLabEpisode({ folderName, styleId: job.styleId });
  const incoming = opts.story.scenes.length ? opts.story : opened.story;

  const preBuiltByPlace = new Map(
    job.scenes.map((s) => [normalizePlaceKey(s.placeName), s]),
  );
  const story: CrashStoryDoc = {
    ...incoming,
    styleId: job.styleId,
    scenes: incoming.scenes.map((sc) => {
      const match = preBuiltByPlace.get(normalizePlaceKey(sc.placeName));
      if (!match) return sc;
      return { ...sc, id: match.id, worldThumbKey: match.worldThumbKey || sc.worldThumbKey };
    }),
  };

  await writeMobileStory(story, folderName);

  const usedSceneIds = new Set(story.scenes.map((sc) => sc.id));
  const leftoverScenes = job.scenes.filter((s) => !usedSceneIds.has(s.id));

  const scenes: MobileSceneRef[] = [
    ...story.scenes.map((sc) => ({
      id: sc.id,
      placeName: sc.placeName,
      worldThumbKey: sc.worldThumbKey,
    })),
    ...leftoverScenes,
  ];
  const shots: MobileShotUnit[] = story.scenes.flatMap((sc) =>
    sc.shots.map((sh) => ({
      shotId: sh.id,
      sceneId: sc.id,
      plateFile: "",
    })),
  );
  const clips: MobileClipUnit[] = story.scenes.flatMap((sc) =>
    sc.shots.flatMap((sh) =>
      sh.beats.map((b) => ({
        beatId: b.id,
        shotId: sh.id,
        sceneId: sc.id,
        clipFile: "",
        clipStatus: "pending" as const,
        error: "",
      })),
    ),
  );

  const beatSpeakers = story.scenes.flatMap((sc) =>
    sc.shots.flatMap((sh) => sh.beats.map((b) => b.speaker.trim())),
  );
  const byLower = new Map<string, string>();
  for (const raw of job.speakers) {
    const key = raw.trim().toLowerCase();
    if (key) byLower.set(key, raw.trim());
  }
  for (const raw of [...parsedCharacters.map((c) => c.name.trim()), ...beatSpeakers]) {
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, raw);
  }
  const speakers = [...byLower.values()];

  const newSpeakers = speakers.filter((s) => !job.castCandidates[s]?.some((c) => c.approved));
  const reusable = newSpeakers.length
    ? await findReusableCastCards(job.styleId, newSpeakers)
    : {};
  const castCandidates: MobileGenJob["castCandidates"] = { ...job.castCandidates };
  for (const [speaker, card] of Object.entries(reusable)) {
    castCandidates[speaker] = [
      { id: card.fileName, fileName: card.fileName, approved: true },
    ];
  }

  const nextPhase = phaseAfterScreenplay({
    speakers,
    castCandidates,
    scenes,
    locationCandidates: job.locationCandidates,
  });
  const updated = await patchMobileGenJob(job.id, {
    folderName,
    phase: nextPhase,
    castCandidates,
    locationCandidates: job.locationCandidates,
    scenes,
    shots,
    clips,
    speakers,
    roster: parsedCharacters,
  });
  if (!updated) throw new Error("Job vanished while locking the episode");
  return updated;
}
