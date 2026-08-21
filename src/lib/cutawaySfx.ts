/**
 * Server-only: read the SPX shelf and copy a 6–10s SFX onto a cutaway beat.
 * Do not import this from a client component — use cutawayActions.ts.
 */

import fs from "fs";
import {
  crashSpxFilePath,
  findCrashSpxItem,
  readCrashSpxManifest,
  type CrashSpxItem,
} from "./crashSpx";
import { useCloudStore } from "./cloudEnv";
import { cloudSpxItems, readShowAssetBytes } from "./cloudShelf";
import { probeDurationSeconds } from "./mediaDuration";
import type { ShowStyleId } from "./showStylePresets";

export {
  CUTAWAY_ACTIONS,
  CUTAWAY_SFX_MAX_SEC,
  CUTAWAY_SFX_MIN_SEC,
  cutawayActionById,
  cutawaySfxInRange,
  cutawaySfxRangeError,
  type CutawayAction,
} from "./cutawayActions";

export function estimateMp3DurationSec(filePath: string): number | undefined {
  try {
    const st = fs.statSync(filePath);
    const sec = (st.size * 8) / 128_000;
    if (Number.isFinite(sec) && sec >= 0.4) return sec;
  } catch {
    /* ignore */
  }
  return undefined;
}

export function resolveCutawaySfxDuration(filePath: string): number | undefined {
  return probeDurationSeconds(filePath) ?? estimateMp3DurationSec(filePath);
}

export async function listShowSfxItems(styleId: ShowStyleId): Promise<CrashSpxItem[]> {
  const rows = useCloudStore()
    ? await cloudSpxItems(styleId)
    : readCrashSpxManifest(styleId);
  return rows.filter((i) => i.kind === "sfx" && /\.mp3$/i.test(i.fileName));
}

export async function findShowSfxItem(
  styleId: ShowStyleId,
  spxId: string,
): Promise<CrashSpxItem | null> {
  const id = spxId.trim();
  if (!id) return null;
  if (useCloudStore()) {
    const hit = (await cloudSpxItems(styleId)).find(
      (i) => i.kind === "sfx" && i.id === id,
    );
    return hit || null;
  }
  const item = findCrashSpxItem(styleId, id);
  return item?.kind === "sfx" ? item : null;
}

export async function readShowSfxBytes(
  styleId: ShowStyleId,
  fileName: string,
): Promise<Buffer | null> {
  const cloud = await readShowAssetBytes(styleId, "spx_sfx", fileName);
  if (cloud) return cloud;
  const p = crashSpxFilePath(styleId, "sfx", fileName);
  if (!p) return null;
  return fs.readFileSync(p);
}
