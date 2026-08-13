import { NextResponse } from "next/server";
import { patchLtxBeatVerdict } from "@/lib/ltxSmoke";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import type { ShowStyleId } from "@/lib/showStylePresets";

export const runtime = "nodejs";

/** POST { styleId, beatId, verdict: "pass"|"fail"|"" } — QC a landed LTX take */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      beatId?: string;
      verdict?: string;
    };
    const styleId = (parseStyleCardId(body.styleId || null) ||
      "") as ShowStyleId;
    const beatId = String(body.beatId || "").trim();
    const raw = String(body.verdict || "").trim().toLowerCase();
    const verdict =
      raw === "pass" || raw === "fail" ? raw : ("" as const);

    if (!styleId || !beatId) {
      return NextResponse.json(
        { error: "Need styleId and beatId" },
        { status: 400 },
      );
    }

    const entry = patchLtxBeatVerdict(styleId, beatId, verdict);
    if (!entry) {
      return NextResponse.json(
        { error: "No LTX take for that beat yet" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, entry });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
