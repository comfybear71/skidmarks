import {
  backupCrashStory,
  writeCrashStory,
} from "./crashStory";
import type { CrashStoryDoc, CrashStorySfx } from "./crashStoryTypes";
import { cursorCastKeys } from "./cursorGagCatalog";
import type { CursorPopulateConfig } from "./cursorPopulateTypes";
import { campaignBaseSlug } from "./showArchivePaths";
import {
  allocateNumberedCampaignFolder,
  peekNextCampaignNumber,
} from "./showArchiveServer";
import { writePromptPopulateConfig } from "./cursorPromptStore";
import type { ShowStyleId } from "./showStylePresets";
import { liveCastRoster } from "./styleCardThumbs";
import { readWorldCardManifest } from "./worldCardThumbs";
import { sortableId } from "./types";
import { normalizePromptScript as normalizePromptScriptBase } from "./cursorPromptNormalize";
import { createCursorEpisodePack } from "./cursorPackCreate";
import { writeSceneKitDiskDraft } from "./crashSceneKitStore";

const BOOKEND_SFX = {
  intro: [
    { id: "sfx_intro_theme", label: "Theme sting", notes: "Opening hit" },
    { id: "sfx_intro_whoosh", label: "Title whoosh", notes: "" },
  ],
  outro: [{ id: "sfx_outro_sting", label: "Sting out", notes: "" }],
};

const BOOKEND_SFX_PROMPTS: Record<string, string> = {
  sfx_intro_theme:
    "Short upbeat theme sting, comedic TV opener, dry mix, not Hollywood",
  sfx_intro_whoosh: "Title card whoosh, quick airy swoosh into logo",
  sfx_outro_sting: "Comedic sting out, short descending notes, end credits bump",
};

function styleBookendPrompts(styleId: ShowStyleId): {
  introPrompt: string;
  outroPrompt: string;
} {
  switch (styleId) {
    case "sunny_banks":
      return {
        introPrompt:
          "SUNNY BANKS caravan park title sign, rubbery adult cartoon, thick black outlines, sun-bleached Aussie palette, dusty ochre, faded teal, heat haze, no people",
        outroPrompt:
          "THE END title card, same Sunny Banks cel cartoon look, sun-bleached palette, no people",
      };
    case "skidmarks":
      return {
        introPrompt:
          "SKIDMARKS title card, stylised 3D animated feature render, nasty English comedy, dirty pub mood, overcast grey daylight, no people",
        outroPrompt:
          "THE END title card, same SKIDMARKS stylised 3D feature look, overcast, no people",
      };
    case "doc":
      return {
        introPrompt:
          "Documentary series title card, neutral interview wall, natural window light, shallow depth of field, no people",
        outroPrompt:
          "THE END documentary credits card, same interview look, no people",
      };
    default:
      return { introPrompt: "Title card, cinematic, no people", outroPrompt: "THE END title card, no people" };
  }
}

function styleBookendTitles(styleId: ShowStyleId): {
  introTitle: string;
  outroTitle: string;
} {
  switch (styleId) {
    case "sunny_banks":
      return {
        introTitle: "Sunny Banks — intro",
        outroTitle: "Credits — outro",
      };
    case "skidmarks":
      return {
        introTitle: "Skidmarks — intro",
        outroTitle: "Credits — outro",
      };
    case "doc":
      return {
        introTitle: "Documentary — intro",
        outroTitle: "Credits — outro",
      };
    default:
      return { introTitle: "Intro", outroTitle: "Outro" };
  }
}

export type ParsedPromptShot = {
  title: string;
  placeName: string;
  placeKey: string;
  cast: string[];
  plateNote: string;
  lines: { speaker: string; text: string }[];
  sfx: { label: string; prompt: string }[];
};

export type ParsedPromptScript = {
  campaignLabel: string;
  gagNote: string;
  shots: ParsedPromptShot[];
};

