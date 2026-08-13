import { NextResponse } from "next/server";
import { ensureCastLabCharacter } from "@/lib/ensureCastLabCharacter";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";

/** POST — auto-create Character Lab entries for deep-fake cast (silent). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      cast?: { key?: string; name?: string }[];
    };
    const styleId = parseStyleCardId(body.styleId || null);
    if (!styleId) {
      return NextResponse.json({ error: "Need styleId" }, { status: 400 });
    }
    const cast = Array.isArray(body.cast) ? body.cast : [];
    if (!cast.length) {
      return NextResponse.json({ error: "Need cast" }, { status: 400 });
    }

    const links: { castKey: string; characterId: string; name: string; created: boolean }[] =
      [];
    for (const row of cast.slice(0, 3)) {
      const name = String(row.name || "").trim();
      const castKey = String(row.key || "").trim();
      if (!name) continue;
      const { characterId, created } = ensureCastLabCharacter({
        styleId,
        castKey,
        name,
      });
      links.push({ castKey: castKey || `name:${name}`, characterId, name, created });
    }

    return NextResponse.json({ ok: true, links });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
