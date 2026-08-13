import fs from "fs";
import { NextResponse } from "next/server";
import {
  crashVoiceFilePath,
  getCrashVoiceSlot,
} from "@/lib/crashVoice";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import {
  getVoiceLibraryEntry,
  resolveKeeperFile,
} from "@/lib/voiceLibrary";

export const runtime = "nodejs";

/** GET ?styleId=&castKey=&attemptId= — play a deep-fake voice take. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  const castKey = String(url.searchParams.get("castKey") || "").trim();
  const attemptId = String(url.searchParams.get("attemptId") || "").trim();

  if (!styleId || !castKey || !attemptId) {
    return NextResponse.json({ error: "Need styleId, castKey, attemptId" }, { status: 400 });
  }

  let filePath = crashVoiceFilePath(styleId, castKey, `${attemptId}.mp3`);

  if (!filePath) {
    const slot = getCrashVoiceSlot(styleId, castKey);
    if (slot?.approvedAttemptId === attemptId && slot.castName) {
      const entry = getVoiceLibraryEntry(styleId, slot.castName);
      filePath = entry ? resolveKeeperFile(entry) : null;
    }
  }

  if (!filePath) {
    return NextResponse.json({ error: "Audio missing" }, { status: 404 });
  }

  return new NextResponse(fs.readFileSync(filePath), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=60",
    },
  });
}
