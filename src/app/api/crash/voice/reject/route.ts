import { NextResponse } from "next/server";
import { rejectCrashVoiceAttempt } from "@/lib/crashVoice";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";

/** POST — reject a voice take (next Gen learns from it). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      castKey?: string;
      attemptId?: string;
      reason?: string;
    };
    const styleId = parseStyleCardId(body.styleId || null);
    const castKey = String(body.castKey || "").trim();
    const attemptId = String(body.attemptId || "").trim();
    if (!styleId || !castKey || !attemptId) {
      return NextResponse.json(
        { error: "Need styleId, castKey, attemptId" },
        { status: 400 },
      );
    }
    const slot = await rejectCrashVoiceAttempt({
      styleId,
      castKey,
      attemptId,
      reason: body.reason,
    });
    if (!slot) {
      return NextResponse.json({ error: "No voice slot" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, slot });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
