import fs from "fs";
import { NextResponse } from "next/server";
import {
  saveStorySfxUpload,
  storySfxContentType,
  storySfxPath,
} from "@/lib/crashStorySfx";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";

/** POST multipart — attach sound file to one story SFX row. */
export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const styleId = parseStyleCardId(String(fd.get("styleId") || ""));
    const sfxId = String(fd.get("sfxId") || "").trim();
    const file = fd.get("file");

    if (!styleId || !sfxId) {
      return NextResponse.json(
        { error: "Need styleId and sfxId" },
        { status: 400 },
      );
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Need audio file" }, { status: 400 });
    }

    const name = file.name || "sound.mp3";
    const ext = name.includes(".")
      ? `.${name.split(".").pop()?.toLowerCase() || "mp3"}`
      : ".mp3";
    const buf = Buffer.from(await file.arrayBuffer());

    const result = saveStorySfxUpload({
      styleId,
      sfxId,
      buffer: buf,
      ext,
    });

    return NextResponse.json({
      ok: true,
      audioFile: result.audioFile,
      story: result.story,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}

/** GET ?styleId=&sfxId= — play story SFX clip. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  const sfxId = String(url.searchParams.get("sfxId") || "").trim();

  if (!styleId || !sfxId) {
    return NextResponse.json({ error: "Need styleId and sfxId" }, { status: 400 });
  }

  const filePath = storySfxPath(styleId, sfxId);
  if (!filePath) {
    return NextResponse.json(
      { error: "No sound yet — Add sound on that SFX row" },
      { status: 404 },
    );
  }

  return new NextResponse(fs.readFileSync(filePath), {
    headers: {
      "Content-Type": storySfxContentType(filePath),
      "Cache-Control": "private, max-age=60",
    },
  });
}
