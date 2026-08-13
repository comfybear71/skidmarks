import { NextResponse } from "next/server";
import { getSwapEngineStatus } from "@/lib/swapRun";
import { listGenPlateTargets, readSwapManifest } from "@/lib/swapCards";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";

/** GET ?styleId= — engine status + swap manifest + recent gen plates */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  const engine = getSwapEngineStatus();
  return NextResponse.json({
    engine,
    genPlates: styleId ? listGenPlateTargets(styleId) : [],
    swaps: styleId ? readSwapManifest(styleId) : {},
    styleId,
  });
}
