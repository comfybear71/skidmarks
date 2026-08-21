"use client";

import { useEffect, useRef, useState } from "react";
import { MobilePrimaryButton } from "@/components/mobile/MobileUi";
import type { MobileGenJob } from "@/lib/mobileGenJob";
import {
  formatSongClock,
  remainingSongWindows,
  songWindowLabel,
  type ScratchSongCut,
} from "@/lib/scratchSongWindow";

export function ScratchSongCuts({
  job,
  plateFile,
  disabled,
  onWindow,
  onAddCut,
  onFillCuts,
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
  onAddCut: () => void | Promise<unknown>;
  onFillCuts: () => void | Promise<unknown>;
  onRemoveCut: (cutId: string) => void;
  onParkEnd: (cutId: string) => void;
  onRunCut: (cutId: string) => void;
  onRunAll: () => void;
  onStitch: () => void;
}) {
  const song = job.scratchSong;
  const [start, setStart] = useState(song?.sliceStartSec ?? 0);
  const [len, setLen] = useState(song?.sliceDurationSec ?? 15);
  const [adding, setAdding] = useState(false);
  const [filling, setFilling] = useState(false);
  const [flashId, setFlashId] = useState("");
  const [parkNote, setParkNote] = useState("");
  const cutCount = useRef(song?.cuts?.length || 0);
  useEffect(() => {
    if (!song) return;
    setStart(song.sliceStartSec);
    setLen(song.sliceDurationSec);
  }, [song?.sliceStartSec, song?.sliceDurationSec, song?.fileName]);
  useEffect(() => {
    const cuts = song?.cuts || [];
    if (cuts.length > cutCount.current) {
      const newest = cuts[cuts.length - 1];
      setFlashId(newest.id);
      setParkNote(
        `Parked camera ${cuts.length} · ${formatSongClock(newest.startSec)} · ${newest.durationSec}s`,
      );
      const t = window.setTimeout(() => setFlashId(""), 2800);
      cutCount.current = cuts.length;
      return () => window.clearTimeout(t);
    }
    cutCount.current = cuts.length;
  }, [song?.cuts]);
  if (!song?.fileName) return null;
  const cuts = song.cuts || [];
  const done = cuts.filter((c) => c.status === "done" && c.clipFile).length;
  const canStitch = done >= 2;
  const leftToPark = remainingSongWindows(cuts, song.durationSec).length;
  const label = songWindowLabel(song.durationSec, cuts);

  return (
    <div className="scratch-song">
      <div className="scratch-song-title">Song cuts — Scratch only</div>
      <p className="scratch-song-clock">{label}</p>
      {parkNote ? <p className="scratch-song-parked">{parkNote}</p> : null}
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
          disabled={disabled || adding || !plateFile || plateFile === "__error__"}
          onClick={() => {
            setAdding(true);
            setParkNote("Parking this camera…");
            void Promise.resolve(onAddCut())
              .catch(() => setParkNote(""))
              .finally(() => setAdding(false));
          }}
        >
          {adding ? "Parking…" : "Add this camera"}
        </MobilePrimaryButton>
        <MobilePrimaryButton
          size="chip"
          tone="ghost"
          disabled={disabled || filling || !plateFile || plateFile === "__error__" || leftToPark === 0}
          onClick={() => {
            setFilling(true);
            setParkNote(`Parking the rest (${leftToPark} cameras)…`);
            void Promise.resolve(onFillCuts())
              .catch(() => setParkNote(""))
              .finally(() => setFilling(false));
          }}
        >
          {filling ? "Parking rest…" : leftToPark ? `Park the rest (${leftToPark})` : "Song is parked"}
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
              flash={cut.id === flashId}
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
  flash,
  disabled,
  onRemove,
  onParkEnd,
  onRun,
}: {
  index: number;
  cut: ScratchSongCut;
  flash?: boolean;
  disabled?: boolean;
  onRemove: () => void;
  onParkEnd: () => void;
  onRun: () => void;
}) {
  const status =
    cut.status === "done"
      ? " · done"
      : cut.status === "error"
        ? ` · ${cut.error || "fail"}`
        : cut.status === "running"
          ? " · cooking"
          : " · parked";
  return (
    <li className={`scratch-song-cut is-${cut.status || "pending"}${flash ? " is-just-added" : ""}`}>
      <span className="scratch-song-cut-n">{index}</span>
      <span className="scratch-song-cut-meta">
        {formatSongClock(cut.startSec)} · {cut.durationSec}s
        {cut.endPlateFile ? " · end still parked" : ""}
        {status}
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
