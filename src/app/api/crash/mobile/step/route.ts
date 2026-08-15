import path from "path";
import { NextResponse } from "next/server";
import { compositeShotPlate } from "@/lib/mobilePlates";
import { assignReusedVoice } from "@/lib/mobileVoiceReuse";
import { generateEpisodeVoices } from "@/lib/scriptVoiceGen";
import { hydrateMobilePackOnDisk, readMobileStory, writeMobileStory } from "@/lib/mobileStoryStore";
import { uploadMobileMedia, resolveMobileMedia } from "@/lib/mobileMediaStore";
import { resolveGenOrPackPlate } from "@/lib/crashActivePack";
import { resolveBeatAudioPath } from "@/lib/crashStorySpeak";
import { storyDialogueDir } from "@/lib/crashStoryLocations";
import { runLtxSmoke } from "@/lib/ltxSmoke";
import { resolveComfyUrl } from "@/lib/comfyClient";
import { listRunpodPods, probeComfyUrl, resumeRunpodPod } from "@/lib/runpod";
import { stitchClips, mobileFinalVideoPath } from "@/lib/mobileStitch";
import { patchMobileGenJob, readMobileGenJob, type MobileGenJob } from "@/lib/mobileGenJob";
import { CRASH_DIR } from "@/lib/paths";
import {
  buildSpeakingMotion,
  buildHoldMotion,
  buildGroupHoldMotion,
  buildSegmentText,
  buildGlobalPrompt,
} from "@/lib/mobileImageMotion";

export const runtime = "nodejs";
export const maxDuration = 300;

async function ensureComfyReady(): Promise<string> {
  // runLtxSmoke checks preferComfyCloudLtx() first and, when true, goes
  // straight to Comfy Cloud — the comfyUrl this returns is discarded either
  // way. But this ran unconditionally before every clip regardless, so a
  // RunPod hiccup (no pods, API down) threw here and blocked the cloud path
  // from ever getting a chance, even though it didn't need this result at
  // all. RunPod/local-pod resolution is now only attempted when the cloud
  // path isn't the one that's actually going to run.
  const { preferComfyCloudLtx } = await import("@/lib/ltxCloudIa2v");
  if (preferComfyCloudLtx()) return "";

  const resolved = await resolveComfyUrl();
  if (resolved.ok) {
    const status = await probeComfyUrl(resolved.url);
    if (status === "up") return resolved.url;
  }
  const pods = await listRunpodPods();
  if (pods.ok && pods.pods.length) {
    const pod = pods.pods[0]!;
    if (!/RUNNING/i.test(pod.desiredStatus)) {
      await resumeRunpodPod(pod.id, pod.gpuCount);
      throw new Error("Comfy pod is starting — try again in a minute or two");
    }
    if (pod.comfyUrl) return pod.comfyUrl;
    throw new Error("Pod is running but Comfy port 3000 isn't mapped yet — try again shortly");
  }
  throw new Error("No Comfy pod available — start one, or set COMFY_URL");
}

function allCastApproved(job: MobileGenJob): boolean {
  return job.speakers.every((s) => job.castCandidates[s]?.some((c) => c.approved));
}

function allLocationsApproved(job: MobileGenJob): boolean {
  return job.scenes.every((s) => job.locationCandidates[s.id]?.some((c) => c.approved));
}

