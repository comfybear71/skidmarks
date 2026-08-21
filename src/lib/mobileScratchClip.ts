import path from "path";
import { resolveGenOrPackPlate } from "./crashActivePack";
import { resolveMobileBeatAudio } from "./resolveMobileBeatAudio";
import { resolveMobileMedia, uploadMobileMedia } from "./mobileMediaStore";
import { rememberClipTake } from "./mobilePlateClips";
import { runLtxSmoke } from "./ltxSmoke";
import { resolveComfyUrl, probeComfyUrl } from "./comfyClient";
import { candidateLookPrompt } from "./mobileJobReady";
import {
  imageMotionNamesLeftovers,
  leftoverHydrateSpeakers,
  shotSpeakersOnCard,
} from "./mobilePlateLines";
import { CRASH_DIR } from "./paths";
import {
  buildScratchPadLtxMotion,
  buildScratchSongLtxMotion,
  buildSegmentText,
  buildGlobalPrompt,
  isInstrumentalStaging,
  ltxSendPrompt,
  stripLtxLipSyncLead,
  looksLikePlatePositionPrompt,
} from "./mobileImageMotion";
import {
  clampSongWindow,
  isDroppedPlaceholderLine,
  scratchSongSliceTempPath,
  sliceSongMp3,
  type ScratchSong,
} from "./scratchSongSlice";
import {
  mobileCandidateFolders,
  mobileMediaFolder,
  patchMobileGenJob,
  type MobileClipUnit,
  type MobileGenJob,
} from "./mobileGenJob";
import type { CrashStoryDoc } from "./crashStoryTypes";

async function ensureComfyReady(): Promise<string> {
  const { preferComfyCloudLtx } = await import("./ltxCloudIa2v");
  if (preferComfyCloudLtx()) return "";

  const resolved = await resolveComfyUrl();
  if (resolved.ok) {
    const status = await probeComfyUrl(resolved.url);
    if (status === "up") return resolved.url;
  }
  throw new Error("No Comfy Cloud key and no reachable COMFY_URL — set one to animate");
}

/**
 * One LTX clip for the scratch plate. Does not flip job.phase to animate —
 * /m stays on review. Patches only this beat's clip row.
 */
