"use client";

import { useRef, useState, useSyncExternalStore, useEffect } from "react";
import type { MobileGenJob } from "@/lib/mobileGenJob";
import { probeBrowserAudioDurationSec, dropScratchSongViaBlob, SCRATCH_SONG_DIRECT_POST_MAX_BYTES } from "@/lib/scratchSongDrop";
import { readApiJson, studioFetchError } from "@/lib/studioFetchError";
import {
  isMp3File,
  lyricLineCount,
  parkPendingSong,
  peekPendingSong,
  subscribePendingSong,
  takePendingSong,
  type PendingSong,
} from "@/lib/musicVideoStart";

/**
 * The parked mp3, as React state. Every panel that asks "do we have a song
 * yet" reads this — a plain Map is invisible to React, so only the box you
 * dropped on used to know, and the track kept asking for a song it already had.
 */
export function usePendingSong(jobId: string): PendingSong | null {
  return useSyncExternalStore(
    subscribePendingSong,
    () => peekPendingSong(jobId),
    () => null,
  );
}

function clock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const whole = Math.floor(sec);
  const m = Math.floor(whole / 60);
  return `${m}:${String(whole - m * 60).padStart(2, "0")}`;
}

/**
 * Compact transport. The native <audio controls> is a fat light-grey slab that
 * fights every other control on this desk — this is play/pause, a thin scrub
 * and the clock, in our colours.
 */
export function SongPlayer({
  src,
  audioRef,
  onTime,
  onDuration,
  onPlayingChange,
}: {
  src: string;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  onTime?: (sec: number) => void;
  /** Fires when the mp3 reports its length — the job row can still be blank. */
  onDuration?: (sec: number) => void;
  /** The marquee only runs while the song does. */
  onPlayingChange?: (playing: boolean) => void;
}) {
  // The element is owned here and mirrored out to any ref the parent passed:
  // writing currentTime straight onto a prop ref is not ours to mutate.
  const own = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [len, setLen] = useState(0);
  const pct = len > 0 ? Math.min(100, (at / len) * 100) : 0;

  function noteDuration(sec: number) {
    if (!Number.isFinite(sec) || sec <= 0) return;
    setLen(sec);
    onDuration?.(sec);
  }

  return (
    <div className="m-song-player">
      <audio
        ref={(node) => {
          own.current = node;
          if (audioRef) audioRef.current = node;
        }}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => noteDuration(e.currentTarget.duration || 0)}
        onDurationChange={(e) => noteDuration(e.currentTarget.duration || 0)}
        onPlay={() => {
          setPlaying(true);
          onPlayingChange?.(true);
        }}
        onPause={() => {
          setPlaying(false);
          onPlayingChange?.(false);
        }}
        onEnded={() => {
          setPlaying(false);
          onPlayingChange?.(false);
        }}
        onTimeUpdate={(e) => {
          setAt(e.currentTarget.currentTime || 0);
          onTime?.(e.currentTarget.currentTime || 0);
        }}
      />
      <button
        type="button"
        className="m-song-play"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => {
          const node = own.current;
          if (!node) return;
          if (node.paused) void node.play();
          else node.pause();
        }}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div
        className="m-song-scrub"
        onPointerDown={(e) => {
          const node = own.current;
          if (!node || !len) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
          node.currentTime = (x / rect.width) * len;
        }}
      >
        <div className="m-song-scrub-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="m-song-clock">
        {clock(at)} / {clock(len)}
      </span>
    </div>
  );
}

/** Parked mp3 from before Lock — attach once a carrier beat exists. */
export async function attachParkedSongToBeat(opts: {
  jobId: string;
  beatId: string;
  pending: PendingSong<File>;
}): Promise<MobileGenJob | null> {
  const { jobId, beatId, pending } = opts;
  const { file, durationSec } = pending;
  if (file.size > SCRATCH_SONG_DIRECT_POST_MAX_BYTES) {
    const data = await dropScratchSongViaBlob({ jobId, beatId, file, durationSec });
    return data.job || null;
  }
  const form = new FormData();
  form.set("jobId", jobId);
  form.set("beatId", beatId);
  form.set("file", file, file.name || "song.mp3");
  const res = await fetch("/api/crash/mobile/beat-audio/upload", { method: "POST", body: form });
  const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error?.trim() || `Couldn't attach the song (${res.status})`);
  }
  return data.job || null;
}

