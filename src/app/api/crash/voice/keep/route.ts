import { NextResponse } from "next/server";
import { keepCrashVoice } from "@/lib/crashVoice";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST — Keep / lock a deep-fake voice take. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      castKey?: string;
      attemptId?: string;
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

    const slot = await keepCrashVoice({ styleId, castKey, attemptId });
    return NextResponse.json({ ok: true, slot });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
