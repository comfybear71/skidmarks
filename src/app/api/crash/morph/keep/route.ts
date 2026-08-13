import { NextResponse } from "next/server";
import { copyMorphToKeepers } from "@/lib/morph";

export const runtime = "nodejs";

/** POST { runId, label? } → copy morph.mp4 into crash/morph/keepers/ */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      runId?: string;
      label?: string;
    };
    if (!body.runId || !/^morph_[\w]+$/.test(body.runId)) {
      return NextResponse.json({ error: "Need runId" }, { status: 400 });
    }
    const dest = copyMorphToKeepers(body.runId, body.label);
    return NextResponse.json({ ok: true, path: dest });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
