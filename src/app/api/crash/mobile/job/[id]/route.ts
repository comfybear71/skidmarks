import { NextResponse } from "next/server";
import {
  deleteMobileGenJob,
  MOBILE_JOB_READ_MISS,
  patchMobileGenJob,
  readMobileGenJob,
} from "@/lib/mobileGenJob";
import { bounceStuckStitch } from "@/lib/mobilePipeline";
import { autoPickSunnyTakes } from "@/lib/sunnyEpisodeSeed";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH { prompt?, artist?, songTitle?, styleRealism? } — fix the start. Same job. */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const job = await readMobileGenJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as {
    prompt?: string;
    artist?: string;
    songTitle?: string;
    styleRealism?: number;
  };
  const patch: {
    prompt?: string;
    artist?: string;
    songTitle?: string;
    styleRealism?: number;
    error: string;
  } = { error: "" };
  if (typeof body.prompt === "string") {
    const prompt = body.prompt.trim();
    if (!prompt) return NextResponse.json({ error: "Need a vibe." }, { status: 400 });
    patch.prompt = prompt;
  }
  if (typeof body.artist === "string") patch.artist = body.artist.trim();
  if (typeof body.songTitle === "string") patch.songTitle = body.songTitle.trim();
  if (body.styleRealism !== undefined) {
    const raw = Number(body.styleRealism);
    if (!Number.isFinite(raw)) {
      return NextResponse.json({ error: "Need a look slider number." }, { status: 400 });
    }
    patch.styleRealism = Math.max(0, Math.min(100, Math.round(raw)));
  }
  const updated = await patchMobileGenJob(id, patch);
  return NextResponse.json({ ok: true, job: updated });
}

/** GET — poll a mobile run's current state. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let job = await readMobileGenJob(id);
  if (!job) return NextResponse.json({ error: MOBILE_JOB_READ_MISS }, { status: 404 });
  const unstick = bounceStuckStitch({ phase: job.phase, error: job.error });
  if (unstick) {
    job = (await patchMobileGenJob(id, { phase: unstick, error: "" })) || job;
  }
  const picked = autoPickSunnyTakes(job);
  if (picked.changed) {
    job =
      (await patchMobileGenJob(id, {
        castCandidates: picked.castCandidates,
        locationCandidates: picked.locationCandidates,
      })) || job;
  }
  return NextResponse.json(
    { ok: true, job },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** DELETE — drop the job from Your episodes (document only; no media wipe). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const clean = (id || "").trim();
  if (!clean) return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  const existed = await readMobileGenJob(clean);
  if (!existed) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const ok = await deleteMobileGenJob(clean);
  if (!ok) return NextResponse.json({ error: "Couldn't delete episode" }, { status: 500 });
  return NextResponse.json({ ok: true, id: clean });
}
