"use client";

import { useEffect, useState } from "react";
import type { MobileGenJob } from "@/lib/mobileGenJob";
import {
  hungBarDurationSec,
  msToSec,
  plateTimingForShot,
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

/** 5–40 on this still. Seconds stay visible. Not chips-only 5/10/15. */
export function PlateLenSlider({
  valueSec,
  disabled,
  onCommit,
}: {
  valueSec: number;
  disabled?: boolean;
  onCommit: (sec: number) => void;
}) {
  const live = valueSec > 0 ? valueSec : SCRATCH_SONG_SLICE_DEFAULT_SEC;
  const [draft, setDraft] = useState(String(live));
  useEffect(() => {
    setDraft(String(live));
  }, [live]);

  function commit(raw: number) {
    const sec = clampHangLengthSec(raw);
    setDraft(String(sec));
    if (Math.abs(sec - live) < 0.05) return;
    onCommit(sec);
  }

  const shown = clampHangLengthSec(Number(draft) || live);

  return (
    <div className="m-track-pick-len" role="group" aria-label="Clip length">
      <input
        type="range"
        className="m-track-len-slider"
        min={HANG_LENGTH_MIN_SEC}
        max={HANG_LENGTH_MAX_SEC}
        step={1}
        aria-label="Seconds on this still"
        value={shown}
        disabled={disabled}
        onChange={(e) => {
          const sec = clampHangLengthSec(Number(e.target.value));
          setDraft(String(sec));
          onCommit(sec);
        }}
      />
      <input
        type="number"
        min={HANG_LENGTH_MIN_SEC}
        max={HANG_LENGTH_MAX_SEC}
        step={0.1}
        inputMode="decimal"
        aria-label="Seconds on the song"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(Number(draft))}
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
  const timing = plateTimingForShot(song, trackDraft, shotId);
  const valueSec = hungBarDurationSec(timing) || 0;

  async function setLength(durationSec: number) {
    if (!jobId || !shotId || !song?.fileName) return;
    const sec = clampHangLengthSec(durationSec);
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

  if (!song?.fileName || !shotId) return null;

  return (
    <PlateLenSlider
      valueSec={valueSec}
      disabled={disabled || busy}
      onCommit={(sec) => void setLength(sec)}
    />
  );
}
