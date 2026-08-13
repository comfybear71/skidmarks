import { NextResponse } from "next/server";
import { readCrashVoiceManifest } from "@/lib/crashVoice";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { elevenKeyPresent } from "@/lib/elevenLabs";
import { readVoiceLibrary } from "@/lib/voiceLibrary";

export const runtime = "nodejs";

/** GET ?styleId= — deep-fake voice locks (NOT Character Lab). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  if (!styleId) {
    return NextResponse.json({ error: "Need styleId" }, { status: 400 });
  }
  return NextResponse.json({
    styleId,
    elevenReady: elevenKeyPresent(),
    slots: readCrashVoiceManifest(styleId),
    libraryCount: Object.keys(readVoiceLibrary()).filter((k) =>
      k.startsWith(`${styleId}:`),
    ).length,
  });
}
