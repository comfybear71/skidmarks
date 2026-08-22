import path from "path";
import { NextResponse } from "next/server";
import { generateFaceImage, imageKeyPresent } from "@/lib/imageGen";
import { saveUploadAsStyleCard } from "@/lib/styleCardThumbs";
import { saveUploadAsWorldCard } from "@/lib/worldCardThumbs";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { mirrorStillIntoActiveCursorPack } from "@/lib/cursorPackCreate";

export const runtime = "nodejs";
export const maxDuration = 120;

/** POST { styleId, kind: face|place, name, brief, prompt } — one original still. */
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
      kind?: string;
      name?: string;
      brief?: string;
      prompt?: string;
    };
    const styleId = parseStyleCardId(body.styleId || "skidmarks");
    if (!styleId) {
      return NextResponse.json({ error: "Need styleId" }, { status: 400 });
    }
    const kind = body.kind === "place" ? "place" : "face";
    const name = String(body.name || "").trim();
    const brief = String(body.brief || "").trim();
    const prompt = String(body.prompt || "").trim();
    if (!name || !prompt) {
      return NextResponse.json({ error: "Need name + prompt" }, { status: 400 });
    }

    const { buffer, ext } = await generateFaceImage({
      prompt,
      referencePaths: [],
      aspectRatio: kind === "place" ? "16:9" : "3:4",
    });
    const fileExt = ext.startsWith(".") ? ext : `.${ext}`;

    if (kind === "place") {
      const saved = saveUploadAsWorldCard({
        buffer,
        ext: fileExt,
        styleId,
        name,
        brief: brief || name,
      });
      const base = saved.thumbKey.startsWith("g:")
        ? saved.thumbKey.slice(2)
        : path.basename(saved.thumbPath);
      mirrorStillIntoActiveCursorPack({
        kind: "place",
        srcPath: saved.thumbPath,
        fileName: base,
      });
      return NextResponse.json({
        ok: true,
        kind,
        name,
        thumbKey: saved.thumbKey,
        url: `/api/crash/world-cards/file?styleId=${encodeURIComponent(styleId)}&thumb=${encodeURIComponent(saved.thumbKey)}&t=${Date.now()}`,
      });
    }

    const saved = saveUploadAsStyleCard({
      buffer,
      ext: fileExt,
      styleId,
      name,
      brief: brief || name,
    });
    const base = saved.thumbKey.startsWith("g:")
      ? saved.thumbKey.slice(2)
      : path.basename(saved.thumbPath);
    mirrorStillIntoActiveCursorPack({
      kind: "face",
      srcPath: saved.thumbPath,
      fileName: base,
    });
    return NextResponse.json({
      ok: true,
      kind,
      name,
      thumbKey: saved.thumbKey,
      url: `/api/crash/style-cards/file?styleId=${encodeURIComponent(styleId)}&thumb=${encodeURIComponent(saved.thumbKey)}&t=${Date.now()}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
