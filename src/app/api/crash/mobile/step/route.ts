import path from "path";
import { NextResponse } from "next/server";
import { assignReusedVoice } from "@/lib/mobileVoiceReuse";
import { hydrateMobilePackOnDisk, readMobileStory } from "@/lib/mobileStoryStore";
import { uploadMobileMedia, resolveMobileMedia } from "@/lib/mobileMediaStore";
import { resolveGenOrPackPlate } from "@/lib/crashActivePack";
import { resolveMobileBeatAudio } from "@/lib/resolveMobileBeatAudio";
import { burnLeftoverPackAudio, savedVoiceFilesOnStory } from "@/lib/burnLeftoverPackAudio";
import { runLtxSmoke } from "@/lib/ltxSmoke";
import { resolveComfyUrl, probeComfyUrl } from "@/lib/comfyClient";
import { stitchClips, mobileFinalVideoPath } from "@/lib/mobileStitch";
import {
  bounceStuckStitch,
  MOBILE_STITCH_MOVIES,
  phaseAfterAnimateQueue,
  phaseAfterErrorResume,
} from "@/lib/mobilePipeline";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { mobileCandidateFolders, mobileMediaFolder } from "@/lib/mobileJobFolder";
import { rememberClipTake, stackedClipFiles } from "@/lib/mobilePlateClips";
import {
  clipNeedsAnimate,
  clipQueueError,
  findBeatHome,
  nextClipToAnimate,
  queueOneBeatForAnimate,
} from "@/lib/mobileClipQueue";
import { isMobileSavedVoiceFile } from "@/lib/mobileSavedVoice";
import { isOffEpisodeDeskShot } from "@/lib/mobileScratch";
import type { CrashStoryDoc } from "@/lib/crashStoryTypes";
import { allCastApproved, allLocationsApproved, candidateLookPrompt } from "@/lib/mobileJobReady";
import {
  imageMotionNamesLeftovers,
  leftoverHydrateSpeakers,
  shotSpeakersOnCard,
} from "@/lib/mobilePlateLines";
import { CRASH_DIR } from "@/lib/paths";
import { dropTailStill, startStillForNextClip } from "@/lib/clipTailFrame";
import {
  buildDefaultBeatMotion,
  buildSegmentText,
  buildGlobalPrompt,
  ltxSendPrompt,
  stripLtxLipSyncLead,
  imageMotionUsableForLine,
  looksLikePlatePositionPrompt,
} from "@/lib/mobileImageMotion";

export const runtime = "nodejs";
export const maxDuration = 900;

async function ensureComfyReady(): Promise<string> {
  // runLtxSmoke checks preferComfyCloudLtx() first and, when true, goes
  // straight to Comfy Cloud — the comfyUrl this returns is discarded either
  // way, so resolving one is only needed when the cloud path isn't what's
  // about to run. RunPod auto-discovery (list pods, resume, guess a port)
  // was the testing-phase fallback here and is gone; a self-hosted Comfy is
  // reached by setting COMFY_URL directly.
  const { preferComfyCloudLtx } = await import("@/lib/ltxCloudIa2v");
  if (preferComfyCloudLtx()) return "";

  const resolved = await resolveComfyUrl();
  if (resolved.ok) {
    const status = await probeComfyUrl(resolved.url);
    if (status === "up") return resolved.url;
  }
  throw new Error("No Comfy Cloud key and no reachable COMFY_URL — set one to animate");
}

