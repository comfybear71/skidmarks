import { NextResponse } from "next/server";
import {
  readStyleCardThumb,
  readStyleCardThumbByKey,
  parseStyleCardId,
} from "@/lib/styleCardThumbs";

export const runtime = "nodejs";

/** GET ?styleId=deepfake&thumb=g:thumb_123.png — one gallery still (latest if thumb omitted). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  if (!styleId) {
    return NextResponse.json({ error: "Bad styleId" }, { status: 400 });
  }
  const thumbKey = url.searchParams.get("thumb");
  const hit = thumbKey
    ? readStyleCardThumbByKey(styleId, thumbKey)
    : readStyleCardThumb(styleId);
  if (!hit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(hit.buf), {
    headers: {
      "Content-Type": hit.contentType,
      "Cache-Control": "no-store",
    },
  });
}
