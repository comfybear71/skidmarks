import path from "path";
import { NextResponse } from "next/server";
import { wanFxLocalFilePath } from "@/lib/wanFxPaths";
import { serveMediaFile } from "@/lib/serveMediaFile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?name= — serve a pulled boom mp4 from data/crash/wan_fx/ */
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") || "";
  const abs = wanFxLocalFilePath(name);
  if (!abs) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  const ext = path.extname(abs).toLowerCase();
  const type =
    ext === ".webm" ? "video/webm" : ext === ".mp4" ? "video/mp4" : "application/octet-stream";
  return serveMediaFile(req, abs, type, { "Cache-Control": "no-store" });
}
