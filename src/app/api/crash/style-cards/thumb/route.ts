import { NextResponse } from "next/server";
import {
  listStyleCardThumbsWithLabels,
  parseStyleCardId,
  removeStyleCardThumb,
} from "@/lib/styleCardThumbs";

export const runtime = "nodejs";

/** DELETE { styleId, thumbKey } — drop face from cast gallery (file → retired). */
export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      thumbKey?: string;
    };
    const styleId = parseStyleCardId(body.styleId || null);
    const thumbKey = String(body.thumbKey || "").trim();
    if (!styleId || !thumbKey) {
      return NextResponse.json(
        { error: "Need styleId and thumbKey" },
        { status: 400 },
      );
    }
    removeStyleCardThumb(styleId, thumbKey);
    return NextResponse.json({
      ok: true,
      styleId,
      thumbKey,
      thumbs: listStyleCardThumbsWithLabels(styleId),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
