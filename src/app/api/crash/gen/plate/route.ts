import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { imageKeyPresent } from "@/lib/imageGen";
import { CRASH_DIR } from "@/lib/paths";
import {
  DEFAULT_SHOW_STYLE,
  type ShowStyleId,
} from "@/lib/showStylePresets";
import {
  plateCastIntoGen,
} from "@/lib/plateCast";
import { PLATE_FACES_PER_PASS } from "@/lib/plateConstants";
import { crashGenDir } from "@/lib/crashActivePack";

export const runtime = "nodejs";
export const maxDuration = 120;

function clampRealism(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 60;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function genDir() {
  return crashGenDir();
}

type Dropped = { buf: Buffer; ext: string };

async function fetchImage(url: string, reqUrl: string): Promise<Dropped> {
  const abs = url.startsWith("http") ? url : new URL(url, reqUrl).toString();
  const imgRes = await fetch(abs);
  if (!imgRes.ok) throw new Error("Could not fetch character image");
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const u = url.toLowerCase();
  let ext = ".png";
  if (u.includes(".jpg") || u.includes(".jpeg")) ext = ".jpg";
  else if (u.includes(".webp")) ext = ".webp";
  return { buf, ext };
}

function parseBool(v: unknown): boolean {
  return v === true || v === "1" || v === "true";
}

/**
 * POST multipart: bgName + character file(s) (+ optional note)
 *   — field "character" (one) and/or repeated "characters"
 * OR JSON: { bgName, characterUrl?, characterUrls?: string[], note? }
 *
 * One Grok pass: image 1 = bg, images 2–3 = up to 2 faces (PLATE_FACES_PER_PASS).
 * chainPass=1 when image 1 already has people from a previous pass.
 */
export async function POST(req: Request) {
  try {
    if (!imageKeyPresent()) {
      return NextResponse.json(
        { error: "Missing XAI_API_KEY in MY MOVIES\\.env" },
        { status: 400 },
      );
    }

    const ctype = req.headers.get("content-type") || "";
    let bgName = "";
    let note = "";
    let styleId = DEFAULT_SHOW_STYLE as ShowStyleId;
    let styleRealism = 60;
    let castNames: string[] = [];
    let placeName = "";
    let chainPass = false;
    let skipMeta = false;
    let totalPeople: number | undefined;
    const drops: Dropped[] = [];

    if (ctype.includes("application/json")) {
      const body = (await req.json().catch(() => ({}))) as {
        bgName?: string;
        characterUrl?: string;
        characterUrls?: string[];
        note?: string;
        styleId?: string;
        styleRealism?: number;
        castNames?: string[];
        placeName?: string;
        chainPass?: boolean;
        skipMeta?: boolean;
        totalPeople?: number;
      };
      bgName = String(body.bgName || "");
      note = String(body.note || "").trim();
      styleId = (body.styleId || DEFAULT_SHOW_STYLE) as ShowStyleId;
      styleRealism = clampRealism(body.styleRealism);
      castNames = Array.isArray(body.castNames)
        ? body.castNames.filter((x): x is string => typeof x === "string")
        : [];
      placeName = String(body.placeName || "").trim();
      chainPass = parseBool(body.chainPass);
      skipMeta = parseBool(body.skipMeta);
      if (Number.isFinite(body.totalPeople)) {
        totalPeople = Math.max(1, Math.round(Number(body.totalPeople)));
      }
      const urls = [
        ...(Array.isArray(body.characterUrls) ? body.characterUrls : []),
        body.characterUrl || "",
      ]
        .map((u) => String(u || "").trim())
        .filter(Boolean);
      if (!urls.length) {
        return NextResponse.json(
          { error: "Need characterUrl or characterUrls" },
          { status: 400 },
        );
      }
      for (const u of urls.slice(0, PLATE_FACES_PER_PASS)) {
        drops.push(await fetchImage(u, req.url));
      }
    } else {
      const form = await req.formData();
      bgName = String(form.get("bgName") || "");
      note = String(form.get("note") || "").trim();
      styleId = (String(form.get("styleId") || DEFAULT_SHOW_STYLE) ||
        DEFAULT_SHOW_STYLE) as ShowStyleId;
      styleRealism = clampRealism(form.get("styleRealism"));
      chainPass = parseBool(form.get("chainPass"));
      skipMeta = parseBool(form.get("skipMeta"));
      const totalRaw = String(form.get("totalPeople") || "").trim();
      if (totalRaw && Number.isFinite(Number(totalRaw))) {
        totalPeople = Math.max(1, Math.round(Number(totalRaw)));
      }
      const castNamesRaw = String(form.get("castNames") || "").trim();
      if (castNamesRaw) {
        try {
          const parsed = JSON.parse(castNamesRaw) as unknown;
          if (Array.isArray(parsed)) {
            castNames = parsed.filter((x): x is string => typeof x === "string");
          }
        } catch {
          castNames = castNamesRaw.split(",").map((s) => s.trim()).filter(Boolean);
        }
      }
      placeName = String(form.get("placeName") || "").trim();
      const files: File[] = [];
      const one = form.get("character");
      if (one instanceof File) files.push(one);
      for (const v of form.getAll("characters")) {
        if (v instanceof File) files.push(v);
      }
      if (!files.length) {
        return NextResponse.json(
          { error: "Drop one or more character images" },
          { status: 400 },
        );
      }
      for (const file of files.slice(0, PLATE_FACES_PER_PASS)) {
        const ext =
          path.extname(file.name || "").toLowerCase() ||
          (file.type.includes("jpeg") ? ".jpg" : ".png");
        drops.push({
          buf: Buffer.from(await file.arrayBuffer()),
          ext,
        });
      }
    }

    if (!bgName || !/^[\w.\-]+$/.test(bgName)) {
      return NextResponse.json({ error: "Need locked bgName" }, { status: 400 });
    }
    if (!drops.length) {
      return NextResponse.json(
        { error: "Need character image(s)" },
        { status: 400 },
      );
    }

    const bgPath = path.join(genDir(), bgName);
    if (!fs.existsSync(bgPath)) {
      return NextResponse.json({ error: "Locked BG missing" }, { status: 404 });
    }

    const result = await plateCastIntoGen({
      styleId,
      bgPath,
      castFiles: drops,
      castNames,
      placeName: placeName || undefined,
      note,
      styleRealism,
      chainPass,
      skipMeta,
      totalPeople,
    });

    return NextResponse.json({
      ok: true,
      id: result.id,
      fileName: result.fileName,
      people: result.people,
      url: `/api/crash/gen/file?name=${encodeURIComponent(result.fileName)}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
