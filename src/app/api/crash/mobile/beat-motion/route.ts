import { NextResponse } from "next/server";
import { readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { stripLtxLipSyncLead } from "@/lib/mobileImageMotion";
import { upsertPendingClip } from "@/lib/mobileClipQueue";
import { isMobileSavedVoiceFile } from "@/lib/mobileSavedVoice";

export const runtime = "nodejs";

/**
 * POST { jobId, beatId, imageMotion } — keep the editable LTX Image motion
 * body on this beat. Lip-sync lead is prepended at send, not stored twice.
 * If the line already has a Saved mp3 + clip, re-queue so Generate video
 * runs again with the new motion (same as Save line).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      beatId?: string;
      imageMotion?: string;
    };
    const jobId = (body.jobId || "").trim();
    const beatId = (body.beatId || "").trim();
    const imageMotion = stripLtxLipSyncLead(body.imageMotion || "");
    if (!jobId || !beatId) {
      return NextResponse.json({ error: "Need jobId and beatId" }, { status: 400 });
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const story = await readMobileStory(job.styleId, job.folderName);
    let found = false;
    let beatVoice = "";
    const next = {
      ...story,
      scenes: story.scenes.map((sc) => ({
        ...sc,
        shots: sc.shots.map((sh) => ({
          ...sh,
          beats: sh.beats.map((b) => {
            if (b.id !== beatId) return b;
            found = true;
            beatVoice = (b.voiceFile || "").trim();
            return { ...b, imageMotion };
          }),
        })),
      })),
    };
    if (!found) {
      return NextResponse.json({ error: "That line isn't on this pack" }, { status: 404 });
    }
    await writeMobileStory(next, job.folderName);

    // Better motion after a done clip — put this beat back on pending so
    // Generate video sends it. Skip if there is no Saved mp3 yet.
    let updated = job;
    if (isMobileSavedVoiceFile(beatVoice)) {
      const clips = upsertPendingClip(job, next, beatId);
      const patched = await patchMobileGenJob(jobId, {
        clips,
        phase: job.phase === "animate" ? "review" : job.phase,
        error: "",
      });
      if (patched) updated = patched;
    }

    return NextResponse.json({ ok: true, imageMotion, job: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
