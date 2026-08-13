import { NextResponse } from "next/server";
import {
  deleteCharacter,
  getCharacter,
  saveCharacter,
} from "@/lib/characters";
import type { Character } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const character = getCharacter(id);
  if (!character)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ character });
}

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = getCharacter(id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json()) as Partial<Character>;
  const character = saveCharacter({
    ...existing,
    ...body,
    id,
    faceAttempts: body.faceAttempts ?? existing.faceAttempts,
  });
  return NextResponse.json({ character });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  deleteCharacter(id);
  return NextResponse.json({ ok: true });
}
