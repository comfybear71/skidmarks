import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { resolveMobileMedia } from "@/lib/mobileMediaStore";
import { cloudBlobRedirect, isSafeMediaName } from "@/lib/cloudMedia";
import { CRASH_DIR } from "@/lib/paths";
import { serveMediaFile } from "@/lib/serveMediaFile";
import type { ShowStyleId } from "@/lib/showStylePresets";

export const runtime = "nodejs";

/**
 * GET — stream one shot's mp4 as soon as it renders, rather than only the
 * final stitch. clipFile arrives as a local path from runLtxSmoke, so this
 * only needs the basename either way.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = (url.searchParams.get("styleId") || "") as ShowStyleId;
  const folderName = url.searchParams.get("folderName") || "";
  const fileName = path.basename(url.searchParams.get("fileName") || "");
  if (!styleId || !folderName || !isSafeMediaName(fileName)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // runLtxSmoke writes here (ltxOutDir) — not the plates "gen" dir, which
  // holds still images, not clips.
  const localPath = path.join(CRASH_DIR, "ltx", fileName);
  const filePath = fs.existsSync(localPath)
    ? localPath
    : await resolveMobileMedia({
        styleId,
        folderName,
        kind: "mp4",
        fileName,
        destPath: localPath,
      });
  if (filePath && fs.existsSync(filePath)) {
    return serveMediaFile(req, filePath, "video/mp4", {
      "Cache-Control": "private, max-age=120",
    });
  }
  const cloud = await cloudBlobRedirect("mp4", fileName, req);
  if (cloud) return cloud;
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
