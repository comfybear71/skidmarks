import { NextResponse } from "next/server";
import { ensureCrashVoiceSample } from "@/lib/crashVoice";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";

/** POST — TTS a short sample for a locked voice_id (no delete). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      castKey?: string;
    };
    const styleId = parseStyleCardId(body.styleId || null);
    const castKey = String(body.castKey || "").trim();

    if (!styleId || !castKey) {
      return NextResponse.json(
        { error: "Need styleId, castKey" },
        { status: 400 },
      );
    }

    const slot = await ensureCrashVoiceSample({ styleId, castKey });
    return NextResponse.json({ ok: true, slot });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
