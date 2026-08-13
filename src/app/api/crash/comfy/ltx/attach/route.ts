import { NextResponse } from "next/server";
import { attachLtxMp4ToBeat } from "@/lib/ltxSmoke";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import type { ShowStyleId } from "@/lib/showStylePresets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST multipart: styleId, beatId, file (.mp4)
 * Copies into data/crash/ltx/ and links the beat. Never deletes the source.
 * Previous LTX for that beat parks in _cleared/.
 */
export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const styleId = (parseStyleCardId(String(fd.get("styleId") || "")) ||
      null) as ShowStyleId | null;
    const beatId = String(fd.get("beatId") || "").trim();
    const file = fd.get("file");

    if (!styleId) {
      return NextResponse.json({ error: "Need styleId" }, { status: 400 });
    }
    if (!beatId) {
      return NextResponse.json({ error: "Need beatId" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Need mp4 file" }, { status: 400 });
    }

    const name = file.name || "clip.mp4";
    if (!/\.mp4$/i.test(name) && file.type && !file.type.includes("mp4")) {
      return NextResponse.json(
        { error: "Need an .mp4 file" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!buffer.length) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    const entry = attachLtxMp4ToBeat({
      styleId,
      beatId,
      buffer,
      sourceName: name,
    });

    return NextResponse.json({
      ok: true,
      result: entry,
      url: entry.url,
      file: entry.file,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
