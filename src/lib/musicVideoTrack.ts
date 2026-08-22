/**
 * Music-video TRACK timeline — song spine, section markers, plate in/out.
 * Stored on job.scratchSong (post-lock) and job.trackDraft (pre-lock peaks/markers).
 * Times are milliseconds on the full MP3.
 */
import type { ScratchSong, ScratchSongCut } from "./scratchSongWindow";
import { clampSongSliceDuration, clampSongWindow } from "./scratchSongWindow";

export type TrackSectionLabel =
  | "verse"
  | "chorus"
  | "bridge"
  | "crescendo"
  | "lead_break"
  | "sax_break"
  | "custom";

export type TrackSectionMarker = {
  id: string;
  label: TrackSectionLabel | string;
  startMs: number;
  endMs: number;
};

export type PlateTiming = {
  plateId: string;
  startMs: number;
  endMs: number;
  sortIndex: number;
};

export type MusicVideoTrackDraft = {
  waveformPeaks?: number[];
  sectionMarkers?: TrackSectionMarker[];
  plateTimings?: PlateTiming[];
};

export const TRACK_SECTION_LABELS: { id: TrackSectionLabel; label: string }[] = [
  { id: "verse", label: "Verse" },
  { id: "chorus", label: "Chorus" },
  { id: "bridge", label: "Bridge" },
  { id: "crescendo", label: "Crescendo" },
  { id: "lead_break", label: "Lead break" },
  { id: "sax_break", label: "Sax break" },
  { id: "custom", label: "Custom" },
];

export function msToSec(ms: number): number {
  return Math.round((ms / 1000) * 10) / 10;
}

export function secToMs(sec: number): number {
  return Math.round(sec * 1000);
}

export function formatTrackClock(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const sec = ms / 1000;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec - m * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function sortPlateTimings(list: PlateTiming[]): PlateTiming[] {
  return [...list].sort((a, b) => a.sortIndex - b.sortIndex || a.startMs - b.startMs);
}

export function plateTimingForShot(
  song: ScratchSong | null | undefined,
  draft: MusicVideoTrackDraft | null | undefined,
  shotId: string,
): PlateTiming | null {
  const id = (shotId || "").trim();
  if (!id) return null;
  const fromSong = (song?.plateTimings || []).find((p) => p.plateId === id);
  if (fromSong) return fromSong;
  return (draft?.plateTimings || []).find((p) => p.plateId === id) || null;
}

/** LTX slice bounds — plate timing wins over legacy cut row. */
export function sliceBoundsForPlate(opts: {
  song: ScratchSong;
  shotId: string;
  cut?: ScratchSongCut;
}): { startSec: number; durationSec: number } {
  const timing = (opts.song.plateTimings || []).find((p) => p.plateId === opts.shotId);
  if (timing && timing.endMs > timing.startMs) {
    const startSec = msToSec(timing.startMs);
    const durationSec = msToSec(timing.endMs - timing.startMs);
    return clampSongWindow(startSec, durationSec, opts.song.durationSec);
  }
  if (opts.cut) {
    return clampSongWindow(opts.cut.startSec, opts.cut.durationSec, opts.song.durationSec);
  }
  return clampSongWindow(0, clampSongSliceDuration(opts.song.sliceDurationSec), opts.song.durationSec);
}

/** Upsert one cut row from a plate timing (keeps legacy song desk in sync). */
export function cutFromPlateTiming(
  cuts: ScratchSongCut[],
  timing: PlateTiming,
  plateFile: string,
  newCutId: () => string,
): ScratchSongCut[] {
  const startSec = msToSec(timing.startMs);
  const durationSec = msToSec(timing.endMs - timing.startMs);
  const existing = cuts.find((c) => c.shotId === timing.plateId);
  const next: ScratchSongCut = {
    id: existing?.id || newCutId(),
    plateFile,
    shotId: timing.plateId,
    startSec,
    durationSec,
    clipFile: existing?.clipFile,
    status: existing?.status || "pending",
    error: existing?.error || "",
  };
  const rest = cuts.filter((c) => c.shotId !== timing.plateId);
  return [...rest, next];
}

export function orderedDoneCutsForStitch(
  song: ScratchSong,
): ScratchSongCut[] {
  const done = (song.cuts || []).filter((c) => c.status === "done" && c.clipFile);
  const timings = sortPlateTimings(song.plateTimings || []);
  if (!timings.length) {
    return [...done].sort((a, b) => a.startSec - b.startSec);
  }
  const byShot = new Map(done.map((c) => [c.shotId || "", c]));
  const ordered: ScratchSongCut[] = [];
  for (const t of timings) {
    const cut = byShot.get(t.plateId);
    if (cut) ordered.push(cut);
  }
  for (const c of done) {
    if (!ordered.includes(c)) ordered.push(c);
  }
  return ordered;
}
