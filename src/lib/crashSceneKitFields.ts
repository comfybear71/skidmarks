import { readScriptDeskCharacterDraft } from "./crashScriptFields";
import type { ShowStyleId } from "./showStylePresets";
import { loadShowStyleIdOptional } from "./showStylePresets";

export const SCENE_KIT_KEY = "crashlab-scene-kit";
export const CRASH_SCENE_KIT_EVENT = "crash-scene-kit";

export const DEFAULT_PLACE_SLOTS = 5;
export const DEFAULT_CAST_SLOTS = 3;
/** Numbered finished shot plates (characters in place) — copy onto Story shots. */
export const DEFAULT_PLATE_SLOTS = 9;

export type SceneKitDraft = {
  sceneId: string;
  sceneTitle: string;
  styleId: ShowStyleId | null;
  /** Main arsehole face thumb key (style-card). */
  arseholeKey: string;
  /** Supporting cast face thumb keys (slot order). */
  castKeys: string[];
  /** How many cast drop slots to show (grows with +). */
  castSlotCount: number;
  /** Place world-card thumb keys (slot order). */
  worldKeys: string[];
  /** How many place drop slots to show (grows with +). */
  placeSlotCount: number;
  /** Which place slot is active (index into worldKeys / slots). */
  activePlaceIndex: number;
  /** Finished cplate file names (shot plates with cast in place). */
  plateFiles: string[];
  /** How many finished-plate slots to show (grows with +). */
  plateSlotCount: number;
};

function emptyDraft(): SceneKitDraft {
  return {
    sceneId: "scene_01",
    sceneTitle: "Scene 01",
    styleId: loadShowStyleIdOptional(),
    arseholeKey: "",
    castKeys: [],
    castSlotCount: DEFAULT_CAST_SLOTS,
    worldKeys: [],
    placeSlotCount: DEFAULT_PLACE_SLOTS,
    activePlaceIndex: 0,
    plateFiles: [],
    plateSlotCount: DEFAULT_PLATE_SLOTS,
  };
}

function cleanKeys(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((k): k is string => typeof k === "string")
    .map((k) => k.trim())
    .filter(Boolean);
}

/** Keep empty slots so Plate 3 stays Plate 3 after clear. */
function cleanPlateSlots(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((k) => (typeof k === "string" ? k.trim() : ""));
}

/** Blank working Scene kit (New episode). */
export function emptySceneKitDraft(
  styleId?: ShowStyleId | null,
): SceneKitDraft {
  return {
    sceneId: "scene_01",
    sceneTitle: "Scene 01",
    styleId:
      styleId !== undefined ? styleId : loadShowStyleIdOptional(),
    arseholeKey: "",
    castKeys: [],
    castSlotCount: DEFAULT_CAST_SLOTS,
    worldKeys: [],
    placeSlotCount: DEFAULT_PLACE_SLOTS,
    activePlaceIndex: 0,
    plateFiles: [],
    plateSlotCount: DEFAULT_PLATE_SLOTS,
  };
}

/**
 * Hard-wipe Scene kit in the browser + on disk.
 * Awaits the server write so Parish can't resurrect from a stale hydrate.
 */
export async function clearSceneKitDraft(
  styleId?: ShowStyleId | null,
): Promise<SceneKitDraft> {
  const next = emptySceneKitDraft(styleId);
  try {
    localStorage.setItem(SCENE_KIT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CRASH_SCENE_KIT_EVENT));
    try {
      await fetch("/api/crash/scene-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true, ...next }),
      });
    } catch {
      /* ignore — local already blank */
    }
  }
  return next;
}

export function readSceneKitDraft(): SceneKitDraft {
  try {
    const raw = localStorage.getItem(SCENE_KIT_KEY);
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw) as Partial<SceneKitDraft> & {
      worldKey?: string;
    };
    const castKeys = cleanKeys(parsed.castKeys);
    let worldKeys = cleanKeys(parsed.worldKeys);
    // Migrate old single worldKey
    if (!worldKeys.length && parsed.worldKey) {
      const one = String(parsed.worldKey).trim();
      if (one) worldKeys = [one];
    }
    const placeSlotCount = Math.max(
      1,
      Number(parsed.placeSlotCount) || worldKeys.length || 1,
      worldKeys.length,
    );
    const castSlotCount = Math.max(
      1,
      Number(parsed.castSlotCount) || castKeys.length || 1,
      castKeys.length,
    );
    const activePlaceIndex = Math.max(
      0,
      Math.min(
        placeSlotCount - 1,
        Number(parsed.activePlaceIndex) || 0,
      ),
    );
    const plateFiles = cleanPlateSlots(
      (parsed as { plateFiles?: unknown }).plateFiles,
    );
    const plateSlotCount = Math.max(
      1,
      Number((parsed as { plateSlotCount?: unknown }).plateSlotCount) ||
        plateFiles.length ||
        1,
      plateFiles.filter(Boolean).length,
    );
    return {
      sceneId: String(parsed.sceneId || "scene_01").trim() || "scene_01",
      sceneTitle: String(parsed.sceneTitle || "Scene 01").trim() || "Scene 01",
      styleId:
        (parsed.styleId as ShowStyleId | null) || loadShowStyleIdOptional(),
      arseholeKey: String(parsed.arseholeKey || "").trim(),
      castKeys,
      castSlotCount,
      worldKeys,
      placeSlotCount,
      activePlaceIndex,
      plateFiles,
      plateSlotCount,
    };
  } catch {
    return emptyDraft();
  }
}

