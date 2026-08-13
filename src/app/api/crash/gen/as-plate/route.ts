import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { CRASH_DIR } from "@/lib/paths";
import { saveCplateMeta } from "@/lib/cplateManifest";
import { parseStyleCardId, resolveStyleCardThumbPath } from "@/lib/styleCardThumbs";
import { resolveSwapResultPath } from "@/lib/swapCards";
import { sortableId } from "@/lib/types";
import { crashGenDir } from "@/lib/crashActivePack";

export const runtime = "nodejs";

function genDir() {
  return crashGenDir();
}

/**
 * POST { kind: "cast"|"swap", styleId, thumbKey?|fileName?, label? }
 * Copy a cast thumb or swap result into gen/ as a cplate (never deletes source).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      kind?: string;
      styleId?: string;
      thumbKey?: string;
      fileName?: string;
      label?: string;
    };
    const styleId = parseStyleCardId(body.styleId || "");
    if (!styleId) {
      return NextResponse.json({ error: "Need styleId" }, { status: 400 });
    }

    let src: string | null = null;
    let castNames: string[] = [];
    const kind = (body.kind || "").trim();

    if (kind === "cast") {
      const thumbKey = (body.thumbKey || "").trim();
      if (!thumbKey) {
        return NextResponse.json({ error: "Need thumbKey" }, { status: 400 });
      }
      src = resolveStyleCardThumbPath(styleId, thumbKey);
      if (body.label?.trim()) castNames = [body.label.trim()];
    } else if (kind === "swap") {
      const fileName = (body.fileName || "").trim();
      if (!fileName) {
        return NextResponse.json({ error: "Need fileName" }, { status: 400 });
      }
      src = resolveSwapResultPath(styleId, fileName);
      if (body.label?.trim()) castNames = [body.label.trim()];
    } else {
      return NextResponse.json(
        { error: "kind must be cast or swap" },
        { status: 400 },
      );
    }

    if (!src || !fs.existsSync(src)) {
      return NextResponse.json({ error: "Source still missing" }, { status: 404 });
    }

    const ext = path.extname(src).toLowerCase() || ".png";
    const outName = `${sortableId("cplate")}${ext.startsWith(".") ? ext : `.${ext}`}`;
    fs.copyFileSync(src, path.join(genDir(), outName));
    saveCplateMeta({
      fileName: outName,
      styleId,
      castNames,
      people: castNames.length || 1,
    });

    return NextResponse.json({
      ok: true,
      fileName: outName,
      url: `/api/crash/gen/file?name=${encodeURIComponent(outName)}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
