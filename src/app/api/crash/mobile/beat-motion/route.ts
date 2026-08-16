import { NextResponse } from "next/server";
import { readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { readMobileGenJob } from "@/lib/mobileGenJob";
import { stripLtxLipSyncLead } from "@/lib/mobileImageMotion";

export const runtime = "nodejs";

/**
 * POST { jobId, beatId, imageMotion } — keep the editable LTX Image motion
 * body on this beat. Lip-sync lead is prepended at send, not stored twice.
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
    const next = {
      ...story,
      scenes: story.scenes.map((sc) => ({
        ...sc,
        shots: sc.shots.map((sh) => ({
          ...sh,
          beats: sh.beats.map((b) => {
            if (b.id !== beatId) return b;
            found = true;
            return { ...b, imageMotion };
          }),
        })),
      })),
    };
    if (!found) {
      return NextResponse.json({ error: "That line isn't on this pack" }, { status: 404 });
    }
    await writeMobileStory(next, job.folderName);
    return NextResponse.json({ ok: true, imageMotion });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
