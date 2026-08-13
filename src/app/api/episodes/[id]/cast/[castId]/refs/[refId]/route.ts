import fs from "fs";
import { NextResponse } from "next/server";
import {
  castRefPath,
  deleteCastReference,
  getCastMember,
} from "@/lib/episodeCast";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; castId: string; refId: string }> };

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(_req: Request, ctx: Ctx) {
  const { id, castId, refId } = await ctx.params;
  const m = getCastMember(id, castId);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ref = m.references.find((r) => r.id === refId);
  if (!ref)
    return NextResponse.json({ error: "No reference" }, { status: 404 });
  const filePath = castRefPath(id, castId, ref.fileName);
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
  const { id, castId, refId } = await ctx.params;
  const episode = deleteCastReference(id, castId, refId);
  if (!episode)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ episode });
}
