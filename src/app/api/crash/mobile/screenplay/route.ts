import { NextResponse } from "next/server";
import { readMobileGenJob } from "@/lib/mobileGenJob";
import { applyImportedStoryToJob } from "@/lib/mobileApplyScreenplay";
import { importPastedStory, parseMobilePaste } from "@/lib/mobilePasteScript";
import { canLockEpisode } from "@/lib/mobileJobReady";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST { jobId, script } — you write the episode (script + shots + beats)
 * as one paste. We lock it onto the pre-built cast and places, then plates
 * and audio follow. Grok does not write this.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      script?: string;
    };
    const jobId = (body.jobId || "").trim();
    const script = (body.script || "").trim();
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });
    if (!script) {
      return NextResponse.json(
        { error: "Paste the episode — script, shots, and beats. We don't write it." },
        { status: 400 },
      );
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (!canLockEpisode(job.phase)) {
      return NextResponse.json({
        error: "This episode is already animating. Open it in Crash Lab — don't start over.",
      }, { status: 409 });
    }
    if (!job.speakers.length) {
      return NextResponse.json({ error: "Add at least one character first" }, { status: 400 });
    }
    if (!job.scenes.length) {
      return NextResponse.json({ error: "Add at least one location first" }, { status: 400 });
    }

    const pasted = parseMobilePaste(script, job.styleId, job.prompt.trim() || "Untitled episode");
    const runTag = jobId.slice(-6);
    const title = `${pasted.title} ${runTag}`;
    const { folderName } = await importPastedStory({
      styleId: job.styleId,
      title,
      story: { ...pasted.story, campaignLabel: title },
    });

    const updated = await applyImportedStoryToJob({
      job,
      folderName,
      story: { ...pasted.story, campaignLabel: title },
      parsedCharacters: pasted.characters,
    });

    return NextResponse.json({ ok: true, job: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
