import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getEpisode, shotPlatePath } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; fileName: string }> };

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
};

export async function GET(_req: Request, ctx: Ctx) {
  const { id, fileName } = await ctx.params;
  if (!getEpisode(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const decoded = decodeURIComponent(fileName);
  const filePath = shotPlatePath(id, decoded);
  if (!filePath)
    return NextResponse.json({ error: "Missing" }, { status: 404 });
  const ext = path.extname(decoded).toLowerCase();
  return new NextResponse(fs.readFileSync(filePath), {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "private, max-age=60",
    },
  });
}
