import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { crashSpxFilePath, type CrashSpxKind } from "@/lib/crashSpx";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { morphKeepersDir } from "@/lib/morph";
import { cloudShowAssetRedirect } from "@/lib/cloudShelf";
import { serveMediaFile } from "@/lib/serveMediaFile";

export const runtime = "nodejs";

/** GET ?styleId=&kind=sfx|video|keeper&file= */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  const kind = url.searchParams.get("kind") || "";
  const file = url.searchParams.get("file") || "";

  if (!file || file.includes("..") || !/^[\w.\-]+$/.test(file)) {
    return NextResponse.json({ error: "Bad file" }, { status: 400 });
  }

  if (styleId && (kind === "sfx" || kind === "video")) {
    const cloud = await cloudShowAssetRedirect(
      styleId,
      kind === "sfx" ? "spx_sfx" : "spx_video",
      file,
    );
    if (cloud) return cloud;
  }

  let filePath: string | null = null;
  if (kind === "keeper") {
    filePath = path.join(morphKeepersDir(), file);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } else if (styleId && (kind === "sfx" || kind === "video")) {
    filePath = crashSpxFilePath(styleId, kind as CrashSpxKind, file);
  }

  if (!filePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === ".mp3"
      ? "audio/mpeg"
      : ext === ".wav"
        ? "audio/wav"
        : ext === ".m4a"
          ? "audio/mp4"
          : ext === ".ogg"
            ? "audio/ogg"
            : ext === ".webm"
              ? "video/webm"
              : ext === ".mov"
                ? "video/quicktime"
                : "video/mp4";

  return serveMediaFile(req, filePath, contentType, { "Cache-Control": "no-store" });
}
