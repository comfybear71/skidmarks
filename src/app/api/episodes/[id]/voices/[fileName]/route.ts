import fs from "fs";
import { NextResponse } from "next/server";
import { retireFile } from "@/lib/retire";
import { getEpisode, shotVoicePath } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; fileName: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id, fileName } = await ctx.params;
  if (!getEpisode(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const decoded = decodeURIComponent(fileName);
  const filePath = shotVoicePath(id, decoded);
  if (!filePath)
    return NextResponse.json({ error: "Missing" }, { status: 404 });
  return new NextResponse(fs.readFileSync(filePath), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, fileName } = await ctx.params;
  if (!getEpisode(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const decoded = decodeURIComponent(fileName);
  const filePath = shotVoicePath(id, decoded);
  if (!filePath || !fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Missing" }, { status: 404 });
  }
  // Out of the UI, not off the disk — mp3s move to data/retired
  try {
    retireFile(filePath);
  } catch {
    return NextResponse.json({ error: "Could not retire" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
