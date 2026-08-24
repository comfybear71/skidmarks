import { NextResponse } from "next/server";
import { hydrateMobilePackOnDisk, readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import {
  appendSoloCastShot,
  episodePlateCounts,
  missingCastPlacePlates,
  nextUnplatedEpisodeShot,
  storyShotSpeaker,
} from "@/lib/mobilePlateGraph";
import { compileMattyBarGroupPosition } from "@/lib/mobileCastPlaces";
import { rebuildShotPlate } from "@/lib/mobilePlateRebuild";
import { resolvePlateStaging } from "@/lib/mobilePlateScript";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST { jobId } — one step of the episode plate graph.
 * pick → compile → draw → qa (retry ≤ 3) → next | halt_lines
 * Cast with a picked face gets solo cards at their house rooms.
 * Does not Save speech. Does not Generate. Skips shots that already have a still.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      /** Only plate shots at this place — do not mint Jo's room while you stare at Orbiting servo. */
      sceneId?: string;
    };
    const jobId = (body.jobId || "").trim();
    const sceneIdFilter = (body.sceneId || "").trim();
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

    let job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (!job.folderName) {
      return NextResponse.json({ error: "Lock the episode first" }, { status: 400 });
    }

    await hydrateMobilePackOnDisk(job.styleId, job.folderName);
    let story = await readMobileStory(job.styleId, job.folderName);
    const counts = episodePlateCounts(job, story);
    let next = nextUnplatedEpisodeShot(job, story, sceneIdFilter || undefined);
    if (!next) {
      // Place-scoped plate: never invent cast house cards for another room.
      if (sceneIdFilter) {
        return NextResponse.json({
          ok: true,
          done: true,
          node: "halt_lines",
          job,
          doneCount: counts.done,
          total: counts.total,
          sceneId: sceneIdFilter,
        });
      }
      const missing = missingCastPlacePlates(job, story);
      const need = missing[0];
      if (!need) {
        return NextResponse.json({
          ok: true,
          done: true,
          node: "halt_lines",
          job,
          doneCount: counts.done,
          total: counts.total,
        });
      }
      const minted = appendSoloCastShot({
        job,
        story,
        speaker: need.speaker,
        speakers: need.speakers,
        ensemble: need.ensemble,
        sceneId: need.sceneId,
      });
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
    const groupNames = (storyShot?.beats || [])
      .map((b) => b.speaker.trim())
      .filter(Boolean);
    const stagingIn =
      resolvePlateStaging({
        existingStaging: storyShot?.staging,
        summary: storyShot?.summary,
        speaker,
        speakers: groupNames,
        roster: job.speakers,
        place: placeName,
      }) ||
      (groupNames.length > 1
        ? compileMattyBarGroupPosition(groupNames, placeName)
        : "");

    const rebuilt = await rebuildShotPlate({
      job,
      story,
      shotId: next.shotId,
      stagingIn,
      qa: true,
    });
    if (rebuilt.qa && rebuilt.qa.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          error:
            rebuilt.job.shots.find((s) => s.shotId === next.shotId)?.error ||
            `Still failed proof (${(rebuilt.qa.fails || []).join(", ")}). Tweak Position and Redo.`,
          node: "qa",
          job: rebuilt.job,
          shotId: next.shotId,
          speaker,
          plateFile: rebuilt.plateFile,
          staging: rebuilt.staging,
          qa: rebuilt.qa,
          qaAttempts: rebuilt.qaAttempts,
          doneCount: counts.done,
          total: counts.total,
        },
        { status: 422 },
      );
    }
    const after = episodePlateCounts(rebuilt.job, rebuilt.story);
    const more = Boolean(
      nextUnplatedEpisodeShot(rebuilt.job, rebuilt.story) ||
        missingCastPlacePlates(rebuilt.job, rebuilt.story).length,
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
