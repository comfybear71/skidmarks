import { NextResponse } from "next/server";
import { listLibraryVoices } from "@/lib/elevenLabs";
import { usableLibraryVoices } from "@/lib/voiceNameMatch";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";

/**
 * GET ?styleId= — every pickable voice on the ElevenLabs account, so a
 * character can be assigned a specific one instead of the auto-pick
 * (name match, then a stable-but-arbitrary fallback) always deciding.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  if (!styleId) return NextResponse.json({ error: "Need styleId" }, { status: 400 });

  try {
    const library = await listLibraryVoices();
    const voices = usableLibraryVoices(library)
      .map((v) => ({ voiceId: v.voiceId, name: v.name, gender: v.gender }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ ok: true, voices });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
