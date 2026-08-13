/**
 * Bootstrap a Sunny Banks CURSOR_ pack with gallery faces + places already filled.
 */
import { createCursorEpisodePack } from "./cursorPackCreate";
import { writeSceneKitDiskDraft } from "./crashSceneKitStore";
import { syncCrashLabCharactersForSceneKit } from "./crashLabSharedAssets";
import { listWorldCardThumbsWithLabels } from "./worldCardThumbs";
import { liveCastKeys } from "./styleCardThumbs";
import {
  CURSOR_SUNNY_PLACES,
  sunnyBanksCursorKit,
} from "./cursorSunnyBanksKit";
import type { ShowStyleId } from "./showStylePresets";

function resolvePlaceKey(
  styleId: ShowStyleId,
  placeName: string,
): string | null {
  const want = placeName.trim().toLowerCase();
  const thumbs = listWorldCardThumbsWithLabels(styleId);
  const exact = thumbs.find((t) => (t.name || "").trim().toLowerCase() === want);
  if (exact) return exact.key;
  const fuzzy = thumbs.find((t) => {
    const n = (t.name || "").toLowerCase();
    return n.includes(want) || want.includes(n);
  });
  return fuzzy?.key || null;
}

export function startSunnyBanksCursorPack(): {
  folderName: string;
  path: string;
  story: ReturnType<typeof createCursorEpisodePack>["story"];
  sceneKit: ReturnType<typeof createCursorEpisodePack>["sceneKit"];
  kit: ReturnType<typeof sunnyBanksCursorKit>;
  facesReady: boolean;
  arseholeKey: string;
  castKeys: string[];
  worldKeys: string[];
} {
  const styleId: ShowStyleId = "sunny_banks";
  const kit = sunnyBanksCursorKit();
  const synced = syncCrashLabCharactersForSceneKit(styleId);

  const nameToKey = new Map<string, string>();
  const live = liveCastKeys(styleId);
  for (const [name, key] of Object.entries(live)) {
    nameToKey.set(name.trim().toLowerCase(), key);
  }

  const findFace = (name: string): string => {
    const k = nameToKey.get(name.trim().toLowerCase());
    if (!k) throw new Error(`Sunny Banks gallery missing face: ${name}`);
    return k;
  };

  const arseholeKey = findFace(kit.arsehole.name);
  const castKeys = kit.cast.map((c) => findFace(c.name));
  // Guests (Kylie etc.) after park cast in kit walk
  for (const gk of synced.guestKeys) {
    if (!castKeys.includes(gk) && gk !== arseholeKey) castKeys.push(gk);
  }

  const worldKeys: string[] = [];
  for (const p of CURSOR_SUNNY_PLACES) {
    const key = resolvePlaceKey(styleId, p.name);
    if (!key) throw new Error(`Sunny Banks gallery missing place: ${p.name}`);
    worldKeys.push(key);
  }

  const created = createCursorEpisodePack({
    styleId,
    baseLabel: "CURSOR_SUNNY_BANKS",
    cursorPrefix: true,
  });

  const sceneKit = writeSceneKitDiskDraft({
    sceneId: "scene_01",
    sceneTitle: "Scene 01",
    styleId,
    arseholeKey,
    castKeys,
    castSlotCount: Math.max(4, castKeys.length + 1),
    worldKeys,
    placeSlotCount: Math.max(4, worldKeys.length),
    activePlaceIndex: 0,
    plateFiles: [],
    plateSlotCount: 1,
  });

  return {
    folderName: created.folderName,
    path: created.path,
    story: created.story,
    sceneKit,
    kit,
    facesReady: true,
    arseholeKey,
    castKeys,
    worldKeys,
  };
}
