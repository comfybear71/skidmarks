import { NextResponse } from "next/server";
import {
  readSceneKitDiskDraft,
  writeSceneKitDiskDraft,
  writeStudioSceneKitDiskDraft,
  type SceneKitDiskDraft,
} from "@/lib/crashSceneKitStore";
import { useCloudStore } from "@/lib/cloudEnv";
import { readCloudEpisodeSceneKit } from "@/lib/cloudPack";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (useCloudStore()) {
    const url = new URL(req.url);
    const styleId = parseStyleCardId(url.searchParams.get("styleId"));
    const folderName = url.searchParams.get("folderName")?.trim() || "";
    if (!styleId || !folderName) {
      return NextResponse.json({ draft: null });
    }
    const draft = await readCloudEpisodeSceneKit(styleId, folderName);
    return NextResponse.json({ draft });
  }
  const draft = readSceneKitDiskDraft();
  return NextResponse.json({ draft });
}

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

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<SceneKitDiskDraft> & {
      clear?: boolean;
    };
    if (body.clear) {
      // Blank desk only — never wipe pack scene-kit.json
      const next = writeStudioSceneKitDiskDraft({
        sceneId: "scene_01",
        sceneTitle: "Scene 01",
        styleId: (body.styleId ?? null) as SceneKitDiskDraft["styleId"],
        arseholeKey: "",
        castKeys: [],
        castSlotCount: 3,
        worldKeys: [],
        placeSlotCount: 5,
        activePlaceIndex: 0,
        plateFiles: [],
        plateSlotCount: 9,
      });
      return NextResponse.json({ ok: true, draft: next });
    }
    const prev = readSceneKitDiskDraft();
    const next = writeSceneKitDiskDraft({
      sceneId: String(body.sceneId ?? prev?.sceneId ?? "scene_01"),
      sceneTitle: String(body.sceneTitle ?? prev?.sceneTitle ?? "Scene 01"),
      styleId: (body.styleId ?? prev?.styleId ?? null) as SceneKitDiskDraft["styleId"],
      arseholeKey: String(
        body.arseholeKey !== undefined
          ? body.arseholeKey
          : prev?.arseholeKey ?? "",
      ).trim(),
      castKeys:
        body.castKeys !== undefined
          ? cleanKeys(body.castKeys)
          : cleanKeys(prev?.castKeys),
      castSlotCount: Math.max(
        3,
        Number(body.castSlotCount ?? prev?.castSlotCount ?? 3) || 3,
      ),
      worldKeys:
        body.worldKeys !== undefined
          ? cleanKeys(body.worldKeys)
          : cleanKeys(prev?.worldKeys),
      placeSlotCount: Math.max(
        5,
        Number(body.placeSlotCount ?? prev?.placeSlotCount ?? 5) || 5,
      ),
      activePlaceIndex: Math.max(
        0,
        Number(body.activePlaceIndex ?? prev?.activePlaceIndex ?? 0) || 0,
      ),
      plateFiles:
        body.plateFiles !== undefined
          ? cleanPlateSlots(body.plateFiles)
          : cleanPlateSlots(prev?.plateFiles),
      plateSlotCount: Math.max(
        9,
        Number(body.plateSlotCount ?? prev?.plateSlotCount ?? 9) || 9,
      ),
    });
    return NextResponse.json({ ok: true, draft: next });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
