import path from "path";
import { NextResponse } from "next/server";
import {
  addShotRender,
  getEpisode,
  setShotRenderStatus,
} from "@/lib/store";
import type { AttemptStatus } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{
    id: string;
    sceneId: string;
    shotId: string;
  }>;
};

export async function POST(req: Request, ctx: Ctx) {
  const { id, sceneId, shotId } = await ctx.params;
  if (!getEpisode(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const form = await req.formData();
  const note = String(form.get("note") || "");
  const file = form.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return NextResponse.json({ error: "Need an mp4 file" }, { status: 400 });
  }

  const f = file as File;
  const buffer = Buffer.from(await f.arrayBuffer());
  let ext = path.extname(f.name || "").toLowerCase() || ".mp4";
  if (!ext.startsWith(".")) ext = `.${ext}`;

  const dest = String(form.get("dest") || "").toLowerCase();
  const status =
    dest === "success" || dest === "keeper" || dest === "approved"
      ? ("approved" as const)
      : dest === "park" || dest === "parked"
        ? ("parked" as const)
        : ("pending" as const);
  const result = addShotRender(id, sceneId, shotId, {
    buffer,
    ext,
    note,
    status,
  });
  if (!result) {
    return NextResponse.json({ error: "Shot not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id, sceneId, shotId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    renderId?: string;
    status?: AttemptStatus;
  };
  if (!body.renderId || !body.status) {
    return NextResponse.json(
      { error: "Need renderId + status" },
      { status: 400 },
    );
  }
  const episode = setShotRenderStatus(
    id,
    sceneId,
    shotId,
    body.renderId,
    body.status,
  );
  if (!episode) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ episode });
}
