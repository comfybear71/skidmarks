import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import {
  buildCrashGenLook,
  generateFaceImage,
  imageKeyPresent,
} from "@/lib/imageGen";
import { plateCastIntoGen } from "@/lib/plateCast";
import { crashGenDir } from "@/lib/crashActivePack";
import { saveCplateMeta } from "@/lib/cplateManifest";
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
import { sortableId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 180;

function resolveCastKeyByName(
  manifest: Record<string, { name?: string }>,
  name: string,
): string | null {
  const lower = name.trim().toLowerCase();
  if (!lower) return null;
  for (const [key, meta] of Object.entries(manifest)) {
    const n = (meta.name || "").trim().toLowerCase();
    if (n === lower) return key;
    if (n.includes(lower) || lower.includes(n)) return key;
  }
  return null;
}

/**
 * POST { styleId, speakers[], placeName?, summary?, staging?, worldKey?, note? }
 * One-shot Story plate: cast already IN the place (like the cutaway gens).
 * Staging (who prominent / place roles) is applied first when present.
 * Prefers world + cast composite when worldKey + cast thumbs exist; else prompt gen.
 */
export async function POST(req: Request) {
  try {
    if (!imageKeyPresent()) {
      return NextResponse.json(
        { error: "Missing XAI_API_KEY in your environment variables" },
        { status: 400 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      speakers?: string[];
      placeName?: string;
      summary?: string;
      staging?: string;
      worldKey?: string;
      note?: string;
    };

    const styleId = parseStyleCardId(body.styleId || null);
    if (!styleId) {
      return NextResponse.json({ error: "Need styleId" }, { status: 400 });
    }

    const speakers = Array.isArray(body.speakers)
      ? [
          ...new Set(
            body.speakers
              .map((s) => String(s || "").trim())
              .filter(Boolean),
          ),
        ]
      : [];
    const placeName = String(body.placeName || "").trim() || "Scene";
    const staging = String(body.staging || "").trim();
    const summary = String(body.summary || "").trim();
    const note = String(body.note || "").trim();
    const worldKey = String(body.worldKey || "").trim();
    const preset = getShowStylePreset(styleId);
    const styleManifest = readStyleCardManifest(styleId);

    // Path A: world BG + cast faces (characters into the locked place)
    if (worldKey && speakers.length) {
      const worldPath = resolveWorldCardThumbPath(styleId, worldKey);
      if (worldPath) {
        const castFiles: { buf: Buffer; ext: string }[] = [];
        const castNames: string[] = [];
        for (const name of speakers.slice(0, 3)) {
          const key = resolveCastKeyByName(styleManifest, name);
          if (!key) continue;
          const p = resolveStyleCardThumbPath(styleId, key);
          if (!p) continue;
          castNames.push(styleManifest[key]?.name || name);
          castFiles.push({
            buf: fs.readFileSync(p),
            ext: path.extname(p).toLowerCase() || ".png",
          });
        }
        if (castFiles.length) {
          const worldManifest = readWorldCardManifest(styleId);
          const place =
            worldManifest[worldKey]?.name || placeName;
          const result = await plateCastIntoGen({
            styleId,
            bgPath: worldPath,
            castFiles,
            castNames,
            placeName: place,
            note: [
              staging,
              note,
              summary,
              speakers[0]
                ? `${speakers[0]} is the prominent character in frame (largest / nearest) if they speak`
                : "",
              "Characters physically in the place — seated at tables, behind counters, feet on ground. Soft overcast. Stylised 3D feature. Not photographic.",
            ]
              .filter(Boolean)
              .join(". "),
            styleRealism: preset.defaultRealism,
          });
          return NextResponse.json({
            ok: true,
            fileName: result.fileName,
            via: "plate-cast",
            url: `/api/crash/gen/file?name=${encodeURIComponent(result.fileName)}`,
          });
        }
      }
    }

    // Path B: prompt-only still (same spirit as cutaway batch)
    const who =
      speakers.length > 0
        ? speakers.join(" and ")
        : "the characters named in the shot";
    const action =
      staging || summary || note || `${who} in ${placeName}`;
    const look = buildCrashGenLook(styleId, preset.defaultRealism);
    const prompt = [
      action,
      staging && summary && staging !== summary ? summary : "",
      `Location: ${placeName}.`,
      speakers.length
        ? `People in frame: ${speakers.join(", ")}. ${speakers[0]} is prominent if this is their line.`
        : "",
      "Characters are physically in the location — contact with furniture/ground, matching light. Stylised 3D animated feature. Not photographic, not a cartoon.",
      look,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { buffer, ext } = await generateFaceImage({
      prompt,
      referencePaths: [],
      aspectRatio: "3:2",
    });

    const genDir = crashGenDir();
    const fileName = `${sortableId("cplate")}${ext.startsWith(".") ? ext : `.${ext}`}`;
    fs.writeFileSync(path.join(genDir, fileName), buffer);
    saveCplateMeta({
      fileName,
      styleId,
      castNames: speakers,
      people: Math.max(1, speakers.length),
      placeName,
    });

    return NextResponse.json({
      ok: true,
      fileName,
      via: "prompt",
      url: `/api/crash/gen/file?name=${encodeURIComponent(fileName)}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