export function resolvePlaceKey(styleId: ShowStyleId, placeName: string): string {
  const manifest = readWorldCardManifest(styleId);
  const want = placeName.trim().toLowerCase();
  for (const [key, label] of Object.entries(manifest)) {
    if (label.name.trim().toLowerCase() === want) return key;
  }
  for (const [key, label] of Object.entries(manifest)) {
    if (
      label.name.toLowerCase().includes(want) ||
      want.includes(label.name.toLowerCase())
    ) {
      return key;
    }
  }
  throw new Error(
    `Unknown place "${placeName}" for ${styleId}. Check World cards names.`,
  );
}

function parseField(line: string, key: string): string | null {
  const re = new RegExp(`^${key}\\s*:\\s*(.+)$`, "i");
  const m = line.trim().match(re);
  return m ? m[1].trim() : null;
}

function normalizePromptScript(raw: string, styleId: ShowStyleId): string {
  const extra = liveCastRoster(styleId).map((c) => c.name);
  return normalizePromptScriptBase(raw, extra);
}

function splitShotBlocks(text: string): string[] {
  const parts = text.split(/(?:^|\n)---\s*SHOT\s+\d+\s*---\s*\n?/im);
  if (parts.length > 1) return parts.slice(1).map((p) => p.trim()).filter(Boolean);
  const alt = text.split(/(?:^|\n)---\s*SHOT\s+\d+\s*---/im);
  if (alt.length > 1) return alt.slice(1).map((p) => p.trim()).filter(Boolean);
  return [];
}

/** Parse pasted PROMPT script into structured shots. */
export function parsePromptScript(
  raw: string,
  styleId: ShowStyleId,
): ParsedPromptScript {
  const text = normalizePromptScript(raw, styleId);
  if (!text) throw new Error("Script is empty");

  let campaignLabel = "";
  let gagNote = "";
  const epMatch = text.match(/^EPISODE:\s*(.+?)(?:\n|$)/im);
  const gagMatch = text.match(/^GAG:\s*(.+?)(?:\n|$)/im);
  if (epMatch) campaignLabel = epMatch[1].trim();
  if (gagMatch) gagNote = gagMatch[1].trim();

  if (!campaignLabel) {
    for (const line of text.split("\n")) {
      const ep = parseField(line, "EPISODE");
      if (ep) campaignLabel = ep;
      const gag = parseField(line, "GAG");
      if (gag) gagNote = gag;
    }
  }
  if (!campaignLabel) {
    throw new Error('Need EPISODE: line at the top (e.g. EPISODE: Laundry meltdown)');
  }

  const castKeys = cursorCastKeys(styleId);
  const blocks = splitShotBlocks(text);
  if (!blocks.length) {
    throw new Error("Need at least one --- SHOT 1 --- block");
  }
  if (blocks.length > 6) {
    throw new Error(
      "Max 6 story shots (+ intro/outro are automatic). Found too many SHOT blocks.",
    );
  }

  const shots: ParsedPromptShot[] = [];
  blocks.forEach((block, idx) => {
    let body = block;
    if (!body.includes("\n") && /Title:/i.test(body)) {
      body = normalizePromptScript(body, styleId);
    }
    const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
    let title = `Shot ${idx + 1}`;
    let placeName = "";
    let cast: string[] = [];
    let plateNote = "";
    const dialogue: { speaker: string; text: string }[] = [];
    let sfxRaw = "";

    for (const line of lines) {
      const t = parseField(line, "Title");
      if (t) {
        title = t;
        continue;
      }
      const p = parseField(line, "Place");
      if (p) {
        placeName = p;
        continue;
      }
      const c = parseField(line, "Cast");
      if (c) {
        cast = c.split(",").map((s) => s.trim()).filter(Boolean);
        continue;
      }
      const pl = parseField(line, "Plate");
      if (pl) {
        plateNote = pl;
        continue;
      }
      const sfx = parseField(line, "SFX");
      if (sfx) {
        sfxRaw = sfx;
        continue;
      }
      const dial = line.match(/^([^:]+):\s*(.+)$/);
      if (dial && !/^(title|place|cast|plate|sfx)$/i.test(dial[1].trim())) {
        dialogue.push({ speaker: dial[1].trim(), text: dial[2].trim() });
      }
    }

    if (!placeName) throw new Error(`SHOT ${idx + 1}: missing Place:`);
    if (!cast.length) throw new Error(`SHOT ${idx + 1}: missing Cast:`);
    if (!plateNote) throw new Error(`SHOT ${idx + 1}: missing Plate:`);
    if (!dialogue.length) {
      throw new Error(`SHOT ${idx + 1}: need at least one Speaker: line`);
    }

    for (const name of cast) {
      if (!castKeys[name]) {
        throw new Error(
          `SHOT ${idx + 1}: unknown cast "${name}" for ${styleId}`,
        );
      }
    }

    const placeKey = resolvePlaceKey(styleId, placeName);
    const sfxParts = sfxRaw
      ? sfxRaw.split("|").map((s) => s.trim()).filter(Boolean)
      : [];
    const sfx =
      sfxParts.length >= 2
        ? sfxParts.slice(0, 2).map((label) => ({ label, prompt: label }))
        : sfxParts.length === 1
          ? [
              { label: sfxParts[0], prompt: sfxParts[0] },
              { label: "Room tone", prompt: "Quiet room tone, dry mix" },
            ]
          : [
              { label: "Ambient hit", prompt: "Short ambient room tone" },
              { label: "Comedic hit", prompt: "Single dry comedic hit" },
            ];

    shots.push({
      title,
      placeName,
      placeKey,
      cast,
      plateNote,
      lines: dialogue,
      sfx,
    });
  });

  return { campaignLabel, gagNote, shots };
}

