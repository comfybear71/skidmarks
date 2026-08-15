import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { faceFilePath } from "@/lib/characters";
import { resolveMobileMedia } from "@/lib/mobileMediaStore";
import { isSafeMediaName } from "@/lib/cloudMedia";
import { CRASH_DIR } from "@/lib/paths";
import type { ShowStyleId } from "@/lib/showStylePresets";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * GET — serve a mobile cast candidate face image directly by
 * styleId/folderName/characterId/fileName (all already known client-side
 * from the job doc), instead of routing through the generic
 * /api/characters/[id]/faces/[attemptId] endpoint — that one depends on
 * the Character's local faceAttempts record existing on THIS Vercel
 * instance, which a candidate generated on a different instance won't
 * have. Local disk first, else pull the bytes down from Blob.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = (url.searchParams.get("styleId") || "") as ShowStyleId;
  const folderName = url.searchParams.get("folderName") || "";
  const characterId = url.searchParams.get("characterId") || "";
  const fileName = url.searchParams.get("fileName") || "";
  if (!styleId || !folderName || !isSafeMediaName(fileName)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const filePath =
    (characterId ? faceFilePath(characterId, fileName) : null) ||
    (await resolveMobileMedia({
      styleId,
      folderName,
      kind: "plates",
      fileName,
      destPath: path.join(CRASH_DIR, "gen", fileName),
    }));
  if (!filePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buf = fs.readFileSync(filePath);
  const ext = path.extname(fileName).toLowerCase();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "private, max-age=60",
    },
  });
}
