import { NextResponse } from "next/server";
import { getStoryLocations } from "@/lib/crashStoryLocations";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";

/** GET ?styleId= — human paths under MY MOVIES\\_SHOW\\ */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  if (!styleId) {
    return NextResponse.json({ error: "Need styleId" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, locations: getStoryLocations(styleId) });
}
