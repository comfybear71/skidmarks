import fs from "fs";
import path from "path";
import type { ShowStyleId } from "./showStylePresets";
import { showArchiveRoot, campaignBaseSlug } from "./showArchivePaths";

export { campaignBaseSlug };

const LEGACY_FOLDER = /^Cursor_gag_(.+)$/i;
const NUMBERED_FOLDER = /^(\d{2})_(.+)$/;

/** Base slugs already archived under a show root (numbered + legacy folders). */
export function archiveUsedBaseSlugs(styleId: ShowStyleId): Set<string> {
  const root = showArchiveRoot(styleId);
  const used = new Set<string>();
  if (!root || !fs.existsSync(root)) return used;

  for (const name of fs.readdirSync(root, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const numbered = name.name.match(NUMBERED_FOLDER);
    if (numbered) {
      used.add(numbered[2]);
      continue;
    }
    const legacy = name.name.match(LEGACY_FOLDER);
    if (legacy) used.add(legacy[1]);
  }
  return used;
}

function maxCampaignNumber(styleId: ShowStyleId): number {
  const root = showArchiveRoot(styleId);
  if (!root || !fs.existsSync(root)) return 0;

  let max = 0;
  for (const name of fs.readdirSync(root, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const m = name.name.match(NUMBERED_FOLDER);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

/** Next free episode number on disk (01 after none, 05 after 04, etc.). */
export function peekNextCampaignNumber(styleId: ShowStyleId): number {
  return maxCampaignNumber(styleId) + 1;
}

function nextCampaignNumber(styleId: ShowStyleId): number {
  return peekNextCampaignNumber(styleId);
}

/** Latest numbered folder for a base slug, e.g. `02_The_pool_inspection`. */
export function findLatestNumberedCampaignFolder(
  styleId: ShowStyleId,
  baseSlug: string,
): string | null {
  const root = showArchiveRoot(styleId);
  if (!root || !fs.existsSync(root)) return null;

  let best: { num: number; abs: string } | null = null;
  for (const name of fs.readdirSync(root, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const m = name.name.match(NUMBERED_FOLDER);
    if (!m || m[2] !== baseSlug) continue;
    const num = parseInt(m[1], 10);
    const abs = path.join(root, name.name);
    if (!best || num > best.num) best = { num, abs };
  }
  return best?.abs ?? null;
}

/** Next folder name: `01_The_pool_inspection`, `02_Unit_9_annex`, … */
export function allocateNumberedCampaignFolder(
  styleId: ShowStyleId,
  baseSlug: string,
): string {
  const num = nextCampaignNumber(styleId);
  return `${String(num).padStart(2, "0")}_${baseSlug}`;
}
