import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { resolveGenOrPackPlate } from "@/lib/crashActivePack";
import { cloudBlobRedirect, isSafeMediaName } from "@/lib/cloudMedia";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get("name") || "";
  if (!isSafeMediaName(name)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const cloud = await cloudBlobRedirect("plates", name);
  if (cloud) return cloud;
  const file = resolveGenOrPackPlate(name);
  if (!file || !fs.existsSync(file)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const buf = fs.readFileSync(file);
  const ext = path.extname(name).toLowerCase();
  const type =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : "image/png";
  return new NextResponse(buf, {
    headers: { "Content-Type": type, "Cache-Control": "no-store" },
  });
}