export type PromptTourPerson = {
  name: string;
  thumbKey: string;
  url: string;
};

export function promptTourKit(
  styleId: ShowStyleId,
  parsed: ParsedPromptScript,
): {
  arsehole: PromptTourPerson;
  cast: PromptTourPerson[];
  places: PromptTourPerson[];
} {
  const keys = cursorCastKeys(styleId);
  const seenCast = new Set<string>();
  const castNames: string[] = [];
  for (const sh of parsed.shots) {
    for (const n of sh.cast) {
      if (seenCast.has(n)) continue;
      seenCast.add(n);
      castNames.push(n);
    }
  }
  if (!castNames.length) throw new Error("Script has no Cast: names");
  const person = (name: string): PromptTourPerson => {
    const thumbKey = keys[name];
    if (!thumbKey) {
      throw new Error(`No gallery face for "${name}" in ${styleId}`);
    }
    return {
      name,
      thumbKey,
      url: `/api/crash/style-cards/file?styleId=${encodeURIComponent(styleId)}&thumb=${encodeURIComponent(thumbKey)}`,
    };
  };
  const arsehole = person(castNames[0]!);
  const cast = castNames.slice(1).map(person);
  const seenPlace = new Set<string>();
  const places: PromptTourPerson[] = [];
  for (const sh of parsed.shots) {
    if (seenPlace.has(sh.placeKey)) continue;
    seenPlace.add(sh.placeKey);
    places.push({
      name: sh.placeName,
      thumbKey: sh.placeKey,
      url: `/api/crash/world-cards/file?styleId=${encodeURIComponent(styleId)}&thumb=${encodeURIComponent(sh.placeKey)}`,
    });
  }
  return { arsehole, cast, places };
}

function shotPrefix(idx: number): string {
  return `pr${idx + 1}`;
}

