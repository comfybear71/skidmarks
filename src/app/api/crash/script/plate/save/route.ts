import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { crashGenDir } from "@/lib/crashActivePack";
import { saveCplateMeta } from "@/lib/cplateManifest";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { sortableId } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST multipart/form-data: file (PNG), styleId, castNames (JSON string[]), placeName
 * Saves a Compositor-flattened shot plate (background + manually placed face
 * layers, drawn client-side to <canvas> then exported via toBlob) — no GROK
 * call, just persisting an already-finished image. Mirrors the Path B write
 * in /api/crash/story/gen-plate (crashGenDir + saveCplateMeta) so the result
 * resolves the same way every other plate does.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const styleId = parseStyleCardId(String(form.get("styleId") || ""));
    if (!styleId) {
      return NextResponse.json({ error: "Need styleId" }, { status: 400 });
    }
    const file = form.get("file");
    if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
      return NextResponse.json({ error: "Need file" }, { status: 400 });
    }
    const buffer = Buffer.from(await (file as File).arrayBuffer());

    let castNames: string[] = [];
    try {
      const raw = JSON.parse(String(form.get("castNames") || "[]")) as unknown;
      if (Array.isArray(raw)) {
        castNames = raw.map((n) => String(n || "").trim()).filter(Boolean);
      }
    } catch {
      /* ignore */
    }
    const placeName = String(form.get("placeName") || "").trim();

    const fileName = `${sortableId("cplate")}.png`;
    fs.writeFileSync(path.join(crashGenDir(), fileName), buffer);
    saveCplateMeta({
      fileName,
      styleId,
      castNames,
      placeName,
      people: Math.max(1, castNames.length),
    });

    return NextResponse.json({
      ok: true,
      fileName,
      url: `/api/crash/gen/file?name=${encodeURIComponent(fileName)}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
