import path from "path";
import { NextResponse } from "next/server";
import { compositeShotPlate } from "@/lib/mobilePlates";
import { hydrateMobilePackOnDisk, readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { uploadMobileMedia } from "@/lib/mobileMediaStore";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import type { CrashStoryDoc, CrashStoryShot, PlateTake } from "@/lib/crashStoryTypes";
import { isHydratedLeftoverBeat } from "@/lib/cloudStoryMedia";
import { dropLeftoverHydrateBeats } from "@/lib/mobilePlateLines";
import { defaultSoloStaging } from "@/lib/mobileImageMotion";
import { ensureSpeakerVoiceCast } from "@/lib/scriptVoiceGen";
import { newId } from "@/lib/types";
import { CRASH_DIR } from "@/lib/paths";

export const runtime = "nodejs";
export const maxDuration = 180;

function patchShotFields(
  story: CrashStoryDoc,
  shotId: string,
  patch: { staging?: string; summary?: string; plateFile?: string; plateTakes?: PlateTake[] },
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
 * POST { jobId, sceneId, speaker, action: "add" } — add a shot card at
 * that location. With speaker: a solo card, one beat, that speaker only.
 * Without speaker: an empty plate — add cast to it with "add-cast".
 * POST { jobId, shotId, speaker, action: "add-cast" } — put one more
 * character into an existing shot (repeat to build a conversation).
 * Appends a beat for that speaker if they're not already in it.
 * POST { jobId, shotId, action: "remove" } — take the shot out of the
 * strip entirely. Any plate/audio it made stays on disk/Blob, just
 * unlinked — same park-don't-delete rule as "drop". Returns the removed
 * shot + its sceneId so the caller can offer Undo.
 * POST { jobId, action: "clear" } — remove every shot on this job in one
 * go (start fresh). Returns the full removed list for Undo.
 * POST { jobId, sceneId, shot, action: "restore" } — undo for "remove"/
 * "clear": puts an exact shot object back where it came from.
 * POST { jobId, shotId, takeId, action: "pick" } — a conversation shot can
 * carry several takes (drawn on different position tweaks); this mirrors
 * one onto plateFile/staging without drawing anything new.
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
      shot?: CrashStoryShot;
      takeId?: string;
    };
    const jobId = (body.jobId || "").trim();
    const shotId = (body.shotId || "").trim();
    const sceneIdIn = (body.sceneId || "").trim();
    const speakerIn = (body.speaker || "").trim();
    const takeIdIn = (body.takeId || "").trim();
    const stagingIn = body.staging !== undefined ? String(body.staging) : undefined;
    const summaryIn = body.summary !== undefined ? String(body.summary) : undefined;
    const action = (body.action || "rebuild").trim().toLowerCase();
    const drop = action === "drop";
    const saveOnly = action === "save";
    const add = action === "add";
    const addCast = action === "add-cast";
    const remove = action === "remove";
    const clear = action === "clear";
    const restore = action === "restore";
    const pick = action === "pick";
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });
    if (!add && !remove && !clear && !restore && !shotId) {
      return NextResponse.json({ error: "Need shotId" }, { status: 400 });
    }
    if (add && !sceneIdIn) return NextResponse.json({ error: "Need sceneId" }, { status: 400 });
    if (addCast && !speakerIn) return NextResponse.json({ error: "Need a character" }, { status: 400 });
    if (restore && (!sceneIdIn || !body.shot?.id)) {
      return NextResponse.json({ error: "Need sceneId and shot" }, { status: 400 });
    }
    if (pick && !takeIdIn) return NextResponse.json({ error: "Need takeId" }, { status: 400 });
    if (!drop && !saveOnly && !add && !addCast && !remove && !clear && !restore && !pick && !(stagingIn || "").trim()) {
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
      // A location approved via Locations only lands in job.scenes — it's
      // meant to get carried into the real story doc when a script gets
      // locked, but this flow skips scripts entirely. Create the story
      // scene here instead of demanding a step nobody asked for.
      let workingStory = story;
      let scene = workingStory.scenes.find((sc) => sc.id === sceneIdIn);
      if (!scene) {
        const jobScene = job.scenes.find((s) => s.id === sceneIdIn);
        if (!jobScene) return NextResponse.json({ error: "That location doesn't exist" }, { status: 404 });
        scene = {
          id: jobScene.id,
          title: jobScene.placeName,
          placeName: jobScene.placeName,
          worldThumbKey: jobScene.worldThumbKey || "",
          shots: [],
        };
        workingStory = { ...workingStory, scenes: [...workingStory.scenes, scene] };
      }
      const solo = Boolean(speakerIn);
      const newShot = {
        id: newId("shot"),
        title: solo ? speakerIn : scene.placeName,
        summary: solo
          ? `${speakerIn}, solo. Only ${speakerIn} in frame, no one else appears.`
          : "",
        staging: solo ? defaultSoloStaging(speakerIn) : "",
        plateFile: "",
        beats: solo ? [{ id: newId("beat"), speaker: speakerIn, text: "" }] : [],
        sfx: [],
      };
      const added: CrashStoryDoc = {
        ...workingStory,
        scenes: workingStory.scenes.map((sc) =>
          sc.id === scene.id ? { ...sc, shots: [...sc.shots, newShot] } : sc,
        ),
      };
      await writeMobileStory(added, job.folderName);
      const shots = [...job.shots, { shotId: newShot.id, sceneId: scene.id, plateFile: "" }];
      const updated = await patchMobileGenJob(jobId, { shots, error: "" });
      return NextResponse.json({ ok: true, job: updated, shotId: newShot.id });
    }

    if (restore) {
      const sceneIn = story.scenes.find((sc) => sc.id === sceneIdIn);
      if (!sceneIn) return NextResponse.json({ error: "That location is not in the story" }, { status: 404 });
      const shotIn = body.shot as CrashStoryShot;
      const already = sceneIn.shots.some((sh) => sh.id === shotIn.id);
      const nextStory: CrashStoryDoc = already
        ? story
        : {
            ...story,
            scenes: story.scenes.map((sc) =>
              sc.id === sceneIn.id ? { ...sc, shots: [...sc.shots, shotIn] } : sc,
            ),
          };
      await writeMobileStory(nextStory, job.folderName);
      const inShots = job.shots.some((s) => s.shotId === shotIn.id);
      const shots = inShots
        ? job.shots
        : [...job.shots, { shotId: shotIn.id, sceneId: sceneIn.id, plateFile: shotIn.plateFile || "" }];
      const updated = await patchMobileGenJob(jobId, { shots, error: "" });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (clear) {
      const removed: { sceneId: string; shot: CrashStoryShot }[] = [];
      let nextStory = story;
      for (const s of job.shots) {
        const sc = nextStory.scenes.find((sc) => sc.shots.some((sh) => sh.id === s.shotId));
        const sh = sc?.shots.find((sh) => sh.id === s.shotId);
        if (!sc || !sh) continue;
        removed.push({ sceneId: sc.id, shot: sh });
        nextStory = {
          ...nextStory,
          scenes: nextStory.scenes.map((x) =>
            x.id === sc.id ? { ...x, shots: x.shots.filter((y) => y.id !== sh.id) } : x,
          ),
        };
      }
      await writeMobileStory(nextStory, job.folderName);
      // finalVideoFile/clips were stitched from the shots just wiped — a
      // stale "done" video has no business surviving Clear all. Undo puts
      // the shots back but doesn't try to resurrect an old stitch.
      const resetPast = job.phase === "animate" || job.phase === "stitch" || job.phase === "done" || job.phase === "error";
      const updated = await patchMobileGenJob(jobId, {
        shots: [],
        clips: [],
        error: "",
        finalVideoFile: "",
        ...(resetPast ? { phase: "review" as const } : {}),
      });
      return NextResponse.json({ ok: true, job: updated, removed });
    }

    let scene = story.scenes.find((sc) => sc.shots.some((sh) => sh.id === shotId));
    let shot = scene?.shots.find((sh) => sh.id === shotId);
    if (!scene || !shot) {
      return NextResponse.json({ error: "That shot is not in the story" }, { status: 404 });
    }
    const liveShot = shot;

    if (addCast) {
      const already = liveShot.beats.some(
        (b) =>
          b.speaker.trim().toLowerCase() === speakerIn.toLowerCase() &&
          !isHydratedLeftoverBeat(liveShot.id, b),
      );
      if (already) {
        return NextResponse.json({ error: `${speakerIn} is already in this shot` }, { status: 400 });
      }
      // GET hydrate used to invent Comfy/Land beats from parked mp3s. Putting
      // Jo in must not keep those extras — composite would draw him, and the
      // line player would play his leftover clip instead of her voice.
      const kept = liveShot.beats.filter(
        (b) =>
          b.speaker.trim() &&
          !isHydratedLeftoverBeat(liveShot.id, b) &&
          b.speaker.trim().toLowerCase() !== speakerIn.toLowerCase(),
      );
      const beats = [...kept, { id: newId("beat"), speaker: speakerIn, text: "" }];
      const cast = beats.map((b) => b.speaker.trim()).filter(Boolean);
      const withBeat: CrashStoryDoc = {
        ...story,
        scenes: story.scenes.map((sc) =>
          sc.id === scene!.id
            ? {
                ...sc,
                shots: sc.shots.map((sh) =>
                  sh.id === shotId
                    ? {
                        ...sh,
                        beats,
                        title: cast.join(", ") || sh.title,
                        staging: sh.staging?.trim() || (cast.length === 1 ? defaultSoloStaging(speakerIn) : ""),
                      }
                    : sh,
                ),
              }
            : sc,
        ),
      };
      await writeMobileStory(withBeat, job.folderName);
      await ensureSpeakerVoiceCast(job.styleId, speakerIn).catch(() => false);
      return NextResponse.json({ ok: true, job });
    }

    if (pick) {
      const take = (shot.plateTakes || []).find((t) => t.id === takeIdIn);
      if (!take) return NextResponse.json({ error: "That take is not on this shot" }, { status: 404 });
      const plateTakes = (shot.plateTakes || []).map((t) => ({ ...t, approved: t.id === takeIdIn }));
      const picked = patchShotFields(story, shotId, {
        plateFile: take.fileName,
        staging: take.staging,
        plateTakes,
      });
      await writeMobileStory(picked, job.folderName);
      const shots = job.shots.map((s) =>
        s.shotId === shotId ? { ...s, plateFile: take.fileName, error: "" } : s,
      );
      const updated = await patchMobileGenJob(jobId, { shots, error: "" });
      return NextResponse.json({ ok: true, job: updated, plateFile: take.fileName, staging: take.staging });
    }

    if (remove) {
      const removedShot = shot;
      const removedSceneId = scene.id;
      const removedStory: CrashStoryDoc = {
        ...story,
        scenes: story.scenes.map((sc) =>
          sc.id === removedSceneId ? { ...sc, shots: sc.shots.filter((sh) => sh.id !== shotId) } : sc,
        ),
      };
      await writeMobileStory(removedStory, job.folderName);
      const shots = job.shots.filter((s) => s.shotId !== shotId);
      const updated = await patchMobileGenJob(jobId, { shots, error: "" });
      return NextResponse.json({
        ok: true,
        job: updated,
        removedShot,
        sceneId: removedSceneId,
      });
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
    const cleanedBeats = dropLeftoverHydrateBeats(shot.id, shot.beats);
    const nextStory: CrashStoryDoc = {
      ...story,
      scenes: story.scenes.map((sc) => ({
        ...sc,
        shots: sc.shots.map((sh) =>
          sh.id === shotId
            ? {
                ...sh,
                staging,
                ...(summaryIn !== undefined ? { summary: summaryIn } : {}),
                plateFile: "",
                beats: cleanedBeats,
              }
            : sh,
        ),
      })),
    };
    await writeMobileStory(nextStory, job.folderName);
    scene = nextStory.scenes.find((sc) => sc.shots.some((sh) => sh.id === shotId))!;
    shot = scene.shots.find((sh) => sh.id === shotId)!;

    // Only people already on THIS shot. Feeding the rest of the job as
    // silent extras is how a Jo-solo test kept drawing the old crowd.
    const fileName = await compositeShotPlate(job.styleId, scene, shot, {
      silentCast: [],
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

    const newTake: PlateTake = { id: newId("take"), fileName, staging, approved: true };
    const plateTakes = [...(shot.plateTakes || []).map((t) => ({ ...t, approved: false })), newTake];
    const plated = patchShotFields(nextStory, shotId, { plateFile: fileName, staging, plateTakes });
    await writeMobileStory(plated, job.folderName);
    const shots = job.shots.map((s) =>
      s.shotId === shotId ? { ...s, plateFile: fileName, error: "" } : s,
    );
    const updated = await patchMobileGenJob(jobId, { shots, error: "" });
    return NextResponse.json({ ok: true, job: updated, plateFile: fileName, plateTakes });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