/**
 * POST { jobId, approveReview? } — advances the AUTOMATIC phases one
 * bounded unit at a time (plates -> voices -> [review, human-gated] ->
 * animate -> stitch -> done). cast_images/location_images are human-gated
 * via /candidates and only checked here for whether they're complete
 * enough to move on. Never does more than one shot/clip of real work per
 * call so a long run survives many short requests instead of one huge one.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      approveReview?: boolean;
    };
    const jobId = (body.jobId || "").trim();
    if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

    let job = await readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // "error" is terminal and outside autoPhases, so nothing ever polled it
    // again — a clip attached from the error screen (clip/upload/route.ts)
    // updated the clip but had no way to make the run continue. If any clip
    // now has a file, there's something to stitch; send it back to animate
    // to pick up whatever is still pending, or straight to stitch if none
    // is. Otherwise leave the job in error — nothing actually changed.
    if (job.phase === "error" && job.clips.some((c) => c.clipStatus === "done")) {
      const nextPhase = job.clips.some((c) => c.clipStatus === "pending") ? "animate" : "stitch";
      job = (await patchMobileGenJob(jobId, { phase: nextPhase, error: "" }))!;
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    if (job.phase === "cast_images") {
      if (allCastApproved(job)) {
        job = (await patchMobileGenJob(jobId, { phase: "location_images" }))!;
      }
      return NextResponse.json({ ok: true, job, advanced: job.phase !== "cast_images" });
    }

    if (job.phase === "location_images") {
      if (allLocationsApproved(job)) {
        job = (await patchMobileGenJob(jobId, { phase: "plates" }))!;
      } else {
        return NextResponse.json({ ok: true, job, advanced: false });
      }
    }

    if (job.phase === "plates") {
      const story = await readMobileStory(job.styleId, job.folderName);
      const next = job.shots.find((s) => !s.plateFile);
      if (!next) {
        job = (await patchMobileGenJob(jobId, { phase: "voices" }))!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }
      const scene = story.scenes.find((sc) => sc.id === next.sceneId);
      const shot = scene?.shots.find((sh) => sh.id === next.shotId);
      if (!scene || !shot) {
        // Marked failed with no reason, which is what made an empty story look
        // like a cast/location problem for four rounds.
        const why = story.scenes.length
          ? `Shot ${next.shotId} is not in scene ${next.sceneId} of the saved story`
          : `The saved story has no scenes — the pack did not reach cloud storage`;
        console.error(why);
        const shots = job.shots.map((s) =>
          s.shotId === next.shotId ? { ...s, plateFile: "__error__", error: why } : s,
        );
        job = (await patchMobileGenJob(jobId, { shots }))!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }
      try {
        // job.speakers carries the whole roster (cast cards are made for
        // non-speakers too); anyone with no dialogue anywhere would otherwise
        // never be composited into a plate.
        const talking = new Set(
          story.scenes.flatMap((sc) =>
            sc.shots.flatMap((sh) => sh.beats.map((b) => b.speaker.trim()).filter(Boolean)),
          ),
        );
        const silentCast = job.speakers.filter((n) => n.trim() && !talking.has(n.trim()));

        const fileName = await compositeShotPlate(job.styleId, scene, shot, {
          silentCast,
          styleRealism: job.styleRealism,
        });
        try {
          await uploadMobileMedia({
            styleId: job.styleId,
            folderName: job.folderName,
            kind: "plates",
            localPath: path.join(CRASH_DIR, "gen", fileName),
          });
        } catch {
          /* best effort — plate still usable this request; animate falls back to local disk */
        }
        const nextScenes = story.scenes.map((sc) =>
          sc.id !== scene.id
            ? sc
            : { ...sc, shots: sc.shots.map((sh) => (sh.id === shot.id ? { ...sh, plateFile: fileName } : sh)) },
        );
        await writeMobileStory({ ...story, scenes: nextScenes }, job.folderName);
        const shots = job.shots.map((s) => (s.shotId === next.shotId ? { ...s, plateFile: fileName } : s));
        job = (await patchMobileGenJob(jobId, { shots }))!;
      } catch (e) {
        // The reason compositing failed used to be discarded here, leaving
        // animate to report only that a plate was missing.
        const why = e instanceof Error ? e.message : String(e);
        console.error(`Plate failed for shot ${next.shotId}: ${why}`);
        const shots = job.shots.map((s) =>
          s.shotId === next.shotId ? { ...s, plateFile: "__error__", error: why } : s,
        );
        job = (await patchMobileGenJob(jobId, {
          shots,
          error: e instanceof Error ? e.message : String(e),
        }))!;
      }
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    if (job.phase === "voices") {
      for (const speaker of job.speakers) {
        await assignReusedVoice(job.styleId, speaker);
      }
      if (!job.folderName) throw new Error("Job has no folder — screenplay phase incomplete");
      await hydrateMobilePackOnDisk(job.styleId, job.folderName);
      const voiceRun = await generateEpisodeVoices(job.styleId, job.folderName);
      const voicedStory = await readMobileStory(job.styleId, job.folderName);

      // Every mp4 is built from its beat's mp3, so a voices phase that made
      // no audio guarantees the animate phase fails on every clip with
      // "Cloud IA2V needs the beat mp3". Its per-line failures and the
      // ElevenLabs quota flag were both discarded here, and the run advanced
      // as if it had worked.
      const voicedBeats = voicedStory.scenes
        .flatMap((sc) => sc.shots.flatMap((sh) => sh.beats))
        .filter((b) => b.voiceFile?.trim()).length;
      if (!voicedBeats) {
        const why =
          (voiceRun.quotaExceeded ? "ElevenLabs quota exceeded. " : "") +
          (voiceRun.lines.find((l) => !l.ok)?.detail ||
            voiceRun.cast.find((c) => !c.ok)?.detail ||
            "no dialogue lines were synthesised");
        job = (await patchMobileGenJob(jobId, {
          phase: "error",
          error: `Voices produced no audio — ${why}`,
        }))!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }

      for (const scene of voicedStory.scenes) {
        for (const shot of scene.shots) {
          for (const beat of shot.beats) {
            if (!beat.voiceFile) continue;
            try {
              await uploadMobileMedia({
                styleId: job.styleId,
                folderName: job.folderName,
                kind: "audio",
                localPath:
                  resolveBeatAudioPath(job.styleId, beat.id, beat.voiceFile) || "",
              });
            } catch {
              /* best effort */
            }
          }
        }
      }
      job = (await patchMobileGenJob(jobId, { phase: "review" }))!;
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    if (job.phase === "review") {
      if (!body.approveReview) {
        return NextResponse.json({ ok: true, job, advanced: false });
      }
      job = (await patchMobileGenJob(jobId, { phase: "animate" }))!;
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    if (job.phase === "animate") {
      const next = job.clips.find((c) => c.clipStatus === "pending");
      if (!next) {
        job = (await patchMobileGenJob(jobId, { phase: "stitch" }))!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }
      const shot = job.shots.find((s) => s.shotId === next.shotId);
      const story = await readMobileStory(job.styleId, job.folderName);
      const scene = story.scenes.find((sc) => sc.id === next.sceneId);
      const storyShot = scene?.shots.find((sh) => sh.id === next.shotId);
      const beat = storyShot?.beats.find((b) => b.id === next.beatId);
      try {
        // One message for three different failures told us nothing about
        // which. They need separate answers: a failed plate is a cast/location
        // problem, a missing beat is a story/job mismatch.
        if (!shot) {
          throw new Error(`Clip references shot ${next.shotId}, which is not in this job`);
        }
        if (shot.plateFile === "__error__") {
          throw new Error(
            shot.error
              ? `Shot ${next.shotId} failed to plate — ${shot.error}`
              : `Shot ${next.shotId} failed to plate — check its cast and location were both picked`,
          );
        }
        if (!shot.plateFile) {
          throw new Error(`Shot ${next.shotId} has no plate yet`);
        }
        if (!beat) {
          throw new Error(`Line ${next.beatId} is missing from the story for shot ${next.shotId}`);
        }
        const platePath =
          resolveGenOrPackPlate(shot.plateFile) ||
          (await resolveMobileMedia({
            styleId: job.styleId,
            folderName: job.folderName,
            kind: "plates",
            fileName: shot.plateFile,
            destPath: path.join(CRASH_DIR, "gen", shot.plateFile),
          }));
        if (!platePath) throw new Error("Plate file missing on disk");
        const audioPath = beat.voiceFile
          ? resolveBeatAudioPath(job.styleId, beat.id, beat.voiceFile) ||
            (await resolveMobileMedia({
              styleId: job.styleId,
              folderName: job.folderName,
              kind: "audio",
              fileName: beat.voiceFile,
              destPath: path.join(storyDialogueDir(job.styleId), beat.voiceFile),
            }))
          : null;

        // Bare `NAME says: "line"` was the whole prompt LTX got — nothing held
        // the plate, so nothing stopped strangers walking in or the actual
        // character disappearing after the first frame. Reworked into the
        // shape docs/SUNNY_BANKS_IMAGE_MOTION_STANDARD.md logged as working
        // 100%: first-frame lock, look lock, "nothing new enters frame",
        // "same person and objects as the start image".
        const speaking = beat.text.trim().length > 0;
        const lookLock = job.roster.find(
          (c) => c.name.trim().toLowerCase() === beat.speaker.trim().toLowerCase(),
        )?.appearance;
        // A hold beat's own speaker is only who is "on" this beat, not who is
        // in the plate — the plate is shared across the whole shot. Naming
        // just one person during a hold reads as permission for everyone else
        // in frame to drift, which is the group-hold shape the standard
        // documents separately.
        const shotCast = [
          ...new Set((storyShot?.beats || []).map((b) => b.speaker.trim()).filter(Boolean)),
        ];
        const imageMotion = speaking
          ? buildSpeakingMotion({
              styleId: job.styleId,
              speaker: beat.speaker,
              line: beat.text,
              lookLock,
            })
          : shotCast.length > 1
            ? buildGroupHoldMotion({ styleId: job.styleId, names: shotCast })
            : buildHoldMotion({ styleId: job.styleId, speaker: beat.speaker, lookLock });

        // Recorded on the clip before the render even starts, so the prompt is
        // visible on screen the moment the clip is queued — not only once it
        // succeeds or fails.
        job = (await patchMobileGenJob(jobId, {
          clips: job.clips.map((c) =>
            c.beatId === next.beatId
              ? { ...c, speaker: beat.speaker, line: beat.text, imageMotion }
              : c,
          ),
        }))!;

        const comfyUrl = await ensureComfyReady();
        const result = await runLtxSmoke({
          platePath,
          audioPath,
          imageMotion,
          segmentText: buildSegmentText(beat.speaker, speaking),
          globalPrompt: buildGlobalPrompt(job.styleId),
          comfyUrl,
          styleId: job.styleId,
          beatId: beat.id,
        });
        try {
          await uploadMobileMedia({
            styleId: job.styleId,
            folderName: job.folderName,
            kind: "mp4",
            localPath: result.localMp4,
          });
        } catch {
          /* best effort — clip still usable this request; stitch falls back to local disk */
        }
        const clips = job.clips.map((c) =>
          c.beatId === next.beatId
            ? { ...c, clipFile: result.localMp4, clipStatus: "done" as const }
            : c,
        );
        job = (await patchMobileGenJob(jobId, { clips }))!;
      } catch (e) {
        const clips = job.clips.map((c) =>
          c.beatId === next.beatId
            ? { ...c, clipStatus: "error" as const, error: e instanceof Error ? e.message : String(e) }
            : c,
        );
        job = (await patchMobileGenJob(jobId, { clips }))!;
      }
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    if (job.phase === "stitch") {
      const done = job.clips.filter((c) => c.clipStatus === "done" && c.clipFile);
      if (!done.length) {
        // Every clip's real failure is recorded on the clip and was then
        // thrown away here, leaving a dead end with no reason on screen and
        // nothing in the browser console (these failures are server-side).
        const reasons = [
          ...new Set(job.clips.map((c) => (c.error || "").trim()).filter(Boolean)),
        ];
        job = (await patchMobileGenJob(jobId, {
          phase: "error",
          error: reasons.length
            ? `No clips generated — ${reasons[0]}${reasons.length > 1 ? ` (+${reasons.length - 1} other reason${reasons.length > 2 ? "s" : ""})` : ""}`
            : "No clips generated successfully — nothing to stitch",
        }))!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }
      const clipPaths: string[] = [];
      for (const c of done) {
        const resolved = await resolveMobileMedia({
          styleId: job.styleId,
          folderName: job.folderName,
          kind: "mp4",
          fileName: path.basename(c.clipFile),
          destPath: c.clipFile,
        });
        if (resolved) clipPaths.push(resolved);
      }
      if (!clipPaths.length) {
        job = (await patchMobileGenJob(jobId, {
          phase: "error",
          error: "Clips were generated but aren't available anymore — try Animate again",
        }))!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }
      const finalVideoFile = stitchClips(clipPaths);
      try {
        await uploadMobileMedia({
          styleId: job.styleId,
          folderName: job.folderName,
          kind: "mp4",
          localPath: mobileFinalVideoPath(finalVideoFile),
        });
      } catch {
        /* best effort — final/route.ts falls back to local disk first anyway */
      }
      job = (await patchMobileGenJob(jobId, { phase: "done", finalVideoFile }))!;
      return NextResponse.json({ ok: true, job, advanced: true, finalVideoPath: mobileFinalVideoPath(finalVideoFile) });
    }

    return NextResponse.json({ ok: true, job, advanced: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
