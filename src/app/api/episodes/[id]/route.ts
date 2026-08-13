import { NextResponse } from "next/server";
import { deleteEpisode, getEpisode, saveEpisode } from "@/lib/store";
import type { Episode } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const episode = getEpisode(id);
  if (!episode) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ episode });
}

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = getEpisode(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json()) as Episode;
  if (body.id !== id) {
    return NextResponse.json({ error: "ID mismatch" }, { status: 400 });
  }
  return NextResponse.json({ episode: saveEpisode(body) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  deleteEpisode(id);
  return NextResponse.json({ ok: true });
}
