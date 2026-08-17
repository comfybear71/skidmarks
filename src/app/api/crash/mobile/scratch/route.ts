import path from "path";
import { NextResponse } from "next/server";
import { compositeShotPlatePreferSiray } from "@/lib/sirayScratchPlate";
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
import { CRASH_DIR } from "@/lib/paths";
import type { CrashStoryDoc, CrashStoryShot, PlateTake } from "@/lib/crashStoryTypes";
import { campaignImageMotionForId } from "@/lib/mobilePlateLtxCampaign";
import {
  SCRATCH_SHOT_TITLE,
  findScratchShot,
  normalizeScratchCast,
  scratchBeatsForCast,
  scratchStagingForCast,
  type ScratchPlateRef,
} from "@/lib/mobileScratch";
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

/**
 * POST { action: "ensure", jobId, speaker, cast?, sceneId, poseId? }
 *   — one Scratch shot on this job. Mints a scratch pack if the episode
 *     was never locked. Never wipes an existing pack's story.
 *   — `cast` = everyone on the still (multi lip-sync / pile). Speaker speaks.
 * POST { action: "preset", jobId, poseId, staging?, cast?, speaker? }
 *   — rebuild that same still with a position preset (or typed staging).
 * POST { action: "clip", jobId, beatId? }
 *   — LTX this scratch plate's Saved mp3. Does not queue the episode.
 */
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
    };
    const jobId = (body.jobId || "").trim();
    const action = (body.action || "ensure").trim().toLowerCase();
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

    let job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

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
        return NextResponse.json({ ok: true, job, shotId: shot.id, sceneId, speaker, cast: onPad, poseId });
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

    if (action === "preset") {
      const poseId = (body.poseId || "").trim();
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
                        styleId: job.styleId,
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
      const fileName = await compositeShotPlatePreferSiray(job.styleId, liveScene, liveShot, {
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
      const plateTakes = [...(liveShot.plateTakes || []).map((t) => ({ ...t, approved: false })), newTake];
      const plated = {
        ...nextStory,
        scenes: nextStory.scenes.map((sc) => ({
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
        scratchPlate: {
          ...job.scratchPlate,
          speaker,
          cast: onPad,
          poseId: poseId || job.scratchPlate.poseId,
        },
      });
      return NextResponse.json({ ok: true, job: updated, plateFile: fileName, staging, poseId, cast: onPad });
    }

    if (action === "clip") {
      const beatId =
        (body.beatId || "").trim() ||
        shot.beats.find((b) => isMobileSavedVoiceFile(b.voiceFile))?.id ||
        "";
      if (!beatId) {
        return NextResponse.json(
          { error: "Save the spoken line first — Play appears next to the name when the mp3 is ready." },
          { status: 400 },
        );
      }
      try {
        const updated = await runScratchLtxClip({
          job,
          story,
          shotId,
          sceneId: scene.id,
          beatId,
          poseId: job.scratchPlate.poseId,
        });
        return NextResponse.json({ ok: true, job: updated });
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
