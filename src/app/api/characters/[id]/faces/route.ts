import { NextResponse } from "next/server";
import { addFaceAttempt, getCharacter } from "@/lib/characters";
import path from "path";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getCharacter(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData();
  const note = String(form.get("note") || "");
  const styleRaw = form.get("styleRealism");
  const styleRealism =
    styleRaw != null && String(styleRaw) !== ""
      ? Number(styleRaw)
      : 60;
  const file = form.get("file");

  let buffer: Buffer | undefined;
  let ext = ".png";
  if (file && typeof file === "object" && "arrayBuffer" in file) {
    const f = file as File;
    buffer = Buffer.from(await f.arrayBuffer());
    const fromName = path.extname(f.name || "");
    if (fromName) ext = fromName.toLowerCase();
  }

  const result = addFaceAttempt(id, { note, buffer, ext, styleRealism });
  if (!result)
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json(result);
}
