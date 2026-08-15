import { NextResponse } from "next/server";
import { createMobileGenJob } from "@/lib/mobileGenJob";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";

const DEFAULT_SECONDS_PER_SHOT = 5;

/** POST { prompt, styleId, targetDurationSec, secondsPerShot? } — create a new mobile run. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      prompt?: string;
      styleId?: string;
      targetDurationSec?: number;
      secondsPerShot?: number;
    };
    const prompt = (body.prompt || "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "Need a prompt" }, { status: 400 });
    }
    const styleId = parseStyleCardId(body.styleId || null);
    if (!styleId) {
      return NextResponse.json({ error: "Need a valid styleId" }, { status: 400 });
    }
    const targetDurationSec = Number(body.targetDurationSec);
    if (!Number.isFinite(targetDurationSec) || targetDurationSec <= 0) {
      return NextResponse.json({ error: "Need targetDurationSec" }, { status: 400 });
    }
    const secondsPerShot =
      Number(body.secondsPerShot) > 0 ? Number(body.secondsPerShot) : DEFAULT_SECONDS_PER_SHOT;

    const job = await createMobileGenJob({
      styleId,
      prompt,
      targetDurationSec,
      secondsPerShot,
    });
    return NextResponse.json({ ok: true, job });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
