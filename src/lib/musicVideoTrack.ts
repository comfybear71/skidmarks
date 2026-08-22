/**
 * Music-video TRACK timeline — song spine, section markers, plate in/out.
 * Stored on job.scratchSong (post-lock) and job.trackDraft (pre-lock peaks/markers).
 * Times are milliseconds on the full MP3.
 */
import type { ScratchSong, ScratchSongCut } from "./scratchSongWindow";
import { clampSongSliceDuration, clampSongWindow } from "./scratchSongWindow";

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
    .filter((line) => line.text.length > 0);
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
export function withSectionTime(
  markers: TrackSectionMarker[],
  id: string,
  edge: "start" | "end",
  ms: number,
  songMs: number,
): TrackSectionMarker[] {
  const MIN = 1000;
  const cap = Number.isFinite(songMs) && songMs > 0 ? songMs : Infinity;
  return (markers || []).map((m) => {
    if (m.id !== id) return m;
    const at = Math.max(0, Math.min(cap, Math.round(ms)));
    if (edge === "start") {
      const startMs = Math.min(at, m.endMs - MIN);
      return { ...m, startMs: Math.max(0, startMs) };
    }
    const endMs = Math.max(at, m.startMs + MIN);
    return { ...m, endMs: Math.min(cap, endMs) };
  });
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

/**
 * Section markers straight from the sheet.
 *
 * The tags already say the running order — [Instrumental Intro], [Verse 1],
 * [Chorus], [Outro] — so the sections do not have to be tapped in one at a
 * time. Only the order is known, never the timings: a lyric sheet says what
 * comes next, not when. So the markers are laid end to end across the song as
 * a starting point and the real times get typed in.
 */
export function sectionsFromLyricTags(opts: {
  tags: LyricTag[];
  songMs: number;
  newId: (i: number) => string;
}): TrackSectionMarker[] {
  const { tags, songMs } = opts;
  // Stage directions ("a single slow bass thud dying out") are not sections.
  const structural = tags.filter((t) => t.label !== "custom");
  if (!structural.length || !Number.isFinite(songMs) || songMs <= 0) return [];

  const each = songMs / structural.length;
  return structural.map((tag, i) => ({
    id: opts.newId(i),
    label: tag.label,
    startMs: Math.round(each * i),
    endMs: i === structural.length - 1 ? Math.round(songMs) : Math.round(each * (i + 1)),
  }));
}
