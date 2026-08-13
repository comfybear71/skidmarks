import { NextResponse } from "next/server";
import {
  listWorldCardStatus,
  parseWorldCardId,
  saveGenStillAsWorldCard,
} from "@/lib/worldCardThumbs";
import type { WorldPlaceTypeId } from "@/lib/worldPlaceTypes";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ cards: listWorldCardStatus() });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      genFileName?: string;
      styleId?: string;
      prompt?: string;
      placeType?: string;
    };
    const genFileName = String(body.genFileName || "").trim();
    const styleId = parseWorldCardId(body.styleId || null);
    const placeType = String(body.placeType || "natural_wild") as WorldPlaceTypeId;
    if (!genFileName) {
      return NextResponse.json({ error: "Need genFileName" }, { status: 400 });
    }
    if (!styleId) {
      return NextResponse.json(
        { error: "Pick a show style in Script desk first" },
        { status: 400 },
      );
    }
    const { thumbPath, thumbKey, label } = saveGenStillAsWorldCard({
      genFileName,
      styleId,
      prompt: String(body.prompt || "").trim() || undefined,
      placeType,
    });
    return NextResponse.json({
      ok: true,
      styleId,
      thumbPath,
      thumbKey,
      label,
      url: `/api/crash/world-cards/file?styleId=${encodeURIComponent(styleId)}&thumb=${encodeURIComponent(thumbKey)}&t=${Date.now()}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
