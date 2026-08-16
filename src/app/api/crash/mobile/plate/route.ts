import path from "path";
import { NextResponse } from "next/server";
import { compositeShotPlate } from "@/lib/mobilePlates";
import { hydrateMobilePackOnDisk, readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { uploadMobileMedia } from "@/lib/mobileMediaStore";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { CRASH_DIR } from "@/lib/paths";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * POST { jobId, shotId, staging } — save the plate prompt and rebuild
 * that one still. Faces and places stay. Not a lineup in the foreground.
 * POST { jobId, shotId, action: "drop" } — clear the shot still pointer.
 * Blob/disk stay (park, don't delete). The strip shows an empty slot.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      shotId?: string;
      staging?: string;
      action?: string;
    };
    const jobId = (body.jobId || "").trim();
    const shotId = (body.shotId || "").trim();
    const staging = (body.staging || "").trim();
    const drop = (body.action || "").trim().toLowerCase() === "drop";
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });
    if (!shotId) return NextResponse.json({ error: "Need shotId" }, { status: 400 });
    if (!drop && !staging) {
      return NextResponse.json(
        { error: "Say who sits where — not two people stuck in the front." },
        { status: 400 },
      );
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (!job.folderName) {
      return NextResponse.json({ error: "Lock the episode first" }, { status: 400 });
    }

    await hydrateMobilePackOnDisk(job.styleId, job.folderName);
    const story = await readMobileStory(job.styleId, job.folderName);
    let scene = story.scenes.find((sc) => sc.shots.some((sh) => sh.id === shotId));
    let shot = scene?.shots.find((sh) => sh.id === shotId);
    if (!scene || !shot) {
      return NextResponse.json({ error: "That shot is not in the story" }, { status: 404 });
    }

    if (drop) {
      const dropped = story.scenes.map((sc) => ({
        ...sc,
        shots: sc.shots.map((sh) => (sh.id === shotId ? { ...sh, plateFile: "" } : sh)),
      }));
      await writeMobileStory({ ...story, scenes: dropped }, job.folderName);
      const shots = job.shots.map((s) =>
        s.shotId === shotId ? { ...s, plateFile: "", error: "" } : s,
      );
      const updated = await patchMobileGenJob(jobId, { shots, error: "" });
      return NextResponse.json({ ok: true, job: updated, plateFile: "" });
    }

    const nextScenes = story.scenes.map((sc) => ({
      ...sc,
      shots: sc.shots.map((sh) => (sh.id === shotId ? { ...sh, staging, plateFile: "" } : sh)),
    }));
    const nextStory = { ...story, scenes: nextScenes };
    await writeMobileStory(nextStory, job.folderName);
    scene = nextStory.scenes.find((sc) => sc.shots.some((sh) => sh.id === shotId))!;
    shot = scene.shots.find((sh) => sh.id === shotId)!;

    const talking = new Set(
      nextStory.scenes.flatMap((sc) =>
        sc.shots.flatMap((sh) => sh.beats.map((b) => b.speaker.trim()).filter(Boolean)),
      ),
    );
    const silentCast = job.speakers.filter((n) => n.trim() && !talking.has(n.trim()));
    const fileName = await compositeShotPlate(job.styleId, scene, shot, {
      silentCast,
      styleRealism: job.styleRealism,
      job,
    });
    try {
      await uploadMobileMedia({
        styleId: job.styleId,
        folderName: job.folderName,
        kind: "plates",
        localPath: path.join(CRASH_DIR, "gen", fileName),
      });
    } catch {
      /* still usable this request */
    }

    const plated = nextStory.scenes.map((sc) => ({
      ...sc,
      shots: sc.shots.map((sh) => (sh.id === shotId ? { ...sh, plateFile: fileName, staging } : sh)),
    }));
    await writeMobileStory({ ...nextStory, scenes: plated }, job.folderName);
    const shots = job.shots.map((s) =>
      s.shotId === shotId ? { ...s, plateFile: fileName, error: "" } : s,
    );
    const updated = await patchMobileGenJob(jobId, { shots, error: "" });
    return NextResponse.json({ ok: true, job: updated, plateFile: fileName });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
