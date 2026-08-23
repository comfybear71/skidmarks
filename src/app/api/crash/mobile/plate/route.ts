import { NextResponse } from "next/server";
import { hydrateMobilePackOnDisk, readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import type { CrashStoryDoc, CrashStoryShot, PlateTake } from "@/lib/crashStoryTypes";
import { isHydratedLeftoverBeat } from "@/lib/cloudStoryMedia";
import { parkMobileClipFile } from "@/lib/mobileClipPark";
import { clearAllStoryShots, clipQueueError } from "@/lib/mobileClipQueue";
import { isEpisodeClipPlanError, planParkClipsUnderPlate } from "@/lib/mobileEpisodeClips";
import { CUTAWAY_ACTIONS } from "@/lib/cutawayActions";
import { buildCutawayMotion, defaultSoloStaging } from "@/lib/mobileImageMotion";
import { candidateLookPrompt, phaseAfterPlateAdd } from "@/lib/mobileJobReady";
import { beatsAfterRemoveLine, shotSpeakersOnCard } from "@/lib/mobilePlateLines";
import { castNamesMatch } from "@/lib/mobileDropCast";
import { appendPlacePlate } from "@/lib/mobilePlateGraph";
import { landEpisodePlateStill, rebuildShotPlate } from "@/lib/mobilePlateRebuild";
import { copyPlaceStillAsEmptyPlate } from "@/lib/mobilePlateMedia";
import { emptyStageFarOutStaging } from "@/lib/emptyStagePlate";
import { scratchDrawStillInFlight } from "@/lib/mobileScratch";
import { finishSirayScratchPlate, submitSirayScratchPlate } from "@/lib/sirayScratchPlate";
import { sirayConfigured } from "@/lib/sirayClient";
import { ensureSpeakerVoiceCast } from "@/lib/scriptVoiceGen";
import { newId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function parkPlanFiles(filesToPark: string[]): string[] {
  const parked: string[] = [];
  for (const file of filesToPark) {
    const moved = parkMobileClipFile(file);
    if (moved) parked.push(moved);
  }
  return parked;
}

function patchShotFields(
  story: CrashStoryDoc,
  shotId: string,
  patch: {
    staging?: string;
    summary?: string;
    title?: string;
    plateFile?: string;
    plateTakes?: PlateTake[];
    bibleIds?: string[];
  },
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
 * POST { jobId, shotId, action: "save", summary?, staging?, title? } — write the
 * action / tweak text and the shot title. Does not composite.
 * POST { jobId, shotId, action: "drop" } — clear the shot still pointer
 * and its take list. Clips park in _cleared/. The card stays. Strip ×
 * uses "remove" instead, so an empty slot cannot fill with the location
 * still (Matty's bar) and keep the lines below.
 * POST { jobId, shotId, takeId, action: "drop-take" } — park one still
 * from the carousel. Files stay.
 * POST { jobId, sceneId, speaker, action: "add" } — add a shot card at
 * that location. With speaker: a solo card, one beat, that speaker only.
 * Without speaker: empty stage plate — far out, no people. Copies the
 * locked place still onto a new plate file so it can sit on the song.
 * POST { jobId, shotId, speaker, action: "add-cast" } — put one more
 * character into an existing shot (repeat to build a conversation).
 * Appends a beat for that speaker if they're not already in it.
 * POST { jobId, shotId, speaker?, action: "add-line" } — another spoken
 * take on the SAME still. Same face, new mp3, new clip thumb under the plate.
 * POST { jobId, shotId, speaker?, action: "add-cutaway" } — silent take on
 * the SAME still. SFX mp3 + Image motion come next. Does not Redo.
 * POST { jobId, shotId, beatId, action: "remove-line" } — drop that spoken
 * take from the plate. Audio/clip files stay in Blob (park). The thumb
 * under the plate goes with it. Last real line leaves an empty box
 * (`beat`) so they can Save again.
 * POST { jobId, shotId, action: "remove" } — take the shot off the strip.
 * Lines under it, clips, and the open editor go. Plate still stays on
 * disk/Blob. Clips park in _cleared/. Returns removed shot + sceneId
 * for Undo.
 * POST { jobId, action: "clear" } — remove every shot on this job in one
 * go (start fresh). Returns the full removed list for Undo.
 * POST { jobId, sceneId, shot, action: "restore" } — undo for "remove"/
 * "clear": puts an exact shot object back where it came from.
 * POST { jobId, shotId, takeId, action: "pick" } — a conversation shot can
 * carry several takes (drawn on different position tweaks); this mirrors
 * one onto plateFile/staging without drawing anything new.
 * POST { jobId, shotId, staging, action: "draw-start" } — start the still.
 * Siray returns pending; the browser polls. One long POST was dying as
 * "Couldn't reach Studio".
 * POST { jobId, shotId?, action: "draw-poll" } — one Siray tick. Lands the
 * still when ready. Does not start a second Draw.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      shotId?: string;
      sceneId?: string;
      speaker?: string;
      staging?: string;
      bibleIds?: string[];
      summary?: string;
      title?: string;
      action?: string;
      shot?: CrashStoryShot;
      takeId?: string;
      beatId?: string;
      qa?: boolean;
    };
    const jobId = (body.jobId || "").trim();
    const shotId = (body.shotId || "").trim();
    const sceneIdIn = (body.sceneId || "").trim();
    const speakerIn = (body.speaker || "").trim();
    const takeIdIn = (body.takeId || "").trim();
    const beatIdIn = (body.beatId || "").trim();
    const stagingIn = body.staging !== undefined ? String(body.staging) : undefined;
    const bibleIdsIn = Array.isArray(body.bibleIds)
      ? [...new Set(body.bibleIds.map((id) => String(id || "").trim()).filter(Boolean))]
      : undefined;
    const summaryIn = body.summary !== undefined ? String(body.summary) : undefined;
    const titleIn = body.title !== undefined ? String(body.title) : undefined;
    const action = (body.action || "rebuild").trim().toLowerCase();
    const drop = action === "drop";
    const saveOnly = action === "save";
    const add = action === "add";
    const addCast = action === "add-cast";
    const addLine = action === "add-line";
    const addCutaway = action === "add-cutaway";
    const removeLine = action === "remove-line";
    const remove = action === "remove";
    const clear = action === "clear";
    const restore = action === "restore";
    const pick = action === "pick";
    const dropTake = action === "drop-take";
    const drawStart = action === "draw-start";
    const drawPoll = action === "draw-poll";
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });
    if (!add && !remove && !clear && !restore && !drawPoll && !shotId) {
      return NextResponse.json({ error: "Need shotId" }, { status: 400 });
    }
    if (add && !sceneIdIn) return NextResponse.json({ error: "Need sceneId" }, { status: 400 });
    if (addCast && !speakerIn) return NextResponse.json({ error: "Need a character" }, { status: 400 });
    if (restore && (!sceneIdIn || !body.shot?.id)) {
      return NextResponse.json({ error: "Need sceneId and shot" }, { status: 400 });
    }
    if ((pick || dropTake) && !takeIdIn) return NextResponse.json({ error: "Need takeId" }, { status: 400 });
    if (removeLine && !beatIdIn) return NextResponse.json({ error: "Need beatId" }, { status: 400 });
    if (saveOnly && stagingIn === undefined && summaryIn === undefined && titleIn === undefined) {
      return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
    }

    const job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (!job.folderName) {
      return NextResponse.json({ error: "Lock the episode first" }, { status: 400 });
    }

    // pick / drop-take only touch Neon story + job — no local pack shell.
    // Hydrate was making every still swipe wait on a full cloud pull.
    if (!pick && !dropTake) {
      await hydrateMobilePackOnDisk(job.styleId, job.folderName);
    }
    const story = await readMobileStory(job.styleId, job.folderName);

    if (drawPoll) {
      const task = job.plateDraw;
      if (!task?.taskId) {
        const sid = shotId || "";
        const plateFile =
          job.shots.find((s) => s.shotId === sid)?.plateFile ||
          story.scenes.flatMap((sc) => sc.shots).find((sh) => sh.id === sid)?.plateFile ||
          "";
        if (plateFile && plateFile !== "__error__") {
          return NextResponse.json({
            ok: true,
            pending: false,
            recovered: true,
            job,
            plateFile,
            staging: story.scenes.flatMap((sc) => sc.shots).find((sh) => sh.id === sid)?.staging,
            plateTakes: story.scenes.flatMap((sc) => sc.shots).find((sh) => sh.id === sid)?.plateTakes,
          });
        }
        return NextResponse.json(
          { error: "No Draw in flight — tap Draw again. The episode is still there." },
          { status: 400 },
        );
      }
      try {
        const fileName = await finishSirayScratchPlate({
          taskId: task.taskId,
          styleId: job.styleId,
          castNames: task.castNames,
          placeName: task.placeName,
        });
        if (!fileName) {
          return NextResponse.json({ ok: true, pending: true, job });
        }
        const landed = await landEpisodePlateStill({
          job,
          story,
          shotId: task.shotId,
          fileName,
          staging: task.staging,
          bibleIds: task.bibleIds,
        });
        return NextResponse.json({
          ok: true,
          pending: false,
          job: landed.job,
          plateFile: landed.plateFile,
          plateTakes: landed.plateTakes,
          staging: landed.staging,
          bibleIds: landed.bibleIds,
        });
      } catch (e) {
        const failed = await patchMobileGenJob(jobId, {
          plateDraw: null,
          error: e instanceof Error ? e.message : String(e),
        });
        return NextResponse.json(
          { error: e instanceof Error ? e.message : String(e), job: failed || job },
          { status: 502 },
        );
      }
    }

    if (add) {
      // A location approved via Locations only lands in job.scenes — it's
      // meant to get carried into the real story doc when a script gets
      // locked, but this flow skips scripts entirely. Create the story
      // scene here instead of demanding a step nobody asked for.
      // Speaker optional: empty card waits for add-cast. Plate this place
      // and the Plates + slot use that so a card appears without a chip.
      if (speakerIn && !job.speakers.some((s) => castNamesMatch(s, speakerIn))) {
        return NextResponse.json(
          { error: `${speakerIn} is not in CAST — add them there first` },
          { status: 400 },
        );
      }
      let minted;
      try {
        minted = appendPlacePlate({
          job,
          story,
          sceneId: sceneIdIn,
          speaker: speakerIn,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "That location doesn't exist";
        const missing = /not on this episode/i.test(message);
        return NextResponse.json({ error: message }, { status: missing ? 404 : 400 });
      }
      await writeMobileStory(minted.story, job.folderName);
      let updated = await patchMobileGenJob(jobId, {
        shots: minted.shots,
        error: "",
        phase: phaseAfterPlateAdd(job.phase),
      });
      if (!speakerIn && updated) {
        const copied = await copyPlaceStillAsEmptyPlate({
          job: updated,
          sceneId: minted.sceneId,
        });
        if (copied) {
          const landed = await landEpisodePlateStill({
            job: updated,
            story: minted.story,
            shotId: minted.shotId,
            fileName: copied,
            staging: emptyStageFarOutStaging(minted.placeName),
          });
          updated = landed.job;
        }
      }
      return NextResponse.json({ ok: true, job: updated, shotId: minted.shotId });
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
      const wiped = clearAllStoryShots(story);
      await writeMobileStory(wiped.story, job.folderName);
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
      return NextResponse.json({ ok: true, job: updated, removed: wiped.removed });
    }

    let scene = story.scenes.find((sc) => sc.shots.some((sh) => sh.id === shotId));
    let shot = scene?.shots.find((sh) => sh.id === shotId);
    if (!scene || !shot) {
      return NextResponse.json({ error: "That shot is not in the story" }, { status: 404 });
    }
    const liveShot = shot;

    if (addLine || addCutaway) {
      const speaker =
        speakerIn ||
        liveShot.beats.find((b) => b.speaker.trim() && !isHydratedLeftoverBeat(liveShot.id, b))?.speaker ||
        "";
      if (!speaker.trim()) {
        return NextResponse.json({ error: "Need a character on this plate first" }, { status: 400 });
      }
      const kept = liveShot.beats.filter(
        (b) => b.speaker.trim() && !isHydratedLeftoverBeat(liveShot.id, b),
      );
      const lookLock =
        candidateLookPrompt(job.castCandidates, speaker) ||
        job.roster.find((c) => c.name.trim().toLowerCase() === speaker.trim().toLowerCase())
          ?.appearance ||
        "";
      const onCard = shotSpeakersOnCard({
        shotId: liveShot.id,
        title: liveShot.title,
        staging: liveShot.staging,
        summary: liveShot.summary,
        plateFile: liveShot.plateFile,
        jobSpeakers: job.speakers,
        beats: kept,
      });
      const move = CUTAWAY_ACTIONS[0]!;
      const beat = addCutaway
        ? {
            id: newId("beat"),
            speaker: speaker.trim(),
            text: move.action,
            kind: "cutaway" as const,
            action: move.action,
            imageMotion: buildCutawayMotion({
              styleId: job.styleId,
              speaker: speaker.trim(),
              action: move.action,
              lookLock,
              shotSpeakers: onCard.length ? onCard : [speaker.trim()],
              staging: liveShot.staging,
            }),
          }
        : { id: newId("beat"), speaker: speaker.trim(), text: "" };
      const beats = [...kept, beat];
      const withBeat: CrashStoryDoc = {
        ...story,
        scenes: story.scenes.map((sc) =>
          sc.id === scene!.id
            ? {
                ...sc,
                shots: sc.shots.map((sh) => (sh.id === shotId ? { ...sh, beats } : sh)),
              }
            : sc,
        ),
      };
      await writeMobileStory(withBeat, job.folderName);
      return NextResponse.json({ ok: true, job, beat });
    }

    if (removeLine) {
      const beat = liveShot.beats.find((b) => b.id === beatIdIn);
      if (!beat) {
        return NextResponse.json({ error: "That line is not on this plate" }, { status: 404 });
      }
      const emptyBeat = { id: newId("beat"), speaker: beat.speaker, text: "" };
      const { beats, keptEmpty } = beatsAfterRemoveLine({
        shotId,
        beats: liveShot.beats,
        beatId: beatIdIn,
        emptyBeat,
      });
      const withoutBeat: CrashStoryDoc = {
        ...story,
        scenes: story.scenes.map((sc) =>
          sc.id === scene!.id
            ? {
                ...sc,
                shots: sc.shots.map((sh) => (sh.id === shotId ? { ...sh, beats } : sh)),
              }
            : sc,
        ),
      };
      await writeMobileStory(withoutBeat, job.folderName);
      const clips = (job.clips || []).filter((c) => c.beatId !== beatIdIn);
      const updated = await patchMobileGenJob(jobId, { clips, error: "" });
      return NextResponse.json({
        ok: true,
        job: updated,
        removedBeatId: beatIdIn,
        ...(keptEmpty ? { beat: emptyBeat } : {}),
      });
    }

    if (addCast) {
      if (!job.speakers.some((s) => castNamesMatch(s, speakerIn))) {
        return NextResponse.json(
          { error: `${speakerIn} is not in CAST — add them there first` },
          { status: 400 },
        );
      }
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
        bibleIds: take.bibleIds,
        plateTakes,
      });
      await writeMobileStory(picked, job.folderName);
      const shots = job.shots.map((s) =>
        s.shotId === shotId ? { ...s, plateFile: take.fileName, error: "" } : s,
      );
      const updated = await patchMobileGenJob(jobId, { shots, error: "" });
      return NextResponse.json({
        ok: true,
        job: updated,
        plateFile: take.fileName,
        staging: take.staging,
        bibleIds: take.bibleIds || [],
      });
    }

    if (remove) {
      const removedShot = shot;
      const removedSceneId = scene.id;
      const plan = planParkClipsUnderPlate(
        job.clips || [],
        shotId,
        liveShot.beats.map((b) => b.id),
      );
      if (isEpisodeClipPlanError(plan)) {
        return NextResponse.json({ error: plan.error }, { status: plan.status });
      }
      const parked = parkPlanFiles(plan.filesToPark);
      const removedStory: CrashStoryDoc = {
        ...story,
        scenes: story.scenes.map((sc) =>
          sc.id === removedSceneId ? { ...sc, shots: sc.shots.filter((sh) => sh.id !== shotId) } : sc,
        ),
      };
      await writeMobileStory(removedStory, job.folderName);
      const shots = job.shots.filter((s) => s.shotId !== shotId);
      const failed = clipQueueError(plan.next);
      const updated = await patchMobileGenJob(jobId, {
        shots,
        clips: plan.next,
        error: failed,
        ...(job.phase === "error" && plan.clearedEpisodeErrors
          ? { phase: "review" as const }
          : {}),
      });
      return NextResponse.json({
        ok: true,
        job: updated,
        removedShot,
        sceneId: removedSceneId,
        parked: parked.length ? parked : null,
        parkedIn: parked.length ? "_cleared/" : null,
      });
    }

    if (drop) {
      const plan = planParkClipsUnderPlate(
        job.clips || [],
        shotId,
        liveShot.beats.map((b) => b.id),
      );
      if (isEpisodeClipPlanError(plan)) {
        return NextResponse.json({ error: plan.error }, { status: plan.status });
      }
      const parked = parkPlanFiles(plan.filesToPark);
      const dropped = patchShotFields(story, shotId, { plateFile: "", plateTakes: [] });
      await writeMobileStory(dropped, job.folderName);
      const shots = job.shots.map((s) =>
        s.shotId === shotId ? { ...s, plateFile: "", error: "" } : s,
      );
      const failed = clipQueueError(plan.next);
      const updated = await patchMobileGenJob(jobId, {
        shots,
        clips: plan.next,
        error: failed,
        ...(job.phase === "error" && plan.clearedEpisodeErrors
          ? { phase: "review" as const }
          : {}),
      });
      return NextResponse.json({
        ok: true,
        job: updated,
        plateFile: "",
        plateTakes: [],
        parked: parked.length ? parked : null,
        parkedIn: parked.length ? "_cleared/" : null,
      });
    }

    if (dropTake) {
      const take = (shot.plateTakes || []).find((t) => t.id === takeIdIn);
      if (!take) return NextResponse.json({ error: "That take is not on this shot" }, { status: 404 });
      let remaining = (shot.plateTakes || []).filter((t) => t.id !== takeIdIn);
      let plateFile = shot.plateFile || "";
      let staging = shot.staging || "";
      if (!remaining.length) {
        plateFile = "";
      } else if (take.fileName === shot.plateFile || remaining.every((t) => !t.approved)) {
        const nextTake = remaining[remaining.length - 1]!;
        remaining = remaining.map((t) => ({ ...t, approved: t.id === nextTake.id }));
        plateFile = nextTake.fileName;
        staging = nextTake.staging;
      }
      const patched = patchShotFields(story, shotId, { plateFile, staging, plateTakes: remaining });
      await writeMobileStory(patched, job.folderName);
      const shots = job.shots.map((s) =>
        s.shotId === shotId ? { ...s, plateFile, error: "" } : s,
      );
      const updated = await patchMobileGenJob(jobId, { shots, error: "" });
      return NextResponse.json({
        ok: true,
        job: updated,
        plateFile,
        staging,
        plateTakes: remaining,
      });
    }

    if (drawStart) {
      const staging = (stagingIn || "").trim();
      if (!staging) {
        return NextResponse.json(
          { error: "Say who sits where — not two people stuck in the front." },
          { status: 400 },
        );
      }
      const speakers = shotSpeakersOnCard({
        shotId: liveShot.id,
        title: liveShot.title,
        staging,
        summary: summaryIn ?? staging,
        plateFile: liveShot.plateFile,
        jobSpeakers: job.speakers,
        beats: liveShot.beats,
      });
      if (!speakers.length) {
        return NextResponse.json(
          { error: "Need a character on this plate before Draw" },
          { status: 400 },
        );
      }
      const saved = patchShotFields(story, shotId, {
        staging,
        summary: summaryIn ?? staging,
        bibleIds: bibleIdsIn,
      });
      await writeMobileStory(saved, job.folderName);
      const liveScene = saved.scenes.find((sc) => sc.shots.some((sh) => sh.id === shotId));
      const nextShot = liveScene?.shots.find((sh) => sh.id === shotId);
      if (!liveScene || !nextShot) {
        return NextResponse.json({ error: "That shot is not in the story" }, { status: 404 });
      }

      if (sirayConfigured()) {
        const want = { shotId, staging, speaker: speakers[0], cast: speakers };
        if (scratchDrawStillInFlight(job.plateDraw, want)) {
          return NextResponse.json({ ok: true, pending: true, job, shotId });
        }
        const started = await submitSirayScratchPlate(job.styleId, liveScene, nextShot, {
          silentCast: [],
          styleRealism: job.styleRealism,
          job,
        });
        const updated = await patchMobileGenJob(jobId, {
          error: "",
          plateDraw: {
            taskId: started.taskId,
            shotId,
            sceneId: liveScene.id,
            staging,
            bibleIds: bibleIdsIn,
            speaker: speakers[0],
            cast: speakers,
            castNames: started.castNames,
            placeName: started.placeName,
            startedAt: new Date().toISOString(),
            sendPrompt: started.send.prompt,
          },
        });
        return NextResponse.json({ ok: true, pending: true, job: updated, shotId });
      }

      const rebuilt = await rebuildShotPlate({
        job,
        story: saved,
        shotId,
        stagingIn: staging,
        bibleIdsIn,
        qa: false,
      });
      return NextResponse.json({
        ok: true,
        pending: false,
        job: rebuilt.job,
        plateFile: rebuilt.plateFile,
        plateTakes: rebuilt.plateTakes,
        staging: rebuilt.staging,
        bibleIds: rebuilt.bibleIds,
      });
    }

    if (saveOnly) {
      const patch: { staging?: string; summary?: string; title?: string; bibleIds?: string[] } = {};
      if (stagingIn !== undefined) patch.staging = stagingIn;
      if (summaryIn !== undefined) patch.summary = summaryIn;
      if (titleIn !== undefined) patch.title = titleIn;
      if (bibleIdsIn !== undefined) patch.bibleIds = bibleIdsIn;
      const saved = patchShotFields(story, shotId, patch);
      await writeMobileStory(saved, job.folderName);
      const next = saved.scenes.flatMap((sc) => sc.shots).find((sh) => sh.id === shotId);
      return NextResponse.json({
        ok: true,
        job,
        staging: next?.staging,
        summary: next?.summary,
        title: next?.title,
        bibleIds: next?.bibleIds || [],
      });
    }

    const rebuilt = await rebuildShotPlate({
      job,
      story,
      shotId,
      stagingIn,
      bibleIdsIn,
      qa: body.qa,
    });
    return NextResponse.json({
      ok: true,
      job: rebuilt.job,
      plateFile: rebuilt.plateFile,
      plateTakes: rebuilt.plateTakes,
      staging: rebuilt.staging,
      bibleIds: rebuilt.bibleIds,
      qa: rebuilt.qa,
      qaAttempts: rebuilt.qaAttempts,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
