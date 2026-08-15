import fs from "fs";
import path from "path";
import type { ShowStyleId } from "./showStylePresets";
import type { CrashStoryDoc } from "./crashStoryTypes";
import { CRASH_DIR } from "./paths";
import { sortableId } from "./types";
import {
  buildFacePrompt,
  buildLocationPrompt,
  generateFaceImage,
} from "./imageGen";
import { addFaceAttempt, listCharacters } from "./characters";
import { saveGenStillAsWorldCard } from "./worldCardThumbs";
import { resolvePlaceKey } from "./cursorPromptBuild";
import { openCrashLabEpisode, saveCrashLabEpisode } from "./crashLabEpisodes";
import { writeCrashStory } from "./crashStory";
import { hydrateShowShelfManifests, persistCursorPackToCloud } from "./cursorCloudSync";
import { writeScriptImageProgress } from "./scriptImageProgress";

export type ScriptImageGenItemResult = {
  name: string;
  ok: boolean;
  detail: string;
};

export type ScriptImageGenResult = {
  folderName: string;
  characters: ScriptImageGenItemResult[];
  locations: ScriptImageGenItemResult[];
};

/** Generated stills land here — same fixed path saveGenStillAsWorldCard() reads from, regardless of any active pack. */
function genStillDir(): string {
  const dir = path.join(CRASH_DIR, "gen");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function uniqueSpeakers(story: CrashStoryDoc): string[] {
  const names = new Set<string>();
  for (const scene of story.scenes) {
    for (const shot of scene.shots) {
      for (const beat of shot.beats) {
        if (beat.speaker.trim()) names.add(beat.speaker.trim());
      }
    }
  }
  return Array.from(names);
}

async function generateCharacterFaces(
  story: CrashStoryDoc,
): Promise<ScriptImageGenItemResult[]> {
  const speakers = uniqueSpeakers(story);
  const byLowerName = new Map(
    listCharacters().map((c) => [c.name.trim().toLowerCase(), c] as const),
  );
  const results: ScriptImageGenItemResult[] = [];

  for (let i = 0; i < speakers.length; i++) {
    const speaker = speakers[i];
    writeScriptImageProgress({
      phase: "characters",
      current: i + 1,
      total: speakers.length,
      label: speaker,
    });

    const character = byLowerName.get(speaker.toLowerCase());
    if (!character) {
      results.push({ name: speaker, ok: false, detail: "No matching Character — save the roster first" });
      continue;
    }
    if (character.approvedFaceId) {
      results.push({ name: speaker, ok: true, detail: "Already has an approved face" });
      continue;
    }

    try {
      const note = [character.lookNote, character.pastNote].filter(Boolean).join(". ");
      const rejectHints = character.faceAttempts
        .filter((a) => a.status === "rejected" && a.reason)
        .slice(0, 5)
        .map((a) => a.reason);
      const prompt = buildFacePrompt({
        name: character.name,
        pastNote: character.pastNote,
        note,
        styleRealism: 60,
        rejectHints,
      });
      const { buffer, ext } = await generateFaceImage({ prompt, referencePaths: [] });
      const saved = addFaceAttempt(character.id, {
        note,
        buffer,
        ext,
        styleRealism: 60,
        source: "generated",
      });
      if (!saved) throw new Error("Save failed");
      results.push({ name: speaker, ok: true, detail: "Face generated — review in Character Lab" });
    } catch (e) {
      results.push({
        name: speaker,
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}

async function generateLocationPlates(
  styleId: ShowStyleId,
  story: CrashStoryDoc,
): Promise<ScriptImageGenItemResult[]> {
  const unresolved = story.scenes.filter((s) => !s.worldThumbKey.trim());
  const results: ScriptImageGenItemResult[] = [];

  for (let i = 0; i < unresolved.length; i++) {
    const scene = unresolved[i];
    writeScriptImageProgress({
      phase: "locations",
      current: i + 1,
      total: unresolved.length,
      label: scene.placeName,
    });

    if (!scene.placeName.trim()) {
      results.push({ name: scene.title || "(untitled scene)", ok: false, detail: "No place name to generate" });
      continue;
    }

    try {
      const genPrompt = buildLocationPrompt({
        name: scene.placeName,
        notes: "",
        lookNote: "",
        note: "",
        styleRealism: 60,
        rejectHints: [],
        residentNames: [],
      });
      const { buffer, ext } = await generateFaceImage({
        prompt: genPrompt,
        referencePaths: [],
        aspectRatio: "16:9",
      });
      const genFileName = `${sortableId("wgen")}${ext.startsWith(".") ? ext : `.${ext}`}`;
      fs.writeFileSync(path.join(genStillDir(), genFileName), buffer);

      // Separate, minimal prompt just for label parsing — saveGenStillAsWorldCard
      // derives name/brief from this text (splits on " — "), so it must lead
      // with the exact place name resolvePlaceKey() will search for later,
      // not the long generation prompt above.
      const labelPrompt = `${scene.placeName} — ${scene.title || "Location"}`;
      const saved = saveGenStillAsWorldCard({
        genFileName,
        styleId,
        prompt: labelPrompt,
        placeType: "social_public",
      });
      scene.worldThumbKey = saved.thumbKey;
      results.push({ name: scene.placeName, ok: true, detail: "World card created — review in World cards" });
    } catch (e) {
      results.push({
        name: scene.placeName,
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}

/**
 * Batch-fill the two things Stage 0 left empty: character faces (for every
 * speaker with a matching, not-yet-approved Character) and location world
 * cards (for every scene whose place name didn't resolve on import).
 * Sequential, not parallel — no parallel-batch precedent exists in this
 * codebase (Populate's own batch loop is sequential too) and GROK calls are
 * presumably rate-sensitive. Each item gets its own try/catch so one bad
 * prompt doesn't abort the rest of the batch.
 */
export async function generateEpisodeImages(
  styleId: ShowStyleId,
  folderName: string,
): Promise<ScriptImageGenResult> {
  await hydrateShowShelfManifests(styleId);

  const opened = openCrashLabEpisode({ folderName, styleId });
  const story = opened.story;

  writeScriptImageProgress({ phase: "characters", current: 0, total: 1, label: "Starting…" });
  const characters = await generateCharacterFaces(story);
  const locations = await generateLocationPlates(styleId, story);

  // Re-resolve any location that now has a fresh world card, in case the
  // scene's place name matches one generated for an earlier scene this run.
  for (const scene of story.scenes) {
    if (scene.worldThumbKey.trim()) continue;
    try {
      scene.worldThumbKey = resolvePlaceKey(styleId, scene.placeName);
    } catch {
      /* still unresolved — fine, leave empty for another pass */
    }
  }

  writeCrashStory(story);
  saveCrashLabEpisode({ styleId, folderName, label: story.campaignLabel });
  await persistCursorPackToCloud({
    styleId,
    folderName,
    story,
    sceneKit: opened.sceneKit,
  });

  writeScriptImageProgress({
    phase: "done",
    current: characters.length + locations.length,
    total: characters.length + locations.length,
    label: "Done",
  });

  return { folderName, characters, locations };
}
