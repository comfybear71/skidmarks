import { NextResponse } from "next/server";
import {
  runWanFxSmoke,
  type WanFxBoomSize,
  type WanFxDuration,
} from "@/lib/wanFxSmoke";

export const runtime = "nodejs";
export const maxDuration = 900;
export const dynamic = "force-dynamic";

type WanBody = {
  plateName?: string;
  prompt?: string;
  duration?: WanFxDuration;
  boom?: WanFxBoomSize;
  comfyUrl?: string;
};

/**
 * POST { plateName, prompt?, duration?, boom?, comfyUrl? }
 * Streams NDJSON progress — upload plate, queue WF_explosion_v1, pull mp4.
 * Never starts the pod.
 */
export async function POST(req: Request) {
  let body: WanBody;
  try {
    body = (await req.json()) as WanBody;
  } catch {
    return NextResponse.json({ error: "Bad JSON body" }, { status: 400 });
  }

  const plateName = (body.plateName || "").trim();
  if (!plateName) {
    return NextResponse.json(
      { error: "Pick a picture first (_XX_SPX\\_PLATES)" },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = async (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        await new Promise((r) => setImmediate(r));
      };
      try {
        await send({
          step: "resolving",
          message: "Finding Comfy…",
          plateName,
        });
        const result = await runWanFxSmoke({
          plateName,
          prompt: body.prompt,
          duration: body.duration,
          boom: body.boom,
          comfyUrl: body.comfyUrl,
          onProgress: (ev) => {
            void send({ plateName, ...ev });
          },
        });
        await send({
          step: "done",
          message: "Done",
          plateName,
          ...result,
          file: result.localMp4.split(/[/\\]/).pop(),
        });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        await send({
          step: "error",
          message: error,
          error,
          plateName,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
