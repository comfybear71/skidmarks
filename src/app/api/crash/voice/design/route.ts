import { NextResponse } from "next/server";
import { designCrashVoice } from "@/lib/crashVoice";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";
export const maxDuration = 120;

/** POST — Gen voice for deep-fake cast. Stays out of Character Lab. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      castKey?: string;
      castName?: string;
      voiceDescription?: string;
    };
    const styleId = parseStyleCardId(body.styleId || null);
    const castKey = String(body.castKey || "").trim();
    const castName = String(body.castName || "").trim();
    const voiceDescription = String(body.voiceDescription || "").trim();

    if (!styleId || !castKey || !castName) {
      return NextResponse.json(
        { error: "Need styleId, castKey, castName" },
        { status: 400 },
      );
    }

    const slot = await designCrashVoice({
      styleId,
      castKey,
      castName,
      voiceDescription,
    });

    return NextResponse.json({ ok: true, slot });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
