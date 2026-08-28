import fs from "fs";
import path from "path";
import { resolveGenOrPackPlate } from "./crashActivePack";
import { resolveMobileBeatAudio } from "./resolveMobileBeatAudio";
import { resolveMobileMedia, uploadMobileMedia } from "./mobileMediaStore";
import { clipFileBasename, humanOrderedClipName, rememberClipTake } from "./mobilePlateClips";
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
  skipSongLipSyncLead,
  ltxSendPrompt,
  stripLtxLipSyncLead,
  looksLikePlatePositionPrompt,
  pickSongSendMotionBody,
  songSendNeedsRecook,
  songStoredMotionUsable,
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
import type { CrashStoryBeat, CrashStoryDoc, CrashStoryShot } from "./crashStoryTypes";
import {
  beatForSongCut,
  MISSING_SCRATCH_SPOKEN_LINE,
  muteSongBeatStub,
  songCutUsesSpokenLine,
  storyShotForSongCut,
} from "./musicVideoSong";
import { probeDurationSeconds } from "./mediaDuration";
import { applyLandedClipDuration } from "./musicVideoTrack";
import { parkMobileClipFile } from "./mobileClipPark";
import { isEpisodeClipPlanError } from "./mobileEpisodeClips";
import { planParkDeskClipTake } from "./parkDeskClip";

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
  const songEarly = job.scratchSong;
  const muteSong = !songCutUsesSpokenLine({
    styleId: job.styleId,
    cutId: opts.cutId,
  });
  const shot =
    job.shots.find((s) => s.shotId === shotId) ||
    (muteSong && (opts.plateFile || "").trim()
      ? job.shots.find((s) => (s.plateFile || "").trim() === (opts.plateFile || "").trim())
      : undefined);
  if (!shot) throw new Error("That plate is not on this job");
  const wantPlate = (opts.plateFile || shot.plateFile || "").trim();
  if (!wantPlate || wantPlate === "__error__") {
    throw new Error(
      shot.error ? `Plate failed — ${shot.error}` : "Draw the still first",
    );
  }
  const scene = story.scenes.find((sc) => sc.id === sceneId);
  let storyShot: CrashStoryShot | undefined =
    scene?.shots.find((sh) => sh.id === shotId) ||
    (muteSong
      ? storyShotForSongCut({
          story,
          jobShots: job.shots,
          cut: { shotId, plateFile: wantPlate },
        })?.shot
      : undefined);
  let beat: CrashStoryBeat | undefined =
    storyShot?.beats.find((b) => b.id === beatId) ||
    (muteSong
      ? beatForSongCut({
          story,
          storyShot,
          beatId,
          songFile: songEarly?.fileName,
        }) || undefined
      : undefined);
  if (muteSong && !beat && (songEarly?.fileName || "").trim()) {
    beat = muteSongBeatStub({
      beatId,
      cutId: opts.cutId,
      songFile: songEarly?.fileName,
    });
  }
  if (!storyShot && muteSong) {
    storyShot = {
      id: shot.shotId,
      title: "",
      summary: "",
      staging: "",
      plateFile: wantPlate,
      beats: beat ? [beat] : [],
      sfx: [],
    };
  }
  if (!storyShot || !beat) {
    throw new Error(
      muteSong
        ? "That still is not ready. Draw it again, then Send."
        : MISSING_SCRATCH_SPOKEN_LINE,
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
  const line = (clipRow?.line || beat.text || "").trim();
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
  const singing =
    Boolean(songFile) &&
    (isDroppedPlaceholderLine(line) || job.styleId === "music_video" || Boolean(opts.cutId));
  // Song look follows who is actually on this plate (pad order), not a leftover
  // carrier-beat speaker that can name someone off-camera → wrong look / "intruder".
  // One person on the pad → that person. Several → beat speaker if they are on
  // the pad, else first on the pad. Never invent silhouette rules from Position text.
  const beatSpeaker = (clipRow?.speaker || beat.speaker || "").trim();
  const onPad = (name: string) =>
    shotCast.some((n) => n.trim().toLowerCase() === name.trim().toLowerCase());
  const speaker = (
    singing
      ? (shotCast.length === 1
          ? shotCast[0]
          : beatSpeaker && onPad(beatSpeaker)
            ? beatSpeaker
            : shotCast[0] || beatSpeaker)
      : beatSpeaker || shotCast[0]
  )
    .trim();
  const sourceAudio = await resolveMobileBeatAudio({
    styleId: job.styleId,
    folderName: mediaFolder,
    folderCandidates: mobileCandidateFolders(job),
    beatId: beat.id,
    voiceFile,
  });
  if (!sourceAudio) {
    throw new Error(
      muteSong || singing
        ? voiceFile
          ? "The song file is missing. Drop the song again."
          : "Drop the song first."
        : voiceFile
          ? `Beat mp3 not reachable — voiceFile="${voiceFile}" folderName="${mediaFolder}" beatId=${beat.id}`
          : "Save the spoken line first — Play appears when the mp3 is ready.",
    );
  }
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
  const stored = stripLtxLipSyncLead(beat.imageMotion || "");
  // Song Send uses the LTX box when he kept words. Empty box still rebuilds
  // the identity lock so later takes do not invent a new face. Gold
  // "Only NAME in frame" on a song cut is not a dumped Position prompt.
  const storedOk = singing
    ? songStoredMotionUsable(stored, leftovers)
    : Boolean(stored) &&
      !imageMotionNamesLeftovers(stored, leftovers) &&
      !looksLikePlatePositionPrompt(stored);
  const cutRow = opts.cutId
    ? (song?.cuts || []).find((c) => c.id === opts.cutId)
    : undefined;
  const performance = cutRow?.performance;
  const body = pickSongSendMotionBody({
    stored,
    storedUsable: storedOk,
    singing,
    singingDefault: buildScratchSongLtxMotion({
      styleId: job.styleId,
      speaker,
      lookLock,
      staging: storyShot.staging,
      performance,
      startSec: cutRow?.startSec,
    }),
    speakingDefault: buildScratchPadLtxMotion({
      styleId: job.styleId,
      speaker,
      line,
      lookLock,
      shotSpeakers: shotCast,
    }),
  });
  const stagingText = storyShot.staging || "";
  const imageMotion = ltxSendPrompt(body, stagingText, {
    skipLipSyncLead: skipSongLipSyncLead({
      speaker,
      staging: stagingText,
      performance,
      singing,
    }),
    speaker,
    shotSpeakers: shotCast,
  });

  const existingFile = opts.cutId ? clipFileBasename(cutRow?.clipFile || "") : "";
  const lastSent = stripLtxLipSyncLead(clipRow?.imageMotion || "");
  const nextSent = stripLtxLipSyncLead(imageMotion);
  if (
    existingFile &&
    !songSendNeedsRecook({
      existingClipFile: existingFile,
      lastSent,
      nextSent,
    })
  ) {
    return job;
  }
  if (existingFile && opts.cutId) {
    const plan = planParkDeskClipTake({
      clips: job.clips || [],
      song: job.scratchSong,
      cutId: opts.cutId,
      fileName: existingFile,
    });
    if (!isEpisodeClipPlanError(plan)) {
      for (const file of plan.filesToPark) {
        parkMobileClipFile(file);
      }
      job = (await patchMobileGenJob(jobId, {
        clips: plan.next,
        scratchSong: plan.nextSong || job.scratchSong,
        error: "",
      }))!;
    }
  }

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
    const doneCuts = (job.scratchSong?.cuts || []).filter((c) => (c.clipFile || "").trim()).length;
    const humanName = humanOrderedClipName({
      index: doneCuts + 1,
      speaker: (storyShot?.title || speaker).trim() || speaker,
      title: job.songTitle || job.artist || "",
    });
    let localMp4 = result.localMp4;
    const humanPath = path.join(path.dirname(result.localMp4), humanName);
    if (humanPath !== result.localMp4) {
      fs.copyFileSync(result.localMp4, humanPath);
      localMp4 = humanPath;
    }
    try {
      await uploadMobileMedia({
        styleId: job.styleId,
        folderName: mediaFolder,
        kind: "mp4",
        localPath: localMp4,
      });
    } catch {
      /* clip still usable this request */
    }
    const next = job.clips.map((c) =>
      c.beatId === beatId
        ? { ...c, ...rememberClipTake(c, localMp4), clipStatus: "done" as const }
        : c,
    );
    const clipName = path.basename(localMp4);
    const probed =
      probeDurationSeconds(localMp4) ||
      (Number(opts.sliceDurationSec) > 0 ? Number(opts.sliceDurationSec) : undefined);
    job = (await patchMobileGenJob(jobId, {
      clips: next,
      scratchSong: patchScratchSongCut(job.scratchSong, opts.cutId, {
        clipFile: clipName,
        status: "done",
        error: "",
        durationSec: probed,
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
  patch: {
    clipFile?: string;
    status?: "pending" | "running" | "done" | "error";
    error?: string;
    durationSec?: number;
  },
): ScratchSong | null | undefined {
  if (!song || !cutId) return song;
  const next: ScratchSong = {
    ...song,
    cuts: (song.cuts || []).map((c) => (c.id === cutId ? { ...c, ...patch } : c)),
  };
  if (patch.status === "done" && Number(patch.durationSec) > 0) {
    return applyLandedClipDuration(next, { cutId, durationSec: Number(patch.durationSec) });
  }
  return next;
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
