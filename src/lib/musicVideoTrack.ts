/**
 * Music-video TRACK timeline — song spine, section markers, plate in/out.
 * Stored on job.scratchSong (post-lock) and job.trackDraft (pre-lock peaks/markers).
 * Times are milliseconds on the full MP3.
 */
import type { ScratchSong, ScratchSongCut } from "./scratchSongWindow";
import { LTX_MAX_DURATION_SEC } from "./ltxDuration";
import {
  clampSongSliceDuration,
  clampSongWindow,
  SCRATCH_SONG_SLICE_DEFAULT_SEC,
} from "./scratchSongWindow";

export type TrackSectionLabel =
  | "intro"
  | "verse"
  | "chorus"
  | "bridge"
  | "crescendo"
  | "lead_break"
  | "sax_break"
  | "outro"
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
  /** Saved the moment the mp3 is dropped, so a refresh cannot lose it. */
  songFile?: string;
  songDurationSec?: number;
  waveformPeaks?: number[];
  sectionMarkers?: TrackSectionMarker[];
  plateTimings?: PlateTiming[];
  lyricCues?: LyricCue[];
};

/**
 * Song order, so the picker reads the way a track runs: intro at the top,
 * outro near the bottom. Each carries its own colour — a wave full of
 * same-coloured bands tells you nothing about the shape of the song.
 */
export const TRACK_SECTION_LABELS: {
  id: TrackSectionLabel;
  label: string;
  color: string;
}[] = [
  { id: "intro", label: "Intro", color: "#35d6d0" },
  // Not the acid of the waveform — a verse band has to read against it.
  { id: "verse", label: "Verse", color: "#f5f2ff" },
  { id: "chorus", label: "Chorus", color: "#ff3ea5" },
  { id: "bridge", label: "Bridge", color: "#9b7bff" },
  { id: "crescendo", label: "Crescendo", color: "#ff9f1c" },
  { id: "lead_break", label: "Lead break", color: "#4db8ff" },
  { id: "sax_break", label: "Sax break", color: "#ffd23f" },
  { id: "outro", label: "Outro", color: "#8fa2b8" },
  { id: "custom", label: "Custom", color: "#9aa4b0" },
];

const SECTION_FALLBACK_COLOR = "#9aa4b0";

/** Colour for a marker. Anything typed by hand falls back to Custom's. */
export function sectionColor(label: string): string {
  const id = String(label || "").trim().toLowerCase();
  return TRACK_SECTION_LABELS.find((o) => o.id === id)?.color || SECTION_FALLBACK_COLOR;
}

/** Human name for a marker, so the wave does not read "lead_break". */
export function sectionTitle(label: string): string {
  const id = String(label || "").trim().toLowerCase();
  const hit = TRACK_SECTION_LABELS.find((o) => o.id === id);
  if (hit) return hit.label;
  return String(label || "").trim() || "Section";
}

