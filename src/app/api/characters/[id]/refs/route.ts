import { NextResponse } from "next/server";
import path from "path";
import { addReference, getCharacter } from "@/lib/characters";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getCharacter(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData();
  const label = String(form.get("label") || "");
  const file = form.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return NextResponse.json({ error: "Reference image required" }, { status: 400 });
  }
  const f = file as File;
  const buffer = Buffer.from(await f.arrayBuffer());
  const fromName = path.extname(f.name || "");
  const ext = fromName || ".png";
  const result = addReference(id, { buffer, ext, label: label || f.name });
  if (!result)
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json(result);
}