export function buildPromptStoryAndConfig(
  parsed: ParsedPromptScript,
  styleId: ShowStyleId,
): { story: CrashStoryDoc; config: CursorPopulateConfig } {
  const bookends = styleBookendTitles(styleId);
  const prompts = styleBookendPrompts(styleId);
  const sfxPrompts: Record<string, string> = { ...BOOKEND_SFX_PROMPTS };

  const scenes = parsed.shots.map((sh, idx) => {
    const sid = `shot_${shotPrefix(idx)}`;
    const sfxRows: CrashStorySfx[] = sh.sfx.map((row, si) => {
      const id = `sfx_${shotPrefix(idx)}_${si + 1}`;
      sfxPrompts[id] = row.prompt;
      return { id, label: row.label, notes: row.prompt };
    });
    return {
      id: sortableId("scene"),
      title: sh.title,
      placeName: sh.placeName,
      worldThumbKey: sh.placeKey,
      shots: [
        {
          id: sid,
          title: sh.title,
          summary: sh.plateNote.slice(0, 120),
          staging: sh.plateNote,
          plateFile: "",
          beats: sh.lines.map((line, bi) => ({
            id: `beat_${shotPrefix(idx)}_${bi + 1}`,
            speaker: line.speaker,
            text: line.text,
          })),
          sfx: sfxRows,
        },
      ],
    };
  });

  const shotPlans = parsed.shots.map((sh, idx) => ({
    shotId: `shot_${shotPrefix(idx)}`,
    placeKey: sh.placeKey,
    placeName: sh.placeName,
    cast: sh.cast,
    note: sh.plateNote,
  }));

  const story: CrashStoryDoc = {
    styleId,
    campaignLabel: parsed.campaignLabel,
    gagNote: parsed.gagNote,
    intro: {
      title: bookends.introTitle,
      notes: "Title card + theme sting.",
      logoFile: "",
      sfx: BOOKEND_SFX.intro.map((r) => ({ ...r })),
    },
    outro: {
      title: bookends.outroTitle,
      notes: "Roll credits + sting out.",
      logoFile: "",
      sfx: BOOKEND_SFX.outro.map((r) => ({ ...r })),
    },
    scenes,
    updatedAt: new Date().toISOString(),
  };

  const config: CursorPopulateConfig = {
    styleId,
    shotPlans,
    sfxPrompts,
    introPrompt: prompts.introPrompt,
    outroPrompt: prompts.outroPrompt,
  };

  return { story, config };
}

export function bootstrapPromptStory(
  styleId: ShowStyleId,
  script: string,
): {
  story: CrashStoryDoc;
  backupFile: string | null;
  nextFolderName: string;
  nextNumber: number;
  campaignLabel: string;
  folderName: string;
  kit: ReturnType<typeof promptTourKit>;
  sceneKit: ReturnType<typeof writeSceneKitDiskDraft>;
} {
  const parsed = parsePromptScript(script, styleId);
  const pack = createCursorEpisodePack({
    styleId,
    baseLabel: parsed.campaignLabel,
    cursorPrefix: false,
  });
  const { story, config } = buildPromptStoryAndConfig(parsed, styleId);
  story.campaignLabel = pack.folderName;
  const backupFile = backupCrashStory(styleId);
  writeCrashStory(story);
  writePromptPopulateConfig(styleId, story.campaignLabel, config);
  const kit = promptTourKit(styleId, parsed);
  const sceneKit = writeSceneKitDiskDraft({
    sceneId: "scene_01",
    sceneTitle: "Scene 01",
    styleId,
    arseholeKey: kit.arsehole.thumbKey,
    castKeys: kit.cast.map((c) => c.thumbKey),
    castSlotCount: Math.max(4, kit.cast.length),
    worldKeys: kit.places.map((p) => p.thumbKey),
    placeSlotCount: Math.max(4, kit.places.length),
    activePlaceIndex: 0,
    plateFiles: [],
    plateSlotCount: 1,
  });

  const nextNumber = peekNextCampaignNumber(styleId);
  const nextFolderName = pack.folderName;

  return {
    story,
    backupFile,
    nextFolderName,
    nextNumber,
    campaignLabel: parsed.campaignLabel,
    folderName: pack.folderName,
    kit,
    sceneKit,
  };
}

export function promptArchivePreview(
  styleId: ShowStyleId,
  campaignLabel?: string,
): {
  highestNumber: number;
  nextNumber: number;
  nextFolderName: string | null;
} {
  const highestNumber = peekNextCampaignNumber(styleId) - 1;
  const nextNumber = peekNextCampaignNumber(styleId);
  const slug = campaignLabel ? campaignBaseSlug(campaignLabel) : null;
  return {
    highestNumber,
    nextNumber,
    nextFolderName: slug
      ? allocateNumberedCampaignFolder(styleId, slug)
      : null,
  };
}
