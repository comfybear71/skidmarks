import { NextResponse } from "next/server";
import { readPlaceholderFile } from "@/lib/crashPlaceholders";
import {
  DEFAULT_SHOW_STYLE,
  SHOW_STYLE_PRESETS,
  type ShowStyleId,
} from "@/lib/showStylePresets";
import { STILL_CACHE_CONTROL } from "@/lib/stillCache";

export const runtime = "nodejs";

/** GET ?styleId=&kind=cast|places&id= — serve a dropped placeholder PNG. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawStyle = url.searchParams.get("styleId") || DEFAULT_SHOW_STYLE;
  const styleId = (
    SHOW_STYLE_PRESETS.some((p) => p.id === rawStyle)
      ? rawStyle
      : DEFAULT_SHOW_STYLE
  ) as ShowStyleId;
  const kind = url.searchParams.get("kind") === "places" ? "places" : "cast";
  const id = url.searchParams.get("id") || "";
  if (!/^[\w-]+$/.test(id)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const hit = readPlaceholderFile(styleId, kind, id);
  if (!hit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(hit.buf), {
    headers: {
      "Content-Type": hit.contentType,
      "Cache-Control": STILL_CACHE_CONTROL,
    },
  });
}
