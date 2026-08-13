import { NextResponse } from "next/server";
import { assignCrashLabToBeat } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST { entryId, sceneId, shotId, beatId? }
 * Wire a Crash Lab shelf item onto a beat as plateFile.
 */
export async function POST(req: Request, ctx: Ctx) {
  const { id: episodeId } = await ctx.params;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      entryId?: string;
      sceneId?: string;
      shotId?: string;
      beatId?: string;
    };
    if (!body.entryId || !body.sceneId || !body.shotId) {
      return NextResponse.json(
        { error: "Need entryId, sceneId, shotId" },
        { status: 400 },
      );
    }
    const episode = assignCrashLabToBeat({
      episodeId,
      entryId: body.entryId,
      sceneId: body.sceneId,
      shotId: body.shotId,
      beatId: body.beatId,
    });
    if (!episode) {
      return NextResponse.json(
        { error: "Episode / entry / shot not found" },
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
