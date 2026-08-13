import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { appendMorphDraft } from "@/lib/morph";
import { CRASH_DIR } from "@/lib/paths";

export const runtime = "nodejs";

function genDir() {
  return path.join(CRASH_DIR, "gen");
}

/**
 * POST { fileNames: string[] }
 * Copy Crash Lab gen stills into the Morph tray (sortable order kept).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      fileNames?: string[];
    };
    const names = (body.fileNames || []).filter((n) => /^[\w.\-]+$/.test(n));
    if (!names.length) {
      return NextResponse.json({ error: "Need fileNames" }, { status: 400 });
    }
    const buffers: { buf: Buffer; ext: string }[] = [];
    for (const name of names) {
      const fp = path.join(genDir(), name);
      if (!fs.existsSync(fp)) continue;
      buffers.push({
        buf: fs.readFileSync(fp),
        ext: path.extname(name) || ".png",
      });
    }
    if (!buffers.length) {
      return NextResponse.json({ error: "No files found" }, { status: 404 });
    }
    const items = appendMorphDraft(buffers);
    return NextResponse.json({ ok: true, items, added: buffers.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
