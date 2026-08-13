import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { imageKeyPresent } from "@/lib/imageGen";
import { plateCastIntoGen, PLATE_FACES_PER_PASS } from "@/lib/plateCast";
import { CRASH_DIR } from "@/lib/paths";
import {
  parseStyleCardId,
  readStyleCardManifest,
  resolveStyleCardThumbPath,
} from "@/lib/styleCardThumbs";
import { getShowStylePreset } from "@/lib/showStylePresets";
import {
  readWorldCardManifest,
  resolveWorldCardThumbPath,
} from "@/lib/worldCardThumbs";

export const runtime = "nodejs";
export const maxDuration = 300;

function genDir() {
  return path.join(CRASH_DIR, "gen");
}

/**
 * POST { styleId, worldKey, castKeys[] }
 * Composites cast onto a location → shot plate (cplate).
 * Chains passes when more than PLATE_FACES_PER_PASS faces.
 */
export async function POST(req: Request) {
  try {
    if (!imageKeyPresent()) {
      return NextResponse.json(
        { error: "Missing XAI_API_KEY in MY MOVIES\\.env" },
        { status: 400 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      worldKey?: string;
      castKeys?: string[];
      note?: string;
    };

    const styleId = parseStyleCardId(body.styleId || null);
    const worldKey = String(body.worldKey || "").trim();
    const castKeys = Array.isArray(body.castKeys)
      ? [
          ...new Set(
            body.castKeys.filter(
              (k): k is string => typeof k === "string" && Boolean(k.trim()),
            ),
          ),
        ]
      : [];

    if (!styleId || !worldKey || !castKeys.length) {
      return NextResponse.json(
        { error: "Need styleId, worldKey, and at least one castKey" },
        { status: 400 },
      );
    }

    const worldPath = resolveWorldCardThumbPath(styleId, worldKey);
    if (!worldPath) {
      return NextResponse.json(
        { error: "World location missing — drop a place into the slot first" },
        { status: 404 },
      );
    }

    const styleManifest = readStyleCardManifest(styleId);
    const castFiles: { buf: Buffer; ext: string }[] = [];
    const castNames: string[] = [];
    for (const key of castKeys) {
      const p = resolveStyleCardThumbPath(styleId, key);
      if (!p) {
        return NextResponse.json(
          { error: `Cast photo missing for ${key}` },
          { status: 404 },
        );
      }
      castNames.push(styleManifest[key]?.name || key);
      const ext = path.extname(p).toLowerCase() || ".jpg";
      castFiles.push({ buf: fs.readFileSync(p), ext });
    }

    const worldManifest = readWorldCardManifest(styleId);
    const placeName = worldManifest[worldKey]?.name || "Location";
    const preset = getShowStylePreset(styleId);
    const total = castFiles.length;

    let bgPath = worldPath;
    let chainPass = false;
    let result: { fileName: string; id: string; people: number } | null = null;

    for (let i = 0; i < castFiles.length; i += PLATE_FACES_PER_PASS) {
      const batch = castFiles.slice(i, i + PLATE_FACES_PER_PASS);
      const isLast = i + PLATE_FACES_PER_PASS >= castFiles.length;
      result = await plateCastIntoGen({
        styleId,
        bgPath,
        castFiles: batch,
        castNames: isLast ? castNames : undefined,
        placeName: isLast ? placeName : undefined,
        note: body.note,
        styleRealism: preset.defaultRealism,
        chainPass,
        skipMeta: !isLast,
        totalPeople: total,
      });
      bgPath = path.join(genDir(), result.fileName);
      chainPass = true;
    }

    if (!result) {
      return NextResponse.json({ error: "Plate gen produced nothing" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      ...result,
      castNames,
      placeName,
      url: `/api/crash/gen/file?name=${encodeURIComponent(result.fileName)}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
