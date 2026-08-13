import fs from "fs";
import path from "path";
import {
  crashLabRoot,
  episodeFolderName,
  episodePackDir,
} from "./crashLabEpisodes";
import {
  writeActivePack,
  clearActivePack,
  readActivePack,
} from "./crashActivePack";
import type { CrashStoryDoc } from "./crashStoryTypes";
import { writeCrashStory } from "./crashStory";
import {
  writeSceneKitDiskDraft,
  type SceneKitDiskDraft,
} from "./crashSceneKitStore";
import type { ShowStyleId } from "./showStylePresets";
import { CURSOR_ORIGINAL_ARSEHOLE } from "./cursorOriginalKit";
import { newId } from "./types";

function emptyCursorStory(styleId: ShowStyleId, label: string): CrashStoryDoc {
  return {
    styleId,
    campaignLabel: label,
    gagNote: "CURSOR original build — watch each step, then Proceed.",
    intro: {
      title: label,
      notes: "Title card later.",
      logoFile: "",
      sfx: [],
    },
    outro: {
      title: "Credits",
      notes: "Credits later.",
      logoFile: "",
      sfx: [],
    },
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

function emptyKit(styleId: ShowStyleId): SceneKitDiskDraft {
  return {
    sceneId: "scene_01",
    sceneTitle: "Scene 01",
    styleId,
    arseholeKey: "",
    castKeys: [],
    castSlotCount: 4,
    worldKeys: [],
    placeSlotCount: 4,
    activePlaceIndex: 0,
    plateFiles: [],
    plateSlotCount: 1,
  };
}

/** New CURSOR_??? pack under _CRASH_LAB — never touches EP packs. */
export function createCursorEpisodePack(opts: {
  styleId: ShowStyleId;
  baseLabel?: string;
  /** Default true — Cursor button. Prompt Go uses false (episode title). */
  cursorPrefix?: boolean;
}): {
  folderName: string;
  path: string;
  story: CrashStoryDoc;
  sceneKit: SceneKitDiskDraft;
} {
  const base =
    opts.baseLabel?.trim() ||
    `CURSOR_${CURSOR_ORIGINAL_ARSEHOLE.name.replace(/\s+/g, "_").toUpperCase()}`;
  const prefix = opts.cursorPrefix !== false;
  let folderName = episodeFolderName(
    prefix && !base.startsWith("CURSOR_") ? `CURSOR_${base}` : base,
  );
  let dir = episodePackDir(folderName, opts.styleId);
  let n = 2;
  while (fs.existsSync(dir)) {
    folderName = episodeFolderName(`${base}_${n}`);
    dir = episodePackDir(folderName, opts.styleId);
    n += 1;
  }

  clearActivePack();

  for (const sub of [
    "_RECIPE",
    "audio",
    "plates",
    "mp4",
    path.join("images", "characters"),
    path.join("images", "places"),
  ]) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }

  const story = emptyCursorStory(opts.styleId, folderName);
  const sceneKit = emptyKit(opts.styleId);

  fs.writeFileSync(
    path.join(dir, "_RECIPE", "story.json"),
    JSON.stringify(story, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(dir, "_RECIPE", "scene-kit.json"),
    JSON.stringify(sceneKit, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(dir, "_RECIPE", "episode.json"),
    JSON.stringify(
      {
        label: folderName,
        styleId: opts.styleId,
        folderName,
        savedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
  fs.writeFileSync(
    path.join(dir, "_RECIPE", "WHERE_FILES_LIVE.txt"),
    [
      "CURSOR pack — copy-only.",
      "",
      "plates\\",
      "audio\\",
      "mp4\\",
      "images\\characters\\",
      "images\\places\\",
      "_RECIPE\\",
      "",
      `Root: ${crashLabRoot(opts.styleId)}`,
    ].join("\n"),
  );

  writeActivePack({ folderName, styleId: opts.styleId });
  writeCrashStory(story);
  writeSceneKitDiskDraft(sceneKit);

  return { folderName, path: dir, story, sceneKit };
}

/** Re-open an existing CURSOR pack (resume after face gens). Never touches EP. */
export function resumeCursorEpisodePack(opts: {
  styleId: ShowStyleId;
  folderName: string;
}): {
  folderName: string;
  path: string;
  story: CrashStoryDoc;
  sceneKit: SceneKitDiskDraft;
  resumed: true;
} {
  const folderName = episodeFolderName(opts.folderName);
  if (!folderName.startsWith("CURSOR_")) {
    throw new Error("Resume only works on CURSOR_ packs");
  }
  const dir = episodePackDir(folderName, opts.styleId);
  if (!fs.existsSync(dir)) {
    throw new Error(`Pack not found: ${folderName}`);
  }
  const recipe = path.join(dir, "_RECIPE");
  const kitPath = path.join(recipe, "scene-kit.json");
  const storyPath = path.join(recipe, "story.json");
  let sceneKit: SceneKitDiskDraft = emptyKit(opts.styleId);
  if (fs.existsSync(kitPath)) {
    try {
      sceneKit = {
        ...emptyKit(opts.styleId),
        ...(JSON.parse(fs.readFileSync(kitPath, "utf8")) as SceneKitDiskDraft),
        styleId: opts.styleId,
      };
    } catch {
      /* keep empty */
    }
  }
  let story: CrashStoryDoc = emptyCursorStory(opts.styleId, folderName);
  if (fs.existsSync(storyPath)) {
    try {
      const raw = fs.readFileSync(storyPath, "utf8");
      const cut = raw.lastIndexOf("}");
      story = JSON.parse(raw.slice(0, cut + 1)) as CrashStoryDoc;
    } catch {
      /* keep empty */
    }
  }
  writeActivePack({ folderName, styleId: opts.styleId });
  writeCrashStory(story);
  writeSceneKitDiskDraft(sceneKit);
  return {
    folderName,
    path: dir,
    story,
    sceneKit,
    resumed: true,
  };
}

/** Copy a gallery still into the open CURSOR pack images folder. */
export function mirrorStillIntoActiveCursorPack(opts: {
  kind: "face" | "place";
  srcPath: string;
  fileName: string;
}): string | null {
  const active = readActivePack();
  if (!active?.folderName?.startsWith("CURSOR_")) return null;
  const pack = episodePackDir(active.folderName, active.styleId);
  const destDir =
    opts.kind === "place"
      ? path.join(pack, "images", "places")
      : path.join(pack, "images", "characters");
  fs.mkdirSync(destDir, { recursive: true });
  const safe = path.basename(opts.fileName).replace(/[^\w.\-]/g, "");
  if (!safe) return null;
  const dest = path.join(destDir, safe);
  fs.copyFileSync(opts.srcPath, dest);
  return dest;
}
