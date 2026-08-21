/**
 * /m cutaway = same still + silent Image motion + a 6–10s SFX mp3 so LTX
 * has a length. The sound is thrown away in Resolve.
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

export const CUTAWAY_SFX_MIN_SEC = 6;
export const CUTAWAY_SFX_MAX_SEC = 10;

export type CutawayAction = {
  id: string;
  label: string;
  action: string;
};

export const CUTAWAY_ACTIONS: CutawayAction[] = [
  {
    id: "stand-up",
    label: "Stand up",
    action: "stands up from sitting, rises to their feet",
  },
  {
    id: "walk-away",
    label: "Walk away",
    action: "stands and walks away from camera, leaving the place",
  },
  {
    id: "walk-toward",
    label: "Walk toward",
    action: "walks toward the camera, filling the frame",
  },
  {
    id: "sit-up",
    label: "Sit up",
    action: "sits up, weight shifting upright",
  },
  {
    id: "look-away",
    label: "Look away",
    action: "turns their head and looks away",
  },
  {
    id: "shake-head",
    label: "Shake head",
    action: "shakes their head, no words",
  },
];

export function cutawayActionById(id: string): CutawayAction | undefined {
  return CUTAWAY_ACTIONS.find((a) => a.id === id);
}

/** Probe jitter — a 6.00 file can read 5.97. */
export function cutawaySfxInRange(sec: number): boolean {
  if (!Number.isFinite(sec) || sec <= 0) return false;
  return sec >= CUTAWAY_SFX_MIN_SEC - 0.25 && sec <= CUTAWAY_SFX_MAX_SEC + 0.25;
}

export function cutawaySfxRangeError(sec: number): string {
  const shown = Number.isFinite(sec) ? `${sec.toFixed(1)}s` : "unknown length";
  return `Need a 6–10 second SFX (this one is ${shown}). Pick another, or add one on the SPX shelf.`;
}

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
