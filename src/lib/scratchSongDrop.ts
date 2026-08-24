/**
 * Browser helpers for dropping a song on Scratch.
 * No Node — the phone may import this. ffmpeg stays in scratchSongSlice.
 */
import { upload } from "@vercel/blob/client";
import { readApiJson } from "./studioFetchError";
import type { MobileGenJob } from "./mobileGenJob";

/** Vercel kills a multipart POST around 4.5MB. Stay under that for the old pipe. */
export const SCRATCH_SONG_DIRECT_POST_MAX_BYTES = Math.floor(3.5 * 1024 * 1024);

export function probeBrowserAudioDurationSec(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    const done = (sec: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(sec) && sec > 0 ? sec : 0);
    };
    audio.onloadedmetadata = () => done(audio.duration);
    audio.onerror = () => done(0);
    audio.src = url;
  });
}

/**
 * Track drop → Blob, then a tiny JSON attach. No beat needed.
 * The old FormData POST dies on Vercel around 4.5MB (Jack Ash songs are bigger).
 */
export async function dropTrackSongViaBlob(opts: {
  jobId: string;
  file: File;
  durationSec: number;
}): Promise<{ job?: MobileGenJob; fileName?: string; durationSec?: number }> {
  const prepRes = await fetch("/api/crash/mobile/track/song", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "prepare",
      jobId: opts.jobId,
      name: opts.file.name || "song.mp3",
    }),
  });
  const prep = await readApiJson<{
    fileName?: string;
    pathname?: string;
    error?: string;
  }>(prepRes);
  const fileName = (prep.fileName || "").trim();
  const pathname = (prep.pathname || "").trim();
  if (!fileName || !pathname) {
    throw new Error("Couldn't prepare the cloud song drop");
  }
  const blob = await upload(pathname, opts.file, {
    access: "public",
    handleUploadUrl: "/api/crash/mobile/track/song-blob",
    clientPayload: JSON.stringify({
      jobId: opts.jobId,
      fileName,
    }),
    contentType: "audio/mpeg",
    multipart: opts.file.size > 8 * 1024 * 1024,
  });
  const attachRes = await fetch("/api/crash/mobile/track/song", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "attach",
      jobId: opts.jobId,
      fileName,
      blobUrl: blob.url,
      durationSec: opts.durationSec,
    }),
  });
  return readApiJson<{ job?: MobileGenJob; fileName?: string; durationSec?: number; error?: string }>(
    attachRes,
  );
}

/** Full track → Blob, then a tiny JSON attach. Bypasses the 4.5MB Studio POST. */
export async function dropScratchSongViaBlob(opts: {
  jobId: string;
  beatId: string;
  file: File;
  text?: string;
  durationSec: number;
}): Promise<{ job?: MobileGenJob; voiceFile?: string }> {
  const prepRes = await fetch("/api/crash/mobile/beat-audio/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "prepare",
      jobId: opts.jobId,
      beatId: opts.beatId,
      text: opts.text || "",
    }),
  });
  const prep = await readApiJson<{
    fileName?: string;
    pathname?: string;
    error?: string;
  }>(prepRes);
  const fileName = (prep.fileName || "").trim();
  const pathname = (prep.pathname || "").trim();
  if (!fileName || !pathname) {
    throw new Error("Couldn't prepare the cloud song drop");
  }
  const blob = await upload(pathname, opts.file, {
    access: "public",
    handleUploadUrl: "/api/crash/mobile/beat-audio/song-blob",
    clientPayload: JSON.stringify({
      jobId: opts.jobId,
      beatId: opts.beatId,
      fileName,
    }),
    contentType: "audio/mpeg",
    multipart: opts.file.size > 8 * 1024 * 1024,
  });
  const attachRes = await fetch("/api/crash/mobile/beat-audio/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "attach",
      jobId: opts.jobId,
      beatId: opts.beatId,
      text: opts.text || "",
      fileName,
      blobUrl: blob.url,
      durationSec: opts.durationSec,
    }),
  });
  return readApiJson<{ job?: MobileGenJob; voiceFile?: string; error?: string }>(attachRes);
}
