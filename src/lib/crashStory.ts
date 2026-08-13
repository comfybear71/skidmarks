import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import type {
  CrashStoryDoc,
  CrashStoryScene,
} from "./crashStoryTypes";
import { newId } from "./types";
import type { ShowStyleId } from "./showStylePresets";
import { pickNextCursorGag, remainingCursorGags } from "./cursorGagCatalog";
import {
  activePackStoryPath,
  clearActivePack,
  readActivePack,
} from "./crashActivePack";

export type {
  CrashStoryBeat,
  CrashStoryBookend,
  CrashStoryDoc,
  CrashStoryScene,
  CrashStoryShot,
  CrashStorySfx,
} from "./crashStoryTypes";
export { sceneIsFilled } from "./crashStoryTypes";

function studioStoryRoot(styleId: ShowStyleId): string {
  return path.join(CRASH_DIR, "story", styleId);
}

function storyRoot(styleId: ShowStyleId): string {
  const active = readActivePack();
  if (active?.styleId === styleId) {
    const packStory = activePackStoryPath();
    if (packStory) return path.dirname(packStory);
  }
  return studioStoryRoot(styleId);
}

function storyFilePath(styleId: ShowStyleId): string {
  const active = readActivePack();
  if (active?.styleId === styleId) {
    const packStory = activePackStoryPath();
    if (packStory) return packStory;
  }
  return path.join(studioStoryRoot(styleId), "story.json");
}

function studioStoryFilePath(styleId: ShowStyleId): string {
  return path.join(studioStoryRoot(styleId), "story.json");
}

