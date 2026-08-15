import { NextResponse } from "next/server";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { cloudShowAssetRedirect } from "@/lib/cloudShelf";

export const runtime = "nodejs";

/** GET ?styleId=sunny_banks&file=plate_dazza.png — stream one character plate. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  const filename = (url.searchParams.get("file") || "").trim();
  if (!styleId || !filename) {
    return NextResponse.json({ error: "Need styleId and file" }, { status: 400 });
  }
  const streamed = await cloudShowAssetRedirect(styleId, "character_plate", filename);
  if (streamed) return streamed;
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
