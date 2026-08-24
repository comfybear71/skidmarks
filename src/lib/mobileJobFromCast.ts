import type { MobileGenJob, MobileSceneRef } from "./mobileGenJob";
import { canReuseCastForNewEpisode } from "./styleEpisodeProcess";

/** CAST + places from an older episode. Never story, shots, clips, or folder. */
export type CastSeed = {
  speakers: string[];
  castCandidates: MobileGenJob["castCandidates"];
  speakerVoices: NonNullable<MobileGenJob["speakerVoices"]>;
  characterPlates: NonNullable<MobileGenJob["characterPlates"]>;
  roster: MobileGenJob["roster"];
  scenes: MobileSceneRef[];
};

export function canConjureCastFromStyle(styleId: string | undefined): boolean {
  return canReuseCastForNewEpisode(styleId);
}

export function castSeedFromJob(
  job: Pick<
    MobileGenJob,
    | "speakers"
    | "castCandidates"
    | "speakerVoices"
    | "characterPlates"
    | "roster"
    | "scenes"
  >,
): CastSeed {
  const speakers = (job.speakers || []).map((s) => s.trim()).filter(Boolean);
  const castCandidates: MobileGenJob["castCandidates"] = {};
  for (const name of speakers) {
    const takes = job.castCandidates?.[name];
    if (takes?.length) castCandidates[name] = takes.map((c) => ({ ...c }));
  }
  const speakerVoices: NonNullable<MobileGenJob["speakerVoices"]> = {};
  for (const name of speakers) {
    const voice = job.speakerVoices?.[name];
    if (voice?.voiceId) speakerVoices[name] = { ...voice };
  }
  const characterPlates: NonNullable<MobileGenJob["characterPlates"]> = {};
  for (const name of speakers) {
    const plate = job.characterPlates?.[name];
    if (plate) characterPlates[name] = { ...plate };
  }
  return {
    speakers,
    castCandidates,
    speakerVoices,
    characterPlates,
    roster: (job.roster || []).filter((row) =>
      speakers.some((s) => s.trim().toLowerCase() === (row.name || "").trim().toLowerCase()),
    ),
    scenes: (job.scenes || []).map((s) => ({
      id: s.id,
      placeName: s.placeName,
      worldThumbKey: s.worldThumbKey || "",
    })),
  };
}

export function applyCastSeed<T extends Partial<MobileGenJob>>(
  job: T,
  seed: CastSeed,
  scenes: MobileSceneRef[] = seed.scenes,
): T {
  return {
    ...job,
    speakers: [...seed.speakers],
    castCandidates: { ...seed.castCandidates },
    speakerVoices: { ...seed.speakerVoices },
    characterPlates: { ...seed.characterPlates },
    roster: [...seed.roster],
    scenes,
    droppedCast: [],
    folderName: "",
    shots: [],
    clips: [],
    finalVideoFile: "",
  };
}
