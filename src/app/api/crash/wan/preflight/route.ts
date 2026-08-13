import { NextResponse } from "next/server";
import { comfyWanFxPreflight } from "@/lib/wanFxPreflight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET/POST `/api/crash/wan/preflight`
 * Probe Comfy for Wan FX nodes. Never starts the pod.
 */
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("comfyUrl") || undefined;
  const result = await comfyWanFxPreflight(url || undefined);
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  let comfyUrl: string | undefined;
  try {
    const body = (await req.json()) as { comfyUrl?: string };
    comfyUrl = body.comfyUrl;
  } catch {
    /* empty body ok */
  }
  const result = await comfyWanFxPreflight(comfyUrl);
  return NextResponse.json(result);
}
