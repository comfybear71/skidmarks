import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { morphRunDir } from "@/lib/morph";
import { serveMediaFile } from "@/lib/serveMediaFile";

export const runtime = "nodejs";

/** GET ?run=morph_xxx&name=morph.mp4 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const run = url.searchParams.get("run") || "";
  const name = url.searchParams.get("name") || "morph.mp4";
  if (!/^morph_[\w]+$/.test(run) || !/^[\w.\-]+$/.test(name)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const file = path.join(morphRunDir(run), name);
  if (!fs.existsSync(file)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const type = name.endsWith(".mp4") ? "video/mp4" : "application/octet-stream";
  return serveMediaFile(req, file, type, {
    "Content-Disposition": `inline; filename="${name}"`,
    "Cache-Control": "no-store",
  });
}
