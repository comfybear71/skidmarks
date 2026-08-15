import { NextResponse } from "next/server";
import { lipsyncFilePath } from "@/lib/lipsyncSmoke";
import { cloudBlobRedirect } from "@/lib/cloudMedia";
import { serveMediaFile } from "@/lib/serveMediaFile";

export const runtime = "nodejs";

/** GET ?name=lipsync_….mp4 — serve a pulled MuseTalk render from data/crash/lipsync/ */
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") || "";
  const cloud = await cloudBlobRedirect("mp4", name);
  if (cloud) return cloud;
  const abs = lipsyncFilePath(name);
  if (!abs) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  return serveMediaFile(req, abs, "video/mp4", { "Cache-Control": "no-store" });
}
