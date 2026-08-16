import path from "path";
import { NextResponse } from "next/server";
import { compositeShotPlate } from "@/lib/mobilePlates";
import { hydrateMobilePackOnDisk, readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { uploadMobileMedia } from "@/lib/mobileMediaStore";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import type { CrashStoryDoc } from "@/lib/crashStoryTypes";
import { newId } from "@/lib/types";
import { CRASH_DIR } from "@/lib/paths";

export const runtime = "nodejs";
export const maxDuration = 180;

function patchShotFields(
  story: CrashStoryDoc,
  shotId: string,
  patch: { staging?: string; summary?: string; plateFile?: string },
): CrashStoryDoc {
  return {
    ...story,
    scenes: story.scenes.map((sc) => ({
      ...sc,
      shots: sc.shots.map((sh) => (sh.id === shotId ? { ...sh, ...patch } : sh)),
    })),
  };
}

/**
 * POST { jobId, shotId, staging } — save the plate prompt and rebuild
 * that one still. Faces and places stay. Not a lineup in the foreground.
 * POST { jobId, shotId, action: "save", summary?, staging? } — write the
 * action / tweak text. Does not composite.
 * POST { jobId, shotId, action: "drop" } — clear the shot still pointer.
 * Blob/disk stay (park, don't delete). The strip shows an empty slot.
 * POST { jobId, sceneId, speaker, action: "add" } — add a new solo shot
 * card for one character at that location. One beat, that speaker only.
 * POST { jobId, shotId, action: "remove" } — take the shot out of the
 * strip entirely (add's undo). Any plate/audio it made stays on disk/Blob,
 * just unlinked — same park-don't-delete rule as "drop".
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      shotId?: string;
      sceneId?: string;
      speaker?: string;
      staging?: string;
      summary?: string;
      action?: string;
    };
    const jobId = (body.jobId || "").trim();
    const shotId = (body.shotId || "").trim();
    const sceneIdIn = (body.sceneId || "").trim();
    const speakerIn = (body.speaker || "").trim();
    const stagingIn = body.staging !== undefined ? String(body.staging) : undefined;
    const summaryIn = body.summary !== undefined ? String(body.summary) : undefined;
    const action = (body.action || "rebuild").trim().toLowerCase();
    const drop = action === "drop";
    const saveOnly = action === "save";
    const add = action === "add";
    const remove = action === "remove";
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });
    if (!add && !shotId) return NextResponse.json({ error: "Need shotId" }, { status: 400 });
    if (add && !sceneIdIn) return NextResponse.json({ error: "Need sceneId" }, { status: 400 });
    if (add && !speakerIn) return NextResponse.json({ error: "Need a character" }, { status: 400 });
    if (!drop && !saveOnly && !add && !remove && !(stagingIn || "").trim()) {
      return NextResponse.json(
        { error: "Say who sits where — not two people stuck in the front." },
        { status: 400 },
      );
    }
    if (saveOnly && stagingIn === undefined && summaryIn === undefined) {
      return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (!job.folderName) {
      return NextResponse.json({ error: "Lock the episode first" }, { status: 400 });
    }

    await hydrateMobilePackOnDisk(job.styleId, job.folderName);
    const story = await readMobileStory(job.styleId, job.folderName);

    if (add) {
      const scene = story.scenes.find((sc) => sc.id === sceneIdIn);
      if (!scene) return NextResponse.json({ error: "That location is not in the story" }, { status: 404 });
      const newShot = {
        id: newId("shot"),
        title: speakerIn,
        summary: `${speakerIn}, solo — position, voice, and lip sync only. No one else in frame.`,
        staging: `${speakerIn} alone, standing centre-frame, facing camera, mid body.`,
        plateFile: "",
        beats: [{ id: newId("beat"), speaker: speakerIn, text: "" }],
        sfx: [],
      };
      const added: CrashStoryDoc = {
        ...story,
        scenes: story.scenes.map((sc) =>
          sc.id === scene.id ? { ...sc, shots: [...sc.shots, newShot] } : sc,
        ),
      };
      await writeMobileStory(added, job.folderName);
      const shots = [...job.shots, { shotId: newShot.id, sceneId: scene.id, plateFile: "" }];
      const updated = await patchMobileGenJob(jobId, { shots, error: "" });
      return NextResponse.json({ ok: true, job: updated, shotId: newShot.id });
    }

    let scene = story.scenes.find((sc) => sc.shots.some((sh) => sh.id === shotId));
    let shot = scene?.shots.find((sh) => sh.id === shotId);
    if (!scene || !shot) {
      return NextResponse.json({ error: "That shot is not in the story" }, { status: 404 });
    }

    if (remove) {
      const removed: CrashStoryDoc = {
        ...story,
        scenes: story.scenes.map((sc) =>
          sc.id === scene!.id ? { ...sc, shots: sc.shots.filter((sh) => sh.id !== shotId) } : sc,
        ),
      };
      await writeMobileStory(removed, job.folderName);
      const shots = job.shots.filter((s) => s.shotId !== shotId);
      const updated = await patchMobileGenJob(jobId, { shots, error: "" });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (drop) {
      const dropped = patchShotFields(story, shotId, { plateFile: "" });
      await writeMobileStory(dropped, job.folderName);
      const shots = job.shots.map((s) =>
        s.shotId === shotId ? { ...s, plateFile: "", error: "" } : s,
      );
      const updated = await patchMobileGenJob(jobId, { shots, error: "" });
      return NextResponse.json({ ok: true, job: updated, plateFile: "" });
    }

    if (saveOnly) {
      const patch: { staging?: string; summary?: string } = {};
      if (stagingIn !== undefined) patch.staging = stagingIn;
      if (summaryIn !== undefined) patch.summary = summaryIn;
      const saved = patchShotFields(story, shotId, patch);
      await writeMobileStory(saved, job.folderName);
      const next = saved.scenes.flatMap((sc) => sc.shots).find((sh) => sh.id === shotId);
      return NextResponse.json({
        ok: true,
        job,
        staging: next?.staging,
        summary: next?.summary,
      });
    }

    const staging = (stagingIn || "").trim();
    const nextStory = patchShotFields(story, shotId, {
      staging,
      ...(summaryIn !== undefined ? { summary: summaryIn } : {}),
      plateFile: "",
    });
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

    const plated = patchShotFields(nextStory, shotId, { plateFile: fileName, staging });
    await writeMobileStory(plated, job.folderName);
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
