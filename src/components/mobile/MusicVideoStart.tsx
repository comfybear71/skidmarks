"use client";

import { useEffect, useRef, useState } from "react";
import { MobilePrimaryButton } from "@/components/mobile/MobileUi";
import type { MobileGenJob } from "@/lib/mobileGenJob";
import { probeBrowserAudioDurationSec, dropScratchSongViaBlob, SCRATCH_SONG_DIRECT_POST_MAX_BYTES } from "@/lib/scratchSongDrop";
import { readApiJson, studioFetchError } from "@/lib/studioFetchError";
import {
  clearPendingSong,
  formatSongLength,
  isMp3File,
  lyricLineCount,
  lyricsPanelOpensAt,
  parkPendingSong,
  peekPendingSong,
  songChipName,
  takePendingSong,
  type PendingSong,
} from "@/lib/musicVideoStart";

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
  const [open, setOpen] = useState(() => lyricsPanelOpensAt(job.lyrics || ""));
  const [saved, setSaved] = useState(false);
  const lines = lyricLineCount(text);

  function update(next: string) {
    setText(next);
    setSaved(false);
    onChange?.(next);
  }

  return (
    <div className="m-mv-block">
      <button type="button" className="m-mv-head" onClick={() => setOpen((v) => !v)}>
        <span className="m-mv-head-label">Lyrics</span>
        <span className="m-mv-head-note">
          {lines ? `${lines} line${lines === 1 ? "" : "s"}` : "optional"}
        </span>
        <span className="m-mv-head-caret">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <textarea
          className="m-mv-lyrics"
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
      ) : null}
      {open && saved ? <p className="m-mv-note">Saved</p> : null}
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
}: {
  jobId: string;
  onPicked?: (name: string, durationSec: number) => void;
}) {
  const parkedNow = peekPendingSong(jobId);
  const [name, setName] = useState(parkedNow?.file.name || "");
  const [lengthSec, setLengthSec] = useState(parkedNow?.durationSec || 0);
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
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
    setName(file.name);
    setLengthSec(durationSec);
    onPicked?.(file.name, durationSec);
  }

  function drop() {
    clearPendingSong(jobId);
    if (srcRef.current) URL.revokeObjectURL(srcRef.current);
    srcRef.current = "";
    setSrc("");
    setName("");
    setLengthSec(0);
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
          <span className="m-mv-song-name">{songChipName(name)}</span>
          <button type="button" className="m-mv-x" aria-label="Drop this song" onClick={drop}>
            ×
          </button>
          {src ? <audio className="m-mv-audio" src={src} controls preload="metadata" /> : null}
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
