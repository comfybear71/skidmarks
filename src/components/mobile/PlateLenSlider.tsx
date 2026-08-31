"use client";

import { useEffect, useState } from "react";
import type { MobileGenJob } from "@/lib/mobileGenJob";
import { writeHangLengthDraft } from "@/lib/hangLengthDraft";
import {
  hungBarDurationSec,
  msToSec,
  plateTimingForShot,
  songFromTrackDraft,
  type MusicVideoTrackDraft,
} from "@/lib/musicVideoTrack";
import type { ScratchSong } from "@/lib/scratchSongWindow";
import {
  clampHangLengthSec,
  HANG_LENGTH_MAX_SEC,
  HANG_LENGTH_MIN_SEC,
  SCRATCH_SONG_SLICE_DEFAULT_SEC,
} from "@/lib/scratchSongWindow";
import { readApiJson } from "@/lib/studioFetchError";

/** 2–60 on this still. Seconds stay visible. Not chips-only 5/10/15. */
export function PlateLenSlider({
  valueSec,
  disabled,
  onCommit,
  onDraft,
}: {
  valueSec: number;
  disabled?: boolean;
  onCommit: (sec: number) => void;
  onDraft?: (sec: number) => void;
}) {
  const live = valueSec > 0 ? valueSec : SCRATCH_SONG_SLICE_DEFAULT_SEC;
  const [draft, setDraft] = useState(String(live));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(String(live));
  }, [live, focused]);

  function commit(raw: number) {
    const sec = clampHangLengthSec(raw);
    setDraft(String(sec));
    onDraft?.(sec);
    if (Math.abs(sec - live) < 0.05) return;
    onCommit(sec);
  }

  const typed = Number(draft);
  const shown =
    Number.isFinite(typed) && typed > 0
      ? typed >= HANG_LENGTH_MIN_SEC
        ? clampHangLengthSec(typed)
        : typed
      : live;
  const sliderSec = clampHangLengthSec(Number.isFinite(typed) && typed > 0 ? typed : live);

  return (
    <div className="m-track-pick-len" role="group" aria-label="Clip length">
      <input
        type="range"
        className="m-track-len-slider"
        min={HANG_LENGTH_MIN_SEC}
        max={HANG_LENGTH_MAX_SEC}
        step={1}
        aria-label="Seconds on this still"
        value={sliderSec}
        disabled={disabled}
        onChange={(e) => {
          const sec = clampHangLengthSec(Number(e.target.value));
          setDraft(String(sec));
          onDraft?.(sec);
          onCommit(sec);
        }}
      />
      <input
        type="text"
        className="m-track-len-box"
        inputMode="decimal"
        aria-label="Seconds on the song"
        value={draft}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n >= HANG_LENGTH_MIN_SEC && n <= HANG_LENGTH_MAX_SEC) {
            onDraft?.(n);
          }
        }}
        onBlur={() => {
          setFocused(false);
          commit(Number(draft));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(Number(draft));
          }
        }}
      />
      <span>{shown}s</span>
    </div>
  );
}

/** Plate-row / LTX IMAGE MOTION — writes plateTimings so Send reads this clock. */
export function PlateHangLenControl({
  jobId,
  shotId,
  song,
  trackDraft,
  disabled,
  onJobChange,
}: {
  jobId: string;
  shotId: string;
  song?: ScratchSong | null;
  trackDraft?: MusicVideoTrackDraft | null;
  disabled?: boolean;
  onJobChange?: (job: MobileGenJob) => void;
}) {
  const [busy, setBusy] = useState(false);
  const merged = songFromTrackDraft(trackDraft, song);
  const timing = plateTimingForShot(song, trackDraft, shotId);
  const valueSec = hungBarDurationSec(timing) || 0;
  useEffect(() => {
    if (jobId && shotId && valueSec > 0) {
      writeHangLengthDraft(jobId, shotId, valueSec);
    }
  }, [jobId, shotId, valueSec]);

  async function setLength(durationSec: number) {
    if (!jobId || !shotId || !merged?.fileName) return;
    const sec = writeHangLengthDraft(jobId, shotId, durationSec);
    setBusy(true);
    try {
      const res = await fetch("/api/crash/mobile/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-plate-duration",
          jobId,
          plateId: shotId,
          ...(timing ? { startSec: msToSec(timing.startMs) } : {}),
          durationSec: sec,
          ...(Number(merged?.durationSec) > 0 ? { songDurationSec: Number(merged.durationSec) } : {}),
        }),
      });
      const raw = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (!res.ok) throw new Error(raw.error?.trim() || `Request failed (${res.status})`);
      if (raw.job) onJobChange?.(raw.job);
    } catch {
      /* length stays; Send still reads the last hung bar */
    } finally {
      setBusy(false);
    }
  }

  if (!shotId) return null;

  return (
    <PlateLenSlider
      valueSec={valueSec}
      disabled={disabled || busy}
      onDraft={(sec) => writeHangLengthDraft(jobId, shotId, sec)}
      onCommit={(sec) => void setLength(sec)}
    />
  );
}
