import path from "path";
import { NextResponse } from "next/server";
import {
  compositeShotPlatePreferSiray,
  finishSirayScratchPlate,
  submitSirayScratchPlate,
} from "@/lib/sirayScratchPlate";
import { finishScratchSirayClip, submitScratchSirayClip } from "@/lib/sirayScratchClip";
import { sirayConfigured } from "@/lib/sirayClient";
import {
  parseScratchClipEngine,
  SIRAY_I2V_DEFAULT,
  SIRAY_I2V_MODELS,
  sirayI2vSpec,
} from "@/lib/sirayI2v";
import { hydrateMobilePackOnDisk, readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { uploadMobileMedia } from "@/lib/mobileMediaStore";
import {
  jobHasEpisodePack,
  patchMobileGenJob,
  readMobileGenJob,
  type MobileGenJob,
} from "@/lib/mobileGenJob";
import { importPastedStory } from "@/lib/mobilePasteScript";
import { approvedCandidateFileName } from "@/lib/mobileJobReady";
import { resolveGenOrPackPlate } from "@/lib/crashActivePack";
import { CRASH_DIR } from "@/lib/paths";
import type { CrashStoryDoc, CrashStoryShot, PlateTake } from "@/lib/crashStoryTypes";
import { campaignImageMotionForId } from "@/lib/mobilePlateLtxCampaign";
import {
  SCRATCH_SHOT_TITLE,
  findScratchShot,
  isOffEpisodeDeskShot,
  isScratchShotTitle,
  normalizeScratchCast,
  scratchBeatsForCast,
  scratchClipStillInFlight,
  scratchDrawStillInFlight,
  scratchPadClips,
  scratchStagingForCast,
  type ScratchPlateRef,
} from "@/lib/mobileScratch";
import { parkMobileClipFile } from "@/lib/mobileClipPark";
import {
  clearClipRowTakes,
  clipFileBasename,
  dropClipTakeFromRow,
  stackedClipFiles,
} from "@/lib/mobilePlateClips";
import { runScratchLtxClip } from "@/lib/mobileScratchClip";
import { deskLabel, jobDeskId } from "@/lib/mobileDesk";
import { isMobileSavedVoiceFile } from "@/lib/mobileSavedVoice";
import { newId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 900;

function emptyBookend() {
  return { title: "", notes: "", sfx: [] as CrashStoryDoc["intro"]["sfx"] };
}

function scratchShotShape(opts: {
  speaker: string;
  cast?: string[];
  placeName: string;
  poseId?: string;
  staging?: string;
}): CrashStoryShot {
  const cast = normalizeScratchCast(opts.speaker, opts.cast);
  const speaker = (opts.speaker || cast[0] || "").trim();
  const staging = scratchStagingForCast({
    cast,
    speaker,
    placeName: opts.placeName,
    poseId: opts.poseId,
    staging: opts.staging,
  });
  return {
    id: newId("shot"),
    title: SCRATCH_SHOT_TITLE,
    summary:
      cast.length > 1
        ? `${cast.join(", ")} on the scratch plate — multi lip-sync / pile test.`
        : `${speaker} on the scratch plate. One still, many positions.`,
    staging,
    plateFile: "",
    beats: scratchBeatsForCast(cast),
    sfx: [],
  };
}

function parseCastBody(body: { speaker?: string; cast?: unknown }, fallbackSpeaker = ""): string[] {
  const speaker = (body.speaker || fallbackSpeaker || "").trim();
  const raw = Array.isArray(body.cast) ? body.cast.map((n) => String(n || "").trim()).filter(Boolean) : [];
  return normalizeScratchCast(speaker, raw.length ? raw : speaker ? [speaker] : []);
}

function withScratchShot(
  story: CrashStoryDoc,
  sceneId: string,
  shot: CrashStoryShot,
): CrashStoryDoc {
  return {
    ...story,
    scenes: story.scenes.map((sc) => {
      const others = sc.shots.filter((sh) => sh.id !== shot.id && !findTitle(sh));
      if (sc.id === sceneId) return { ...sc, shots: [...others, shot] };
      return { ...sc, shots: others };
    }),
  };
}

function findTitle(sh: { title?: string }): boolean {
  return (sh.title || "").trim().toLowerCase() === SCRATCH_SHOT_TITLE.toLowerCase();
}

function ensureScene(
  story: CrashStoryDoc,
  job: MobileGenJob,
  sceneId: string,
): { story: CrashStoryDoc; sceneId: string; placeName: string; worldThumbKey: string } {
  const jobScene = job.scenes.find((s) => s.id === sceneId);
  if (!jobScene) throw new Error("Pick a place first");
  const existing = story.scenes.find((sc) => sc.id === sceneId);
  if (existing) {
    return {
      story,
      sceneId,
      placeName: existing.placeName || jobScene.placeName,
      worldThumbKey: existing.worldThumbKey || jobScene.worldThumbKey || "",
    };
  }
  const scene = {
    id: jobScene.id,
    title: jobScene.placeName,
    placeName: jobScene.placeName,
    worldThumbKey: jobScene.worldThumbKey || "",
    shots: [] as CrashStoryShot[],
  };
  return {
    story: { ...story, scenes: [...story.scenes, scene] },
    sceneId,
    placeName: jobScene.placeName,
    worldThumbKey: scene.worldThumbKey,
  };
}

async function landScratchStill(opts: {
  job: MobileGenJob;
  jobId: string;
  story: CrashStoryDoc;
  shotId: string;
  fileName: string;
  staging: string;
  speaker: string;
  cast: string[];
  poseId?: string;
}): Promise<MobileGenJob> {
  const { job, jobId, story, shotId, fileName, staging, speaker, cast, poseId } = opts;
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
  const liveShot = story.scenes.flatMap((sc) => sc.shots).find((sh) => sh.id === shotId);
  const newTake: PlateTake = { id: newId("take"), fileName, staging, approved: true };
  const plateTakes = [...(liveShot?.plateTakes || []).map((t) => ({ ...t, approved: false })), newTake];
  const plated: CrashStoryDoc = {
    ...story,
    scenes: story.scenes.map((sc) => ({
      ...sc,
      shots: sc.shots.map((sh) =>
        sh.id === shotId ? { ...sh, plateFile: fileName, staging, plateTakes } : sh,
      ),
    })),
  };
  await writeMobileStory(plated, job.folderName);
  const shots = job.shots.map((s) =>
    s.shotId === shotId ? { ...s, plateFile: fileName, error: "" } : s,
  );
  const updated = await patchMobileGenJob(jobId, {
    shots,
    error: "",
    scratchDraw: null,
    scratchPadCleared: false,
    scratchPlate: {
      ...job.scratchPlate!,
      speaker,
      cast,
      poseId: poseId || job.scratchPlate?.poseId,
    },
  });
  if (!updated) throw new Error("Job vanished");
  return updated;
}

async function persistScratch(
  job: MobileGenJob,
  story: CrashStoryDoc,
  ref: ScratchPlateRef,
): Promise<MobileGenJob> {
  await writeMobileStory(story, job.folderName);
  const inShots = job.shots.some((s) => s.shotId === ref.shotId);
  const shotRow = {
    shotId: ref.shotId,
    sceneId: ref.sceneId,
    plateFile: story.scenes.flatMap((sc) => sc.shots).find((sh) => sh.id === ref.shotId)?.plateFile || "",
  };
  const shots = inShots
    ? job.shots.map((s) => (s.shotId === ref.shotId ? { ...s, sceneId: ref.sceneId, plateFile: shotRow.plateFile } : s))
    : [...job.shots, shotRow];
  const updated = await patchMobileGenJob(job.id, {
    shots,
    scratchPlate: ref,
    error: "",
  });
  if (!updated) throw new Error("Job vanished");
  return updated;
}

/** Put an older still back on the Scratch pad so the next Draw refines it. */
async function restoreScratchPlate(opts: {
  job: MobileGenJob;
  jobId: string;
  story: CrashStoryDoc;
  shotId: string;
  plateFile: string;
  staging?: string;
}): Promise<{ job: MobileGenJob; story: CrashStoryDoc; staging: string }> {
  const plateFile = opts.plateFile.trim();
  if (!plateFile || plateFile === "__error__") throw new Error("Need a plate file to restore");
  try {
    resolveGenOrPackPlate(plateFile);
  } catch {
    throw new Error("That still file is missing — Draw it again or pick another history thumb.");
  }

  const liveShot = opts.story.scenes.flatMap((sc) => sc.shots).find((sh) => sh.id === opts.shotId);
  if (!liveShot) throw new Error("Scratch plate is missing — tap Draw again");

  const stagingHint = (opts.staging || "").trim();
  const prevTakes = liveShot.plateTakes || [];
  const hit = prevTakes.find((t) => t.fileName === plateFile);
  let plateTakes: PlateTake[];
  let staging: string;
  if (hit) {
    plateTakes = prevTakes.map((t) => ({ ...t, approved: t.fileName === plateFile }));
    staging = stagingHint || hit.staging || liveShot.staging || "";
  } else if (prevTakes.length) {
    const take: PlateTake = {
      id: newId("take"),
      fileName: plateFile,
      staging: stagingHint || liveShot.staging || "",
      approved: true,
    };
    plateTakes = [...prevTakes.map((t) => ({ ...t, approved: false })), take];
    staging = take.staging;
  } else {
    plateTakes = [
      {
        id: newId("take"),
        fileName: plateFile,
        staging: stagingHint || liveShot.staging || "",
        approved: true,
      },
    ];
    staging = plateTakes[0]!.staging;
  }

  const nextStory: CrashStoryDoc = {
    ...opts.story,
    scenes: opts.story.scenes.map((sc) => ({
      ...sc,
      shots: sc.shots.map((sh) =>
        sh.id === opts.shotId ? { ...sh, plateFile, staging, plateTakes } : sh,
      ),
    })),
  };
  await writeMobileStory(nextStory, opts.job.folderName);
  const shots = opts.job.shots.map((s) =>
    s.shotId === opts.shotId ? { ...s, plateFile, error: "" } : s,
  );
  const updated = await patchMobileGenJob(opts.jobId, {
    shots,
    scratchPadCleared: false,
    scratchDraw: null,
    error: "",
  });
  if (!updated) throw new Error("Job vanished");
  return { job: updated, story: nextStory, staging };
}

/**
 * POST { action: "ensure", jobId, speaker, cast?, sceneId, poseId? }
 *   — one Scratch shot on this job. Mints a scratch pack if the episode
 *     was never locked. Never wipes an existing pack's story.
 *   — `cast` = everyone on the still (multi lip-sync / pile). Speaker speaks.
 * POST { action: "preset", jobId, poseId, staging?, cast?, speaker? }
 *   — rebuild that same still with a position preset (or typed staging).
 *     Siray: submit and return `{ pending: true }` — do not wait for the still.
 * POST { action: "preset-poll", jobId }
 *   — one Siray tick. `{ pending: true }` until the still lands. Same episode.
 * POST { action: "restore-plate", jobId, plateFile, staging? }
 *   — put an older still back on the pad. Next Draw refines that image.
 * POST { action: "clear-plate", jobId }
 *   — hide the last still. Does not delete the plate or the episode.
 * POST { action: "clear-pad", jobId }
 *   — hide the still and empty the scratch cast on the job. Story stays.
 * POST { action: "select-place", jobId, sceneId }
 *   — park a place on the pad. Hides the last composite. Faces stay.
 * POST { action: "clip", jobId, beatId?, clipEngine? }
 *   — LTX waits on this request. Siray i2v submits and returns `{ pending: true }`.
 * POST { action: "clip-poll", jobId }
 *   — one Siray video tick. `{ pending: true }` until the mp4 lands. Same episode.
 * POST { action: "remove-clip", jobId, beatId, fileName }
 *   — drop one bad take from the strip. Local mp4 parks in _cleared/; Blob stays.
 * POST { action: "remove-all-clips", jobId }
 *   — clear every Scratch pad clip row. Same park rules.
 * GET — whether SIRAY_API_KEY is on this process (no secrets).
 */
export async function GET() {
  const cheap = sirayI2vSpec(SIRAY_I2V_DEFAULT);
  return NextResponse.json({
    ok: true,
    siray: sirayConfigured(),
    stillModel: "bytedance/seedream-4.5-ref2i-spicy",
    clipModel: cheap.model,
    clipModels: SIRAY_I2V_MODELS.map((row) => ({
      id: row.id,
      model: row.model,
      label: row.label,
      shortLabel: row.shortLabel,
      hint: row.hint,
    })),
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      jobId?: string;
      speaker?: string;
      cast?: string[];
      sceneId?: string;
      poseId?: string;
      staging?: string;
      beatId?: string;
      clipEngine?: string;
      joPhone?: boolean;
      plateFile?: string;
      fileName?: string;
    };
    const jobId = (body.jobId || "").trim();
    const action = (body.action || "ensure").trim().toLowerCase();
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

    let job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    if (action === "select-place") {
      const sceneId = (body.sceneId || "").trim();
      if (!sceneId || !job.scenes.some((s) => s.id === sceneId)) {
        return NextResponse.json({ error: "Pick a place first — drop it on the pad." }, { status: 400 });
      }
      const prev = job.scratchPlate;
      const scratchPlate: ScratchPlateRef = {
        shotId: prev?.shotId || "",
        sceneId,
        speaker: prev?.speaker || "",
        cast: prev?.cast || [],
        poseId: prev?.poseId,
      };
      const updated = await patchMobileGenJob(jobId, {
        scratchPadCleared: true,
        scratchPlate,
        error: "",
      });
      if (!updated) return NextResponse.json({ error: "Job vanished" }, { status: 404 });
      return NextResponse.json({ ok: true, job: updated, sceneId });
    }

    if (action === "restore-plate") {
      const plateFile = (body.plateFile || "").trim();
      if (!plateFile) {
        return NextResponse.json({ error: "Need plateFile — pick a history still." }, { status: 400 });
      }
      const shotId = job.scratchPlate?.shotId || "";
      if (!shotId) {
        return NextResponse.json({ error: "Draw once first — then history can restore a still." }, { status: 400 });
      }
      if (!job.folderName) {
        return NextResponse.json({ error: "Episode pack missing" }, { status: 400 });
      }
      await hydrateMobilePackOnDisk(job.styleId, job.folderName);
      let story = await readMobileStory(job.styleId, job.folderName);
      if (!story) return NextResponse.json({ error: "Story missing" }, { status: 404 });
      const scratch = findScratchShot(story);
      if (!scratch || scratch.shot.id !== shotId) {
        return NextResponse.json({ error: "Scratch shot missing" }, { status: 404 });
      }
      try {
        const restored = await restoreScratchPlate({
          job,
          jobId,
          story,
          shotId,
          plateFile,
          staging: body.staging,
        });
        return NextResponse.json({
          ok: true,
          job: restored.job,
          plateFile,
          staging: restored.staging,
        });
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Couldn't restore that still" },
          { status: 400 },
        );
      }
    }

    if (action === "clear-plate" || action === "clear-pad") {
      const emptyPad = action === "clear-pad";
      const updated = await patchMobileGenJob(jobId, {
        scratchPadCleared: true,
        error: "",
        scratchDraw: null,
        ...(emptyPad && job.scratchPlate
          ? {
              scratchPlate: {
                ...job.scratchPlate,
                speaker: "",
                cast: [],
              },
            }
          : {}),
      });
      if (!updated) return NextResponse.json({ error: "Job vanished" }, { status: 404 });
      return NextResponse.json({ ok: true, job: updated, cleared: emptyPad ? "pad" : "plate" });
    }

    if (action === "ensure") {
      const cast = parseCastBody(body, job.scratchPlate?.speaker || "");
      const speaker =
        (body.speaker || job.scratchPlate?.speaker || cast[0] || "").trim() ||
        job.speakers.find((n) => approvedCandidateFileName(job!.castCandidates, n)) ||
        "";
      const sceneId =
        (body.sceneId || job.scratchPlate?.sceneId || "").trim() ||
        job.scenes.find((s) => approvedCandidateFileName(job!.locationCandidates, s.id))?.id ||
        "";
      const onPad = normalizeScratchCast(speaker, cast.length ? cast : speaker ? [speaker] : []);
      if (!speaker || !onPad.length) {
        return NextResponse.json({ error: "Pick a character first — tap a face." }, { status: 400 });
      }
      if (!sceneId) {
        return NextResponse.json({ error: "Pick a place first — tap a location." }, { status: 400 });
      }
      for (const name of onPad) {
        if (!job.speakers.some((s) => s.trim().toLowerCase() === name.toLowerCase())) {
          return NextResponse.json({ error: `${name} is not on this desk` }, { status: 400 });
        }
        if (!approvedCandidateFileName(job.castCandidates, name)) {
          return NextResponse.json({ error: `Approve ${name}'s face first` }, { status: 400 });
        }
      }
      if (!job.scenes.some((s) => s.id === sceneId)) {
        return NextResponse.json({ error: "That place is not on this desk" }, { status: 400 });
      }
      if (!approvedCandidateFileName(job.locationCandidates, sceneId) && !job.scenes.find((s) => s.id === sceneId)?.worldThumbKey) {
        return NextResponse.json({ error: "Approve the location still first" }, { status: 400 });
      }

      const poseId = (body.poseId || job.scratchPlate?.poseId || "mcu-phone").trim();
      const placeName = job.scenes.find((s) => s.id === sceneId)?.placeName || "this place";
      const scratchRef: ScratchPlateRef = {
        shotId: "",
        sceneId,
        speaker,
        cast: onPad,
        poseId,
      };

      if (!jobHasEpisodePack(job)) {
        const shot = scratchShotShape({ speaker, cast: onPad, placeName, poseId });
        const jobScene = job.scenes.find((s) => s.id === sceneId)!;
        const story: CrashStoryDoc = {
          styleId: job.styleId,
          campaignLabel: `Scratch ${deskLabel(jobDeskId(job))}`,
          gagNote: "One scratch plate — not an episode. Do not treat this as a wipe.",
          intro: emptyBookend(),
          outro: emptyBookend(),
          scenes: [
            {
              id: jobScene.id,
              title: jobScene.placeName,
              placeName: jobScene.placeName,
              worldThumbKey: jobScene.worldThumbKey || "",
              shots: [shot],
            },
          ],
          updatedAt: new Date().toISOString(),
        };
        const { folderName } = await importPastedStory({
          styleId: job.styleId,
          title: `${story.campaignLabel} ${job.id.slice(-6)}`,
          story,
        });
        scratchRef.shotId = shot.id;
        job = (await patchMobileGenJob(jobId, {
          folderName,
          scratchPlate: scratchRef,
          shots: [{ shotId: shot.id, sceneId, plateFile: "" }],
          error: "",
        }))!;
        return NextResponse.json({
          ok: true,
          job,
          shotId: shot.id,
          sceneId,
          speaker,
          cast: onPad,
          poseId,
          siray: sirayConfigured(),
        });
      }

      await hydrateMobilePackOnDisk(job.styleId, job.folderName);
      let story = await readMobileStory(job.styleId, job.folderName);
      const found = findScratchShot(story);
      const scenePack = ensureScene(story, job, sceneId);
      story = scenePack.story;
      let shot = found?.shot;
      if (!shot) {
        shot = scratchShotShape({ speaker, cast: onPad, placeName: scenePack.placeName, poseId });
      } else {
        shot = {
          ...shot,
          title: SCRATCH_SHOT_TITLE,
          beats: scratchBeatsForCast(onPad, shot.beats),
          staging:
            shot.staging?.trim() ||
            scratchStagingForCast({
              cast: onPad,
              speaker,
              placeName: scenePack.placeName,
              poseId,
            }),
        };
      }
      story = withScratchShot(story, sceneId, shot);
      scratchRef.shotId = shot.id;
      job = await persistScratch(job, story, scratchRef);
      return NextResponse.json({
        ok: true,
        job,
        shotId: shot.id,
        sceneId,
        speaker,
        cast: onPad,
        poseId: job.scratchPlate?.poseId || poseId,
        siray: sirayConfigured(),
      });
    }

    if (!jobHasEpisodePack(job) || !job.scratchPlate?.shotId) {
      return NextResponse.json({ error: "Put a character on a place first" }, { status: 400 });
    }

    await hydrateMobilePackOnDisk(job.styleId, job.folderName);
    const story = await readMobileStory(job.styleId, job.folderName);
    const shotId = job.scratchPlate.shotId;
    const scene = story.scenes.find((sc) => sc.shots.some((sh) => sh.id === shotId));
    const shot = scene?.shots.find((sh) => sh.id === shotId);
    if (!scene || !shot) {
      return NextResponse.json({ error: "Scratch plate is missing — tap Draw again" }, { status: 404 });
    }
    if (!isScratchShotTitle(shot.title)) {
      return NextResponse.json(
        { error: "Scratch will not rewrite a live episode shot. Park on the Scratch plate." },
        { status: 400 },
      );
    }

    if (action === "preset") {
      const poseId = (body.poseId || "").trim();
      const jobStyleId = job.styleId;
      const placeName = scene.placeName || "this place";
      const speaker =
        (body.speaker || job.scratchPlate.speaker || shot.beats[0]?.speaker || "").trim();
      const cast = parseCastBody(
        body,
        speaker || job.scratchPlate.speaker || "",
      );
      const onPad = normalizeScratchCast(
        speaker,
        cast.length
          ? cast
          : job.scratchPlate.cast?.length
            ? job.scratchPlate.cast
            : shot.beats.map((b) => b.speaker).filter(Boolean),
      );
      const staging = scratchStagingForCast({
        cast: onPad,
        speaker,
        placeName,
        poseId: poseId || job.scratchPlate.poseId,
        staging: body.staging,
      });
      if (!staging) {
        return NextResponse.json({ error: "Pick a position preset" }, { status: 400 });
      }
      const joPhone = body.joPhone !== false;
      const nextStory: CrashStoryDoc = {
        ...story,
        scenes: story.scenes.map((sc) => ({
          ...sc,
          shots: sc.shots.map((sh) =>
            sh.id === shotId
              ? {
                  ...sh,
                  staging,
                  beats: scratchBeatsForCast(onPad, sh.beats).map((b) => {
                    if (!poseId || !b.text.trim() || onPad.length > 1) return b;
                    return {
                      ...b,
                      imageMotion: campaignImageMotionForId({
                        id: poseId,
                        styleId: jobStyleId,
                        speaker: b.speaker,
                        line: b.text,
                      }),
                    };
                  }),
                }
              : sh,
          ),
        })),
      };
      await writeMobileStory(nextStory, job.folderName);
      const liveScene = nextStory.scenes.find((sc) => sc.id === scene.id)!;
      const liveShot = liveScene.shots.find((sh) => sh.id === shotId)!;

      if (sirayConfigured()) {
        const wantDraw = { shotId, staging, speaker, cast: onPad };
        if (scratchDrawStillInFlight(job.scratchDraw, wantDraw)) {
          return NextResponse.json({
            ok: true,
            pending: true,
            job,
            staging,
            poseId,
            cast: onPad,
            backend: "siray-spicy",
            siray: true,
          });
        }
        const started = await submitSirayScratchPlate(job.styleId, liveScene, liveShot, {
          silentCast: [],
          styleRealism: job.styleRealism,
          job,
          useLastStill: !job.scratchPadCleared,
          joPhone,
        });
        const updated = await patchMobileGenJob(jobId, {
          error: "",
          scratchPlate: {
            ...job.scratchPlate,
            speaker,
            cast: onPad,
            poseId: poseId || job.scratchPlate.poseId,
          },
          scratchDraw: {
            taskId: started.taskId,
            shotId,
            sceneId: scene.id,
            staging,
            poseId: poseId || job.scratchPlate.poseId,
            speaker,
            cast: onPad,
            castNames: started.castNames,
            placeName: started.placeName,
            startedAt: new Date().toISOString(),
            joPhone,
            sendPrompt: started.send.prompt,
          },
        });
        return NextResponse.json({
          ok: true,
          pending: true,
          job: updated,
          staging,
          poseId,
          cast: onPad,
          backend: "siray-spicy",
          siray: true,
          send: started.send,
        });
      }

      const drawn = await compositeShotPlatePreferSiray(job.styleId, liveScene, liveShot, {
        silentCast: [],
        styleRealism: job.styleRealism,
        job,
        allowFallback: true,
      });
      const landed = await landScratchStill({
        job,
        jobId,
        story: nextStory,
        shotId,
        fileName: drawn.fileName,
        staging,
        speaker,
        cast: onPad,
        poseId: poseId || job.scratchPlate.poseId,
      });
      return NextResponse.json({
        ok: true,
        pending: false,
        job: landed,
        plateFile: drawn.fileName,
        staging,
        poseId,
        cast: onPad,
        backend: drawn.backend,
        siray: false,
      });
    }

    if (action === "preset-poll") {
      const task = job.scratchDraw;
      if (!task?.taskId) {
        const shotId = job.scratchPlate?.shotId || "";
        const plateFile =
          job.shots.find((s) => s.shotId === shotId)?.plateFile ||
          story.scenes.flatMap((sc) => sc.shots).find((sh) => sh.id === shotId)?.plateFile ||
          "";
        if (plateFile && plateFile !== "__error__") {
          const refreshed = (await readMobileGenJob(jobId)) || job;
          return NextResponse.json({
            ok: true,
            pending: false,
            recovered: true,
            job: refreshed,
            plateFile,
            staging: story.scenes.flatMap((sc) => sc.shots).find((sh) => sh.id === shotId)?.staging,
            backend: "siray-spicy",
            siray: true,
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
          return NextResponse.json({
            ok: true,
            pending: true,
            job,
            backend: "siray-spicy",
            siray: true,
          });
        }
        const landed = await landScratchStill({
          job,
          jobId,
          story,
          shotId: task.shotId,
          fileName,
          staging: task.staging,
          speaker: task.speaker,
          cast: task.cast,
          poseId: task.poseId || job.scratchPlate.poseId,
        });
        return NextResponse.json({
          ok: true,
          pending: false,
          job: landed,
          plateFile: fileName,
          staging: task.staging,
          poseId: task.poseId,
          cast: task.cast,
          backend: "siray-spicy",
          siray: true,
          sendPrompt: task.sendPrompt || "",
        });
      } catch (e) {
        const failed = await patchMobileGenJob(jobId, {
          scratchDraw: null,
          error: e instanceof Error ? e.message : String(e),
        });
        return NextResponse.json(
          { error: e instanceof Error ? e.message : String(e), job: failed || job },
          { status: 502 },
        );
      }
    }

    if (action === "remove-clip" || action === "remove-all-clips") {
      let padJob = job;
      const story =
        padJob.folderName
          ? await readMobileStory(padJob.styleId, padJob.folderName).catch(() => null)
          : null;
      const padBeatIds = new Set(scratchPadClips(padJob, story).map((c) => c.beatId));
      const onPad = (clip: { beatId: string; shotId: string }) =>
        padBeatIds.has(clip.beatId) || isOffEpisodeDeskShot(padJob, clip.shotId, story);

      if (action === "remove-all-clips") {
        const parked: string[] = [];
        const next = (padJob.clips || []).map((clip) => {
          if (!onPad(clip)) return clip;
          for (const file of stackedClipFiles(clip)) {
            const moved = parkMobileClipFile(file);
            if (moved) parked.push(moved);
          }
          return clearClipRowTakes(clip);
        });
        const updatedAll = await patchMobileGenJob(jobId, {
          clips: next,
          scratchClip: null,
          error: "",
        });
        if (updatedAll) padJob = updatedAll;
        return NextResponse.json({ ok: true, job: padJob, removed: parked.length, parkedIn: "_cleared/" });
      }

      const beatId = (body.beatId || "").trim();
      const fileName = clipFileBasename(body.fileName || "");
      if (!beatId || !fileName) {
        return NextResponse.json({ error: "Need beatId and fileName" }, { status: 400 });
      }
      const clip = (padJob.clips || []).find((c) => c.beatId === beatId);
      if (!clip || !onPad(clip)) {
        return NextResponse.json({ error: "That clip is not on the Scratch pad" }, { status: 404 });
      }
      if (!stackedClipFiles(clip).includes(fileName)) {
        return NextResponse.json({ error: "Clip take not found on this beat" }, { status: 404 });
      }
      const parked = parkMobileClipFile(fileName);
      const next = (padJob.clips || []).map((c) =>
        c.beatId === beatId ? dropClipTakeFromRow(c, fileName) : c,
      );
      const updatedOne = await patchMobileGenJob(jobId, { clips: next, error: "" });
      if (updatedOne) padJob = updatedOne;
      return NextResponse.json({
        ok: true,
        job: padJob,
        parked: parked || null,
        parkedIn: parked ? "_cleared/" : null,
      });
    }

    if (action === "clip") {
      let clipPick: ReturnType<typeof parseScratchClipEngine>;
      try {
        clipPick = parseScratchClipEngine(body.clipEngine);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : String(e) },
          { status: 400 },
        );
      }
      const beatId =
        (body.beatId || "").trim() ||
        (clipPick === "ltx"
          ? shot.beats.find((b) => isMobileSavedVoiceFile(b.voiceFile))?.id
          : shot.beats[0]?.id) ||
        "";
      if (!beatId) {
        return NextResponse.json(
          {
            error:
              clipPick === "ltx"
                ? "Save the spoken line first — Play appears next to the name when the mp3 is ready."
                : "Pick someone on the pad first.",
          },
          { status: 400 },
        );
      }
      try {
        if (clipPick === "ltx") {
          const updated = await runScratchLtxClip({
            job,
            story,
            shotId,
            sceneId: scene.id,
            beatId,
          });
          return NextResponse.json({
            ok: true,
            job: updated,
            backend: "ltx",
            clipLabel: "LTX (mp3)",
            siray: sirayConfigured(),
          });
        }
        const want = { shotId, beatId, i2v: clipPick };
        if (scratchClipStillInFlight(job.scratchClip, want)) {
          return NextResponse.json({
            ok: true,
            pending: true,
            job,
            backend: "siray-i2v",
            clipModel: job.scratchClip?.model,
            clipLabel: job.scratchClip?.label,
            i2v: clipPick,
            siray: true,
          });
        }
        const drawn = await submitScratchSirayClip({
          job,
          story,
          shotId,
          sceneId: scene.id,
          beatId,
          i2v: clipPick,
        });
        return NextResponse.json({
          ok: true,
          pending: true,
          job: drawn.job,
          backend: "siray-i2v",
          clipModel: drawn.model,
          clipLabel: drawn.label,
          i2v: drawn.i2v,
          siray: sirayConfigured(),
        });
      } catch (e) {
        const latest = await readMobileGenJob(jobId);
        return NextResponse.json(
          {
            error: e instanceof Error ? e.message : String(e),
            job: latest || job,
          },
          { status: 502 },
        );
      }
    }

    if (action === "clip-poll") {
      const task = job.scratchClip;
      if (!task?.taskId) {
        const beatId = (body.beatId || "").trim();
        const landed = beatId
          ? (job.clips || []).find((c) => c.beatId === beatId && c.clipFile && c.clipStatus === "done")
          : (job.clips || []).find((c) => c.clipFile && c.clipStatus === "done");
        if (landed?.clipFile) {
          return NextResponse.json({
            ok: true,
            pending: false,
            recovered: true,
            job,
            backend: "siray-i2v",
            clipLabel: sirayI2vSpec(SIRAY_I2V_DEFAULT).label,
            siray: true,
          });
        }
        return NextResponse.json(
          { error: "No clip in flight — tap Generate again. The episode is still there." },
          { status: 400 },
        );
      }
      try {
        const tick = await finishScratchSirayClip({ job, task });
        return NextResponse.json({
          ok: true,
          pending: tick.pending,
          job: tick.job,
          backend: "siray-i2v",
          clipModel: task.model,
          clipLabel: task.label,
          i2v: task.i2v,
          siray: true,
        });
      } catch (e) {
        const latest = await readMobileGenJob(jobId);
        return NextResponse.json(
          {
            error: e instanceof Error ? e.message : String(e),
            job: latest || job,
          },
          { status: 502 },
        );
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
