import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import {
  morphRoot,
  readLastMorph,
  runMorphFromDraft,
  type MorphToolsOpts,
} from "@/lib/morph";
import { sortableId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/** GET — last morph result (survives refresh) */
export async function GET() {
  const last = readLastMorph();
  return NextResponse.json({ last });
}

/**
 * POST — morph the draft tray.
 * JSON body (optional tools) OR multipart with optional `audio` file + `tools` JSON string.
 */
export async function POST(req: Request) {
  try {
    const ctype = req.headers.get("content-type") || "";
    let tools: MorphToolsOpts = {};

    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      const toolsRaw = String(form.get("tools") || "{}");
      try {
        tools = JSON.parse(toolsRaw) as MorphToolsOpts;
      } catch {
        tools = {};
      }
      const audio = form.get("audio");
      if (audio instanceof File && audio.size > 0) {
        const dir = path.join(morphRoot(), "audio");
        fs.mkdirSync(dir, { recursive: true });
        const ext =
          path.extname(audio.name || "").toLowerCase() ||
          (audio.type.includes("mpeg") || audio.type.includes("mp3")
            ? ".mp3"
            : audio.type.includes("wav")
              ? ".wav"
              : ".m4a");
        const name = `${sortableId("maud")}${ext.startsWith(".") ? ext : `.${ext}`}`;
        const dest = path.join(dir, name);
        fs.writeFileSync(dest, Buffer.from(await audio.arrayBuffer()));
        tools.audioPath = dest;
      }
    } else if (ctype.includes("application/json")) {
      tools = (await req.json().catch(() => ({}))) as MorphToolsOpts;
    }

    const result = await runMorphFromDraft(tools);
    return NextResponse.json({
      runId: result.runId,
      url: result.relativeUrl,
      seconds: result.seconds,
      frames: result.frames,
      fps: result.fps,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
