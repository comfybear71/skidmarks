import fs from "fs";
import { NextResponse } from "next/server";
import { ltxFilePath } from "@/lib/ltxSmoke";
import { cloudBlobRedirect } from "@/lib/cloudMedia";

export const runtime = "nodejs";

/** GET ?name=ltx_….mp4 — serve a pulled LTX render from data/crash/ltx/ */
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") || "";
  const cloud = await cloudBlobRedirect("mp4", name);
  if (cloud) return cloud;
  const abs = ltxFilePath(name);
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
