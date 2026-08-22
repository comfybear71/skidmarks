"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MobilePrimaryButton } from "@/components/mobile/MobileUi";
import type { MobileGenJob } from "@/lib/mobileGenJob";
import { probeBrowserAudioDurationSec, dropScratchSongViaBlob, SCRATCH_SONG_DIRECT_POST_MAX_BYTES } from "@/lib/scratchSongDrop";
import { readApiJson } from "@/lib/studioFetchError";
import {
  clearPendingSong,
  formatSongLength,
  isMp3File,
  lyricLineCount,
  parkPendingSong,
  peekPendingSong,
  songChipName,
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
}: {
  src: string;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  onTime?: (sec: number) => void;
}) {
  // The element is owned here and mirrored out to any ref the parent passed:
  // writing currentTime straight onto a prop ref is not ours to mutate.
  const own = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [len, setLen] = useState(0);
  const pct = len > 0 ? Math.min(100, (at / len) * 100) : 0;

  return (
    <div className="m-song-player">
      <audio
        ref={(node) => {
          own.current = node;
          if (audioRef) audioRef.current = node;
        }}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setLen(e.currentTarget.duration || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
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

async function saveLyrics(jobId: string, lyrics: string): Promise<void> {
  await fetch("/api/crash/mobile/song", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "set-lyrics", jobId, lyrics }),
  });
}

/**
 * Lyrics box. Shared by the start panel and the song desk so the words stay
 * reachable after Lock. Closed unless there is already something in it.
 */
export function LyricsBox({
  job,
  onSaved,
  onChange,
}: {
  job: MobileGenJob;
  onSaved?: (lyrics: string) => void;
  onChange?: (lyrics: string) => void;
}) {
  const [text, setText] = useState(job.lyrics || "");
  const [saved, setSaved] = useState(false);
  const lines = lyricLineCount(text);

  function update(next: string) {
    setText(next);
    setSaved(false);
    onChange?.(next);
  }

  return (
    <div className="m-mv-lyrics">
      <div className="m-mv-lyrics-note">
        {lines ? `${lines} line${lines === 1 ? "" : "s"}` : "paste the words"}
        {saved ? " · saved" : ""}
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
            void saveLyrics(job.id, text).then(() => {
              setSaved(true);
              onSaved?.(text);
            });
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
  job,
  onPicked,
}: {
  jobId: string;
  /** Pass the job to put the Lyrics toggle in this card's title row. */
  job?: MobileGenJob;
  onPicked?: (name: string, durationSec: number) => void;
}) {
  const parkedNow = usePendingSong(jobId);
  const name = parkedNow?.file.name || "";
  const lengthSec = parkedNow?.durationSec || 0;
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [src, setSrc] = useState("");
  const srcRef = useRef("");
  const pick = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (srcRef.current) URL.revokeObjectURL(srcRef.current);
    };
  }, []);

  async function take(file: File) {
    if (!isMp3File(file)) {
      setErr("That is not an mp3.");
      return;
    }
    setErr("");
    const durationSec = await probeBrowserAudioDurationSec(file);
    parkPendingSong(jobId, { file, durationSec });
    if (srcRef.current) URL.revokeObjectURL(srcRef.current);
    const url = URL.createObjectURL(file);
    srcRef.current = url;
    setSrc(url);
    onPicked?.(file.name, durationSec);
  }

  function drop() {
    clearPendingSong(jobId);
    if (srcRef.current) URL.revokeObjectURL(srcRef.current);
    srcRef.current = "";
    setSrc("");
    onPicked?.("", 0);
  }

  return (
    <div className="m-mv-block">
      <div className="m-mv-head as-static">
        <span className="m-mv-head-label">Song</span>
        <span className="m-mv-head-note">{lengthSec ? formatSongLength(lengthSec) : "mp3"}</span>
      </div>
      {name ? (
        <div className="m-mv-song">
          {/* Title line owns the card: name on the left, Lyrics and × on the
              right. Lyrics stay shut — they are for entering, not reading. */}
          <div className="m-mv-song-top">
            <span className="m-mv-song-name">{songChipName(name)}</span>
            {job ? (
              <button
                type="button"
                className={`m-mv-lyr-toggle${lyricsOpen ? " is-open" : ""}`}
                aria-expanded={lyricsOpen}
                onClick={() => setLyricsOpen((v) => !v)}
              >
                Lyrics <span className="m-mv-lyr-caret">{lyricsOpen ? "▾" : "▸"}</span>
              </button>
            ) : null}
            <button type="button" className="m-mv-x" aria-label="Drop this song" onClick={drop}>
              ×
            </button>
          </div>
          {src ? <SongPlayer src={src} /> : null}
          {job && lyricsOpen ? <LyricsBox job={job} /> : null}
        </div>
      ) : (
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
      )}
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
    </div>
  );
}

/**
 * What stands where the Plates script template used to be, for music_video.
 * Band + place are already above. This is the song and the words, then Start.
 */
export function MusicVideoStart({
  job,
  busy,
  onStart,
}: {
  job: MobileGenJob;
  busy: boolean;
  onStart: (lyrics: string) => void;
}) {
  const [hasSong, setHasSong] = useState(Boolean(peekPendingSong(job.id)));
  const [lyricsText, setLyricsText] = useState(job.lyrics || "");

  return (
    <div className="m-mv">
      <SongDropRow jobId={job.id} onPicked={(name) => setHasSong(Boolean(name))} />
      <LyricsBox job={job} onChange={setLyricsText} />
      <MobilePrimaryButton disabled={busy} onClick={() => onStart(lyricsText)}>
        {busy ? "Starting…" : "Start the video"}
      </MobilePrimaryButton>
      {!hasSong ? <p className="m-mv-note">No song yet — you can drop it after this too.</p> : null}
    </div>
  );
}
