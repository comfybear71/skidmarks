import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import type { ShowStyleId } from "./showStylePresets";
import {
  activePackSceneKitPath,
  readActivePack,
} from "./crashActivePack";

export type SceneKitDiskDraft = {
  sceneId: string;
  sceneTitle: string;
  styleId: ShowStyleId | null;
  arseholeKey: string;
  castKeys: string[];
  castSlotCount: number;
  worldKeys: string[];
  placeSlotCount: number;
  activePlaceIndex: number;
  plateFiles: string[];
  plateSlotCount: number;
};

const DIR = path.join(CRASH_DIR, "scene-kit");
const FILE = path.join(DIR, "draft.json");

function cleanKeys(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((k): k is string => typeof k === "string")
    .map((k) => k.trim())
    .filter(Boolean);
}

function cleanPlateSlots(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((k) => (typeof k === "string" ? k.trim() : ""));
}

function sceneKitFilePath(): string {
  const active = readActivePack();
  if (active?.folderName) {
    const pack = activePackSceneKitPath();
    if (pack) return pack;
  }
  return FILE;
}

function parseDraft(raw: string): SceneKitDiskDraft | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SceneKitDiskDraft>;
    const plateFiles = cleanPlateSlots(parsed.plateFiles);
    return {
      sceneId: String(parsed.sceneId || "scene_01").trim() || "scene_01",
      sceneTitle:
        String(parsed.sceneTitle || "Scene 01").trim() || "Scene 01",
      styleId: (parsed.styleId as ShowStyleId | null) || null,
      arseholeKey: String(parsed.arseholeKey || "").trim(),
      castKeys: cleanKeys(parsed.castKeys),
      castSlotCount: Math.max(1, Number(parsed.castSlotCount) || 1, cleanKeys(parsed.castKeys).length),
      worldKeys: cleanKeys(parsed.worldKeys),
      placeSlotCount: Math.max(1, Number(parsed.placeSlotCount) || 1, cleanKeys(parsed.worldKeys).length),
      activePlaceIndex: Math.max(0, Number(parsed.activePlaceIndex) || 0),
      plateFiles,
      plateSlotCount: Math.max(
        1,
        Number(parsed.plateSlotCount) || 1,
        plateFiles.filter(Boolean).length,
      ),
    };
  } catch {
    return null;
  }
}

export function readSceneKitDiskDraft(): SceneKitDiskDraft | null {
  const fp = sceneKitFilePath();
  if (!fs.existsSync(fp)) return null;
  return parseDraft(fs.readFileSync(fp, "utf8"));
}

export function writeSceneKitDiskDraft(
  draft: SceneKitDiskDraft,
): SceneKitDiskDraft {
  const fp = sceneKitFilePath();
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  const next: SceneKitDiskDraft = {
    ...draft,
    plateFiles: cleanPlateSlots(draft.plateFiles),
    plateSlotCount: Math.max(1, Number(draft.plateSlotCount) || 1),
  };
  fs.writeFileSync(fp, JSON.stringify(next, null, 2) + "\n");
  // Keep a studio mirror only when NO pack is open (blank desk).
  if (!readActivePack()?.folderName && fp !== FILE) {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(next, null, 2) + "\n");
  }
  return next;
}

/** Blank desk scene-kit after Close — Studio draft only, never wipes pack. */
export function writeStudioSceneKitDiskDraft(
  draft: SceneKitDiskDraft,
): SceneKitDiskDraft {
  fs.mkdirSync(DIR, { recursive: true });
  const next: SceneKitDiskDraft = {
    ...draft,
    plateFiles: cleanPlateSlots(draft.plateFiles),
    plateSlotCount: Math.max(1, Number(draft.plateSlotCount) || 1),
  };
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2) + "\n");
  return next;
}
