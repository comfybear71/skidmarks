import { NextResponse } from "next/server";
import { clearCrashVoiceAttempts } from "@/lib/crashVoice";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";

/** POST — clear voice takes for one cast (manifest only). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      castKey?: string;
    };
    const styleId = parseStyleCardId(body.styleId || null);
    const castKey = String(body.castKey || "").trim();
    if (!styleId || !castKey) {
      return NextResponse.json({ error: "Need styleId + castKey" }, { status: 400 });
    }
    const slot = clearCrashVoiceAttempts({ styleId, castKey });
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
