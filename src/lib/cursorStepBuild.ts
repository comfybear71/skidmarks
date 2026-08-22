/**
 * Cursor walk — server builders (no Comfy Send).
 */
import fs from "fs";
import path from "path";
import {
  CURSOR_ORIGINAL_ARSEHOLE,
  CURSOR_ORIGINAL_CAST,
  CURSOR_ORIGINAL_PLACES,
  CURSOR_ORIGINAL_SHOTS,
  type CursorStillPlan,
} from "./cursorOriginalKit";
import {
  CURSOR_SUNNY_ARSEHOLE,
  CURSOR_SUNNY_CAST,
  CURSOR_SUNNY_PLACES,
  CURSOR_SUNNY_SHOTS,
} from "./cursorSunnyBanksKit";
import { readCrashStory, writeCrashStory } from "./crashStory";
import type { CrashStoryDoc, CrashStoryShot } from "./crashStoryTypes";
import {
  findCrashVoiceByName,
  lockCrashVoiceByExternalId,
} from "./crashVoice";
import { synthesizeStoryBeat } from "./crashStorySpeak";
import { plateCastIntoGen } from "./plateCast";
import { buildCrashGenLook, generateFaceImage } from "./imageGen";
import { crashGenDir, readActivePack } from "./crashActivePack";
import { saveCplateMeta } from "./cplateManifest";
import {
  readStyleCardManifest,
  resolveStyleCardThumbPath,
  writeStyleCardManifestLabel,
} from "./styleCardThumbs";
import { resolveWorldCardThumbPath } from "./worldCardThumbs";
import { addCrashSpxGeneratedSound } from "./crashSpx";
import {
  elevenKeyPresent,
  generateSoundEffect,
  listLibraryVoices,
  type ElevenVoiceSummary,
} from "./elevenLabs";
import {
  CRASH_COMFY_DEFAULT_GLOBAL,
  defaultImageMotion,
  defaultSegmentText,
  listComfyBeats,
  type ComfyDraft,
} from "./crashComfyStack";
import { getShowStylePreset, type ShowStyleId } from "./showStylePresets";
import { newId, sortableId } from "./types";
import { episodePackDir } from "./crashLabEpisodes";
import { getVoiceLibraryEntry } from "./voiceLibrary";

export function cursorKitPlans(): {
  arsehole: CursorStillPlan;
  cast: CursorStillPlan[];
  places: CursorStillPlan[];
} {
  return {
    arsehole: CURSOR_ORIGINAL_ARSEHOLE,
    cast: CURSOR_ORIGINAL_CAST,
    places: CURSOR_ORIGINAL_PLACES,
  };
}

export function voiceDescFor(name: string): string {
  if (name === CURSOR_ORIGINAL_ARSEHOLE.name) {
    return CURSOR_ORIGINAL_ARSEHOLE.voiceDescription || name;
  }
  if (name === CURSOR_SUNNY_ARSEHOLE.name) {
    return CURSOR_SUNNY_ARSEHOLE.voiceDescription || name;
  }
  const hit =
    CURSOR_ORIGINAL_CAST.find((c) => c.name === name) ||
    CURSOR_SUNNY_CAST.find((c) => c.name === name);
  return hit?.voiceDescription || name;
}

export function libraryVoiceNameFor(name: string): string {
  if (name === CURSOR_ORIGINAL_ARSEHOLE.name) {
    return CURSOR_ORIGINAL_ARSEHOLE.libraryVoiceName || name;
  }
  if (name === CURSOR_SUNNY_ARSEHOLE.name) {
    return CURSOR_SUNNY_ARSEHOLE.libraryVoiceName || name;
  }
  const hit =
    CURSOR_ORIGINAL_CAST.find((c) => c.name === name) ||
    CURSOR_SUNNY_CAST.find((c) => c.name === name);
  return hit?.libraryVoiceName || name;
}

function normVoiceLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/^skidmarks\s+/i, "")
    .replace(/^sunny\s+banks\s+/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Match an existing ElevenLabs library voice by name (no design / no edit). */
export function resolveLibraryVoice(
  voices: ElevenVoiceSummary[],
  wanted: string,
): ElevenVoiceSummary | null {
  const want = normVoiceLabel(wanted);
  if (!want) return null;
  const exact = voices.find((v) => normVoiceLabel(v.name) === want);
  if (exact) return exact;
  const contains = voices.find((v) => {
    const n = normVoiceLabel(v.name);
    return n.includes(want) || want.includes(n);
  });
  return contains || null;
}

/**
 * Lock cast to an existing library voice — never Voice Design / add-edit quota.
 */
export async function cursorLockVoice(opts: {
  styleId: ShowStyleId;
  castKey: string;
  castName: string;
  voiceDescription: string;
  libraryVoiceName?: string;
}): Promise<{ castName: string; libraryVoice: string; voiceId: string }> {
  if (!elevenKeyPresent()) {
    throw new Error("Missing ELEVENLABS_API_KEY in your environment variables");
  }
  const wanted =
    opts.libraryVoiceName?.trim() || libraryVoiceNameFor(opts.castName);
  const desc = opts.voiceDescription.trim() || voiceDescFor(opts.castName);
  writeStyleCardManifestLabel(opts.styleId, opts.castKey, {
    name: opts.castName,
    brief: desc,
  });

  const local =
    getVoiceLibraryEntry(opts.styleId, opts.castName) ||
    getVoiceLibraryEntry(opts.styleId, wanted);
  if (local?.approvedVoiceId?.trim()) {
    await lockCrashVoiceByExternalId({
      styleId: opts.styleId,
      castKey: opts.castKey,
      castName: opts.castName,
      voiceId: local.approvedVoiceId.trim(),
      voiceDescription: desc,
    });
    return {
      castName: opts.castName,
      libraryVoice: local.characterName,
      voiceId: local.approvedVoiceId.trim(),
    };
  }

  const voices = await listLibraryVoices();
  const hit = resolveLibraryVoice(voices, wanted);
  if (!hit) {
    const sample = voices
      .slice(0, 12)
      .map((v) => v.name)
      .join(", ");
    throw new Error(
      `No existing ElevenLabs voice matching "${wanted}" for ${opts.castName}. Library has: ${sample}${voices.length > 12 ? "…" : ""}`,
    );
  }

  await lockCrashVoiceByExternalId({
    styleId: opts.styleId,
    castKey: opts.castKey,
    castName: opts.castName,
    voiceId: hit.voiceId,
    voiceDescription: desc,
  });
  return {
    castName: opts.castName,
    libraryVoice: hit.name,
    voiceId: hit.voiceId,
  };
}

export function cursorWriteStory(opts: {
  styleId: ShowStyleId;
  folderName: string;
  worldKeys: string[];
}): CrashStoryDoc {
  const sunny = opts.styleId === "sunny_banks";
  const places = sunny ? CURSOR_SUNNY_PLACES : CURSOR_ORIGINAL_PLACES;
  const shotPlans = sunny ? CURSOR_SUNNY_SHOTS : CURSOR_ORIGINAL_SHOTS;
  const scenes = shotPlans.map((plan) => {
    const worldKey = opts.worldKeys[plan.placeIndex] || "";
    const placeName = places[plan.placeIndex]?.name || plan.placeName;
    const shot: CrashStoryShot = {
      id: newId("shot"),
      title: plan.title,
      summary: plan.summary,
      staging: plan.staging,
      plateFile: "",
      beats: plan.lines.map((line) => ({
        id: newId("beat"),
        speaker: line.speaker,
        text: line.text,
      })),
      sfx: plan.sfx.map((s) => ({
        id: newId("sfx"),
        label: s.label,
        notes: s.prompt,
        audioFile: "",
        spxId: "",
      })),
    };
    return {
      id: newId("scene"),
      title: plan.title,
      placeName,
      worldThumbKey: worldKey,
      shots: [shot],
    };
  });

  const story: CrashStoryDoc = {
    styleId: opts.styleId,
    campaignLabel: opts.folderName,
    gagNote: sunny
      ? "Nuggets panics. Bazza translates. Dazza's fix is worse. Nan ends it."
      : "Clive the Clipboard enforces nothing. Moira, Keith, Auntie Bev and Declan shut him down.",
    intro: {
      title: opts.folderName,
      notes: "Title later.",
      logoFile: "",
      sfx: [],
    },
    outro: {
      title: "Credits",
      notes: "Credits later.",
      logoFile: "",
      sfx: [],
    },
    scenes,
    updatedAt: new Date().toISOString(),
  };
  writeCrashStory(story);
  return story;
}

function resolveCastKeyByName(
  styleId: ShowStyleId,
  name: string,
): string | null {
  const man = readStyleCardManifest(styleId);
  const lower = name.trim().toLowerCase();
  for (const [key, meta] of Object.entries(man)) {
    const n = (meta.name || "").trim().toLowerCase();
    if (n === lower || n.includes(lower) || lower.includes(n)) return key;
  }
  return null;
}

export async function cursorGenPlates(opts: {
  styleId: ShowStyleId;
}): Promise<{ story: CrashStoryDoc; plates: string[] }> {
  let story = readCrashStory(opts.styleId);
  const styleMan = readStyleCardManifest(opts.styleId);
  const plates: string[] = [];
  const realism = getShowStylePreset(opts.styleId).defaultRealism;
  const look = buildCrashGenLook(opts.styleId, realism);

  for (const sc of story.scenes) {
    for (const sh of sc.shots) {
      const speakers = [
        ...new Set(sh.beats.map((b) => b.speaker.trim()).filter(Boolean)),
      ].slice(0, 3);
      const worldKey = String(sc.worldThumbKey || "").trim();
      const worldPath = worldKey
        ? resolveWorldCardThumbPath(opts.styleId, worldKey)
        : null;

      // Staging / tweak MUST drive the plate — never paste faces on empty BG with no scene brief.
      const tweak = [
        sh.staging?.trim() || "",
        sh.summary?.trim() || "",
        speakers.length
          ? `People in frame (baked into the still): ${speakers.join(", ")}. ${speakers[0]} prominent if they speak.`
          : "",
        sc.placeName ? `Location: ${sc.placeName}.` : "",
        "Characters physically in the place — feet on ground, matching light. One finished shot still.",
      ]
        .filter(Boolean)
        .join(" ");

      let fileName = "";
      if (worldPath && speakers.length) {
        const castFiles: { buf: Buffer; ext: string }[] = [];
        const castNames: string[] = [];
        for (const name of speakers) {
          const key = resolveCastKeyByName(opts.styleId, name);
          if (!key) continue;
          const p = resolveStyleCardThumbPath(opts.styleId, key);
          if (!p) continue;
          castNames.push(styleMan[key]?.name || name);
          castFiles.push({
            buf: fs.readFileSync(p),
            ext: path.extname(p) || ".png",
          });
        }
        if (castFiles.length) {
          const result = await plateCastIntoGen({
            styleId: opts.styleId,
            bgPath: worldPath,
            castFiles,
            castNames,
            placeName: sc.placeName || "Place",
            note: tweak,
          });
          fileName = result.fileName;
        }
      }

      if (!fileName) {
        const prompt = [
          tweak || sh.title,
          look,
          "16:9 still. Characters already in the place — not pasted on afterwards.",
        ].join("\n\n");
        const { buffer, ext } = await generateFaceImage({
          prompt,
          referencePaths: [],
          aspectRatio: "16:9",
        });
        const id = sortableId("cplate");
        fileName = `${id}${ext.startsWith(".") ? ext : `.${ext}`}`;
        fs.writeFileSync(path.join(crashGenDir(), fileName), buffer);
        saveCplateMeta({
          fileName,
          styleId: opts.styleId,
          castNames: speakers,
          placeName: sc.placeName || sh.title,
          people: speakers.length,
        });
      }

      sh.plateFile = fileName;
      plates.push(fileName);
    }
  }

  writeCrashStory(story);
  story = readCrashStory(opts.styleId);
  return { story, plates };
}

export async function cursorSpeakAll(opts: {
  styleId: ShowStyleId;
}): Promise<{ lines: number }> {
  const story = readCrashStory(opts.styleId);
  let lines = 0;
  for (const sc of story.scenes) {
    for (const sh of sc.shots) {
      for (const beat of sh.beats) {
        if (!beat.text.trim() || !beat.speaker.trim()) continue;
        const slot = findCrashVoiceByName(opts.styleId, beat.speaker);
        if (!slot) {
          throw new Error(`No locked voice for ${beat.speaker}`);
        }
        await synthesizeStoryBeat({
          styleId: opts.styleId,
          beatId: beat.id,
          speaker: beat.speaker,
          text: beat.text,
        });
        lines += 1;
      }
    }
  }
  return { lines };
}

export function cursorFillAnimateDraft(opts: {
  styleId: ShowStyleId;
}): ComfyDraft {
  const story = readCrashStory(opts.styleId);
  const rows = listComfyBeats(story);
  const beats: ComfyDraft["beats"] = {};
  for (const row of rows) {
    beats[row.beatId] = {
      imageMotion: defaultImageMotion(row),
      segmentText: defaultSegmentText(row),
    };
  }
  const draft: ComfyDraft = {
    global: CRASH_COMFY_DEFAULT_GLOBAL,
    beats,
  };

  const active = readActivePack();
  if (active?.folderName) {
    const pack = episodePackDir(active.folderName, active.styleId);
    const fp = path.join(pack, "_RECIPE", "comfy-draft.json");
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(draft, null, 2) + "\n");
  }
  return draft;
}

export async function cursorGenSfx(opts: {
  styleId: ShowStyleId;
}): Promise<{ count: number; story: CrashStoryDoc }> {
  if (!elevenKeyPresent()) {
    throw new Error("Missing ELEVENLABS_API_KEY in your environment variables");
  }
  let story = readCrashStory(opts.styleId);
  let count = 0;
  for (const sc of story.scenes) {
    for (const sh of sc.shots) {
      for (const sfx of sh.sfx) {
        const prompt = (sfx.notes || sfx.label || "").trim();
        if (!prompt) continue;
        const buf = await generateSoundEffect({
          text: prompt,
          durationSeconds: 2,
        });
        const item = addCrashSpxGeneratedSound({
          styleId: opts.styleId,
          buffer: buf,
          label: sfx.label || "SFX",
          prompt,
        });
        sfx.audioFile = item.fileName;
        sfx.spxId = item.id;
        count += 1;
      }
    }
  }
  writeCrashStory(story);
  story = readCrashStory(opts.styleId);
  return { count, story };
}
