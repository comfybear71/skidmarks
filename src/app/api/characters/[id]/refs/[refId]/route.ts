import { NextResponse } from "next/server";
import fs from "fs";
import {
  deleteReference,
  getCharacter,
  referenceFilePath,
} from "@/lib/characters";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; refId: string }> };

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(_req: Request, ctx: Ctx) {
  const { id, refId } = await ctx.params;
  const c = getCharacter(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ref = c.references.find((r) => r.id === refId);
  if (!ref)
    return NextResponse.json({ error: "No reference" }, { status: 404 });
  const filePath = referenceFilePath(id, ref.fileName);
  if (!filePath)
    return NextResponse.json({ error: "Missing file" }, { status: 404 });
  const ext = ref.fileName.slice(ref.fileName.lastIndexOf(".")).toLowerCase();
  return new NextResponse(fs.readFileSync(filePath), {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, refId } = await ctx.params;
  const character = deleteReference(id, refId);
  if (!character)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ character });
}
