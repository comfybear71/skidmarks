import fs from "fs";
import { NextResponse } from "next/server";
import { lipsyncFilePath } from "@/lib/lipsyncSmoke";

export const runtime = "nodejs";

/** GET ?name=lipsync_….mp4 — serve a pulled MuseTalk render from data/crash/lipsync/ */
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") || "";
  const abs = lipsyncFilePath(name);
  if (!abs) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  const buf = fs.readFileSync(abs);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(buf.length),
      "Cache-Control": "no-store",
    },
  });
}
