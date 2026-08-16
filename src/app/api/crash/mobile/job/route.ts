import { NextResponse } from "next/server";
import { createMobileGenJob } from "@/lib/mobileGenJob";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";

const DEFAULT_SECONDS_PER_SHOT = 5;

/** POST { prompt, styleId, styleRealism? } — create a new mobile run.
 * Runtime is not chosen here. Clip length comes from the voiced lines
 * and plates once those exist; the script is sized from the locations. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      prompt?: string;
      styleId?: string;
      targetDurationSec?: number;
      secondsPerShot?: number;
      styleRealism?: number;
    };
    const prompt = (body.prompt || "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "Need a prompt" }, { status: 400 });
    }
    const styleId = parseStyleCardId(body.styleId || null);
    if (!styleId) {
      return NextResponse.json({ error: "Need a valid styleId" }, { status: 400 });
    }
    // Kept on the job doc so older runs still parse. No longer a planning input.
    const targetDurationSec =
      Number(body.targetDurationSec) > 0 ? Number(body.targetDurationSec) : 0;
    const secondsPerShot =
      Number(body.secondsPerShot) > 0 ? Number(body.secondsPerShot) : DEFAULT_SECONDS_PER_SHOT;

    // Omitted (or out of range) leaves it undefined so the style preset's own
    // default still applies — same as before the slider existed.
    const rawRealism = Number(body.styleRealism);
    const styleRealism = Number.isFinite(rawRealism)
      ? Math.max(0, Math.min(100, Math.round(rawRealism)))
      : undefined;

    const job = await createMobileGenJob({
      styleId,
      prompt,
      targetDurationSec,
      secondsPerShot,
      styleRealism,
    });
    return NextResponse.json({ ok: true, job });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
