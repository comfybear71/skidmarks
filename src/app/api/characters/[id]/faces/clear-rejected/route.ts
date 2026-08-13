import { NextResponse } from "next/server";
import { clearRejectedAttempts, getCharacter } from "@/lib/characters";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getCharacter(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const character = clearRejectedAttempts(id);
  return NextResponse.json({ character });
}
