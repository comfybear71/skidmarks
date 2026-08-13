import path from "path";
import { NextResponse } from "next/server";
import {
  addShotRender,
  getEpisode,
  setShotPlate,
  setShotVoiceFile,
} from "@/lib/store";

export const runtime = "nodejs";

type Ctx = {
  params: Promise<{
    id: string;
    sceneId: string;
    shotId: string;
  }>;
};

/** Drag-drop hub: image → plate, audio → voice, video → render */
export async function POST(req: Request, ctx: Ctx) {
  const { id, sceneId, shotId } = await ctx.params;
  if (!getEpisode(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const form = await req.formData();
  const note = String(form.get("note") || "");
  /** success → Keeper (approved), park → salvage bin */
  const dest = String(form.get("dest") || "").toLowerCase();
  const file = form.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return NextResponse.json({ error: "Need a file" }, { status: 400 });
  }

  const f = file as File;
  const buffer = Buffer.from(await f.arrayBuffer());
  let ext = path.extname(f.name || "").toLowerCase() || "";
  if (!ext.startsWith(".") && ext) ext = `.${ext}`;
  const mime = (f.type || "").toLowerCase();
  const name = (f.name || "").toLowerCase();

  const isImage =
    mime.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext);
  const isAudio =
    mime.startsWith("audio/") || [".mp3", ".wav", ".m4a", ".ogg"].includes(ext);
  const isVideo =
    mime.startsWith("video/") ||
    [".mp4", ".webm", ".mov"].includes(ext) ||
    name.endsWith(".mp4");

  const beatId = String(form.get("beatId") || "") || undefined;

  if (isImage) {
    const episode = setShotPlate(id, sceneId, shotId, {
      buffer,
      ext: ext || ".png",
      beatId,
    });
    if (!episode)
      return NextResponse.json({ error: "Shot not found" }, { status: 404 });
    return NextResponse.json({ episode, kind: "plate", beatId });
  }

  if (isAudio) {
    const episode = setShotVoiceFile(id, sceneId, shotId, {
      buffer,
      ext: ext || ".mp3",
      beatId,
    });
    if (!episode)
      return NextResponse.json({ error: "Shot not found" }, { status: 404 });
    return NextResponse.json({ episode, kind: "voice", beatId });
  }

  if (isVideo) {
    const status =
      dest === "success" || dest === "keeper" || dest === "approved"
        ? ("approved" as const)
        : dest === "park" || dest === "parked"
          ? ("parked" as const)
          : ("pending" as const);
    const result = addShotRender(id, sceneId, shotId, {
      buffer,
      ext: ext || ".mp4",
      note,
      status,
    });
    if (!result)
      return NextResponse.json({ error: "Shot not found" }, { status: 404 });
    return NextResponse.json({
      episode: result.episode,
      kind: "render",
      render: result.render,
      dest: status === "approved" ? "success" : status === "parked" ? "park" : "pending",
    });
  }

  return NextResponse.json(
    { error: "Drop an image, mp3, or mp4" },
    { status: 400 },
  );
}
