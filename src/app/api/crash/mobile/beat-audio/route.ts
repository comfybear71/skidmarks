import fs from "fs";
import { NextResponse } from "next/server";
import { resolveBeatAudioPath } from "@/lib/crashStorySpeak";
import { resolveMobileMedia } from "@/lib/mobileMediaStore";
import { isSafeMediaName } from "@/lib/cloudMedia";
import { storyDialogueDir } from "@/lib/crashStoryLocations";
import path from "path";
import type { ShowStyleId } from "@/lib/showStylePresets";

export const runtime = "nodejs";

/**
 * GET — stream one beat's synthesized line, so the "building the story" feed
 * can play a line as soon as it's voiced instead of only after the whole
 * episode is stitched.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = (url.searchParams.get("styleId") || "") as ShowStyleId;
  const folderName = url.searchParams.get("folderName") || "";
  const beatId = url.searchParams.get("beatId") || "";
  const fileName = url.searchParams.get("fileName") || "";
  if (!styleId || !folderName || !beatId || !isSafeMediaName(fileName)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const filePath =
    resolveBeatAudioPath(styleId, beatId, fileName) ||
    (await resolveMobileMedia({
      styleId,
      folderName,
      kind: "audio",
      fileName,
      destPath: path.join(storyDialogueDir(styleId), fileName),
    }));
  if (!filePath || !fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(fs.readFileSync(filePath)), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=300",
    },
  });
}
