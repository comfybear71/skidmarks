import { NextResponse } from "next/server";
import { addCastMember } from "@/lib/episodeCast";
import { getEpisode } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const episode = getEpisode(id);
  if (!episode)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ cast: episode.cast || [] });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getEpisode(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    roleNote?: string;
    voiceDescription?: string;
    previewText?: string;
  };
  const episode = addCastMember(id, {
    name: body.name?.trim() || "New cast",
    roleNote: body.roleNote?.trim() || "",
    voiceDescription: body.voiceDescription?.trim() || "",
    previewText: body.previewText?.trim() || "",
  });
  if (!episode)
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json({ episode });
}
