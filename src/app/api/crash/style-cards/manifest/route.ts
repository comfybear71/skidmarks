import { NextResponse } from "next/server";
import {
  parseStyleCardId,
  readStyleCardManifest,
  writeStyleCardManifestLabel,
} from "@/lib/styleCardThumbs";
import { rosterEntryByName } from "@/lib/styleCharacterRoster";

export const runtime = "nodejs";

/** GET ?styleId=deepfake — saved name/brief per thumb key. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  if (!styleId) {
    return NextResponse.json({ error: "Bad styleId" }, { status: 400 });
  }
  return NextResponse.json({ styleId, labels: readStyleCardManifest(styleId) });
}

/** POST { styleId, thumbKey, name } — lock label to this PNG. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      thumbKey?: string;
      name?: string;
      brief?: string;
    };
    const styleId = parseStyleCardId(body.styleId || null);
    const thumbKey = String(body.thumbKey || "").trim();
    const name = String(body.name || "").trim();
    if (!styleId || !thumbKey || !name) {
      return NextResponse.json(
        { error: "Need styleId, thumbKey, name" },
        { status: 400 },
      );
    }
    const briefRaw = String(body.brief || "").trim();
    // Prefer posted bio when Stuie edits Cast face — don't clobber with roster
    const roster = rosterEntryByName(styleId, name);
    const entry = briefRaw
      ? { name, brief: briefRaw }
      : roster ?? { name, brief: name };
    const labels = writeStyleCardManifestLabel(styleId, thumbKey, entry);
    return NextResponse.json({ ok: true, styleId, thumbKey, label: entry, labels });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
