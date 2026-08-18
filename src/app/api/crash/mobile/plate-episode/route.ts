import { NextResponse } from "next/server";
import { hydrateMobilePackOnDisk, readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import {
  appendSoloCastShot,
  episodePlateCounts,
  nextUnplatedEpisodeShot,
  speakersMissingEpisodeShot,
  storyShotSpeaker,
} from "@/lib/mobilePlateGraph";
import { rebuildShotPlate } from "@/lib/mobilePlateRebuild";
import { compileScriptedPosition } from "@/lib/mobilePlateScript";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST { jobId } — one step of the episode plate graph.
 * pick → compile → draw → qa (retry ≤ 3) → next | halt_lines
 * Cast with a picked face and no shot gets a solo card first.
 * Does not Save speech. Does not Generate. Skips shots that already have a still.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { jobId?: string };
    const jobId = (body.jobId || "").trim();
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

    let job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (!job.folderName) {
      return NextResponse.json({ error: "Lock the episode first" }, { status: 400 });
    }

    await hydrateMobilePackOnDisk(job.styleId, job.folderName);
    let story = await readMobileStory(job.styleId, job.folderName);
    const counts = episodePlateCounts(job, story);
    let next = nextUnplatedEpisodeShot(job, story);
    if (!next) {
      const missing = speakersMissingEpisodeShot(job, story);
      const speaker = missing[0];
      if (!speaker) {
        return NextResponse.json({
          ok: true,
          done: true,
          node: "halt_lines",
          job,
          doneCount: counts.done,
          total: counts.total,
        });
      }
      const minted = appendSoloCastShot({ job, story, speaker });
      await writeMobileStory(minted.story, job.folderName);
      const patched = await patchMobileGenJob(jobId, { shots: minted.shots, error: "" });
      if (!patched) throw new Error("Job vanished while adding a cast plate");
      job = patched;
      story = minted.story;
      next = { shotId: minted.shotId, sceneId: minted.sceneId, plateFile: "" };
    }

    const { speaker, placeName } = storyShotSpeaker(story, next.shotId);
    if (!speaker) {
      return NextResponse.json(
        {
          error: `Shot needs a character before it can plate.`,
          shotId: next.shotId,
          node: "pick",
          doneCount: counts.done,
          total: counts.total,
        },
        { status: 400 },
      );
    }

    const storyShot = story.scenes
      .flatMap((sc) => sc.shots)
      .find((sh) => sh.id === next.shotId);
    const stagingIn =
      (storyShot?.staging || "").trim() ||
      compileScriptedPosition({ name: speaker, place: placeName });

    const rebuilt = await rebuildShotPlate({
      job,
      story,
      shotId: next.shotId,
      stagingIn,
      qa: true,
    });
    const after = episodePlateCounts(rebuilt.job, rebuilt.story);
    const more = Boolean(
      nextUnplatedEpisodeShot(rebuilt.job, rebuilt.story) ||
        speakersMissingEpisodeShot(rebuilt.job, rebuilt.story).length,
    );
    return NextResponse.json({
      ok: true,
      done: !more,
      node: more ? "next" : "halt_lines",
      job: rebuilt.job,
      shotId: next.shotId,
      speaker,
      plateFile: rebuilt.plateFile,
      staging: rebuilt.staging,
      qa: rebuilt.qa,
      qaAttempts: rebuilt.qaAttempts,
      doneCount: after.done,
      total: after.total,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
