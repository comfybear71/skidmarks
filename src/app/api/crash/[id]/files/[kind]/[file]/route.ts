import fs from "fs";
import { NextResponse } from "next/server";
import {
  crashAssetPath,
  crashTakePath,
  getCrashJob,
} from "@/lib/crash";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{ id: string; kind: string; file: string }>;
};

export async function GET(_req: Request, ctx: Ctx) {
  const { id, kind, file } = await ctx.params;
  if (!getCrashJob(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const fp =
    kind === "takes" ? crashTakePath(id, file) : crashAssetPath(id, file);
  if (!fp) return NextResponse.json({ error: "File missing" }, { status: 404 });
  const buf = fs.readFileSync(fp);
  const ext = file.split(".").pop()?.toLowerCase();
  const type =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "webp"
        ? "image/webp"
        : "image/png";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "no-store",
    },
  });
}
