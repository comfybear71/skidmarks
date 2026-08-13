import { NextResponse } from "next/server";
import { getCastMember, updateCastMember } from "@/lib/episodeCast";
import { getEpisode } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; castId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id, castId } = await ctx.params;
  const m = getCastMember(id, castId);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ cast: m });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id, castId } = await ctx.params;
  if (!getEpisode(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    roleNote?: string;
    voiceDescription?: string;
    previewText?: string;
  };
  const episode = updateCastMember(id, castId, {
    ...(body.name != null ? { name: body.name } : {}),
    ...(body.roleNote != null ? { roleNote: body.roleNote } : {}),
    ...(body.voiceDescription != null
      ? { voiceDescription: body.voiceDescription }
      : {}),
    ...(body.previewText != null ? { previewText: body.previewText } : {}),
  });
  if (!episode)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ episode });
}
