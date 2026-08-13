import { NextResponse } from "next/server";
import { removeCrashLabEntry } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * DELETE { entryId }
 * Drop a Crash Lab shelf item.
 */
export async function DELETE(req: Request, ctx: Ctx) {
  const { id: episodeId } = await ctx.params;
  try {
    const body = (await req.json().catch(() => ({}))) as { entryId?: string };
    if (!body.entryId) {
      return NextResponse.json({ error: "Need entryId" }, { status: 400 });
    }
    const episode = removeCrashLabEntry({
      episodeId,
      entryId: body.entryId,
    });
    if (!episode) {
      return NextResponse.json(
        { error: "Episode / entry not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, episode });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
