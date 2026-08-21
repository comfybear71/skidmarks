import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { cloudShowAssetRedirect } from "@/lib/cloudShelf";
import { resolveCharacterPlatePath } from "@/lib/characterPlates";
import { STILL_CACHE_CONTROL } from "@/lib/stillCache";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/** GET ?styleId=skidmarks&file=plate_baby.jpg — stream one character plate. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  const filename = (url.searchParams.get("file") || "").trim();
  if (!styleId || !filename) {
    return NextResponse.json({ error: "Need styleId and file" }, { status: 400 });
  }
  const streamed = await cloudShowAssetRedirect(styleId, "character_plate", filename);
  if (streamed) return streamed;
  const local = resolveCharacterPlatePath(styleId, filename);
  if (!local) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ext = path.extname(filename).toLowerCase();
  return new NextResponse(fs.readFileSync(local), {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": STILL_CACHE_CONTROL,
    },
  });
}
