import { NextResponse } from "next/server";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { runFaceSwap } from "@/lib/swapRun";
import { friendlySwapError } from "@/lib/swapErrors";
import type { SwapTargetRef } from "@/lib/swapCards";

export const runtime = "nodejs";
export const maxDuration = 300;

/** POST { styleId, castKey, castName, sourceKey, target } — FaceFusion swap */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      castKey?: string;
      castName?: string;
      sourceKey?: string;
      castOrder?: string[];
      target?: SwapTargetRef;
    };
    const styleId = parseStyleCardId(body.styleId || null);
    const castKey = String(body.castKey || "").trim();
    const castName = String(body.castName || "").trim();
    const sourceKey = String(body.sourceKey || "").trim();
    const target = body.target;

    if (!styleId || !castKey || !castName || !sourceKey || !target?.kind) {
      return NextResponse.json(
        { error: "Need styleId, castKey, castName, sourceKey, target" },
        { status: 400 },
      );
    }

    const castOrder = Array.isArray(body.castOrder)
      ? body.castOrder.filter((k): k is string => typeof k === "string")
      : undefined;

    const { label } = await runFaceSwap({
      styleId,
      castKey,
      castName,
      sourceKey,
      target,
      castOrder,
    });

    return NextResponse.json({
      ok: true,
      label,
      url: `/api/crash/swap/file?styleId=${encodeURIComponent(styleId)}&file=${encodeURIComponent(label.resultFile)}&t=${Date.now()}`,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: friendlySwapError(raw) }, { status: 500 });
  }
}
