import { NextResponse } from "next/server";
import { readCrashVoiceManifest } from "@/lib/crashVoice";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { elevenKeyPresent } from "@/lib/elevenLabs";
import { readVoiceLibrary } from "@/lib/voiceLibrary";
import { libraryVoiceSlotsForShow } from "@/lib/mobileVoiceReuse";

export const runtime = "nodejs";

/** GET ?styleId= — deep-fake voice locks (NOT Character Lab). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  if (!styleId) {
    return NextResponse.json({ error: "Need styleId" }, { status: 400 });
  }
  const local = readCrashVoiceManifest(styleId);
  const library = elevenKeyPresent()
    ? await libraryVoiceSlotsForShow(styleId)
    : {};
  // Local approved locks win. Library fills the empty Vercel /tmp manifest
  // so Animate can show Gen mp3 for DAP/Kim/Garry instead of "no voice lock".
  const slots = { ...library, ...local };
  return NextResponse.json({
    styleId,
    elevenReady: elevenKeyPresent(),
    slots,
    libraryCount: Object.keys(readVoiceLibrary()).filter((k) =>
      k.startsWith(`${styleId}:`),
    ).length,
  });
}