export function writeSceneKitDraft(
  partial: Partial<SceneKitDraft>,
): SceneKitDraft {
  const prev = readSceneKitDraft();
  const next: SceneKitDraft = {
    sceneId:
      partial.sceneId !== undefined
        ? String(partial.sceneId).trim() || prev.sceneId
        : prev.sceneId,
    sceneTitle:
      partial.sceneTitle !== undefined
        ? String(partial.sceneTitle).trim() || prev.sceneTitle
        : prev.sceneTitle,
    styleId:
      partial.styleId !== undefined
        ? partial.styleId
        : prev.styleId || loadShowStyleIdOptional(),
    arseholeKey:
      partial.arseholeKey !== undefined
        ? String(partial.arseholeKey).trim()
        : prev.arseholeKey,
    castKeys:
      partial.castKeys !== undefined
        ? cleanKeys(partial.castKeys)
        : prev.castKeys,
    castSlotCount:
      partial.castSlotCount !== undefined
        ? Math.max(1, Number(partial.castSlotCount) || 1)
        : prev.castSlotCount,
    worldKeys:
      partial.worldKeys !== undefined
        ? cleanKeys(partial.worldKeys)
        : prev.worldKeys,
    placeSlotCount:
      partial.placeSlotCount !== undefined
        ? Math.max(1, Number(partial.placeSlotCount) || 1)
        : prev.placeSlotCount,
    activePlaceIndex:
      partial.activePlaceIndex !== undefined
        ? Math.max(0, Number(partial.activePlaceIndex) || 0)
        : prev.activePlaceIndex,
    plateFiles:
      partial.plateFiles !== undefined
        ? cleanPlateSlots(partial.plateFiles)
        : prev.plateFiles,
    plateSlotCount:
      partial.plateSlotCount !== undefined
        ? Math.max(1, Number(partial.plateSlotCount) || 1)
        : prev.plateSlotCount,
  };
  next.activePlaceIndex = Math.min(
    next.placeSlotCount - 1,
    next.activePlaceIndex,
  );
  next.plateSlotCount = Math.max(next.plateSlotCount, next.plateFiles.length);
  try {
    localStorage.setItem(SCENE_KIT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CRASH_SCENE_KIT_EVENT));
    void fetch("/api/crash/scene-kit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => {
      /* ignore */
    });
  }
  return next;
}

/** Load pack/disk restore into local Scene kit (Open episode / Reload places). */
export async function hydrateSceneKitFromDisk(
  url?: string | null,
): Promise<SceneKitDraft | null> {
  try {
    const res = await fetch(url || "/api/crash/scene-kit", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.draft) return null;
    const d = data.draft as Partial<SceneKitDraft>;
    const castKeys = cleanKeys(d.castKeys);
    const worldKeys = cleanKeys(d.worldKeys);
    const arseholeKey = String(d.arseholeKey || "").trim();
    // Disk is the live working copy — including a blank New-episode kit.
    // Wipe local first so a stale 3-place kit can't win a merge race.
    try {
      localStorage.removeItem(SCENE_KIT_KEY);
    } catch {
      /* ignore */
    }
    return writeSceneKitDraft({
      sceneId: d.sceneId || "scene_01",
      sceneTitle: d.sceneTitle || "Scene 01",
      styleId: d.styleId ?? undefined,
      arseholeKey,
      castKeys,
      castSlotCount: d.castSlotCount,
      worldKeys,
      placeSlotCount: Math.max(
        Number(d.placeSlotCount) || 1,
        worldKeys.length,
        1,
      ),
      activePlaceIndex: d.activePlaceIndex,
      plateFiles: cleanPlateSlots((d as { plateFiles?: unknown }).plateFiles),
      plateSlotCount: (d as { plateSlotCount?: number }).plateSlotCount,
    });
  } catch {
    return null;
  }
}

/** Active place key for this scene (slot index). */
export function sceneKitActiveWorldKey(d?: SceneKitDraft): string {
  const draft = d || readSceneKitDraft();
  return draft.worldKeys[draft.activePlaceIndex] || draft.worldKeys[0] || "";
}

/** Copy Script desk cast/place picks into this scene kit. */
export function pullScriptDeskIntoSceneKit(): SceneKitDraft {
  const draft = readScriptDeskCharacterDraft();
  const castKeys = draft.styleCastKeys;
  const arseholeKey =
    draft.styleThumbKey ||
    (castKeys.length === 1 ? castKeys[0] : "") ||
    "";
  const worldKeys = draft.styleWorldKey ? [draft.styleWorldKey] : [];
  return writeSceneKitDraft({
    styleId: draft.styleId,
    arseholeKey,
    castKeys: castKeys.filter((k) => k !== arseholeKey),
    worldKeys,
    placeSlotCount: Math.max(1, worldKeys.length || 1),
    activePlaceIndex: 0,
  });
}

/** Keep scene kit style in sync when Script desk / toolbar style changes.
 *  Wrong show's cast keys → broken thumbs — wipe kit contents on style change. */
export function syncSceneKitStyleFromDesk(): void {
  const desk = readScriptDeskCharacterDraft();
  if (!desk.styleId) return;
  const kit = readSceneKitDraft();
  if (kit.styleId === desk.styleId) return;
  writeSceneKitDraft({
    ...emptySceneKitDraft(desk.styleId),
    sceneId: kit.sceneId,
    sceneTitle: kit.sceneTitle,
  });
}
