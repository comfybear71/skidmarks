import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import {
  ensureWanFxExplosionsDir,
  WAN_FX_EXPLOSIONS_DIR,
  wanFxLocalFilePath,
} from "@/lib/wanFxPaths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { file } — copy pulled boom mp4 into `_XX_SPX\explosions\`
 * Never deletes. Never overwrites — adds a suffix if name exists.
 */
export async function POST(req: Request) {
  let body: { file?: string; label?: string };
  try {
    body = (await req.json()) as { file?: string; label?: string };
  } catch {
    return NextResponse.json({ error: "Bad JSON body" }, { status: 400 });
  }

  const src = wanFxLocalFilePath((body.file || "").trim());
  if (!src) {
    return NextResponse.json(
      { error: "No boom file to Keep — run Go first" },
      { status: 400 },
    );
  }

  const destDir = ensureWanFxExplosionsDir();
  const base = path.basename(src);
  let dest = path.join(destDir, base);
  if (fs.existsSync(dest)) {
    const stem = base.replace(/\.[^.]+$/, "");
    const ext = path.extname(base);
    dest = path.join(destDir, `${stem}_${Date.now()}${ext}`);
  }
  fs.copyFileSync(src, dest);

  return NextResponse.json({
    ok: true,
    kept: path.basename(dest),
    destDir: WAN_FX_EXPLOSIONS_DIR,
    message: `Kept → _XX_SPX\\explosions\\${path.basename(dest)}`,
  });
}
