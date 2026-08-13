import { NextResponse } from "next/server";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import { runFaceSwap } from "@/lib/swapRun";
import type { SwapTargetRef } from "@/lib/swapCards";

export const runtime = "nodejs";
export const maxDuration = 300;

type CastRow = { key: string; name: string };

/** POST { styleId, target, cast: CastRow[] } — swap each face in order (multi-person chain) */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      styleId?: string;
      target?: SwapTargetRef;
      cast?: CastRow[];
    };

    const styleId = parseStyleCardId(body.styleId || null);
    const target = body.target;
    const cast = Array.isArray(body.cast)
      ? body.cast.filter((c) => c?.key && c?.name)
      : [];

    if (!styleId || !target?.kind || !cast.length) {
      return NextResponse.json(
        { error: "Need styleId, target, and cast list" },
        { status: 400 },
      );
    }

    const castOrder = cast.map((c) => c.key);
    const results: Record<string, unknown> = {};
    const errors: string[] = [];

    for (const person of cast) {
      try {
        const { label } = await runFaceSwap({
          styleId,
          castKey: person.key,
          castName: person.name,
          sourceKey: person.key,
          target,
          castOrder,
        });
        results[person.key] = label;
      } catch (e) {
        errors.push(
          `${person.name}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    if (!Object.keys(results).length) {
      return NextResponse.json(
        { error: errors.join(" · ") || "All swaps failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      results,
      errors: errors.length ? errors : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
