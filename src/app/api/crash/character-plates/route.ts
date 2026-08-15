import { NextResponse } from "next/server";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { listCharacterPlates } from "@/lib/characterPlates";

export const runtime = "nodejs";

/** GET ?styleId=sunny_banks — every character plate held for a show. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const styleId = parseStyleCardId(url.searchParams.get("styleId"));
    if (!styleId) {
      return NextResponse.json({ error: "Bad styleId" }, { status: 400 });
    }
    const plates = await listCharacterPlates(styleId);
    return NextResponse.json({ ok: true, plates });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
