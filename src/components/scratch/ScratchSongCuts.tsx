"use client";

import { useEffect, useState } from "react";
import { MobilePrimaryButton } from "@/components/mobile/MobileUi";
import type { MobileGenJob } from "@/lib/mobileGenJob";
import {
  formatSongClock,
  songWindowLabel,
  type ScratchSongCut,
} from "@/lib/scratchSongWindow";

export function ScratchSongCuts({
  job,
  plateFile,
  disabled,
  onWindow,
  onAddCut,
  onRemoveCut,
  onParkEnd,
  onRunCut,
  onRunAll,
  onStitch,
}: {
  job: MobileGenJob;
  plateFile?: string;
  disabled?: boolean;
  onWindow: (startSec: number, durationSec: number) => void;
  onAddCut: () => void;
  onRemoveCut: (cutId: string) => void;
  onParkEnd: (cutId: string) => void;
  onRunCut: (cutId: string) => void;
  onRunAll: () => void;
  onStitch: () => void;
}) {
  const song = job.scratchSong;
  const [start, setStart] = useState(song?.sliceStartSec ?? 0);
  const [len, setLen] = useState(song?.sliceDurationSec ?? 15);
  useEffect(() => {
    if (!song) return;
    setStart(song.sliceStartSec);
    setLen(song.sliceDurationSec);
  }, [song?.sliceStartSec, song?.sliceDurationSec, song?.fileName]);
  if (!song?.fileName) return null;
  const cuts = song.cuts || [];
  const done = cuts.filter((c) => c.status === "done" && c.clipFile).length;
  const canStitch = done >= 2;
  const label = songWindowLabel(song.durationSec, cuts);

  return (
    <div className="scratch-song">
      <div className="scratch-song-title">Song cuts — Scratch only</div>
      <p className="scratch-song-clock">{label}</p>
      <p className="scratch-song-hint">
        LTX gets one still + one 4–30s slice. 4 minutes is many slices, one tap each — not one
        giant sample. First→last still is parked, not sent (cartoon graph has no last frame).
      </p>
      <div className="scratch-song-window">
        <label>
          Start
          <input
            type="number"
            min={0}
            step={0.5}
            value={start}
            disabled={disabled}
            onChange={(e) => setStart(Number(e.target.value))}
            onBlur={() => onWindow(start, len)}
          />
        </label>
        <label>
          Length
          <input
            type="number"
            min={4}
            max={30}
            step={0.5}
            value={len}
            disabled={disabled}
            onChange={(e) => setLen(Number(e.target.value))}
            onBlur={() => onWindow(start, len)}
          />
        </label>
        <span className="scratch-song-len">
          Track {formatSongClock(song.durationSec)}
        </span>
      </div>
      <div className="scratch-song-actions">
        <MobilePrimaryButton
          size="chip"
          tone="ghost"
          disabled={disabled || !plateFile || plateFile === "__error__"}
          onClick={onAddCut}
        >
          Add this camera
        </MobilePrimaryButton>
        <MobilePrimaryButton
          size="chip"
          tone="ghost"
          disabled={disabled || cuts.length === 0}
          onClick={onRunAll}
        >
          Generate cuts
        </MobilePrimaryButton>
        <MobilePrimaryButton size="chip" tone="ghost" disabled={disabled || !canStitch} onClick={onStitch}>
          Stitch song
        </MobilePrimaryButton>
      </div>
      {cuts.length ? (
        <ol className="scratch-song-cuts">
          {cuts.map((cut, i) => (
            <CutRow
              key={cut.id}
              index={i + 1}
              cut={cut}
              disabled={disabled}
              onRemove={() => onRemoveCut(cut.id)}
              onParkEnd={() => onParkEnd(cut.id)}
              onRun={() => onRunCut(cut.id)}
            />
          ))}
        </ol>
      ) : (
        <p className="scratch-song-hint">
          Draw a still, set start/length, Add this camera. Repeat with a new still for the next
          slice — same as the Comfy image_count list.
        </p>
      )}
      {song.stitchedFile ? (
        <p className="scratch-song-done">Stitched: {song.stitchedFile}</p>
      ) : null}
    </div>
  );
}

function CutRow({
  index,
  cut,
  disabled,
  onRemove,
  onParkEnd,
  onRun,
}: {
  index: number;
  cut: ScratchSongCut;
  disabled?: boolean;
  onRemove: () => void;
  onParkEnd: () => void;
  onRun: () => void;
}) {
  return (
    <li className={`scratch-song-cut is-${cut.status || "pending"}`}>
      <span className="scratch-song-cut-n">{index}</span>
      <span className="scratch-song-cut-meta">
        {formatSongClock(cut.startSec)} · {cut.durationSec}s
        {cut.endPlateFile ? " · end still parked" : ""}
        {cut.status === "done" ? " · done" : cut.status === "error" ? ` · ${cut.error || "fail"}` : ""}
      </span>
      <button type="button" disabled={disabled} onClick={onParkEnd}>
        End still
      </button>
      <button type="button" disabled={disabled} onClick={onRun}>
        Generate
      </button>
      <button type="button" disabled={disabled} onClick={onRemove}>
        ×
      </button>
    </li>
  );
}
