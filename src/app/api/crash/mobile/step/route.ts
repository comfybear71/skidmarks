import { NextResponse } from "next/server";
import { compositeShotPlate } from "@/lib/mobilePlates";
import { assignReusedVoice } from "@/lib/mobileVoiceReuse";
import { generateEpisodeVoices } from "@/lib/scriptVoiceGen";
import { readCrashStory, writeCrashStory } from "@/lib/crashStory";
import { resolveGenOrPackPlate } from "@/lib/crashActivePack";
import { resolveBeatAudioPath } from "@/lib/crashStorySpeak";
import { runLtxSmoke } from "@/lib/ltxSmoke";
import { resolveComfyUrl } from "@/lib/comfyClient";
import { listRunpodPods, probeComfyUrl, resumeRunpodPod } from "@/lib/runpod";
import { CRASH_COMFY_DEFAULT_GLOBAL } from "@/lib/crashComfyStack";
import { stitchClips, mobileFinalVideoPath } from "@/lib/mobileStitch";
import { patchMobileGenJob, readMobileGenJob, type MobileGenJob } from "@/lib/mobileGenJob";

export const runtime = "nodejs";
export const maxDuration = 300;

async function ensureComfyReady(): Promise<string> {
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

    let job = readMobileGenJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    if (job.phase === "cast_images") {
      if (allCastApproved(job)) {
        job = patchMobileGenJob(jobId, { phase: "location_images" })!;
      }
      return NextResponse.json({ ok: true, job, advanced: job.phase !== "cast_images" });
    }

    if (job.phase === "location_images") {
      if (allLocationsApproved(job)) {
        job = patchMobileGenJob(jobId, { phase: "plates" })!;
      } else {
        return NextResponse.json({ ok: true, job, advanced: false });
      }
    }

    if (job.phase === "plates") {
      const story = readCrashStory(job.styleId);
      const next = job.shots.find((s) => !s.plateFile);
      if (!next) {
        job = patchMobileGenJob(jobId, { phase: "voices" })!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }
      const scene = story.scenes.find((sc) => sc.id === next.sceneId);
      const shot = scene?.shots.find((sh) => sh.id === next.shotId);
      if (!scene || !shot) {
        const shots = job.shots.map((s) =>
          s.shotId === next.shotId ? { ...s, plateFile: "__error__" } : s,
        );
        job = patchMobileGenJob(jobId, { shots })!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }
      try {
        const fileName = await compositeShotPlate(job.styleId, scene, shot);
        const nextScenes = story.scenes.map((sc) =>
          sc.id !== scene.id
            ? sc
            : { ...sc, shots: sc.shots.map((sh) => (sh.id === shot.id ? { ...sh, plateFile: fileName } : sh)) },
        );
        writeCrashStory({ ...story, scenes: nextScenes });
        const shots = job.shots.map((s) => (s.shotId === next.shotId ? { ...s, plateFile: fileName } : s));
        job = patchMobileGenJob(jobId, { shots })!;
      } catch (e) {
        const shots = job.shots.map((s) =>
          s.shotId === next.shotId ? { ...s, plateFile: "__error__" } : s,
        );
        job = patchMobileGenJob(jobId, {
          shots,
          error: e instanceof Error ? e.message : String(e),
        })!;
      }
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    if (job.phase === "voices") {
      for (const speaker of job.speakers) {
        await assignReusedVoice(job.styleId, speaker);
      }
      if (!job.folderName) throw new Error("Job has no folder — screenplay phase incomplete");
      await generateEpisodeVoices(job.styleId, job.folderName);
      job = patchMobileGenJob(jobId, { phase: "review" })!;
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    if (job.phase === "review") {
      if (!body.approveReview) {
        return NextResponse.json({ ok: true, job, advanced: false });
      }
      job = patchMobileGenJob(jobId, { phase: "animate" })!;
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    if (job.phase === "animate") {
      const next = job.clips.find((c) => c.clipStatus === "pending");
      if (!next) {
        job = patchMobileGenJob(jobId, { phase: "stitch" })!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }
      const shot = job.shots.find((s) => s.shotId === next.shotId);
      const story = readCrashStory(job.styleId);
      const scene = story.scenes.find((sc) => sc.id === next.sceneId);
      const beat = scene?.shots.find((sh) => sh.id === next.shotId)?.beats.find((b) => b.id === next.beatId);
      try {
        if (!shot?.plateFile || shot.plateFile === "__error__" || !beat) {
          throw new Error("No plate/line ready for this clip");
        }
        const platePath = resolveGenOrPackPlate(shot.plateFile);
        if (!platePath) throw new Error("Plate file missing on disk");
        const audioPath = beat.voiceFile
          ? resolveBeatAudioPath(job.styleId, beat.id, beat.voiceFile)
          : null;

        const comfyUrl = await ensureComfyReady();
        const result = await runLtxSmoke({
          platePath,
          audioPath,
          imageMotion: `${beat.speaker} says: "${beat.text.slice(0, 200)}"`,
          segmentText: "",
          globalPrompt: CRASH_COMFY_DEFAULT_GLOBAL,
          comfyUrl,
          styleId: job.styleId,
          beatId: beat.id,
        });
        const clips = job.clips.map((c) =>
          c.beatId === next.beatId
            ? { ...c, clipFile: result.localMp4, clipStatus: "done" as const }
            : c,
        );
        job = patchMobileGenJob(jobId, { clips })!;
      } catch (e) {
        const clips = job.clips.map((c) =>
          c.beatId === next.beatId
            ? { ...c, clipStatus: "error" as const, error: e instanceof Error ? e.message : String(e) }
            : c,
        );
        job = patchMobileGenJob(jobId, { clips })!;
      }
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    if (job.phase === "stitch") {
      const done = job.clips.filter((c) => c.clipStatus === "done" && c.clipFile);
      if (!done.length) {
        job = patchMobileGenJob(jobId, {
          phase: "error",
          error: "No clips generated successfully — nothing to stitch",
        })!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }
      const clipPaths = done.map((c) => c.clipFile);
      const finalVideoFile = stitchClips(clipPaths);
      job = patchMobileGenJob(jobId, { phase: "done", finalVideoFile })!;
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