/** Read-once attach — call right after Start the video when the API returns carrierBeatId. */
export async function attachTakenPendingSong(opts: {
  jobId: string;
  beatId: string;
}): Promise<MobileGenJob | null> {
  const pending = takePendingSong(opts.jobId);
  if (!pending || !opts.beatId) return null;
  return attachParkedSongToBeat({ ...opts, pending: pending as PendingSong<File> });
}

async function saveLyrics(jobId: string, lyrics: string): Promise<MobileGenJob | null> {
  const res = await fetch("/api/crash/mobile/song", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "set-lyrics", jobId, lyrics }),
  });
  const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error?.trim() || `Couldn't save lyrics (${res.status})`);
  }
  return data.job || null;
}

/**
 * Lyrics box. Shared by the start panel and the song desk so the words stay
 * reachable after Lock. Closed unless there is already something in it.
 */
export function LyricsBox({
  job,
  onSaved,
  onChange,
  onJobChange,
}: {
  job: MobileGenJob;
  onSaved?: (lyrics: string) => void;
  onChange?: (lyrics: string) => void;
  onJobChange?: (job: MobileGenJob) => void;
}) {
  const [text, setText] = useState(job.lyrics || "");
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const lines = lyricLineCount(text);

  useEffect(() => {
    setText(job.lyrics || "");
    setSaved(false);
    setSaveErr("");
  }, [job.id, job.lyrics]);

  function update(next: string) {
    setText(next);
    setSaved(false);
    setSaveErr("");
    onChange?.(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persist(next);
    }, 1200);
  }

  async function persist(next: string) {
    setSaving(true);
    try {
      const updated = await saveLyrics(job.id, next);
      setSaved(true);
      setSaveErr("");
      onSaved?.(next);
      if (updated) onJobChange?.(updated);
    } catch (e) {
      setSaveErr(studioFetchError(e, "Couldn't save lyrics — tap out and try again"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="m-mv-lyrics">
      <div className="m-mv-lyrics-note">
        {lines ? `${lines} line${lines === 1 ? "" : "s"}` : "paste the words"}
        {saved ? " · saved" : saving ? " · saving…" : ""}
        {saveErr ? ` · ${saveErr}` : ""}
      </div>
      {(
        <textarea
          className="m-mv-lyrics-input"
          value={text}
          rows={6}
          spellCheck={false}
          placeholder="Paste the words…"
          onChange={(e) => update(e.target.value)}
          onBlur={() => {
            if (saveTimer.current) {
              window.clearTimeout(saveTimer.current);
              saveTimer.current = null;
            }
            void persist(text);
          }}
        />
      )}
    </div>
  );
}

/**
 * Song row — drag or tap to pick the mp3, then play it back.
 * The file is parked (musicVideoStart) and attached by the song desk once
 * Lock has built a beat for it to hang on.
 */
export function SongDropRow({
  jobId,
  onPicked,
  onSaved,
}: {
  jobId: string;
  onPicked?: (name: string, durationSec: number) => void;
  /** The job after the song is written to disk/Blob. */
  onSaved?: (job: MobileGenJob) => void;
}) {
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
  const pick = useRef<HTMLInputElement | null>(null);

  async function take(file: File) {
    if (!isMp3File(file)) {
      setErr("That is not an mp3.");
      return;
    }
    setErr("");
    const durationSec = await probeBrowserAudioDurationSec(file);
    // Park first so the desk swaps to the player straight away, then save it.
    // Parking alone used to be the whole story, so a refresh lost the song.
    parkPendingSong(jobId, { file, durationSec });
    onPicked?.(file.name, durationSec);
    try {
      const form = new FormData();
      form.set("jobId", jobId);
      form.set("file", file, file.name || "song.mp3");
      const res = await fetch("/api/crash/mobile/track/song", { method: "POST", body: form });
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (data.job) onSaved?.(data.job);
    } catch (e) {
      setErr(studioFetchError(e, "Song is on screen but did not save — drop it again"));
    }
  }

  return (
    <>
      {/* Just the drop target. The title, the player and the Lyrics toggle
          belong to the track — this sits in the player's slot until a song
          lands, so the UI is the same shape empty or full. */}
      <button
        type="button"
        className={`m-mv-drop${over ? " is-over" : ""}`}
        onClick={() => pick.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void take(file);
        }}
      >
        Drop the mp3 — or tap to pick
      </button>
      <input
        ref={pick}
        type="file"
        accept="audio/mpeg,audio/mp3,.mp3"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void take(file);
        }}
      />
      {err ? <p className="m-mv-err">{err}</p> : null}
    </>
  );
}
