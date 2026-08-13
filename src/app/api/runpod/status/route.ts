import { NextResponse } from "next/server";
import {
  listRunpodPods,
  probeComfyUrl,
  runpodKeyPresent,
} from "@/lib/runpod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — RunPod key ok? list pods. Optional ?probe=1 checks Comfy :3000 proxy.
 * Never returns the API key.
 */
export async function GET(req: Request) {
  if (!runpodKeyPresent()) {
    return NextResponse.json({
      ok: false,
      connected: false,
      error: "Missing RUNPOD_API_KEY in MY MOVIES\\.env",
    });
  }

  const listed = await listRunpodPods();
  if (!listed.ok) {
    return NextResponse.json({
      ok: false,
      connected: false,
      error: listed.error,
    });
  }

  const probe =
    new URL(req.url).searchParams.get("probe") === "1" ||
    new URL(req.url).searchParams.get("probe") === "true";

  const running = listed.pods.filter((p) =>
    /RUNNING/i.test(p.desiredStatus),
  );

  let pods = listed.pods.map((p) => ({
    ...p,
    comfy: "skip" as "up" | "down" | "skip",
  }));

  if (probe) {
    pods = await Promise.all(
      listed.pods.map(async (p) => ({
        ...p,
        comfy: await probeComfyUrl(p.comfyUrl),
      })),
    );
  }

  return NextResponse.json({
    ok: true,
    connected: true,
    running: running.length,
    total: listed.pods.length,
    pods,
  });
}