export function sunnyBanksTestGagSeed(): CrashStoryDoc {
  return {
    styleId: "sunny_banks",
    campaignLabel: "Test campaign #1",
    gagNote:
      "Nuggets = alien. Gibberish only. Only Ranger Bazza understands and translates.",
    intro: {
      title: "Sunny Banks — intro",
      notes: "Title card + theme sting. Generate plate + audio later.",
      sfx: [
        { id: "sfx_intro_theme", label: "Theme sting", notes: "Opening hit" },
        { id: "sfx_intro_whoosh", label: "Title whoosh", notes: "" },
      ],
    },
    outro: {
      title: "Credits — outro",
      notes: "Roll credits + sting out.",
      sfx: [{ id: "sfx_outro_sting", label: "Sting out", notes: "" }],
    },
    scenes: [
      {
        id: "scene_1",
        title: "Scene 1",
        placeName: "Caravan park",
        worldThumbKey: "",
        shots: [
          {
            id: "shot_1",
            title: "Wide — nobody gets Nuggets",
            summary: "Nuggets panicking at Dazza & Shazza",
            plateFile: "",
            beats: [
              {
                id: "beat_1_1",
                speaker: "Nuggets",
                text: "Skree-boop wah-doo nee-yah!",
              },
              {
                id: "beat_1_2",
                speaker: "Shazza",
                text: "No idea what you're saying, love.",
              },
              {
                id: "beat_1_3",
                speaker: "Dazza",
                text: "Reckon it's fine.",
              },
            ],
            sfx: [
              { id: "sfx_1_1", label: "Alien chirp", notes: "Nuggets emphasis" },
              {
                id: "sfx_1_2",
                label: "Park ambience",
                notes: "Caravan park bed",
              },
            ],
          },
          {
            id: "shot_2",
            title: "Bazza rolls in — translator",
            summary: "Ranger understands Nuggets",
            plateFile: "",
            beats: [
              {
                id: "beat_2_1",
                speaker: "Nuggets",
                text: "Nee-yah skrit wah-wah!",
              },
              {
                id: "beat_2_2",
                speaker: "Ranger Bazza",
                text: "He says Unit 9's annex is breaching park by-laws. Again.",
              },
              {
                id: "beat_2_3",
                speaker: "Dazza",
                text: "Sweet.",
              },
            ],
            sfx: [
              { id: "sfx_2_1", label: "Ute on gravel", notes: "" },
              { id: "sfx_2_2", label: "Clipboard slap", notes: "" },
            ],
          },
          {
            id: "shot_3",
            title: "Insane fix",
            summary: "Dazza deploys junk invention — makes it worse",
            plateFile: "",
            beats: [
              {
                id: "beat_3_1",
                speaker: "Dazza",
                text: "Hold my beer.",
              },
              {
                id: "beat_3_2",
                speaker: "Nuggets",
                text: "Wah-wah skree-boop nah!",
              },
              {
                id: "beat_3_3",
                speaker: "Ranger Bazza",
                text: "He says that's worse.",
              },
            ],
            sfx: [
              { id: "sfx_3_1", label: "Ray-gun zap", notes: "" },
              { id: "sfx_3_2", label: "Something breaks", notes: "" },
            ],
          },
          {
            id: "shot_4",
            title: "Nan button",
            summary: "Nan unbothered — one line",
            plateFile: "",
            beats: [
              {
                id: "beat_4_1",
                speaker: "Nan",
                text: "One line — deadpan destroyer. (write it)",
              },
            ],
            sfx: [
              { id: "sfx_4_1", label: "Cricket bat tap", notes: "" },
              { id: "sfx_4_2", label: "Tea sip", notes: "" },
            ],
          },
        ],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

/** Fresh Skidmarks gag — CrackWhore Darryl at the Dirty Dog Pub. */
export function cursorSkidmarksDarrylGagSeed(): CrashStoryDoc {
  return {
    styleId: "skidmarks",
    campaignLabel: "Cursor gag — Darryl at the Dog",
    gagNote:
      "Darryl mansplains the pub. Kim is not impressed. Garry is collateral damage. One humiliation button.",
    intro: {
      title: "Skidmarks — intro",
      notes: "Title card + theme sting.",
      logoFile: "",
      sfx: [
        { id: "sfx_intro_theme", label: "Theme sting", notes: "Opening hit" },
        { id: "sfx_intro_whoosh", label: "Title whoosh", notes: "" },
      ],
    },
    outro: {
      title: "Credits — outro",
      notes: "Roll credits + sting out.",
      logoFile: "",
      sfx: [{ id: "sfx_outro_sting", label: "Sting out", notes: "" }],
    },
    scenes: [
      {
        id: "scene_cursor_d1",
        title: "Scene 1",
        placeName: "Dirty Dog Pub",
        worldThumbKey: "",
        shots: [
          {
            id: "shot_d1",
            title: "Wide — Darryl arrives",
            summary: "Darryl bursts into the pub like he owns it",
            plateFile: "",
            beats: [
              {
                id: "beat_d1_1",
                speaker: "CrackWhore Darryl",
                text: "Right. Who's running this shithole?",
              },
              {
                id: "beat_d1_2",
                speaker: "Kim the Gypsy KUNT",
                text: "You want a pint or a lecture?",
              },
              {
                id: "beat_d1_3",
                speaker: "Garry Crump",
                text: "He's only here for the lecture.",
              },
            ],
            sfx: [
              { id: "sfx_d1_1", label: "Pub door slam", notes: "" },
              { id: "sfx_d1_2", label: "Pub ambience", notes: "" },
            ],
          },
          {
            id: "shot_d2",
            title: "Mansplain at the bar",
            summary: "Darryl explains women and pubs",
            plateFile: "",
            beats: [
              {
                id: "beat_d2_1",
                speaker: "CrackWhore Darryl",
                text: "Women don't understand pubs. It's science.",
              },
              {
                id: "beat_d2_2",
                speaker: "Kim the Gypsy KUNT",
                text: "Pour your own, then.",
              },
            ],
            sfx: [
              { id: "sfx_d2_1", label: "Bar tap", notes: "" },
              { id: "sfx_d2_2", label: "Long sigh", notes: "" },
            ],
          },
          {
            id: "shot_d3",
            title: "Fake corporate win",
            summary: "Darryl wears a cheap lanyard",
            plateFile: "",
            beats: [
              {
                id: "beat_d3_1",
                speaker: "CrackWhore Darryl",
                text: "Corporate respects my leadership.",
              },
              {
                id: "beat_d3_2",
                speaker: "Garry Crump",
                text: "That's a lanyard from Bunnings.",
              },
            ],
            sfx: [
              { id: "sfx_d3_1", label: "Lanyard click", notes: "" },
              { id: "sfx_d3_2", label: "Office hum", notes: "" },
            ],
          },
          {
            id: "shot_d4",
            title: "Humiliation button",
            summary: "Darryl finally cracks",
            plateFile: "",
            beats: [
              {
                id: "beat_d4_1",
                speaker: "CrackWhore Darryl",
                text: "Still a win for blokes.",
              },
            ],
            sfx: [
              { id: "sfx_d4_1", label: "Handbag thwack", notes: "" },
              { id: "sfx_d4_2", label: "Bus brakes", notes: "" },
            ],
          },
        ],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

/** Fresh gag for CURSOR tour — backs up your old story.json first. */
export function cursorSunnyBanksGagSeed(): CrashStoryDoc {
  return {
    styleId: "sunny_banks",
    campaignLabel: "Cursor gag — The pool inspection",
    gagNote:
      "Dazza's illegal pool. Nuggets thinks it's a mothership landing pad. Bazza translates. Nan ends it.",
    intro: {
      title: "Sunny Banks — intro",
      notes: "Title card + theme sting.",
      logoFile: "",
      sfx: [
        { id: "sfx_intro_theme", label: "Theme sting", notes: "Opening hit" },
        { id: "sfx_intro_whoosh", label: "Title whoosh", notes: "" },
      ],
    },
    outro: {
      title: "Credits — outro",
      notes: "Roll credits + sting out.",
      logoFile: "",
      sfx: [{ id: "sfx_outro_sting", label: "Sting out", notes: "" }],
    },
    scenes: [
      {
        id: "scene_cursor_1",
        title: "Scene 1",
        placeName: "Unit 9 — dodgy pool",
        worldThumbKey: "",
        shots: [
          {
            id: "shot_p1",
            title: "Wide — illegal pool panic",
            summary: "Nuggets melting down at Dazza's dodgy pool",
            plateFile: "",
            beats: [
              {
                id: "beat_p1_1",
                speaker: "Nuggets",
                text: "Skree-boop wah-doo nee-yah!",
              },
              {
                id: "beat_p1_2",
                speaker: "Shazza",
                text: "He's not asking about the pool, Dazza.",
              },
              {
                id: "beat_p1_3",
                speaker: "Dazza",
                text: "Reckon we're sweet.",
              },
            ],
            sfx: [
              { id: "sfx_p1_1", label: "Alien chirp", notes: "Nuggets panic" },
              { id: "sfx_p1_2", label: "Pool splash", notes: "Dodgy pool" },
            ],
          },
          {
            id: "shot_p2",
            title: "Bazza translates",
            summary: "Ranger office — clipboard authority",
            plateFile: "",
            beats: [
              {
                id: "beat_p2_1",
                speaker: "Nuggets",
                text: "Nee-yah skrit wah-wah!",
              },
              {
                id: "beat_p2_2",
                speaker: "Ranger Bazza",
                text: "He says the mothership demands you drain it by sundown.",
              },
              {
                id: "beat_p2_3",
                speaker: "Shazza",
                text: "Tell him it's a puddle.",
              },
            ],
            sfx: [
              { id: "sfx_p2_1", label: "Ute on gravel", notes: "" },
              { id: "sfx_p2_2", label: "Clipboard slap", notes: "" },
            ],
          },
          {
            id: "shot_p3",
            title: "Insane fix — blue tarp",
            summary: "Dazza hides the pool with a tarp",
            plateFile: "",
            beats: [
              {
                id: "beat_p3_1",
                speaker: "Dazza",
                text: "Hold my beer. I'll camouflage it.",
              },
              {
                id: "beat_p3_2",
                speaker: "Nuggets",
                text: "Wah-wah skree-boop nah!",
              },
              {
                id: "beat_p3_3",
                speaker: "Ranger Bazza",
                text: "He says that's a blue tarp, not a wetland.",
              },
            ],
            sfx: [
              { id: "sfx_p3_1", label: "Tarp flap", notes: "Wind" },
              { id: "sfx_p3_2", label: "Plastic snap", notes: "Tarp peg" },
            ],
          },
          {
            id: "shot_p4",
            title: "Nan button",
            summary: "Nan unbothered — one line",
            plateFile: "",
            beats: [
              {
                id: "beat_p4_1",
                speaker: "Nan",
                text: "It's two inches deep, love. Even I won't drown in that.",
              },
            ],
            sfx: [
              { id: "sfx_p4_1", label: "Cricket bat tap", notes: "" },
              { id: "sfx_p4_2", label: "Tea sip", notes: "" },
            ],
          },
        ],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function backupCrashStory(styleId: ShowStyleId): string | null {
  const fp = storyFilePath(styleId);
  if (!fs.existsSync(fp)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backup = path.join(storyRoot(styleId), `story_backup_${stamp}.json`);
  fs.copyFileSync(fp, backup);
  return backup;
}

/** True when intro/outro cards + every shot have plates on disk. */
export function crashStoryIsPopulated(styleId: ShowStyleId): boolean {
  const story = readCrashStory(styleId);
  const gen = path.join(CRASH_DIR, "gen");
  const fileOk = (name: string) =>
    Boolean(name && fs.existsSync(path.join(gen, name)));

  if (!fileOk(story.intro.logoFile || "")) return false;
  if (!fileOk(story.outro.logoFile || "")) return false;
  for (const sc of story.scenes) {
    for (const sh of sc.shots) {
      if (!fileOk(sh.plateFile)) return false;
    }
  }
  return story.scenes.some((sc) => sc.shots.length > 0);
}

/** Copy current story to backup file, then write fresh Cursor gag (next un-archived episode). */
export function bootstrapCursorStory(styleId: ShowStyleId): {
  story: CrashStoryDoc;
  backupFile: string | null;
  gagLabel: string | null;
  error?: string;
} {
  const backupFile = backupCrashStory(styleId);
  const entry = pickNextCursorGag(styleId);
  if (!entry) {
    const left = remainingCursorGags(styleId);
    return {
      story: readCrashStory(styleId),
      backupFile,
      gagLabel: null,
      error:
        left === 0 && backupFile
          ? `No new test gags left for ${styleId} — all already saved on disk.`
          : `No Cursor test gag for ${styleId}.`,
    };
  }
  const story = entry.seed();
  writeCrashStory(story);
  return { story, backupFile, gagLabel: entry.campaignLabel };
}

function emptyStory(styleId: ShowStyleId): CrashStoryDoc {
  return {
    styleId,
    campaignLabel: "",
    gagNote: "",
    intro: { title: "Intro", notes: "", sfx: [] },
    outro: { title: "Outro", notes: "", sfx: [] },
    scenes: [
      {
        id: newId("scene"),
        title: "Scene 1",
        placeName: "",
        worldThumbKey: "",
        shots: [
          {
            id: newId("shot"),
            title: "Shot 1",
            summary: "",
            plateFile: "",
            beats: [{ id: newId("beat"), speaker: "", text: "" }],
            sfx: [],
          },
        ],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

/** data/crash/story/{show}/_cleared/{stamp}/ — never delete media. */
function storyClearedDir(styleId: ShowStyleId): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const d = path.join(storyRoot(styleId), "_cleared", stamp);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** Move every file out of a folder into dest (subfolder name preserves source). */
function quarantineFolderFiles(
  srcDir: string,
  destRoot: string,
  subName: string,
): string[] {
  if (!fs.existsSync(srcDir)) return [];
  const moved: string[] = [];
  const destDir = path.join(destRoot, subName);
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    if (name.includes("..")) continue;
    const src = path.join(srcDir, name);
    let st: fs.Stats;
    try {
      st = fs.statSync(src);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    let dest = path.join(destDir, name);
    if (fs.existsSync(dest)) {
      dest = path.join(destDir, `${Date.now()}_${name}`);
    }
    try {
      fs.renameSync(src, dest);
    } catch {
      // Cross-drive / lock — copy first so bytes survive
      fs.copyFileSync(src, dest);
      try {
        fs.unlinkSync(src);
      } catch {
        /* leave original if locked — duplicate beats a wipe */
      }
    }
    moved.push(`${subName}/${path.basename(dest)}`);
  }
  return moved;
}

/**
 * Wipe current show story to a blank scene/shot.
 * If a _CRASH_LAB pack is open: clear the "open" pointer only — pack audio stays.
 * Studio dialogue leftovers park in _cleared/ — never deleted.
 * Pack folders under _CRASH_LAB are never touched.
 */
export function clearCrashStory(styleId: ShowStyleId): {
  story: CrashStoryDoc;
  backupFile: string | null;
  moved: string[];
  parkedIn: string;
} {
  const hadPack = Boolean(readActivePack()?.folderName);
  clearActivePack();

  const backupFile = backupCrashStory(styleId);
  const destRoot = storyClearedDir(styleId);
  const dialogueDir = path.join(studioStoryRoot(styleId), "dialogue");
  const legacyAudioDir = path.join(studioStoryRoot(styleId), "audio");
  const moved = hadPack
    ? []
    : [
        ...quarantineFolderFiles(dialogueDir, destRoot, "dialogue"),
        ...quarantineFolderFiles(legacyAudioDir, destRoot, "audio"),
      ];
  const story = emptyStory(styleId);
  fs.mkdirSync(studioStoryRoot(styleId), { recursive: true });
  fs.writeFileSync(
    studioStoryFilePath(styleId),
    JSON.stringify(story, null, 2) + "\n",
  );
  const parkedIn = path
    .relative(CRASH_DIR, destRoot)
    .split(path.sep)
    .join("/");
  return {
    story,
    backupFile,
    moved,
    parkedIn: hadPack
      ? "(pack left intact — desk cleared)"
      : `data/crash/${parkedIn}/`,
  };
}

export function readCrashStory(styleId: ShowStyleId): CrashStoryDoc {
  const fp = storyFilePath(styleId);
  if (fs.existsSync(fp)) {
    try {
      const raw = JSON.parse(fs.readFileSync(fp, "utf8")) as CrashStoryDoc;
      if (raw?.styleId === styleId) return raw;
    } catch {
      /* fall through */
    }
  }

  const seed =
    styleId === "sunny_banks" ? sunnyBanksTestGagSeed() : emptyStory(styleId);
  writeCrashStory(seed);
  return seed;
}

export function writeCrashStory(doc: CrashStoryDoc): void {
  const root = storyRoot(doc.styleId);
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(storyFilePath(doc.styleId), JSON.stringify(doc, null, 2));
}
