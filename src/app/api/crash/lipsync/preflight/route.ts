import { NextResponse } from "next/server";
import { comfyLipsyncPreflight } from "@/lib/lipsyncPreflight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET/POST `/api/crash/lipsync/preflight`
 * Optional JSON/query: { comfyUrl? }
 * → { ok, missing, comfyUrl, source, reachable, hint, error? }
 */
async function run(comfyUrl?: string) {
  const result = await comfyLipsyncPreflight(comfyUrl);
  return NextResponse.json(result, { status: result.reachable ? 200 : 503 });
}

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("comfyUrl") || undefined;
  try {
    return await run(url || undefined);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        missing: [],
        comfyUrl: "",
        source: "",
        reachable: false,
        hint: "Preflight crashed — check Studio server log",
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  let comfyUrl: string | undefined;
  try {
    const body = (await req.json()) as { comfyUrl?: string };
    comfyUrl = body.comfyUrl?.trim() || undefined;
  } catch {
    /* empty body ok */
  }
  try {
    return await run(comfyUrl);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        missing: [],
        comfyUrl: "",
        source: "",
        reachable: false,
        hint: "Preflight crashed — check Studio server log",
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
