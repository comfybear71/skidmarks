import { NextResponse } from "next/server";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { syncCrashLabCharactersForSceneKit } from "@/lib/crashLabSharedAssets";

export const runtime = "nodejs";

/**
 * POST { styleId } — pull _CRASH_LAB\images\characters\ into Style gallery,
 * return park + guest keys for Scene kit seed.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { styleId?: string };
    const styleId = parseStyleCardId(body.styleId || null);
    if (!styleId) {
      return NextResponse.json({ error: "Need styleId" }, { status: 400 });
    }
    const result = syncCrashLabCharactersForSceneKit(styleId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
