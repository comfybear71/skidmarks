import { NextResponse } from "next/server";
import { readCrashSpxDesk, removeCrashSpxItem } from "@/lib/crashSpx";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { useCloudStore } from "@/lib/cloudEnv";
import { cloudSpxItems } from "@/lib/cloudShelf";

export const runtime = "nodejs";

/** GET ?styleId= — sfx + video shelf for Script desk SPX panel. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  if (!styleId) {
    return NextResponse.json({ error: "Need styleId" }, { status: 400 });
  }
  if (useCloudStore()) {
    return NextResponse.json({ styleId, items: await cloudSpxItems(styleId) });
  }
  return NextResponse.json(readCrashSpxDesk(styleId));
}

/** DELETE body { styleId, id } — retire one shelf item (not destroy). */
export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      id?: string;
    };
    const styleId = parseStyleCardId(body.styleId || null);
    const id = String(body.id || "").trim();
    if (!styleId || !id) {
      return NextResponse.json({ error: "Need styleId + id" }, { status: 400 });
    }
    const items = removeCrashSpxItem(styleId, id);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
