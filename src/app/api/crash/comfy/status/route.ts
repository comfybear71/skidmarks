import { NextResponse } from "next/server";
import { comfyGetJson, resolveComfyUrl } from "@/lib/comfyClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET `/api/crash/comfy/status`
 * Live Comfy queue — WORKING vs IDLE for Animate.
 */
export async function GET() {
  try {
    const { preferComfyCloudLtx } = await import("@/lib/ltxCloudIa2v");
    const { COMFY_CLOUD_BASE } = await import("@/lib/comfyCloudClient");
    if (preferComfyCloudLtx()) {
      return NextResponse.json({
        ok: true,
        busy: false,
        running: 0,
        pending: 0,
        comfyUrl: COMFY_CLOUD_BASE,
        source: "cloud",
        cloud: true,
      });
    }

    const resolved = await resolveComfyUrl();
    if (!resolved.ok) {
      return NextResponse.json({
        ok: false,
        busy: false,
        running: 0,
        pending: 0,
        comfyUrl: "",
        source: "",
        error: resolved.error,
      });
    }

    const q = (await comfyGetJson(resolved.url, "/queue")) as {
      queue_running?: unknown[];
      queue_pending?: unknown[];
    };
    const running = Array.isArray(q.queue_running) ? q.queue_running.length : 0;
    const pending = Array.isArray(q.queue_pending) ? q.queue_pending.length : 0;
    return NextResponse.json({
      ok: true,
      busy: running + pending > 0,
      running,
      pending,
      comfyUrl: resolved.url,
      source: resolved.source,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        busy: false,
        running: 0,
        pending: 0,
        comfyUrl: "",
        source: "",
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    );
  }
}
