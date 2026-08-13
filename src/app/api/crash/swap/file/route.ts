import { NextResponse } from "next/server";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { readSwapResultFile } from "@/lib/swapCards";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  const file = String(url.searchParams.get("file") || "").trim();
  if (!styleId || !file) {
    return NextResponse.json({ error: "Need styleId and file" }, { status: 400 });
  }
  const hit = readSwapResultFile(styleId, file);
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