export async function runScratchLtxClip(opts: {
  job: MobileGenJob;
  story: CrashStoryDoc;
  shotId: string;
  sceneId: string;
  beatId: string;
  /** Override pad still — one cut in a song list. */
  plateFile?: string;
  sliceStartSec?: number;
  sliceDurationSec?: number;
  cutId?: string;
}): Promise<MobileGenJob> {
  const { story, shotId, sceneId, beatId } = opts;
  let job = opts.job;
  const jobId = job.id;
  const shot = job.shots.find((s) => s.shotId === shotId);
  const scene = story.scenes.find((sc) => sc.id === sceneId);
  const storyShot = scene?.shots.find((sh) => sh.id === shotId);
  const beat = storyShot?.beats.find((b) => b.id === beatId);
  if (!shot) throw new Error("That plate is not on this job");
  const wantPlate = (opts.plateFile || shot.plateFile || "").trim();
  if (!wantPlate || wantPlate === "__error__") {
    throw new Error(
      shot.error ? `Plate failed — ${shot.error}` : "Draw the still first",
    );
  }
  if (!storyShot || !beat) {
    throw new Error(
      "That line is missing from the scratch plate — Draw again, or drop the song so the spoken line is on this plate.",
    );
  }

  const mediaFolder = mobileMediaFolder(job);
  const defaultPlatePath =
    resolveGenOrPackPlate(wantPlate) ||
    (await resolveMobileMedia({
      styleId: job.styleId,
      folderName: mediaFolder,
      kind: "plates",
      fileName: wantPlate,
      destPath: path.join(CRASH_DIR, "gen", wantPlate),
    }));
  if (!defaultPlatePath) throw new Error("Plate file missing on disk");

  const clipRow = (job.clips || []).find((c) => c.beatId === beatId);
  // Cloud story hydrate can blank beat.voiceFile on read while the queued
  // clip still holds the Save take — same fix as /m step/route.ts.
  const song = job.scratchSong;
  const songFile = (song?.fileName || "").trim();
  const voiceFile = (songFile || clipRow?.voiceFile || beat.voiceFile || "").trim();
  const speaker = (clipRow?.speaker || beat.speaker || "").trim();
  const line = (clipRow?.line || beat.text || "").trim();
  const sourceAudio = await resolveMobileBeatAudio({
    styleId: job.styleId,
    folderName: mediaFolder,
    folderCandidates: mobileCandidateFolders(job),
    beatId: beat.id,
    voiceFile,
  });
  if (!sourceAudio) {
    throw new Error(
      voiceFile
        ? `Beat mp3 not reachable — voiceFile="${voiceFile}" folderName="${mediaFolder}" beatId=${beat.id}`
        : "Save the spoken line first — Play appears when the mp3 is ready.",
    );
  }
  const singing =
    Boolean(songFile) &&
    (isDroppedPlaceholderLine(line) || job.styleId === "music_video" || Boolean(opts.cutId));
  if (looksLikePlatePositionPrompt(line) && !singing) {
    throw new Error("That's the still position, not speech. Wipe the line box, type what they say, then Save.");
  }
  const window = clampSongWindow(
    opts.sliceStartSec ?? song?.sliceStartSec ?? 0,
    opts.sliceDurationSec ?? song?.sliceDurationSec ?? 15,
    song?.durationSec || 0,
  );
  const needsSlice = Boolean(song?.fileName) && (window.startSec > 0.05 || (song?.durationSec || 0) > window.durationSec + 0.4);
  const audioPath = needsSlice
    ? sliceSongMp3({
        srcPath: sourceAudio,
        destPath: scratchSongSliceTempPath(jobId),
        startSec: window.startSec,
        durationSec: window.durationSec,
      })
    : sourceAudio;

  const speaking = line.length > 0 && !singing;
  const lookLock =
    candidateLookPrompt(job.castCandidates, speaker) ||
    job.roster.find((c) => c.name.trim().toLowerCase() === speaker.toLowerCase())?.appearance;
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
  const storedOk =
    Boolean(stored) &&
    !imageMotionNamesLeftovers(stored, leftovers) &&
    !looksLikePlatePositionPrompt(stored);
  const body =
    (storedOk ? stored : "") ||
    (singing
      ? buildScratchSongLtxMotion({
          styleId: job.styleId,
          speaker,
          lookLock,
          staging: storyShot.staging,
        })
      : buildScratchPadLtxMotion({
          styleId: job.styleId,
          speaker,
          line,
          lookLock,
          shotSpeakers: shotCast,
        }));
  const imageMotion = ltxSendPrompt(body, storyShot.staging, {
    skipLipSyncLead: singing && isInstrumentalStaging(storyShot.staging || ""),
  });

  const clips: MobileClipUnit[] = (job.clips || []).some((c) => c.beatId === beatId)
    ? (job.clips || []).map((c) =>
        c.beatId === beatId
          ? {
              ...c,
              shotId,
              sceneId,
              speaker,
              line,
              voiceFile,
              imageMotion,
              clipStatus: "pending",
              error: "",
            }
          : c,
      )
    : [
        ...(job.clips || []),
        {
          beatId,
          shotId,
          sceneId,
          clipFile: "",
          clipStatus: "pending",
          error: "",
          speaker,
          line,
          voiceFile,
          imageMotion,
        },
      ];

  job = (await patchMobileGenJob(jobId, { clips, error: "" }))!;

  // Scratch retries always start from the pad still — never the last frame of a
  // prior clip (that chains bad poses: sitting, phone, cropped head, walkers).
  const platePath = defaultPlatePath;

  try {
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
        folderName: mediaFolder,
        kind: "mp4",
        localPath: result.localMp4,
      });
    } catch {
      /* clip still usable this request */
    }
    const next = job.clips.map((c) =>
      c.beatId === beatId
        ? { ...c, ...rememberClipTake(c, result.localMp4), clipStatus: "done" as const }
        : c,
    );
    const clipName = path.basename(result.localMp4);
    job = (await patchMobileGenJob(jobId, {
      clips: next,
      scratchSong: patchScratchSongCut(job.scratchSong, opts.cutId, {
        clipFile: clipName,
        status: "done",
        error: "",
      }),
    }))!;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const next = job.clips.map((c) =>
      c.beatId === beatId
        ? { ...c, clipStatus: "error" as const, error: msg }
        : c,
    );
    job = (await patchMobileGenJob(jobId, {
      clips: next,
      scratchSong: patchScratchSongCut(job.scratchSong, opts.cutId, {
        status: "error",
        error: msg,
      }),
    }))!;
    throw e;
  }
  return job;
}

function patchScratchSongCut(
  song: ScratchSong | null | undefined,
  cutId: string | undefined,
  patch: { clipFile?: string; status?: "pending" | "running" | "done" | "error"; error?: string },
): ScratchSong | null | undefined {
  if (!song || !cutId) return song;
  return {
    ...song,
    cuts: (song.cuts || []).map((c) => (c.id === cutId ? { ...c, ...patch } : c)),
  };
}

/** Early throw after marking running left the cut hung forever — flip it to error. */
export async function failScratchSongCutRun(opts: {
  jobId: string;
  job: MobileGenJob;
  cutId: string;
  message: string;
}): Promise<MobileGenJob> {
  const msg = (opts.message || "").trim() || "Clip failed";
  const song = opts.job.scratchSong;
  if (!song) return opts.job;
  const next = await patchMobileGenJob(opts.jobId, {
    scratchSong: patchScratchSongCut(song, opts.cutId, {
      status: "error",
      error: msg,
    }),
    error: "",
  });
  return next || opts.job;
}
