import { NextResponse } from "next/server";
import { createMobileGenJob, patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { parseStyleCardId } from "@/lib/styleCardThumbs";
import {
  applyCastSeed,
  canConjureCastFromStyle,
  castSeedFromJob,
} from "@/lib/mobileJobFromCast";
import { findReusableCastCards } from "@/lib/mobileCastReuse";
import { newId } from "@/lib/types";

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
      deskId?: string;
      artist?: string;
      songTitle?: string;
      /** Skidmarks: new episode from an older job's CAST. Old pack stays. */
      fromJobId?: string;
    };
    const fromJobId = (body.fromJobId || "").trim();
    if (fromJobId) {
      const source = await readMobileGenJob(fromJobId);
      if (!source) return NextResponse.json({ error: "That episode was not found" }, { status: 404 });
      if (!canConjureCastFromStyle(source.styleId)) {
        return NextResponse.json(
          { error: "New from this cast is Skidmarks only. Music video still uses a saved band." },
          { status: 400 },
        );
      }
      const seed = castSeedFromJob(source);
      if (!seed.speakers.length) {
        return NextResponse.json({ error: "That episode has no CAST to bring back" }, { status: 400 });
      }
      const prompt =
        (body.prompt || "").trim() ||
        (source.prompt || "").trim() ||
        "New episode";
      const created = await createMobileGenJob({
        styleId: source.styleId,
        prompt,
        targetDurationSec: 0,
        secondsPerShot: DEFAULT_SECONDS_PER_SHOT,
        styleRealism:
          typeof body.styleRealism === "number" ? body.styleRealism : source.styleRealism,
        deskId: body.deskId || source.deskId,
      });
      const reusable = await findReusableCastCards(source.styleId, seed.speakers);
      const castCandidates = { ...seed.castCandidates };
      for (const [name, card] of Object.entries(reusable)) {
        const prior = castCandidates[name] || [];
        if (prior.some((c) => c.approved)) continue;
        castCandidates[name] = [
          {
            id: card.fileName,
            fileName: card.fileName,
            approved: true,
            prompt: card.look || "",
          },
        ];
      }
      const scenes = seed.scenes.map((s) => ({
        ...s,
        id: newId("scene"),
      }));
      const updated = await patchMobileGenJob(
        created.id,
        applyCastSeed(created, { ...seed, castCandidates }, scenes),
      );
      return NextResponse.json({ ok: true, job: updated || created, fromJobId });
    }

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
      deskId: body.deskId,
      artist: body.artist,
      songTitle: body.songTitle,
    });
    return NextResponse.json({ ok: true, job });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
