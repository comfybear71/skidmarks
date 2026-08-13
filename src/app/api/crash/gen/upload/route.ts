import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { CRASH_DIR } from "@/lib/paths";
import { sortableId } from "@/lib/types";
import { crashGenDir } from "@/lib/crashActivePack";

export const runtime = "nodejs";

function genDir() {
  return crashGenDir();
}

/**
 * POST multipart: file
 * Park a still in Crash Lab gen (e.g. drop a saved BG before Lock).
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Need an image file" }, { status: 400 });
    }
    const ext =
      path.extname(file.name || "").toLowerCase() ||
      (file.type.includes("jpeg") || file.type.includes("jpg")
        ? ".jpg"
        : file.type.includes("webp")
          ? ".webp"
          : ".png");
    const fileName = `${sortableId("cup")}${ext.startsWith(".") ? ext : `.${ext}`}`;
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(genDir(), fileName), buf);
    return NextResponse.json({
      ok: true,
      fileName,
      url: `/api/crash/gen/file?name=${encodeURIComponent(fileName)}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
