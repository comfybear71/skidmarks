import path from "path";
import { MOVIES_ROOT } from "./paths";
import type { ShowStyleId } from "./showStylePresets";

/** Human-facing show roots under MY MOVIES (not blueprint/data). */
export const SHOW_ARCHIVE_FOLDER: Partial<Record<ShowStyleId, string>> = {
  skidmarks: "_SKIDMARKS",
  sunny_banks: "_SUNNY_BANKS",
  deepfake: "_REAL_FAKES",
  doc: "_DOCUMENTARY",
  music_video: "_MUSIC_VIDEO",
  photoreal: "_PHOTOREAL",
};

export function showArchiveRoot(styleId: ShowStyleId): string | null {
  const folder = SHOW_ARCHIVE_FOLDER[styleId];
  if (!folder) return null;
  return path.join(MOVIES_ROOT, folder);
}

/** Crash Lab scratch packs for this show only — never another show's tree. */
export function crashLabRootForStyle(styleId: ShowStyleId): string {
  const root = showArchiveRoot(styleId);
  if (!root) {
    return path.join(MOVIES_ROOT, "_SKIDMARKS", "_CRASH_LAB");
  }
  return path.join(root, "_CRASH_LAB");
}

export function crashLabShowFolderName(styleId: ShowStyleId): string {
  return SHOW_ARCHIVE_FOLDER[styleId] || "_SKIDMARKS";
}

/** Campaign folder on disk — e.g. MY MOVIES\\_SUNNY_BANKS\\01_The_pool_inspection */
export function showCampaignDir(
  styleId: ShowStyleId,
  folderName: string,
): string | null {
  const root = showArchiveRoot(styleId);
  if (!root) return null;
  return path.join(root, folderName);
}

export function toShowMoviesPath(absPath: string): string {
  const rel = path.relative(MOVIES_ROOT, absPath);
  if (rel.startsWith("..")) return absPath;
  return `MY MOVIES\\${rel.split(path.sep).join("\\")}`;
}

/** Strip "Cursor gag —" prefix; spaces → underscores. */
export function campaignBaseSlug(label: string): string {
  return (
    label
      .replace(/^cursor\s+gag\s*[—–-]\s*/i, "")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 40) || "campaign"
  );
}

/** @deprecated use campaignBaseSlug */
export function slugCampaignFolder(label: string): string {
  return campaignBaseSlug(label);
}
