import path from "path";
import { existsSync } from "node:fs";
import { isSafeMediaName } from "./cloudMedia";
import { resolveBeatAudioPath } from "./crashStorySpeak";
import { storyDialogueDir } from "./crashStoryLocations";
import { CRASH_DIR } from "./paths";
import {
  resolveMobileMedia,
  resolveMobileMediaByFilename,
} from "./mobileMediaStore";
import type { ShowStyleId } from "./showStylePresets";
import { findSiblingVoiceFile, findSiblingVoicePath, packAudioDir } from "./storyVoiceRebind";

function diskAudioDirs(styleId: ShowStyleId, folders: string[]): string[] {
  const dirs = [
    storyDialogueDir(styleId),
    path.join(CRASH_DIR, "story", styleId, "audio"),
  ];
  for (const folder of folders) {
    const pack = packAudioDir(styleId, folder);
    if (pack) dirs.push(pack);
  }
  return [...new Set(dirs.filter(Boolean))];
}

/**
 * Same lookup Play uses: disk, then this pack's Blob folder, then Neon
 * by filename. LTX used to stop at disk and die GEN MP3 while Play worked.
 * A later take can stamp a new suffix while the bytes stay under the old one —
 * look for that sibling on disk and in Blob before 404.
 */
export async function resolveMobileBeatAudio(opts: {
  styleId: ShowStyleId;
  folderName: string;
  /** Extra Blob folders to try (job id before pack exists, etc.). */
  folderCandidates?: string[];
  beatId: string;
  voiceFile?: string;
}): Promise<string | null> {
  const names = [
    ...new Set(
      [opts.voiceFile?.trim(), opts.beatId ? `${opts.beatId}.mp3` : ""].filter(
        (n): n is string => Boolean(n),
      ),
    ),
  ];
  const folders = [
    ...new Set(
      [opts.folderName, ...(opts.folderCandidates || [])]
        .map((f) => f.trim())
        .filter(Boolean),
    ),
  ];
  const dirs = diskAudioDirs(opts.styleId, folders);

  for (const fileName of names) {
    if (!isSafeMediaName(fileName)) continue;
    const destPath = path.join(storyDialogueDir(opts.styleId), fileName);
    const onDisk = resolveBeatAudioPath(opts.styleId, opts.beatId, fileName);
    if (onDisk) return onDisk;
    for (const dir of dirs) {
      const local = path.join(dir, fileName);
      if (existsSync(local)) return local;
    }
    for (const folderName of folders) {
      const fromFolder = await resolveMobileMedia({
        styleId: opts.styleId,
        folderName,
        kind: "audio",
        fileName,
        destPath,
      });
      if (fromFolder) return fromFolder;
    }
    const byName = await resolveMobileMediaByFilename({
      kind: "audio",
      fileName,
      destPath,
    });
    if (byName) return byName;
  }

  for (const fileName of names) {
    if (!isSafeMediaName(fileName)) continue;
    const siblingPath = findSiblingVoicePath(dirs, fileName);
    if (siblingPath) return siblingPath;
    const siblingName = dirs
      .map((dir) => findSiblingVoiceFile(dir, fileName))
      .find((n): n is string => Boolean(n));
    if (!siblingName || !isSafeMediaName(siblingName)) continue;
    const destPath = path.join(storyDialogueDir(opts.styleId), siblingName);
    for (const folderName of folders) {
      const fromFolder = await resolveMobileMedia({
        styleId: opts.styleId,
        folderName,
        kind: "audio",
        fileName: siblingName,
        destPath,
      });
      if (fromFolder) return fromFolder;
    }
    const byName = await resolveMobileMediaByFilename({
      kind: "audio",
      fileName: siblingName,
      destPath,
    });
    if (byName) return byName;
  }
  return null;
}
