import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { resolveGenOrPackPlate } from "@/lib/crashActivePack";
import { resolveMobileMedia } from "@/lib/mobileMediaStore";
import { cloudBlobRedirect, isSafeMediaName } from "@/lib/cloudMedia";
import { cloudShowAssetRedirect } from "@/lib/cloudShelf";
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
 * GET — serve a mobile location candidate still.
 * location_build runs before a pack exists, so /api/crash/gen/file only
 * sees this instance's /tmp (empty on the next Vercel invoke) and the
 * latest desk episode. Same fallback as cast-face: local gen, then Blob
 * under the job id, then filename lookup, then the world shelf.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = (url.searchParams.get("styleId") || "") as ShowStyleId;
  const folderName = url.searchParams.get("folderName") || "";
  const fileName = url.searchParams.get("fileName") || "";
  if (!styleId || !isSafeMediaName(fileName)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const local = resolveGenOrPackPlate(fileName);
  const filePath =
    (local && fs.existsSync(local) ? local : null) ||
    (folderName
      ? await resolveMobileMedia({
          styleId,
          folderName,
          kind: "plates",
          fileName,
          destPath: path.join(CRASH_DIR, "gen", fileName),
        })
      : null);
  if (!filePath) {
    const byName = await cloudBlobRedirect("plates", fileName);
    if (byName) return byName;
    const shelf = await cloudShowAssetRedirect(styleId, "world", fileName);
    if (shelf) return shelf;
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