/**
 * POST { jobId, approveReview?, beatId? } — advances the AUTOMATIC phases one
 * bounded unit at a time (plates -> voices -> [review, human-gated] ->
 * animate -> stitch -> done). Stitch is parked (MOBILE_STITCH_MOVIES) —
 * Generate video still sends clips to LTX; animate then returns to review.
 * cast_images/location_images are human-gated via /candidates and only
 * checked here for whether they're complete enough to move on. Never does
 * more than one shot/clip of real work per call so a long run survives
 * many short requests instead of one huge one.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      jobId?: string;
      approveReview?: boolean;
      /** Generate on one plate line — do not re-queue every Saved mp3. */
      beatId?: string;
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
    if (job.phase === "error") {
      const live = job;
      let story: CrashStoryDoc | null = null;
      if (live.folderName) {
        try {
          story = await readMobileStory(live.styleId, live.folderName);
        } catch {
          story = null;
        }
      }
      const deskClips = live.clips.filter(
        (c) => !isOffEpisodeDeskShot(live, c.shotId, story),
      );
      const pendingDesk = deskClips.some((c) => clipNeedsAnimate(c));
      if (deskClips.some((c) => c.clipStatus === "done")) {
        const nextPhase = phaseAfterErrorResume(pendingDesk);
        job = (await patchMobileGenJob(jobId, { phase: nextPhase, error: "" }))!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }
      const clips = live.clips.filter(
        (c) =>
          !(c.clipStatus === "pending" && isOffEpisodeDeskShot(live, c.shotId, story)),
      );
      job = (await patchMobileGenJob(jobId, { clips, phase: "review", error: "" }))!;
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    const unstick = bounceStuckStitch({ phase: job.phase, error: job.error });
    if (unstick) {
      job = (await patchMobileGenJob(jobId, { phase: unstick }))!;
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
      // Empty shot strip on purpose. Auto-compositing every shot from the
      // lock used to mint an early-dev still nobody asked to start from.
      // Rebuild one shot at a time from Tweak. In-flight jobs already in
      // this phase skip the lottery the same way.
      job = (await patchMobileGenJob(jobId, { phase: "review" }))!;
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    const oneBeatId = (body.beatId || "").trim();
    if (
      body.approveReview &&
      oneBeatId &&
      (job.phase === "review" ||
        job.phase === "animate" ||
        job.phase === "done" ||
        job.phase === "error")
    ) {
      const live = job;
      if (!live.folderName) throw new Error("Job has no folder — screenplay phase incomplete");
      await hydrateMobilePackOnDisk(live.styleId, live.folderName);
      const story = await readMobileStory(live.styleId, live.folderName);
      const one = queueOneBeatForAnimate(live, story, oneBeatId);
      if (one.error) {
        job = (await patchMobileGenJob(jobId, {
          phase: live.phase === "animate" ? "animate" : "review",
          error: one.error,
        }))!;
        return NextResponse.json({ ok: true, job, advanced: false });
      }
      job = (await patchMobileGenJob(jobId, {
        clips: one.clips,
        phase: "animate",
        error: "",
      }))!;
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    if (job.phase === "review") {
      if (!body.approveReview) {
        return NextResponse.json({ ok: true, job, advanced: false });
      }

      const live = job;
      const takenVoices = new Set<string>();
      for (const speaker of live.speakers) {
        await assignReusedVoice(live.styleId, speaker, takenVoices);
      }
      if (!live.folderName) throw new Error("Job has no folder — screenplay phase incomplete");
      await hydrateMobilePackOnDisk(live.styleId, live.folderName);
      const story = await readMobileStory(live.styleId, live.folderName);

      // Only LTX episode lines they Saved (Play). Keep scratch/campaign
      // clips on the job so the pad stack stays playable — do not wipe them.
      // Also keep any row that already has mp4 takes, even if the voice
      // file looks odd — otherwise the last Generate video vanishes.
      // Generate again with nothing pending → re-queue Saved lines so a new
      // plate take (or another take under the same line) can stack.
      let clips = (live.clips || []).flatMap((c) => {
        const home = findBeatHome(story, c.beatId);
        const shotId = home?.shotId || c.shotId;
        if (isOffEpisodeDeskShot(live, shotId, story)) return [c];
        const hasTakes = stackedClipFiles(c).length > 0;
        if (!isMobileSavedVoiceFile(c.voiceFile) && !hasTakes) return [];
        // Prefer the clip's Saved take — cloud story hydrate often blanks
        // beat.voiceFile while the queue still holds the real mp3 name.
        const voiceFile =
          (isMobileSavedVoiceFile(c.voiceFile) && c.voiceFile) ||
          (isMobileSavedVoiceFile(home?.voiceFile) && home?.voiceFile) ||
          c.voiceFile ||
          home?.voiceFile ||
          "";
        if (!isMobileSavedVoiceFile(voiceFile) && !hasTakes) return [];
        return [
          {
            ...c,
            voiceFile: isMobileSavedVoiceFile(voiceFile) ? voiceFile : c.voiceFile,
            line: (home?.text || "").trim() || c.line,
            shotId: home?.shotId || c.shotId,
            sceneId: home?.sceneId || c.sceneId,
            speaker: home?.speaker || c.speaker,
            ...(c.clipStatus === "error"
              ? { clipStatus: "pending" as const, error: "" }
              : {}),
          },
        ];
      });
      let pending = clips.filter(
        (c) =>
          c.clipStatus === "pending" &&
          !isOffEpisodeDeskShot(live, c.shotId, story),
      );
      if (!pending.length) {
        const requeued = clips.map((c) => {
          if (isOffEpisodeDeskShot(live, c.shotId, story)) return c;
          if (!isMobileSavedVoiceFile(c.voiceFile)) return c;
          if (c.clipStatus === "pending" || c.clipStatus === "running") return c;
          return { ...c, clipStatus: "pending" as const, error: "" };
        });
        pending = requeued.filter(
          (c) =>
            c.clipStatus === "pending" &&
            !isOffEpisodeDeskShot(live, c.shotId, story),
        );
        if (pending.length) {
          clips = requeued;
        }
      }
      if (!pending.length) {
        const episodeClips = clips.filter(
          (c) => !isOffEpisodeDeskShot(live, c.shotId, story),
        );
        job = (await patchMobileGenJob(jobId, {
          clips,
          phase: "review",
          error: episodeClips.length
            ? "No Saved mp3s ready to send. Save the spoken line on the plate first — Play appears when the mp3 is ready."
            : "No Saved mp3s to send. Save the spoken line on the plate first — Play appears next to the name when the mp3 is ready.",
        }))!;
        return NextResponse.json({ ok: true, job, advanced: false });
      }

      job = (await patchMobileGenJob(jobId, {
        clips,
        phase: "animate",
        error: "",
      }))!;
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    if (job.phase === "animate") {
      const live = job;
      let story: CrashStoryDoc | null = null;
      if (live.folderName) {
        try {
          story = await readMobileStory(live.styleId, live.folderName);
        } catch {
          story = null;
        }
      }
      const skipOffDesk = (c: { shotId: string }) =>
        isOffEpisodeDeskShot(live, c.shotId, story);
      const next = nextClipToAnimate(live.clips, skipOffDesk);
      if (!next) {
        const deskClips = live.clips.filter(
          (c) => !isOffEpisodeDeskShot(live, c.shotId, story),
        );
        // Chunk 2 of a rant stays pending until chunk 1 is done (so we can
        // pull its last frame). Another invoke may still own that render.
        if (deskClips.some((c) => c.clipStatus === "running")) {
          return NextResponse.json({ ok: true, job: live, advanced: false });
        }
        const clips = live.clips.filter(
          (c) =>
            !(c.clipStatus === "pending" && isOffEpisodeDeskShot(live, c.shotId, story)),
        );
        const failed = clipQueueError(deskClips);
        if (failed) {
          job = (await patchMobileGenJob(jobId, { clips, phase: "error", error: failed }))!;
          return NextResponse.json({ ok: true, job, advanced: true });
        }
        try {
          const doneStory = story || (await readMobileStory(job.styleId, job.folderName));
          await burnLeftoverPackAudio({
            styleId: job.styleId,
            folderName: job.folderName,
            keepFiles: savedVoiceFilesOnStory(doneStory),
          });
        } catch {
          /* completion still returns — leftover burn is best effort */
        }
        job = (await patchMobileGenJob(jobId, {
          clips,
          phase: phaseAfterAnimateQueue(false),
          error: "",
          ...(job.plateLtxCampaign
            ? {
                plateLtxCampaign: {
                  ...job.plateLtxCampaign,
                  phase: "done" as const,
                  error: "",
                },
              }
            : {}),
        }))!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }

      // Claim this beat before the long LTX wait so a parallel /step poll
      // cannot start a second render and overwrite priorClipFiles.
      const claimed = await patchMobileGenJob(jobId, {
        clips: live.clips.map((c) =>
          c.beatId === next.beatId
            ? { ...c, clipStatus: "running" as const, error: "" }
            : c,
        ),
      });
      if (!claimed) {
        return NextResponse.json({ ok: false, error: "Job vanished" }, { status: 404 });
      }
      const stillOurs = claimed.clips.find(
        (c) => c.beatId === next.beatId && c.clipStatus === "running",
      );
      if (!stillOurs) {
        return NextResponse.json({ ok: true, job: claimed, advanced: false });
      }
      job = claimed;

      const shot = job.shots.find((s) => s.shotId === next.shotId);
      story = story ?? (await readMobileStory(job.styleId, job.folderName));
      const scene = story.scenes.find((sc) => sc.id === next.sceneId);
      const storyShot = scene?.shots.find((sh) => sh.id === next.shotId);
      const beat = storyShot?.beats.find((b) => b.id === next.beatId);
      let tailStillPath: string | null = null;
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
        if (!storyShot || !beat) {
          throw new Error(`Line ${next.beatId} is missing from the story for shot ${next.shotId}`);
        }
        const defaultPlatePath =
          resolveGenOrPackPlate(shot.plateFile) ||
          (await resolveMobileMedia({
            styleId: job.styleId,
            folderName: job.folderName,
            kind: "plates",
            fileName: shot.plateFile,
            destPath: path.join(CRASH_DIR, "gen", shot.plateFile),
          }));
        if (!defaultPlatePath) throw new Error("Plate file missing on disk");
        // Split rants share a shot. Clip 1 uses this plate; clip 2+ use the
        // previous take's last frame so the mouth/pose does not snap back.
        const startStill = await startStillForNextClip({
          styleId: job.styleId,
          folderName: job.folderName,
          clips: job.clips,
          next,
          defaultPlatePath,
          skip: skipOffDesk,
        });
        tailStillPath = startStill.tailStillPath;
        const platePath = startStill.platePath;
        // /crash Send uses the beat you picked (plate + that mp3 + Image
        // motion). The queued clip is that pick. Hydrate can blank
        // story.voiceFile on a read (leftover strip / older snapshot) while
        // the clip still holds the Save take — looking up beat.voiceFile
        // then asked Blob for beat_<id>.mp3 and died unreachable.
        const voiceFile = (next.voiceFile || beat.voiceFile || "").trim();
        const speaker = (next.speaker || beat.speaker || "").trim();
        const line = (next.line || beat.text || "").trim();
        // Same lookup Scratch / Play use: pack folder + job-id shelf + Neon
        // by filename. Save can land under the job id before folderName is set.
        const mediaFolder = mobileMediaFolder(job);
        const audioPath = await resolveMobileBeatAudio({
          styleId: job.styleId,
          folderName: mediaFolder,
          folderCandidates: mobileCandidateFolders(job),
          beatId: beat.id,
          voiceFile,
        });
        if (!audioPath) {
          throw new Error(
            `Beat mp3 not reachable — story.voiceFile="${beat.voiceFile || "(empty)"}" ` +
              `clip.voiceFile="${next.voiceFile || "(empty)"}" folderName="${mediaFolder}" beatId=${beat.id}`,
          );
        }

        // Bare `NAME says: "line"` was the whole prompt LTX got — nothing held
        // the plate, so nothing stopped strangers walking in or the actual
        // character disappearing after the first frame. Reworked into the
        // shape docs/SUNNY_BANKS_IMAGE_MOTION_STANDARD.md logged as working
        // 100%: first-frame lock, look lock, "nothing new enters frame",
        // "same person and objects as the start image".
        const speaking = line.length > 0;
        const lookLock =
          candidateLookPrompt(job.castCandidates, speaker) ||
          job.roster.find(
            (c) => c.name.trim().toLowerCase() === speaker.toLowerCase(),
          )?.appearance;
        const leftovers = leftoverHydrateSpeakers(storyShot.id, storyShot.beats);
        const shotCast = shotSpeakersOnCard({
          shotId: storyShot.id,
          title: storyShot.title,
          staging: storyShot.staging,
          summary: storyShot.summary,
          plateFile: storyShot.plateFile,
          jobSpeakers: job.speakers,
          beats: storyShot.beats,
        });
        const stored = stripLtxLipSyncLead(beat.imageMotion || "");
        if (looksLikePlatePositionPrompt(line)) {
          throw new Error(
            "The queued line is the still position, not speech. Wipe the line box, type what she says, Save, then Generate video.",
          );
        }
        const body =
          (stored &&
          !imageMotionNamesLeftovers(stored, leftovers) &&
          imageMotionUsableForLine(stored, line, storyShot.staging)
            ? stored
            : "") ||
          buildDefaultBeatMotion({
            styleId: job.styleId,
            speaker,
            line,
            lookLock,
            shotSpeakers: shotCast,
            staging: storyShot.staging,
          });
        const imageMotion = ltxSendPrompt(body, storyShot.staging);

        // Recorded on the clip before the render even starts, so the prompt is
        // visible on screen the moment the clip is queued — not only once it
        // succeeds or fails.
        job = (await patchMobileGenJob(jobId, {
          clips: job.clips.map((c) =>
            c.beatId === next.beatId
              ? { ...c, speaker, line, voiceFile, imageMotion, clipStatus: "running" as const }
              : c,
          ),
        }))!;

        const comfyUrl = await ensureComfyReady();
        const result = await runLtxSmoke({
          platePath,
          audioPath,
          imageMotion,
          segmentText: buildSegmentText(speaker, speaking),
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
        // Re-read so we stack onto whatever takes survived other Saves,
        // not a stale in-memory job that forgot priorClipFiles.
        const fresh = (await readMobileGenJob(jobId)) || job;
        const clips = fresh.clips.map((c) =>
          c.beatId === next.beatId
            ? { ...c, ...rememberClipTake(c, result.localMp4), clipStatus: "done" as const, error: "" }
            : c,
        );
        job = (await patchMobileGenJob(jobId, { clips }))!;
      } catch (e) {
        const fresh = (await readMobileGenJob(jobId)) || job;
        const clips = fresh.clips.map((c) =>
          c.beatId === next.beatId
            ? {
                ...c,
                clipStatus: "error" as const,
                error: e instanceof Error ? e.message : String(e),
              }
            : c,
        );
        job = (await patchMobileGenJob(jobId, { clips }))!;
      } finally {
        dropTailStill(tailStillPath);
      }
      return NextResponse.json({ ok: true, job, advanced: true });
    }

    if (job.phase === "stitch") {
      if (!MOBILE_STITCH_MOVIES) {
        job = (await patchMobileGenJob(jobId, { phase: "review", error: "" }))!;
        return NextResponse.json({ ok: true, job, advanced: true });
      }
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
