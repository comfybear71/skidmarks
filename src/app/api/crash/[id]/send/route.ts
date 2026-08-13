import { NextResponse } from "next/server";
import { getCrashJob, readCrashTakeBuffer } from "@/lib/crash";
import { setShotPlate } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const job = getCrashJob(id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    takeId?: string;
    episodeId?: string;
    sceneId?: string;
    shotId?: string;
    beatId?: string;
  };
  const takeId = body.takeId || job.approvedTakeId || job.takes[0]?.id;
  if (!takeId || !body.episodeId || !body.sceneId || !body.shotId) {
    return NextResponse.json(
      { error: "Need takeId, episodeId, sceneId, shotId" },
      { status: 400 },
    );
  }
  const packed = readCrashTakeBuffer(id, takeId);
  if (!packed)
    return NextResponse.json({ error: "Take file missing" }, { status: 404 });

  const episode = setShotPlate(body.episodeId, body.sceneId, body.shotId, {
    buffer: packed.buffer,
    ext: packed.ext,
    beatId: body.beatId,
  });
  if (!episode)
    return NextResponse.json({ error: "Episode/shot not found" }, { status: 404 });
  return NextResponse.json({
    episode,
    plateFile:
      episode.scenes
        .find((s) => s.id === body.sceneId)
        ?.shots.find((sh) => sh.id === body.shotId)
        ?.beats?.find((b) => b.id === (body.beatId || ""))?.plateFile ||
      "sent",
  });
}
