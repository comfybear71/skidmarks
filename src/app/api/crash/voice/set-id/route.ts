import { NextResponse } from "next/server";
import { lockCrashVoiceByExternalId } from "@/lib/crashVoice";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";

/** POST — paste an existing ElevenLabs voice_id onto a deep-fake cast (no delete). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      castKey?: string;
      castName?: string;
      voiceId?: string;
      voiceDescription?: string;
    };
    const styleId = parseStyleCardId(body.styleId || null);
    const castKey = String(body.castKey || "").trim();
    const castName = String(body.castName || "").trim();
    const voiceId = String(body.voiceId || "").trim();

    if (!styleId || !castKey || !voiceId) {
      return NextResponse.json(
        { error: "Need styleId, castKey, voiceId" },
        { status: 400 },
      );
    }

    const slot = await lockCrashVoiceByExternalId({
      styleId,
      castKey,
      castName: castName || castKey,
      voiceId,
      voiceDescription: body.voiceDescription,
    });
    return NextResponse.json({ ok: true, slot });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
