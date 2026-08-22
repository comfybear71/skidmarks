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
  lyricCues?: LyricCue[];
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

/* ── Lyrics on the track ───────────────────────────────────────────────── */

/** Canvas 2D cannot resolve CSS variables — var(--acid) silently draws black. */
export const TRACK_ACID = "#c8ff2e";

export type LyricCue = {
  /** Index into the lyric lines as typed. Re-pasting the words re-anchors. */
  lineIndex: number;
  atMs: number;
};

export type LyricLine = {
  index: number;
  text: string;
};

/** Blank lines are verse breaks on screen, never cue targets. */
export function lyricLinesFrom(lyrics: string): LyricLine[] {
  return (lyrics || "")
    .split(/\r?\n/)
    .map((text, index) => ({ index, text: text.trim() }))
    .filter((line) => line.text.length > 0);
}

export function withLyricCue(cues: LyricCue[], lineIndex: number, atMs: number): LyricCue[] {
  const at = Math.max(0, Math.round(atMs));
  const rest = (cues || []).filter((c) => c.lineIndex !== lineIndex);
  return [...rest, { lineIndex, atMs: at }].sort((a, b) => a.atMs - b.atMs);
}

export function withoutLyricCue(cues: LyricCue[], lineIndex: number): LyricCue[] {
  return (cues || []).filter((c) => c.lineIndex !== lineIndex);
}

export function lyricCueFor(cues: LyricCue[], lineIndex: number): LyricCue | null {
  return (cues || []).find((c) => c.lineIndex === lineIndex) || null;
}

/** Which pinned line the playhead is sitting on — the last one started. */
export function activeLyricLineIndex(cues: LyricCue[], atMs: number): number | null {
  let best: LyricCue | null = null;
  for (const cue of cues || []) {
    if (cue.atMs > atMs) continue;
    if (!best || cue.atMs > best.atMs) best = cue;
  }
  return best ? best.lineIndex : null;
}

/* ── Seeing the video before it is rendered ────────────────────────────── */

export type TrackCoverage = {
  coveredMs: number;
  songMs: number;
  /** Song with no plate on it — these render as nothing. */
  gaps: { startMs: number; endMs: number }[];
  /** Two plates claiming the same seconds. */
  overlaps: { startMs: number; endMs: number }[];
  pct: number;
};

/**
 * What the stitched video will actually be, read off the plate timings —
 * so a hole in the song is visible before any LTX credit is spent.
 */
export function trackCoverage(
  timings: PlateTiming[],
  songMs: number,
): TrackCoverage {
  const empty: TrackCoverage = { coveredMs: 0, songMs: 0, gaps: [], overlaps: [], pct: 0 };
  if (!Number.isFinite(songMs) || songMs <= 0) return empty;

  const spans = (timings || [])
    .map((t) => ({
      startMs: Math.max(0, Math.min(songMs, Math.round(t.startMs))),
      endMs: Math.max(0, Math.min(songMs, Math.round(t.endMs))),
    }))
    .filter((s) => s.endMs > s.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  const overlaps: { startMs: number; endMs: number }[] = [];
  const merged: { startMs: number; endMs: number }[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span.startMs < last.endMs) {
      overlaps.push({ startMs: span.startMs, endMs: Math.min(span.endMs, last.endMs) });
    }
    if (!last || span.startMs > last.endMs) {
      merged.push({ ...span });
      continue;
    }
    last.endMs = Math.max(last.endMs, span.endMs);
  }

  const gaps: { startMs: number; endMs: number }[] = [];
  let cursor = 0;
  for (const span of merged) {
    if (span.startMs > cursor) gaps.push({ startMs: cursor, endMs: span.startMs });
    cursor = span.endMs;
  }
  if (cursor < songMs) gaps.push({ startMs: cursor, endMs: songMs });

  const coveredMs = merged.reduce((sum, s) => sum + (s.endMs - s.startMs), 0);
  return {
    coveredMs,
    songMs,
    gaps,
    overlaps,
    pct: Math.round((coveredMs / songMs) * 100),
  };
}

/** One line for the desk: what is covered, and what is still a hole. */
export function coverageLine(cov: TrackCoverage): string {
  if (!cov.songMs) return "";
  const bits = [`${formatTrackClock(cov.coveredMs)} / ${formatTrackClock(cov.songMs)} covered`];
  if (cov.gaps.length) {
    bits.push(`${cov.gaps.length} gap${cov.gaps.length === 1 ? "" : "s"}`);
  }
  if (cov.overlaps.length) {
    bits.push(`${cov.overlaps.length} overlap${cov.overlaps.length === 1 ? "" : "s"}`);
  }
  return bits.join(" · ");
}
