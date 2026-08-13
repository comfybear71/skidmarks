import { NextResponse } from "next/server";
import { populateCursorGag } from "@/lib/cursorPopulate";
import { CURSOR_TOUR_STYLE } from "@/lib/cursorPopulateConfig";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";
export const maxDuration = 600;

/** POST { styleId? } — generate plates, voices, shot SFX for Cursor gag. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { styleId?: string };
    const styleId = parseStyleCardId(body.styleId || CURSOR_TOUR_STYLE);
    if (!styleId) {
      return NextResponse.json({ error: "Need styleId" }, { status: 400 });
    }
    const result = await populateCursorGag(styleId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
