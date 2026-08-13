import { NextResponse } from "next/server";
import {
  resumeRunpodPod,
  runpodKeyPresent,
  stopRunpodPod,
} from "@/lib/runpod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { podId, action: "start" | "stop", gpuCount? }
 * Start = podResume · Stop = podStop. Never returns the API key.
 */
export async function POST(req: Request) {
  if (!runpodKeyPresent()) {
    return NextResponse.json(
      { ok: false, error: "Missing RUNPOD_API_KEY in MY MOVIES\\.env" },
      { status: 400 },
    );
  }

  let body: { podId?: string; action?: string; gpuCount?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Bad JSON" },
      { status: 400 },
    );
  }

  const podId = String(body.podId || "").trim();
  const action = String(body.action || "").toLowerCase();
  if (!podId) {
    return NextResponse.json(
      { ok: false, error: "Missing podId" },
      { status: 400 },
    );
  }

  if (action === "start") {
    const result = await resumeRunpodPod(podId, body.gpuCount ?? 1);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      action: "start",
      podId,
      desiredStatus: result.desiredStatus,
    });
  }

  if (action === "stop") {
    const result = await stopRunpodPod(podId);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      action: "stop",
      podId,
      desiredStatus: result.desiredStatus,
    });
  }

  return NextResponse.json(
    { ok: false, error: 'action must be "start" or "stop"' },
    { status: 400 },
  );
}
