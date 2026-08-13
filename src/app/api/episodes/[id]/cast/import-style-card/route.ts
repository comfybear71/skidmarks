import { NextResponse } from "next/server";
import { importStyleCardIntoEpisodeCast } from "@/lib/crashSceneKitImport";
import { getEpisode } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** POST — copy a Crash style-card face into this episode's cast. */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getEpisode(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      thumbKey?: string;
      name?: string;
      approve?: boolean;
    };
    const result = importStyleCardIntoEpisodeCast({
      episodeId: id,
      styleId: String(body.styleId || ""),
      thumbKey: String(body.thumbKey || ""),
      name: body.name,
      approve: body.approve,
    });
    return NextResponse.json({
      ok: true,
      episode: result.episode,
      castId: result.castId,
      attemptId: result.attemptId,
      created: result.created,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
