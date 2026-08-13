import { NextResponse } from "next/server";
import {
  parseWorldCardId,
  readWorldCardThumbByKey,
} from "@/lib/worldCardThumbs";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseWorldCardId(url.searchParams.get("styleId"));
  if (!styleId) {
    return NextResponse.json({ error: "Bad styleId" }, { status: 400 });
  }
  const thumbKey = url.searchParams.get("thumb");
  if (!thumbKey) {
    return NextResponse.json({ error: "Need thumb" }, { status: 400 });
  }
  const hit = readWorldCardThumbByKey(styleId, thumbKey);
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
