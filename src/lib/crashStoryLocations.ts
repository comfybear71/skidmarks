import fs from "fs";
import path from "path";
import { readCrashStory } from "./crashStory";
import { CRASH_DIR, MOVIES_ROOT } from "./paths";
import {
  showArchiveRoot,
  showCampaignDir,
  campaignBaseSlug,
  toShowMoviesPath,
} from "./showArchivePaths";
import { findLatestNumberedCampaignFolder } from "./showArchiveServer";
import type { ShowStyleId } from "./showStylePresets";
import { activePackAudioDir, readActivePack } from "./crashActivePack";

export type StoryLocationLink = {
  label: string;
  displayPath: string;
  absPath: string;
};

export type StoryLocationPaths = {
  styleId: ShowStyleId;
  campaignLabel: string;
  archiveRoot: string | null;
  storyJson: string | null;
  platesFolder: string | null;
  dialogueFolder: string | null;
  sfxFolder: string | null;
  comfyMd: string | null;
  comfyExportFolder: string | null;
  /** Click-to-open rows with absolute Windows paths */
  links: StoryLocationLink[];
  podLoadDoc: string;
  exportShots: { shotId: string; title: string; folder: string }[];
  studioNote: string;
};

export function storyDialogueDir(styleId: ShowStyleId): string {
  const active = readActivePack();
  if (active && active.styleId === styleId) {
    const packAudio = activePackAudioDir();
    if (packAudio) return packAudio;
  }
  return path.join(CRASH_DIR, "story", styleId, "dialogue");
}

export function storySfxResolveDir(styleId: ShowStyleId): string {
  return path.join(CRASH_DIR, "story", styleId, "sfx_for_resolve");
}

export function getStoryLocations(styleId: ShowStyleId): StoryLocationPaths {
  const podLoadDoc = toShowMoviesPath(
    path.join(
      MOVIES_ROOT,
      "_DOCUMENTS",
      "06_Pod_And_ComfyUI_Setup",
      "02_ComfyUI_Load_Every_Time.md",
    ),
  );

  let campaignLabel = "";
  let archiveRootAbs: string | null = null;
  let exportShots: StoryLocationPaths["exportShots"] = [];

  try {
    const story = readCrashStory(styleId);
    campaignLabel = story.campaignLabel || "";
    const baseSlug = campaignBaseSlug(campaignLabel);
    archiveRootAbs =
      findLatestNumberedCampaignFolder(styleId, baseSlug) ??
      showCampaignDir(styleId, baseSlug);
  } catch {
    /* no story */
  }

  const manifestPath = path.join(
    CRASH_DIR,
    "story",
    styleId,
    "export-manifest.json",
  );
  if (fs.existsSync(manifestPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        archiveRoot?: string;
        exportShots?: StoryLocationPaths["exportShots"];
        campaignLabel?: string;
      };
      if (m.campaignLabel) campaignLabel = m.campaignLabel;
      if (m.archiveRoot && fs.existsSync(m.archiveRoot)) {
        archiveRootAbs = m.archiveRoot;
      }
      exportShots = m.exportShots || [];
    } catch {
      /* ignore */
    }
  }

  const showRoot = showArchiveRoot(styleId);
  const studioNote = showRoot
    ? `Studio working copy (internal): MY MOVIES\\blueprint\\planner\\data\\crash\\story\\${styleId}\\`
    : "";

  if (!archiveRootAbs || !fs.existsSync(archiveRootAbs)) {
    return {
      styleId,
      campaignLabel,
      archiveRoot: null,
      storyJson: null,
      platesFolder: null,
      dialogueFolder: null,
      sfxFolder: null,
      comfyMd: null,
      comfyExportFolder: null,
      links: [],
      podLoadDoc,
      exportShots,
      studioNote,
    };
  }

  const comfyDirAbs = path.join(archiveRootAbs, "comfy");
  const comfyMdAbs = fs.existsSync(path.join(comfyDirAbs, "COMFY.md"))
    ? path.join(comfyDirAbs, "COMFY.md")
    : fs.existsSync(path.join(archiveRootAbs, "COMFY.md"))
      ? path.join(archiveRootAbs, "COMFY.md")
      : null;

  const links: StoryLocationLink[] = [
    {
      label: "Campaign folder",
      displayPath: toShowMoviesPath(archiveRootAbs),
      absPath: archiveRootAbs,
    },
  ];

  return {
    styleId,
    campaignLabel,
    archiveRoot: toShowMoviesPath(archiveRootAbs),
    storyJson: toShowMoviesPath(path.join(archiveRootAbs, "story.json")),
    platesFolder: null,
    dialogueFolder: null,
    sfxFolder: null,
    comfyMd: comfyMdAbs ? toShowMoviesPath(comfyMdAbs) : null,
    comfyExportFolder: toShowMoviesPath(comfyDirAbs),
    links,
    podLoadDoc,
    exportShots,
    studioNote,
  };
}

export function writeExportManifest(
  styleId: ShowStyleId,
  data: {
    exportRoot: string;
    comfyMd: string;
    campaignLabel: string;
    exportShots: { shotId: string; title: string; folder: string }[];
    archiveRoot: string | null;
  },
): void {
  const manifestPath = path.join(
    CRASH_DIR,
    "story",
    styleId,
    "export-manifest.json",
  );
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      { ...data, updatedAt: new Date().toISOString() },
      null,
      2,
    ),
    "utf8",
  );
}

export { toShowMoviesPath };
