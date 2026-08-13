import { NextResponse } from "next/server";
import path from "path";
import { addCastReference, getCastMember } from "@/lib/episodeCast";
import { getEpisode } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; castId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id, castId } = await ctx.params;
  if (!getEpisode(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!getCastMember(id, castId))
    return NextResponse.json({ error: "Cast not found" }, { status: 404 });

  const form = await req.formData();
  const label = String(form.get("label") || "");
  const file = form.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return NextResponse.json(
      { error: "Reference image required" },
      { status: 400 },
    );
  }
  const f = file as File;
  const buffer = Buffer.from(await f.arrayBuffer());
  const ext = path.extname(f.name || "") || ".png";
  const result = addCastReference(id, castId, {
    buffer,
    ext,
    label: label || f.name,
  });
  if (!result) return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json(result);
}
