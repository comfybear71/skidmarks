import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { wanFxPlatePath } from "@/lib/wanFxPaths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
};

/** GET ?name= — serve a plate thumb from `_XX_SPX\_PLATES` */
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") || "";
  const abs = wanFxPlatePath(name);
  if (!abs) {
    return NextResponse.json({ error: "Plate not found" }, { status: 404 });
  }
  const ext = path.extname(abs).toLowerCase();
  const buf = fs.readFileSync(abs);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "private, max-age=60",
    },
  });
}