/** Same colour at a given alpha, for the band behind the wave. */
export function sectionTint(label: string, alpha: number): string {
  const hex = sectionColor(label).replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function msToSec(ms: number): number {
  return Math.round((ms / 1000) * 10) / 10;
}

export function secToMs(sec: number): number {
  return Math.round(sec * 1000);
}

/** Split this song evenly across these plates. Do not invent 15s rows. */
export function evenPlateTimings(
  durationSec: number,
  plateIds: string[],
): PlateTiming[] {
  const ids = plateIds.map((id) => (id || "").trim()).filter(Boolean);
  if (!ids.length) return [];
  const totalMs = secToMs(durationSec);
  if (!(totalMs > 0)) return [];
  return ids.map((plateId, i) => {
    const startMs = Math.round((totalMs * i) / ids.length);
    const endMs = Math.round((totalMs * (i + 1)) / ids.length);
    return {
      plateId,
      startMs,
      endMs: Math.max(endMs, startMs + 100),
      sortIndex: i,
    };
  });
}

export function formatTrackClock(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const sec = ms / 1000;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec - m * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Tenths — for lining a plate box up on the wave (4:07.5). */
export function formatTrackClockPrecise(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00.0";
  const tot = ms / 1000;
  const m = Math.floor(tot / 60);
  const s = tot - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

export function sortPlateTimings(list: PlateTiming[]): PlateTiming[] {
  return [...list].sort((a, b) => a.sortIndex - b.sortIndex || a.startMs - b.startMs);
}

/**
 * Swap this still with the neighbour slot. Time boxes stay. The picture
 * moves. Null if it is already first or last.
 */
export function swapNeighborPlateTimings(
  timings: PlateTiming[],
  plateId: string,
  direction: -1 | 1,
): PlateTiming[] | null {
  const sorted = sortPlateTimings(timings);
  const i = sorted.findIndex((t) => t.plateId === plateId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= sorted.length) return null;
  const a = sorted[i]!;
  const b = sorted[j]!;
  return sortPlateTimings(
    sorted.map((t) => {
      if (t.plateId === a.plateId) {
        return { ...t, startMs: b.startMs, endMs: b.endMs, sortIndex: b.sortIndex };
      }
      if (t.plateId === b.plateId) {
        return { ...t, startMs: a.startMs, endMs: a.endMs, sortIndex: a.sortIndex };
      }
      return t;
    }),
  );
}

/** How wide a second of song is on the phone wave. A 3-minute track is
 * ~5040px — the strip scrolls sideways instead of crushing into one screen. */
export const TRACK_WAVE_PX_PER_SEC = 28;

/** Canvas / rail inner width: at least the viewport, else seconds × 28px. */
export function trackWaveCssWidth(durationMs: number, viewportPx: number): number {
  const view = Math.max(0, Math.round(Number(viewportPx) || 0));
  const sec = Math.max(0, Number(durationMs) || 0) / 1000;
  const fromSong = sec > 0 ? Math.round(sec * TRACK_WAVE_PX_PER_SEC) : 0;
  return Math.max(view, fromSong);
}

/**
 * Keep the playhead on screen: the wave slides right-to-left, the needle
 * stays at `followRatio` of the viewport (default a third in).
 */
export function trackPlayheadScrollLeft(opts: {
  playheadMs: number;
  durationMs: number;
  viewW: number;
  innerW: number;
  followRatio?: number;
}): number {
  const durationMs = Math.max(0, Number(opts.durationMs) || 0);
  const viewW = Math.max(0, Math.round(Number(opts.viewW) || 0));
  const innerW = Math.max(0, Math.round(Number(opts.innerW) || 0));
  if (!durationMs || !viewW || innerW <= viewW) return 0;
  const x = (Math.max(0, Number(opts.playheadMs) || 0) / durationMs) * innerW;
  const ratio = Number.isFinite(opts.followRatio) ? Number(opts.followRatio) : 0.35;
  const target = x - viewW * Math.min(0.8, Math.max(0.1, ratio));
  const max = innerW - viewW;
  return Math.max(0, Math.min(max, Math.round(target)));
}

/** Picture tile under the wave — same left/width as that still's slice. */
export function plateRailBox(
  startMs: number,
  endMs: number,
  durationMs: number,
): { leftPct: number; widthPct: number } {
  const song = Math.max(1, durationMs);
  const start = Math.max(0, startMs);
  const end = Math.max(start, endMs);
  return {
    leftPct: (start / song) * 100,
    widthPct: ((end - start) / song) * 100,
  };
}

export const TRACK_WAVE_RULER_H = 13;
export const TRACK_WAVE_LANE_H = 26;

/** Same geometry the canvas draws for the ruler, wave, and plate lane. */
export function trackWaveLayout(width: number, height: number) {
  const rulerH = TRACK_WAVE_RULER_H;
  const laneH = TRACK_WAVE_LANE_H;
  const waveTop = rulerH;
  const waveH = Math.max(8, height - rulerH - laneH);
  const laneY = waveTop + waveH + 3;
  const laneBoxH = laneH - 6;
  return { rulerH, laneH, waveTop, waveH, laneY, laneBoxH, width };
}

/**
 * A dropped mp3 on a locked spoken episode lives in trackDraft first.
 * Timing plates needs scratchSong.fileName — copy the pointer, never a beat.
 */
export function songFromTrackDraft(
  draft: MusicVideoTrackDraft | null | undefined,
  existing?: ScratchSong | null,
): ScratchSong | null {
  const fileName = (existing?.fileName || draft?.songFile || "").trim();
  if (!fileName) return null;
  const durationSec =
    (Number(existing?.durationSec) > 0 ? Number(existing?.durationSec) : 0) ||
    (Number(draft?.songDurationSec) > 0 ? Number(draft?.songDurationSec) : 0);
  const window = clampSongWindow(
    existing?.sliceStartSec ?? 0,
    existing?.sliceDurationSec ?? SCRATCH_SONG_SLICE_DEFAULT_SEC,
    durationSec,
  );
  return {
    ...(existing || {}),
    fileName,
    durationSec,
    sliceStartSec: window.startSec,
    sliceDurationSec: window.durationSec,
    cuts: existing?.cuts || [],
    waveformPeaks: existing?.waveformPeaks || draft?.waveformPeaks,
    sectionMarkers: existing?.sectionMarkers || draft?.sectionMarkers,
    lyricCues: existing?.lyricCues || draft?.lyricCues,
    plateTimings: existing?.plateTimings || draft?.plateTimings,
  };
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

/** LTX slice bounds — this cut's clock wins. Plate timings follow the song
 * up to the LTX safety ceiling. The old 15s rows still cap at 30s. */
export function sliceBoundsForPlate(opts: {
  song: ScratchSong;
  shotId: string;
  cut?: ScratchSongCut;
}): { startSec: number; durationSec: number } {
  const timed = (opts.song.plateTimings || []).length > 0;
  const maxSec = timed ? LTX_MAX_DURATION_SEC : undefined;
  if (opts.cut) {
    return clampSongWindow(
      opts.cut.startSec,
      opts.cut.durationSec,
      opts.song.durationSec,
      maxSec,
    );
  }
  const timing = (opts.song.plateTimings || []).find((p) => p.plateId === opts.shotId);
  if (timing && timing.endMs > timing.startMs) {
    const startSec = msToSec(timing.startMs);
    const durationSec = msToSec(timing.endMs - timing.startMs);
    return clampSongWindow(startSec, durationSec, opts.song.durationSec, LTX_MAX_DURATION_SEC);
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

/** Next empty clock after the last hung still. Do not invent a 15s row when that plate already has in/out. */
export function nextPlateHangStartMs(existing: PlateTiming[] | undefined): number {
  const kept = sortPlateTimings(existing || []);
  if (!kept.length) return 0;
  return Math.max(...kept.map((t) => t.endMs));
}

export function nextPlateHangWindow(
  existing: PlateTiming[] | undefined,
): { startMs: number; endMs: number } {
  const startMs = nextPlateHangStartMs(existing);
  return {
    startMs,
    endMs: startMs + secToMs(SCRATCH_SONG_SLICE_DEFAULT_SEC),
  };
}

/**
 * TRACK paints plateTimings, not the cut list. Add-on-stills used to
 * write a waiting cut and leave the wave empty. Keep any clock already
 * on the wave — do not even-split the song. Hang each cut that has no
 * timing yet, first slice only.
 */
export function hangMissingPlateTimings(
  existing: PlateTiming[] | undefined,
  cuts: Pick<ScratchSongCut, "shotId" | "startSec" | "durationSec">[],
  extraIds: string[] = [],
): PlateTiming[] {
  const kept = sortPlateTimings(existing || []);
  const have = new Set(kept.map((t) => t.plateId));
  const next = [...kept];
  let sort = next.length;
  const seen = new Set<string>();
  for (const c of cuts) {
    const plateId = (c.shotId || "").trim();
    if (!plateId || have.has(plateId) || seen.has(plateId)) continue;
    seen.add(plateId);
    have.add(plateId);
    const startMs = secToMs(Number(c.startSec) || 0);
    const durSec = Number(c.durationSec);
    const durMs = secToMs(
      Number.isFinite(durSec) && durSec > 0 ? durSec : SCRATCH_SONG_SLICE_DEFAULT_SEC,
    );
    next.push({
      plateId,
      startMs,
      endMs: Math.max(startMs + 100, startMs + durMs),
      sortIndex: sort++,
    });
  }
  let cursor = next.length ? Math.max(...next.map((t) => t.endMs)) : 0;
  for (const raw of extraIds) {
    const plateId = (raw || "").trim();
    if (!plateId || have.has(plateId) || seen.has(plateId)) continue;
    seen.add(plateId);
    have.add(plateId);
    const durMs = secToMs(SCRATCH_SONG_SLICE_DEFAULT_SEC);
    next.push({
      plateId,
      startMs: cursor,
      endMs: Math.max(cursor + 100, cursor + durMs),
      sortIndex: sort++,
    });
    cursor += durMs;
  }
  return next;
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
/**
 * Sung words only.
 *
 * Square brackets in a pasted sheet are not lyrics — they are structure and
 * stage directions: [Verse 1], [Chorus], [Instrumental Intro], [Fading
 * 12-string drone]. They must never reach the marquee. A bracket is also
 * written hard against the first word — "[Verse 1]Silver glass" — so stripping
 * has to happen before the line is split, or the first word comes out as
 * "1]Silver".
 */
export function lyricLinesFrom(lyrics: string): LyricLine[] {
  return (lyrics || "")
    .split(/\r?\n/)
    .map((raw, index) => ({ index, text: stripLyricTags(raw) }))
    .filter((line) => line.text.length > 0 && !isLyricFilenameLine(line.text));
}

/** Drop every [...] run and tidy the whitespace it leaves behind. */
export function stripLyricTags(line: string): string {
  return String(line || "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The words of one line, ready for the marquee. */
export function lyricWords(line: string): string[] {
  return stripLyricTags(line).split(" ").filter(Boolean);
}

/**
 * The song's own structure, read out of the sheet. A pasted lyric already
 * carries [Verse 1] / [Chorus] / [Sax break], which is the same thing being
 * typed by hand into the section rows.
 */
export type LyricTag = {
  /** As written, e.g. "Verse 1". */
  raw: string;
  /** Matched section id where one fits, else "custom". */
  label: TrackSectionLabel;
  /** Which lyric line it was written on. */
  lineIndex: number;
};

const TAG_MATCHES: { id: TrackSectionLabel; test: RegExp }[] = [
  { id: "intro", test: /\bintro\b/i },
  // "outro", never a stray "out" — a stage direction that ends "dying out"
  // is not the outro.
  { id: "outro", test: /\boutro\b/i },
  { id: "chorus", test: /\bchorus\b|\bhook\b/i },
  { id: "bridge", test: /\bbridge\b/i },
  { id: "sax_break", test: /\bsax\b/i },
  { id: "lead_break", test: /\b(lead|guitar|solo)\b/i },
  { id: "crescendo", test: /\bcrescendo\b|\bbuild\b/i },
  { id: "verse", test: /\bverse\b/i },
];

export function lyricTagLabel(raw: string): TrackSectionLabel {
  const text = String(raw || "").trim();
  for (const match of TAG_MATCHES) {
    if (match.test.test(text)) return match.id;
  }
  return "custom";
}

/** Every [tag] in the sheet, in order, with the line it sat on. */
export function lyricTagsFrom(lyrics: string): LyricTag[] {
  const out: LyricTag[] = [];
  const lines = String(lyrics || "").split(/\r?\n/);
  lines.forEach((line, lineIndex) => {
    for (const hit of line.matchAll(/\[([^\]]*)\]/g)) {
      const raw = (hit[1] || "").trim();
      if (!raw) continue;
      out.push({ raw, label: lyricTagLabel(raw), lineIndex });
    }
  });
  return out;
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

/**
 * How long the current line holds the marquee: until the next pinned line,
 * or a readable default when it is the last one. Clamped so a long instrumental
 * gap does not park one line on screen for a minute.
 */
export function lyricHoldMs(cues: LyricCue[], lineIndex: number | null): number {
  const FALLBACK = 5200;
  const MIN = 2400;
  const MAX = 9000;
  if (lineIndex === null) return FALLBACK;
  const mine = (cues || []).find((c) => c.lineIndex === lineIndex);
  if (!mine) return FALLBACK;
  let nextAt = Infinity;
  for (const cue of cues || []) {
    if (cue.atMs > mine.atMs && cue.atMs < nextAt) nextAt = cue.atMs;
  }
  if (!Number.isFinite(nextAt)) return FALLBACK;
  return Math.max(MIN, Math.min(MAX, nextAt - mine.atMs));
}

/**
 * The section a moment of the song falls in. The plate bar under the wave is
 * drawn in this section's colour, so a plate reads as belonging to the chorus
 * or the sax break without a second legend to look at.
 */
export function sectionAtMs(
  markers: TrackSectionMarker[],
  atMs: number,
): TrackSectionMarker | null {
  for (const m of markers || []) {
    if (m.endMs > m.startMs && atMs >= m.startMs && atMs < m.endMs) return m;
  }
  return null;
}

/** Colour for one plate's bar: its section's, or plain when it sits outside one. */
export function plateBarColor(
  markers: TrackSectionMarker[],
  timing: { startMs: number; endMs: number },
): string {
  // Judge by the middle: a plate that just clips the edge of the next section
  // still belongs to the one it mostly plays over.
  const mid = timing.startMs + (timing.endMs - timing.startMs) / 2;
  const hit = sectionAtMs(markers, mid) || sectionAtMs(markers, timing.startMs);
  return hit ? sectionColor(hit.label) : PLATE_BAR_NO_SECTION;
}

/** No section marked yet — neutral, never a colour that means something else. */
export const PLATE_BAR_NO_SECTION = "#78c8ff";

/* ── Typed section times ───────────────────────────────────────────────────
   Dragging a range gave 15-second blobs and two half-right Intros. A section
   is a number you know — type it. */

/**
 * Type a time on a phone. The decimal keypad has no colon, so "0.35" has to
 * mean 0:35 — read as 0.35 seconds it snapped to the minimum length, which is
 * how one-second sections kept appearing.
 *
 * ":" or "." separate minutes from seconds. Bare digits read from the right
 * like a microwave: "35" is 0:35, "135" is 1:35, "1035" is 10:35.
 * Returns null when it is not a time, so a typo can snap back instead of saving.
 */
export function parseTrackClock(text: string): number | null {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const split = raw.match(/^(\d+)[:.](\d{1,2})$/);
  if (split) {
    const mins = Number(split[1]);
    const secs = Number(split[2]);
    if (secs >= 60) return null;
    return Math.round((mins * 60 + secs) * 1000);
  }

  // Colon form keeps fractional seconds — a desktop keyboard can type them.
  const precise = raw.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/);
  if (precise) {
    const secs = Number(precise[2]);
    if (secs >= 60) return null;
    return Math.round((Number(precise[1]) * 60 + secs) * 1000);
  }

  const bare = raw.match(/^(\d+)(?:\.(\d+))?$/);
  if (bare) {
    const digits = bare[1]!;
    const frac = bare[2] ? Number(`0.${bare[2]}`) : 0;
    if (digits.length <= 2) {
      // Bare seconds, so "90" is a minute and a half rather than a rejection.
      return Math.round((Number(digits) + frac) * 1000);
    }
    const secs = Number(digits.slice(-2)) + frac;
    const mins = Number(digits.slice(0, -2));
    if (secs >= 60) return null;
    return Math.round((mins * 60 + secs) * 1000);
  }

  return null;
}

/**
 * Move one edge of a section and hand back the whole list. Keeps at least a
 * second on the section and never runs past the end of the song, so a typo
 * cannot produce a marker that draws backwards.
 */
export function sortSectionMarkers(markers: TrackSectionMarker[]): TrackSectionMarker[] {
  return [...(markers || [])].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

/**
 * Move one edge and chain neighbours. A one-second typo can be grown again —
 * the old clamp trapped edits inside a 1s band so the boxes looked dead.
 */
export function withSectionTime(
  markers: TrackSectionMarker[],
  id: string,
  edge: "start" | "end",
  ms: number,
  songMs: number,
): TrackSectionMarker[] {
  const MIN = 1000;
  const cap = Number.isFinite(songMs) && songMs > 0 ? songMs : Infinity;
  const out = sortSectionMarkers(markers).map((m) => ({ ...m }));
  const idx = out.findIndex((m) => m.id === id);
  if (idx < 0) return markers;
  const m = out[idx]!;
  const at = Math.max(0, Math.min(cap, Math.round(ms)));

  if (edge === "start") {
    m.startMs = at;
    if (m.endMs < m.startMs + MIN) m.endMs = Math.min(cap, m.startMs + MIN);
    if (idx > 0) out[idx - 1]!.endMs = Math.max(out[idx - 1]!.startMs + MIN, at);
  } else {
    m.endMs = Math.min(cap, Math.max(at, m.startMs + MIN));
    if (idx < out.length - 1) {
      const next = out[idx + 1]!;
      next.startMs = Math.max(next.startMs, m.endMs);
      if (next.endMs < next.startMs + MIN) next.endMs = Math.min(cap, next.startMs + MIN);
    }
  }
  return out;
}

/** Rename a section (Custom, mostly). Blank keeps what was there. */
export function withSectionLabel(
  markers: TrackSectionMarker[],
  id: string,
  label: string,
): TrackSectionMarker[] {
  const next = String(label || "").trim();
  if (!next) return markers;
  return (markers || []).map((m) => (m.id === id ? { ...m, label: next } : m));
}

/**
 * Where a new section should start: the end of the last one, so sections lay
 * end to end instead of piling up as overlapping 15s blobs.
 */
export function nextSectionStartMs(markers: TrackSectionMarker[]): number {
  let end = 0;
  for (const m of markers || []) {
    if (m.endMs > end) end = m.endMs;
  }
  return end;
}

/** Stage-direction brackets are not sections — only structural tags import. */
export function meaningfulLyricTags(lyrics: string): LyricTag[] {
  return lyricTagsFrom(lyrics).filter((t) => t.label !== "custom");
}

/**
 * Build section rows from [Intro] / [Verse 1] / [Chorus] in the lyrics.
 * Times follow where those tags sit on the sheet (line index across the
 * song). Marquee pins can still nudge a row later with Start here.
 * Parking every row but the first at 0:00 used to hide Verse/Chorus —
 * only INTRO painted the whole wave.
 */
export function importSectionMarkersFromLyrics(opts: {
  lyrics: string;
  durationMs: number;
}): TrackSectionMarker[] {
  const tags = meaningfulLyricTags(opts.lyrics);
  if (!tags.length) return [];
  const songMs = Math.max(1000, Math.round(opts.durationMs));
  const now = Date.now();
  const lineCount = Math.max(1, String(opts.lyrics || "").split(/\r?\n/).length);
  const MIN = 1000;

  return tags.map((t, i) => {
    const startMs = i === 0 ? 0 : evenLineStartMs(t.lineIndex, lineCount, songMs);
    const next = tags[i + 1];
    const rawEnd = next
      ? evenLineStartMs(next.lineIndex, lineCount, songMs)
      : songMs;
    const endMs = Math.min(songMs, Math.max(startMs + MIN, rawEnd));
    return {
      id: `marker_${now}_${i}`,
      label: t.label,
      startMs,
      endMs,
    };
  });
}

/**
 * Empty TRACK, or one row stretched across the whole song, is not a real
 * import. Build Intro / Verse / Chorus from the [tags] on the sheet.
 */
export function shouldImportLyricSections(opts: {
  lyrics: string;
  markers: TrackSectionMarker[] | null | undefined;
  durationMs: number;
}): boolean {
  const tags = meaningfulLyricTags(opts.lyrics);
  if (tags.length < 2) return false;
  const songMs = Math.max(0, Math.round(opts.durationMs || 0));
  if (songMs < 2000) return false;
  const markers = opts.markers || [];
  if (!markers.length) return true;
  if (markers.length === 1) {
    const m = markers[0]!;
    const span = Math.max(0, m.endMs - m.startMs);
    return span >= songMs * 0.85;
  }
  return false;
}

/** A dropped filename is not a sung line — keep it off the marquee. */
export function isLyricFilenameLine(text: string): boolean {
  return /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(String(text || "").trim());
}

/**
 * Pair each lyric [tag] to the next unused Section of the same name, in
 * time order. Extra rows he taps in (a second Bridge, a third Verse) are
 * skipped — they do not steal the next verse's words.
 */
export function sectionMarkerForLyricTag(
  tags: LyricTag[],
  markers: TrackSectionMarker[],
): Array<TrackSectionMarker | null> {
  const sorted = sortSectionMarkers(markers);
  let j = 0;
  return tags.map((tag) => {
    const want = String(tag.label || "").trim().toLowerCase();
    while (j < sorted.length) {
      const m = sorted[j]!;
      j += 1;
      if (String(m.label || "").trim().toLowerCase() === want) return m;
    }
    return null;
  });
}

/**
 * Pin each sung line inside the section window it sits under on the sheet.
 * Intro with no words stays empty. Even spread inside the window — this is
 * lining from the Sections on the job, not hearing the vocal.
 */
export function lyricCuesFromSectionSheet(opts: {
  lyrics: string;
  durationMs: number;
  markers?: TrackSectionMarker[];
}): LyricCue[] {
  const lyrics = String(opts.lyrics || "");
  const songMs = Math.max(1000, Math.round(opts.durationMs));
  const tags = meaningfulLyricTags(lyrics);
  const markers = sortSectionMarkers(
    opts.markers?.length
      ? opts.markers
      : importSectionMarkersFromLyrics({ lyrics, durationMs: songMs }),
  );
  if (!tags.length || !markers.length) return [];

  const sung = lyricLinesFrom(lyrics);
  const buckets = tags.map(() => [] as LyricLine[]);
  for (const line of sung) {
    let tagIdx = -1;
    for (let i = 0; i < tags.length; i++) {
      if (tags[i]!.lineIndex <= line.index) tagIdx = i;
    }
    if (tagIdx < 0) continue;
    buckets[tagIdx]!.push(line);
  }

  const paired = sectionMarkerForLyricTag(tags, markers);
  const cues: LyricCue[] = [];
  for (let i = 0; i < tags.length; i++) {
    const group = buckets[i]!;
    const marker = paired[i];
    if (!marker || !group.length) continue;
    const startMs = marker.startMs;
    const span = Math.max(1, marker.endMs - startMs);
    for (let n = 0; n < group.length; n++) {
      const atMs = Math.min(
        marker.endMs - 1,
        Math.max(startMs, Math.round(startMs + (span * n) / group.length)),
      );
      cues.push({ lineIndex: group[n]!.index, atMs });
    }
  }
  return cues.sort((a, b) => a.atMs - b.atMs || a.lineIndex - b.lineIndex);
}

/** Scrub to a moment, tap Start here — closes the previous section at the same point. */
export function withSectionStartAt(
  markers: TrackSectionMarker[],
  id: string,
  atMs: number,
  songMs: number,
): TrackSectionMarker[] {
  const at = Math.max(0, Math.min(songMs, Math.round(atMs)));
  const sorted = sortSectionMarkers(markers);
  const idx = sorted.findIndex((m) => m.id === id);
  if (idx < 0) return markers;
  const MIN = 1000;
  return sorted.map((m, i) => {
    if (i === idx) {
      const endMs = Math.max(at + MIN, m.endMs > at ? m.endMs : songMs);
      return { ...m, startMs: at, endMs: Math.min(songMs, endMs) };
    }
    if (i === idx - 1) {
      return { ...m, endMs: Math.max(m.startMs + MIN, at) };
    }
    return m;
  });
}

/** Who is actually on the stills that sit in this section. Empty if none. */
export function sectionPeopleOnPlates(
  section: { startMs: number; endMs: number },
  plates: { startMs: number; endMs: number; label: string }[],
): string {
  const names: string[] = [];
  const seen = new Set<string>();
  const ordered = [...plates].sort((a, b) => a.startMs - b.startMs);
  for (const p of ordered) {
    if (p.endMs <= section.startMs || p.startMs >= section.endMs) continue;
    const name = String(p.label || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names.join(" · ");
}

/** A section waiting for Start here — collapsed at the song end. */
export function sectionNeedsStartHere(m: TrackSectionMarker, songMs: number): boolean {
  const song = Math.max(1000, Math.round(songMs));
  return m.startMs >= song - 500 && m.endMs >= song - 500;
}

/** First section still parked at the end of the song. */
export function nextSectionNeedingStart(
  markers: TrackSectionMarker[],
  songMs: number,
): TrackSectionMarker | null {
  for (const m of sortSectionMarkers(markers)) {
    if (sectionNeedsStartHere(m, songMs)) return m;
  }
  return null;
}

/**
 * Lyrics are pasted, not timed by hand — so the marquee spreads the lines
 * evenly across the song and shows whichever one the playhead is inside.
 * Returns null before the song starts or when there are no words.
 */
export function evenLyricIndexAt(
  lineCount: number,
  atMs: number,
  songMs: number,
): number | null {
  if (!Number.isFinite(lineCount) || lineCount <= 0) return null;
  if (!Number.isFinite(songMs) || songMs <= 0) return null;
  if (!Number.isFinite(atMs) || atMs < 0) return null;
  if (atMs >= songMs) return lineCount - 1;
  const per = songMs / lineCount;
  return Math.min(lineCount - 1, Math.floor(atMs / per));
}

/** How long each line owns the strip when the lines are spread evenly. */
export function evenLyricHoldMs(lineCount: number, songMs: number): number {
  const FALLBACK = 5200;
  if (!Number.isFinite(lineCount) || lineCount <= 0) return FALLBACK;
  if (!Number.isFinite(songMs) || songMs <= 0) return FALLBACK;
  return Math.max(1200, Math.min(12_000, Math.round(songMs / lineCount)));
}

/**
 * The word the marquee is on. Each line's slot is split evenly between its
 * words, so a word rides through on its own rather than a whole line sliding
 * past — which is what a marquee actually is.
 */
export function marqueeWordAt(opts: {
  words: number;
  lineStartMs: number;
  lineHoldMs: number;
  atMs: number;
}): { index: number; holdMs: number } | null {
  const { words, lineStartMs, lineHoldMs, atMs } = opts;
  if (!Number.isFinite(words) || words <= 0) return null;
  if (!Number.isFinite(lineHoldMs) || lineHoldMs <= 0) return null;
  const holdMs = lineHoldMs / words;
  const into = atMs - lineStartMs;
  if (!Number.isFinite(into) || into < 0) return null;
  const index = Math.min(words - 1, Math.floor(into / holdMs));
  return { index, holdMs: Math.max(280, Math.round(holdMs)) };
}

/** Where a line starts, when the lines are spread evenly across the song. */
export function evenLineStartMs(lineIndex: number, lineCount: number, songMs: number): number {
  if (!Number.isFinite(lineCount) || lineCount <= 0) return 0;
  if (!Number.isFinite(songMs) || songMs <= 0) return 0;
  return Math.round((songMs / lineCount) * Math.max(0, lineIndex));
}
