import fs from "fs";
import path from "path";
import type { CrashStoryDoc } from "./crashStoryTypes";
import {
  showCampaignDir,
  campaignBaseSlug,
  toShowMoviesPath,
} from "./showArchivePaths";
import { allocateNumberedCampaignFolder } from "./showArchiveServer";
import type { ShowStyleId } from "./showStylePresets";

function copyFileSafe(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDirMerge(srcDir: string, destDir: string): void {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const a = path.join(srcDir, ent.name);
    const b = path.join(destDir, ent.name);
    if (ent.isDirectory()) copyDirMerge(a, b);
    else copyFileSafe(a, b);
  }
}

const MP3_EXT = /\.mp3$/i;
const SKIP_SHOT_FILES = new Set(["stack.txt", "README.txt"]);

/** Flat mp3 + plate in shot root; lift legacy dialogue/ + drop stack.txt cruft. */
function tidyShotArchiveFolder(shotDir: string, archiveRoot: string): void {
  if (!fs.existsSync(shotDir)) return;

  const legacyDialogue = path.join(shotDir, "dialogue");
  if (fs.existsSync(legacyDialogue) && fs.statSync(legacyDialogue).isDirectory()) {
    for (const f of fs.readdirSync(legacyDialogue)) {
      if (MP3_EXT.test(f)) {
        const dest = path.join(shotDir, f);
        if (!fs.existsSync(dest)) {
          copyFileSafe(path.join(legacyDialogue, f), dest);
        }
      }
    }
    const junkRoot = path.join(
      path.dirname(archiveRoot),
      "..",
      "_UNKNOWN",
      "ARCHIVE_OLD_LAYOUT",
      path.basename(archiveRoot),
      path.basename(shotDir),
    );
    const junkDialogue = path.join(junkRoot, "dialogue");
    fs.mkdirSync(path.dirname(junkDialogue), { recursive: true });
    if (!fs.existsSync(junkDialogue)) {
      fs.renameSync(legacyDialogue, junkDialogue);
    }
  }

  for (const f of ["stack.txt"]) {
    const fp = path.join(shotDir, f);
    if (!fs.existsSync(fp)) continue;
    const junkFile = path.join(
      path.dirname(archiveRoot),
      "..",
      "_UNKNOWN",
      "ARCHIVE_OLD_LAYOUT",
      path.basename(archiveRoot),
      path.basename(shotDir),
      f,
    );
    fs.mkdirSync(path.dirname(junkFile), { recursive: true });
    if (!fs.existsSync(junkFile)) fs.renameSync(fp, junkFile);
  }
}

/** One shot folder — flat mp3 + plate; only sfx_for_resolve/ is nested. */
function mirrorShotFolder(shotExport: string, shotArchive: string): void {
  fs.mkdirSync(shotArchive, { recursive: true });

  for (const ent of fs.readdirSync(shotExport, { withFileTypes: true })) {
    const src = path.join(shotExport, ent.name);

    if (ent.isDirectory() && ent.name === "dialogue") {
      for (const f of fs.readdirSync(src)) {
        if (MP3_EXT.test(f)) copyFileSafe(path.join(src, f), path.join(shotArchive, f));
      }
      continue;
    }

    if (ent.isDirectory() && ent.name === "sfx_for_resolve") {
      copyDirMerge(src, path.join(shotArchive, "sfx_for_resolve"));
      continue;
    }

    if (ent.isDirectory()) continue;
    if (SKIP_SHOT_FILES.has(ent.name)) continue;

    copyFileSafe(src, path.join(shotArchive, ent.name));
  }
}

function writeArchiveGuide(archiveRoot: string): void {
  const guide = [
    "Campaign folder — ONE plan, no duplicates",
    "",
    "comfy\\COMFY.md          map — all prompts",
    "comfy\\01_Shot-name\\   plate + mp3 (flat) + sfx_for_resolve\\",
    "story.json",
    "",
    "No stack.txt. No dialogue\\ subfolder.",
  ].join("\r\n");
  fs.writeFileSync(path.join(archiveRoot, "WHERE_FILES_LIVE.txt"), guide, "utf8");
}

/** Copy export + story to MY MOVIES\\_SHOW\\Campaign — copy only, never delete source. */
export function mirrorCampaignToShowArchive(opts: {
  styleId: ShowStyleId;
  story: CrashStoryDoc;
  exportRoot: string;
  comfyMd: string;
  storyJsonSrc: string;
}): { archiveRoot: string | null; archiveRootDisplay: string | null } {
  const baseSlug = campaignBaseSlug(opts.story.campaignLabel || "campaign");
  const folderName = allocateNumberedCampaignFolder(opts.styleId, baseSlug);
  const archiveRoot = showCampaignDir(opts.styleId, folderName);
  if (!archiveRoot) {
    return { archiveRoot: null, archiveRootDisplay: null };
  }

  fs.mkdirSync(archiveRoot, { recursive: true });

  copyFileSafe(opts.storyJsonSrc, path.join(archiveRoot, "story.json"));

  const comfyDir = path.join(archiveRoot, "comfy");
  fs.mkdirSync(comfyDir, { recursive: true });
  copyFileSafe(opts.comfyMd, path.join(comfyDir, "COMFY.md"));

  if (fs.existsSync(opts.exportRoot)) {
    for (const ent of fs.readdirSync(opts.exportRoot, { withFileTypes: true })) {
      if (!ent.isDirectory()) {
        if (ent.name === "README.txt") {
          copyFileSafe(
            path.join(opts.exportRoot, ent.name),
            path.join(comfyDir, ent.name),
          );
        }
        continue;
      }
      mirrorShotFolder(
        path.join(opts.exportRoot, ent.name),
        path.join(comfyDir, ent.name),
      );
      tidyShotArchiveFolder(path.join(comfyDir, ent.name), archiveRoot);
    }
  }

  if (fs.existsSync(comfyDir)) {
    for (const ent of fs.readdirSync(comfyDir, { withFileTypes: true })) {
      if (ent.isDirectory()) {
        tidyShotArchiveFolder(path.join(comfyDir, ent.name), archiveRoot);
      }
    }
  }

  writeArchiveGuide(archiveRoot);

  return {
    archiveRoot,
    archiveRootDisplay: toShowMoviesPath(archiveRoot),
  };
}
