/**
 * Music-video TRACK timeline — song spine, section markers, plate in/out.
 * Stored on job.scratchSong (post-lock) and job.trackDraft (pre-lock peaks/markers).
 * Times are milliseconds on the full MP3.
 */
import type { ScratchSong, ScratchSongCut } from "./scratchSongWindow";
import { LTX_MAX_DURATION_SEC } from "./ltxDuration";
import { clampMinimaxH3HangSec } from "./minimaxH3";
import { addPlateHangDurationSec } from "./hangLengthDraft";
import {
  clampSongSliceDuration,
  clampSongWindow,
  HANG_LENGTH_MAX_SEC,
  SCRATCH_SONG_SLICE_DEFAULT_SEC,
  SCRATCH_SONG_SLICE_MIN_SEC,
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

/**
 * One clock for the wave, the 15s badge, and the pick row.
 * An empty song array must not hide a draft hang — [] is truthy in JS.
 */
export function resolvePlateTimings(
  song?: { plateTimings?: PlateTiming[] } | null,
  draft?: { plateTimings?: PlateTiming[] } | null,
): PlateTiming[] {
  const fromSong = song?.plateTimings;
  if (fromSong && fromSong.length) return fromSong;
  const fromDraft = draft?.plateTimings;
  if (fromDraft && fromDraft.length) return fromDraft;
  if (Array.isArray(fromSong)) return fromSong;
  if (Array.isArray(fromDraft)) return fromDraft;
  return [];
}

export const MIN_PLATE_BOX_MS = 500;

/**
 * 0.5s leftover is not a hang. Presence-only rows (plateId, no times)
 * are already listed — do not treat those as leftover.
 */
export function isLeftoverPlateHang(
  t: { startMs?: number; endMs?: number } | null | undefined,
): boolean {
  if (!t) return false;
  const start = Number(t.startMs);
  const end = Number(t.endMs);
  return Number.isFinite(start) && Number.isFinite(end) && end - start <= MIN_PLATE_BOX_MS;
}

/** On the wave with a real width — leftover 0.5s does not count. */
export function isRealPlateHang(
  t: { startMs?: number; endMs?: number } | null | undefined,
): boolean {
  if (!t) return false;
  const start = Number(t.startMs);
  const end = Number(t.endMs);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return end - start > MIN_PLATE_BOX_MS;
}

/**
 * Real mp4 / clip / cut seconds. Leftover 0.5s is not a length.
 * When one candidate is 5 and another is the 15s cook window, use 5.
 */
export function realHangDurationSec(
  ...candidates: Array<number | undefined | null>
): number | undefined {
  const real = candidates
    .map((n) => Number(n))
    .filter((sec) => Number.isFinite(sec) && sec > MIN_PLATE_BOX_MS / 1000);
  if (!real.length) return undefined;
  return Math.min(...real);
}

/** Known mp4 / clip / cut length, else 15s. A 5s file wins over a 15s window. */
export function hangClipDurationMs(
  ...candidates: Array<number | undefined | null>
): number {
  return secToMs(realHangDurationSec(...candidates) ?? SCRATCH_SONG_SLICE_DEFAULT_SEC);
}

export type PlateBoxEdge = "start" | "end";

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

function clockOrderPlateTimings(list: PlateTiming[]): PlateTiming[] {
  return [...list].sort((a, b) => a.startMs - b.startMs || a.sortIndex - b.sortIndex);
}

/**
 * Slide this bar into the empty clock on that side. Identities stay —
 * plateId and clipFile do not swap with the neighbour. Length stays.
 * Neighbours stay put. Null if there is no gap to fill — flush bars
 * do not swap identities.
 */
export function slidePlateIntoGap(
  timings: PlateTiming[],
  plateId: string,
  direction: -1 | 1,
  songEndMs = Infinity,
): PlateTiming[] | null {
  const id = (plateId || "").trim();
  if (!id || (direction !== -1 && direction !== 1)) return null;
  const hung = clockOrderPlateTimings(timings).filter((t) => isRealPlateHang(t));
  const i = hung.findIndex((t) => t.plateId === id);
  if (i < 0) return null;
  const cur = hung[i]!;
  const dur = cur.endMs - cur.startMs;
  if (!(dur > MIN_PLATE_BOX_MS)) return null;

  let startMs = cur.startMs;
  let endMs = cur.endMs;
  if (direction < 0) {
    const prev = hung[i - 1];
    const targetStart = prev ? prev.endMs : 0;
    if (cur.startMs <= targetStart) return null;
    startMs = targetStart;
    endMs = startMs + dur;
  } else {
    const next = hung[i + 1];
    if (!next) return null;
    const cap = Number.isFinite(songEndMs) && songEndMs > 0 ? Math.round(songEndMs) : Infinity;
    const targetEnd = Math.min(next.startMs, cap);
    if (!Number.isFinite(targetEnd) || cur.endMs >= targetEnd) return null;
    endMs = targetEnd;
    startMs = endMs - dur;
    if (startMs < 0) {
      startMs = 0;
      endMs = dur;
    }
    if (next && endMs > next.startMs) return null;
    const prev = hung[i - 1];
    if (prev && startMs < prev.endMs) return null;
  }
  if (startMs === cur.startMs && endMs === cur.endMs) return null;

  const next = timings.map((t) => (t.plateId === id ? { ...t, startMs, endMs } : { ...t }));
  return clockOrderPlateTimings(next).map((t, sortIndex) => ({ ...t, sortIndex }));
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

/** Bar / picture width in px on the painted wave. Honest: (end − start) / song × wave. */
export function plateSlicePx(
  startMs: number,
  endMs: number,
  durationMs: number,
  waveCssWidth: number,
): number {
  const box = plateRailBox(startMs, endMs, durationMs);
  return (box.widthPct / 100) * Math.max(0, waveCssWidth);
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

/** Same geometry the canvas draws, so a tap on a handle hits that bar. */
export function hitPlateEdge(opts: {
  timings: Pick<PlateTiming, "plateId" | "startMs" | "endMs">[];
  durationMs: number;
  width: number;
  height: number;
  x: number;
  y: number;
  slopPx?: number;
}): { plateId: string; edge: PlateBoxEdge } | null {
  const { durationMs, width, height, x, y } = opts;
  if (!durationMs || !width || !height) return null;
  const layout = trackWaveLayout(width, height);
  const slop = opts.slopPx ?? 14;
  if (y < layout.laneY - 6 || y > layout.laneY + layout.laneBoxH + 6) return null;
  const xAt = (ms: number) => (ms / durationMs) * width;
  let best: { plateId: string; edge: PlateBoxEdge; dist: number } | null = null;
  for (const t of opts.timings) {
    const x0 = xAt(t.startMs);
    const x1 = xAt(t.endMs);
    for (const edge of ["start", "end"] as const) {
      const dist = Math.abs(x - (edge === "start" ? x0 : x1));
      if (dist > slop) continue;
      if (!best || dist < best.dist) best = { plateId: t.plateId, edge, dist };
    }
  }
  return best ? { plateId: best.plateId, edge: best.edge } : null;
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
    plateTimings: resolvePlateTimings(existing, draft),
  };
}

/** TRACK already plays from either pointer. Add and the 5–40 slider must too. */
export function deskHasSong(opts: {
  scratchSong?: ScratchSong | null;
  trackDraft?: MusicVideoTrackDraft | null;
}): boolean {
  return Boolean(songFromTrackDraft(opts.trackDraft, opts.scratchSong)?.fileName);
}

/**
 * TRACK × — park the mp3 pointer. File stays in Blob. Clips and stills stay.
 * A carrier beat does not keep the player hooked; drop another mp3 after this.
 */
export function parkSongFilePointers(opts: {
  trackDraft?: MusicVideoTrackDraft | null;
  scratchSong?: ScratchSong | null;
}): { trackDraft: MusicVideoTrackDraft; scratchSong?: ScratchSong } {
  const draft = { ...(opts.trackDraft || {}) };
  delete draft.songFile;
  delete draft.songDurationSec;
  delete draft.waveformPeaks;
  const song = opts.scratchSong;
  if (!song) return { trackDraft: draft };
  return {
    trackDraft: draft,
    scratchSong: {
      ...song,
      fileName: "",
      waveformPeaks: undefined,
    },
  };
}

export function plateTimingForShot(
  song: ScratchSong | null | undefined,
  draft: MusicVideoTrackDraft | null | undefined,
  shotId: string,
): PlateTiming | null {
  const id = (shotId || "").trim();
  if (!id) return null;
  return resolvePlateTimings(song, draft).find((p) => p.plateId === id) || null;
}

/**
 * Pull one hung bar's in or out. Other stills keep their times — no slide,
 * no compact, no new 15s row.
 */
export function stretchPlateEdge(
  timings: PlateTiming[],
  plateId: string,
  edge: PlateBoxEdge,
  wantMs: number,
  songEndMs: number,
  snapMs = 100,
): PlateTiming[] {
  const out = sortPlateTimings(timings).map((t) => ({ ...t }));
  const idx = out.findIndex((t) => t.plateId === plateId);
  if (idx < 0) return timings;
  const cap = Number.isFinite(songEndMs) && songEndMs > 0 ? Math.round(songEndMs) : Infinity;
  const snap = snapMs > 0 ? snapMs : 1;
  let at = Math.round(wantMs / snap) * snap;
  const cur = out[idx]!;

  if (edge === "start") {
    const hi = cur.endMs - MIN_PLATE_BOX_MS;
    at = Math.max(0, Math.min(hi, at, cap));
    cur.startMs = at;
  } else {
    const lo = cur.startMs + MIN_PLATE_BOX_MS;
    at = Math.max(lo, Math.min(at, cap));
    cur.endMs = at;
  }
  return out;
}

/**
 * The cut on this still's wave clock. Same shotId later on the song list
 * (180s leftover row) is not this still — Send must not cook that instead.
 */
export function cutForHungPlate(opts: {
  cuts: ScratchSongCut[] | undefined;
  shotId: string;
  timing?: PlateTiming | null;
}): ScratchSongCut | undefined {
  const id = (opts.shotId || "").trim();
  if (!id) return undefined;
  const mine = (opts.cuts || []).filter((c) => (c.shotId || "").trim() === id);
  if (!mine.length) return undefined;
  if (opts.timing && opts.timing.endMs > opts.timing.startMs) {
    const startSec = msToSec(opts.timing.startMs);
    const hit = mine.find((c) => Math.abs(Number(c.startSec || 0) - startSec) < 0.26);
    if (hit) return hit;
  }
  return mine[0];
}

/** Hung bar length in seconds. Leftover 0.5s is not a length. */
export function hungBarDurationSec(
  timing?: { startMs?: number; endMs?: number } | null,
): number | undefined {
  if (!isRealPlateHang(timing)) return undefined;
  const sec = msToSec(Number(timing!.endMs) - Number(timing!.startMs));
  return sec > 0 ? sec : undefined;
}

/**
 * Send uses this clock. H3 4–15 (7 and 9 stay 7 and 9). LTX 5–40.
 * A 10s bar cooks 10. A 40s bar cooks 40. Never invent 15.
 */
export function cookDurationFromHungBar(
  timing: { startMs?: number; endMs?: number } | null | undefined,
  engine: "h3" | "ltx",
): { durationSec: number; note: string } | { error: string } {
  const hang = hungBarDurationSec(timing);
  if (hang == null) return { error: "Hang the still on the song first." };
  if (engine === "h3") return clampMinimaxH3HangSec(hang);
  const durationSec = clampSongSliceDuration(hang, HANG_LENGTH_MAX_SEC);
  if (hang > HANG_LENGTH_MAX_SEC) {
    return { durationSec, note: `LTX max ${HANG_LENGTH_MAX_SEC} — cooking ${durationSec}` };
  }
  if (hang < SCRATCH_SONG_SLICE_MIN_SEC) {
    return { durationSec, note: `LTX min ${SCRATCH_SONG_SLICE_MIN_SEC} — cooking ${durationSec}` };
  }
  return { durationSec, note: "" };
}

/**
 * Hung bar clock wins. A stale cut at 5s must not cook 5 when the bar is 15.
 * Same still twice: cut.shotId / hang id (`jack~still2`) wins. First
 * `plateId === originalShotId` match is hang 1 — that used to cook bar 2
 * on hang 1's clock and stamp clip 1 onto the second bar.
 */
export function sliceBoundsForPlate(opts: {
  song: ScratchSong;
  shotId: string;
  cut?: ScratchSongCut;
}): { startSec: number; durationSec: number } {
  const hangId = (opts.cut?.shotId || "").trim() || (opts.shotId || "").trim();
  const timing =
    (opts.song.plateTimings || []).find((p) => p.plateId === hangId) ||
    (opts.song.plateTimings || []).find((p) => p.plateId === opts.shotId);
  if (timing && timing.endMs > timing.startMs) {
    const startSec = msToSec(timing.startMs);
    const durationSec = msToSec(timing.endMs - timing.startMs);
    return clampSongWindow(startSec, durationSec, opts.song.durationSec, LTX_MAX_DURATION_SEC);
  }
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
  const onSlot = cuts.filter((c) => (c.shotId || "").trim() === timing.plateId);
  const empty = onSlot.find((c) => !(c.clipFile || "").trim());
  const existing = empty || onSlot[0];
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
  // Keep other done mp4s on this still. Filtering every shotId used to
  // drop previous clip 2 when leftover hang wrote this slot again.
  const rest = existing ? cuts.filter((c) => c.id !== existing.id) : cuts;
  return [...rest, next];
}

/**
 * First hole that fits this length, counting from 0. Jack at 0:31 stays
 * 0:31 when 30s of intro sits on the front. Packed bars fall through to
 * the open end. Does not invent a 15s row when that plate already has in/out.
 * Does not move existing bars.
 */
export function nextPlateHangStartMs(
  existing: PlateTiming[] | undefined,
  durationMs?: number,
): number {
  const asked = Math.round(Number(durationMs));
  const dur = Math.max(
    MIN_PLATE_BOX_MS,
    Number.isFinite(asked) && asked > 0 ? asked : secToMs(SCRATCH_SONG_SLICE_DEFAULT_SEC),
  );
  const hung = sortPlateTimings(existing || [])
    .filter((t) => isRealPlateHang(t))
    .sort((a, b) => a.startMs - b.startMs || a.sortIndex - b.sortIndex);
  if (!hung.length) return 0;
  let cursor = 0;
  for (const t of hung) {
    if (t.startMs - cursor >= dur) return cursor;
    cursor = Math.max(cursor, t.endMs);
  }
  return cursor;
}

const LYRIC_HANG_MATCH_MS = 400;

/**
 * A lyric pin is taken if a hang starts on it (within 400ms) or if any
 * hung bar covers that ms. Clip 2 at 0:30–1:09 covers the verse at 0:31
 * even though it starts a second earlier. Intro 0:00–0:30 does not cover
 * 0:31 — Silver stays free.
 */
export function lyricPinTakenByHang(
  t: { startMs?: number; endMs?: number } | null | undefined,
  atMs: number,
): boolean {
  if (!t || !isRealPlateHang(t)) return false;
  const start = Number(t.startMs);
  const end = Number(t.endMs);
  const pin = Math.round(Number(atMs));
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(pin)) return false;
  if (Math.abs(start - pin) <= LYRIC_HANG_MATCH_MS) return true;
  return start <= pin && pin < end;
}

/**
 * First unused lyric pin. Silver lines at 0:31 stays 0:31 while intro
 * clips occupy 0:00–0:30. A hang that already starts on a pin, or covers
 * that clock, yields the next pin. Does not move other bars.
 */
export function firstUnusedLyricHangStartMs(
  cues: LyricCue[] | undefined,
  plateTimings?: PlateTiming[],
): number | null {
  const pins = [...(cues || [])]
    .filter((c) => Number.isFinite(c.atMs) && c.atMs >= 0)
    .sort((a, b) => a.atMs - b.atMs || a.lineIndex - b.lineIndex);
  if (!pins.length) return null;
  const hung = sortPlateTimings(plateTimings || []).filter((t) => isRealPlateHang(t));
  for (const cue of pins) {
    const taken = hung.some((t) => lyricPinTakenByHang(t, cue.atMs));
    if (!taken) return Math.round(cue.atMs);
  }
  return null;
}

/**
 * Singing Add (No lips OFF). First still on an empty wave starts at 0 —
 * not the first lyric pin (lineIndex 3 at 0:15.5 is not "3rd place").
 * Lyric pins only after a real hang already exists (Silver 0:31 after
 * intro). Null when mute/support, the sheet has no pins, or this still
 * is already on the wave — extra take sits in a gap.
 */
export function singingHangStartMs(opts: {
  singing?: boolean;
  lyricCues?: LyricCue[];
  plateTimings?: PlateTiming[];
  alreadyOnWave?: boolean;
}): number | null {
  if (!opts.singing || opts.alreadyOnWave) return null;
  const hung = sortPlateTimings(opts.plateTimings || []).filter((t) => isRealPlateHang(t));
  if (!hung.length) return null;
  return firstUnusedLyricHangStartMs(opts.lyricCues, opts.plateTimings);
}

export function nextPlateHangWindow(
  existing: PlateTiming[] | undefined,
  durationOrOpts?: number | { singing?: boolean; lyricCues?: LyricCue[]; durationSec?: number },
): { startMs: number; endMs: number } {
  const opts = typeof durationOrOpts === "object" && durationOrOpts ? durationOrOpts : undefined;
  const durationSec = typeof durationOrOpts === "number" ? durationOrOpts : opts?.durationSec;
  const lyric = singingHangStartMs({
    singing: opts?.singing,
    lyricCues: opts?.lyricCues,
    plateTimings: existing,
  });
  const durMs = secToMs(addPlateHangDurationSec(durationSec));
  const startMs = lyric ?? nextPlateHangStartMs(existing, durMs);
  return {
    startMs,
    endMs: startMs + durMs,
  };
}

const PLATE_DURATION_MIN_MS = 1000;
const PLATE_DURATION_MAX_MS = secToMs(LTX_MAX_DURATION_SEC);

/**
 * Where this still sits, and how long it covers. Other stills keep their
 * song times — plates must not push the song back.
 * Missing / 0 song length must not invent a 1s song that clamps 9s to 1s.
 */
export function withPlateWindow(
  existing: PlateTiming[] | undefined,
  plateId: string,
  startMs: number,
  durationMs: number,
  songMs: number,
): PlateTiming[] | null {
  const sorted = sortPlateTimings(existing || []);
  const id = (plateId || "").trim();
  const i = sorted.findIndex((t) => t.plateId === id);
  if (i < 0) return null;
  const songRaw = Math.round(Number(songMs) || 0);
  const askedStart = Math.round(Number(startMs));
  const askedDur = Math.max(
    PLATE_DURATION_MIN_MS,
    Math.min(PLATE_DURATION_MAX_MS, Math.round(Number(durationMs) || 0) || PLATE_DURATION_MIN_MS),
  );
  const startAsked = Number.isFinite(askedStart) ? Math.max(0, askedStart) : 0;
  const start =
    songRaw > 0
      ? Math.min(startAsked, Math.max(0, songRaw - PLATE_DURATION_MIN_MS))
      : startAsked;
  const dur =
    songRaw > 0
      ? Math.max(PLATE_DURATION_MIN_MS, Math.min(askedDur, songRaw - start))
      : askedDur;
  const next = sorted.map((t) => ({ ...t }));
  next[i] = { ...next[i]!, startMs: start, endMs: start + dur };
  next.sort((a, b) => a.startMs - b.startMs || a.sortIndex - b.sortIndex);
  return next.map((t, sortIndex) => ({ ...t, sortIndex }));
}

/** How long this still covers. Other bars keep their song times. Not stuck at 15s. */
export function withPlateDuration(
  existing: PlateTiming[] | undefined,
  plateId: string,
  durationMs: number,
  songMs: number,
): PlateTiming[] | null {
  const sorted = sortPlateTimings(existing || []);
  const hit = sorted.find((t) => t.plateId === (plateId || "").trim());
  if (!hit) return null;
  return withPlateWindow(existing, plateId, hit.startMs, durationMs, songMs);
}

/**
 * Same as withPlateDuration when the still is already on the wave.
 * If it is not hung yet, mint a bar in a gap or at 0 at this length
 * so Send has a clock (10s stays 10). Does not slide later bars.
 */
export function ensurePlateDuration(
  existing: PlateTiming[] | undefined,
  plateId: string,
  durationMs: number,
  songMs: number,
): PlateTiming[] | null {
  const id = (plateId || "").trim();
  if (!id) return null;
  const resized = withPlateDuration(existing, id, durationMs, songMs);
  if (resized) return resized;
  const dur = Math.max(PLATE_DURATION_MIN_MS, Math.round(Number(durationMs) || 0));
  const startMs = nextPlateHangStartMs(existing, dur);
  const seed: PlateTiming[] = [
    ...sortPlateTimings(existing || []),
    {
      plateId: id,
      startMs,
      endMs: startMs + dur,
      sortIndex: (existing || []).length,
    },
  ];
  return withPlateDuration(seed, id, durationMs, songMs);
}

/**
 * After the mp4 lands — the wave uses the real clip length.
 * He does not type How long first. Other bars keep their song times.
 * A done cut with no real hang gets one write: this bar in a gap.
 * File length stays. Does not invent 15s when duration is known.
 * Does not restamp another hang.
 */
export function applyLandedClipDuration(
  song: ScratchSong,
  opts: { cutId?: string; plateId?: string; durationSec: number },
): ScratchSong {
  const durationSec = Number(opts.durationSec);
  if (!Number.isFinite(durationSec) || durationSec <= 0) return song;
  const cutId = (opts.cutId || "").trim();
  const cuts = (song.cuts || []).map((c) =>
    cutId && c.id === cutId ? { ...c, durationSec } : c,
  );
  const plateId =
    (opts.plateId || "").trim() ||
    (cutId ? (cuts.find((c) => c.id === cutId)?.shotId || "").trim() : "");
  if (!plateId) return { ...song, cuts };
  const durMs = secToMs(durationSec);
  const songMs = secToMs(song.durationSec);
  const exact = (song.plateTimings || []).find(
    (t) => isRealPlateHang(t) && t.plateId === plateId,
  );
  const mapped = (song.plateTimings || []).find(
    (t) => isRealPlateHang(t) && hangPlateShotId(t.plateId) === hangPlateShotId(plateId),
  );
  const hangId = (exact || mapped)?.plateId || plateId;
  const resized = withPlateDuration(song.plateTimings, hangId, durMs, songMs);
  if (resized) {
    return { ...song, cuts, plateTimings: resized };
  }
  const minted = ensurePlateDuration(song.plateTimings, plateId, durMs, songMs);
  const hang = minted?.find((t) => t.plateId === plateId);
  const stamped =
    hang && cutId
      ? cuts.map((c) =>
          c.id === cutId
            ? { ...c, startSec: msToSec(hang.startMs), durationSec }
            : c,
        )
      : cuts;
  return {
    ...song,
    cuts: stamped,
    plateTimings: minted || song.plateTimings,
  };
}

/** Same still, second mp4 — unique hang slot. First take keeps shotId. */
export const EXTRA_HANG_SEP = "~";

export function hangPlateShotId(plateId: string): string {
  const raw = (plateId || "").trim();
  const i = raw.lastIndexOf(EXTRA_HANG_SEP);
  if (i <= 0) return raw;
  return raw.slice(0, i);
}

export function extraTakeHangPlateId(shotId: string, clipFile: string): string {
  const shot = hangPlateShotId(shotId);
  const stem = hangClipBasename(clipFile).replace(/\.[^.]+$/, "");
  const compact = stem.replace(/[^a-zA-Z0-9]/g, "");
  // Last-12 only made 01_Title and 02_Title the same slot — Add
  // stamped clip 3 onto clip 2. Keep the leading NN_ plus a tail.
  const lead = compact.slice(0, 6);
  const tail = compact.slice(-6);
  const token =
    lead && tail && lead !== compact ? `${lead}${tail}` : compact.slice(-12) || "take";
  if (!shot) return "";
  return `${shot}${EXTRA_HANG_SEP}${token}`;
}

/** Same still, another Add with no leftover mp4 — unique wave slot. */
export function extraStillHangPlateId(
  shotId: string,
  plateTimings?: { plateId?: string }[],
): string {
  const shot = hangPlateShotId(shotId);
  if (!shot) return "";
  const used = new Set(
    (plateTimings || []).map((t) => (t.plateId || "").trim()).filter(Boolean),
  );
  let n = 2;
  let id = `${shot}${EXTRA_HANG_SEP}still${n}`;
  while (used.has(id)) {
    n += 1;
    id = `${shot}${EXTRA_HANG_SEP}still${n}`;
  }
  return id;
}

/**
 * Send / cook this hang — not the first same-still bar. Picked extra
 * id wins. Else the empty extra hang (`~still2`). Else the id he passed.
 */
export function hangIdForSend(opts: {
  shotId: string;
  plateTimings?: PlateTiming[];
  cuts?: ScratchSongCut[];
  pickedId?: string;
}): string {
  const raw = (opts.shotId || "").trim();
  if (!raw) return "";
  const timings = sortPlateTimings(opts.plateTimings || []).filter((t) => isRealPlateHang(t));
  const still = hangPlateShotId(raw);
  const hangs = timings.filter((t) => hangPlateShotId(t.plateId) === still);
  const picked = (opts.pickedId || "").trim();
  if (picked && hangs.some((t) => t.plateId === picked)) return picked;
  if (raw !== still && timings.some((t) => t.plateId === raw)) return raw;
  const empty = hangs.find((t) => {
    const cut = cutForHungPlate({
      cuts: opts.cuts,
      shotId: t.plateId,
      timing: t,
    });
    return !hangClipBasename(cut?.clipFile || "");
  });
  return empty?.plateId || raw;
}

function hangClipBasename(clipFile: string): string {
  const raw = (clipFile || "").trim();
  if (!raw) return "";
  return raw.split(/[\\/]/).pop() || "";
}

/** This mp4 owns a real wave bar. Two files on one shot: only the first owns shotId. */
export function clipFileOnWave(
  song:
    | {
        cuts?: { clipFile?: string; shotId?: string }[];
        plateTimings?: PlateTiming[];
      }
    | null
    | undefined,
  clipFile: string,
): boolean {
  return clipHangTiming(song, clipFile) != null;
}

export function clipHangTiming(
  song:
    | {
        cuts?: { clipFile?: string; shotId?: string }[];
        plateTimings?: PlateTiming[];
      }
    | null
    | undefined,
  clipFile: string,
): PlateTiming | null {
  const file = hangClipBasename(clipFile);
  if (!file) return null;
  const timings = sortPlateTimings(song?.plateTimings || []).filter((t) => isRealPlateHang(t));
  const cuts = song?.cuts || [];
  for (const t of timings) {
    const onSlot = cuts.filter(
      (c) => (c.shotId || "").trim() === t.plateId && hangClipBasename(c.clipFile || ""),
    );
    if (hangPlateShotId(t.plateId) !== t.plateId) {
      if (onSlot.some((c) => hangClipBasename(c.clipFile || "") === file)) return t;
      continue;
    }
    if (!onSlot.length) continue;
    if (hangClipBasename(onSlot[0]!.clipFile || "") === file) return t;
  }
  return null;
}

function upsertClipHangCut(
  cuts: ScratchSongCut[],
  timing: PlateTiming,
  plateFile: string,
  clipFile: string,
  newCutId: () => string,
): ScratchSongCut[] {
  const file = hangClipBasename(clipFile);
  const startSec = msToSec(timing.startMs);
  const durationSec = msToSec(timing.endMs - timing.startMs);
  const byFile = cuts.findIndex((c) => hangClipBasename(c.clipFile || "") === file);
  const byEmpty = cuts.findIndex(
    (c) => (c.shotId || "").trim() === timing.plateId && !hangClipBasename(c.clipFile || ""),
  );
  const idx = byFile >= 0 ? byFile : byEmpty;
  const prev = idx >= 0 ? cuts[idx] : undefined;
  const next: ScratchSongCut = {
    id: prev?.id || newCutId(),
    plateFile: plateFile || prev?.plateFile || "",
    shotId: timing.plateId,
    startSec,
    durationSec,
    clipFile: file,
    status: "done",
    error: "",
    ...(prev?.endPlateFile ? { endPlateFile: prev.endPlateFile } : {}),
    ...(prev?.performance ? { performance: prev.performance } : {}),
  };
  if (idx >= 0) return cuts.map((c, i) => (i === idx ? next : c));
  return [...cuts, next];
}

/**
 * File first — hang this mp4 on the wave. Same still, second take gets its
 * own clock (`shotId~tail`). Gap from 0, or a lyric pin that no hung bar
 * covers. Known length else 15. Does not cook. Does not invent 15s when
 * this file already has a real in/out. Does not move other bars. Overlap
 * with a hung bar (two takes both at 0:20, or a verse pin under clip 2)
 * uses the next gap — do not stack another 0:20.
 */
export function hangOneClipOnWave(opts: {
  plateTimings?: PlateTiming[];
  cuts: ScratchSongCut[];
  shotId: string;
  plateFile: string;
  clipFile: string;
  durationSec?: number;
  /** Singing first hang — unused uncovered lyric pin. Extra takes omit this. */
  preferStartMs?: number;
  newCutId: () => string;
}): { plateTimings: PlateTiming[]; cuts: ScratchSongCut[] } | null {
  const shotId = (opts.shotId || "").trim();
  const clipFile = hangClipBasename(opts.clipFile);
  const plateFile = (opts.plateFile || "").trim();
  if (!shotId || !clipFile) return null;
  const existing = sortPlateTimings(opts.plateTimings || []).filter((t) => !isLeftoverPlateHang(t));
  if (clipFileOnWave({ cuts: opts.cuts, plateTimings: existing }, clipFile)) {
    return { plateTimings: existing, cuts: opts.cuts };
  }
  const otherOwnsShot = (opts.cuts || []).some((c) => {
    if ((c.shotId || "").trim() !== shotId) return false;
    const owned = hangClipBasename(c.clipFile || "");
    return Boolean(owned) && owned !== clipFile;
  });
  const shotTaken = existing.some((t) => t.plateId === shotId) || otherOwnsShot;
  let plateId = shotTaken ? extraTakeHangPlateId(shotId, clipFile) : shotId;
  if (!plateId) {
    return { plateTimings: existing, cuts: opts.cuts };
  }
  const occupiedByOther = (opts.cuts || []).some((c) => {
    if ((c.shotId || "").trim() !== plateId) return false;
    const owned = hangClipBasename(c.clipFile || "");
    return Boolean(owned) && owned !== clipFile;
  });
  // Same tail (`JackGhost`) used to reuse clip 2 / clip 5's slot —
  // then Add stamped the new mp4 onto that bar. Mint a free id.
  if (existing.some((t) => t.plateId === plateId) || occupiedByOther) {
    let n = 2;
    let next = `${plateId}${n}`;
    while (
      existing.some((t) => t.plateId === next) ||
      (opts.cuts || []).some((c) => {
        if ((c.shotId || "").trim() !== next) return false;
        const owned = hangClipBasename(c.clipFile || "");
        return Boolean(owned) && owned !== clipFile;
      })
    ) {
      n += 1;
      next = `${plateId}${n}`;
    }
    plateId = next;
  }
  const cutForFile = (opts.cuts || []).find((c) => hangClipBasename(c.clipFile || "") === clipFile);
  const durMs = hangClipDurationMs(opts.durationSec, cutForFile?.durationSec);
  const lyricStart = Number(opts.preferStartMs);
  const useLyric = Number.isFinite(lyricStart) && lyricStart >= 0;
  const lyricCovered =
    useLyric && existing.some((t) => lyricPinTakenByHang(t, lyricStart));
  const askedStart =
    cutForFile && Number(cutForFile.durationSec) > MIN_PLATE_BOX_MS / 1000
      ? secToMs(Number(cutForFile.startSec) || 0)
      : 0;
  const gapStart = nextPlateHangStartMs(existing, durMs);
  const overlaps = existing.some(
    (t) => askedStart < t.endMs && askedStart + durMs > t.startMs,
  );
  const startMs =
    useLyric && !lyricCovered ? lyricStart : !askedStart || overlaps ? gapStart : askedStart;
  const timing: PlateTiming = {
    plateId,
    startMs,
    endMs: Math.max(startMs + 100, startMs + durMs),
    sortIndex: existing.length,
  };
  return {
    plateTimings: [...existing, timing],
    cuts: upsertClipHangCut(opts.cuts, timing, plateFile, clipFile, opts.newCutId),
  };
}

export type UnhungDoneClip = {
  shotId: string;
  clipFile: string;
  plateFile?: string;
  durationSec?: number;
};

/** Done mp4s with no own wave bar. Two files on one still: the extra is here. */
export function listUnhungDoneClips(opts: {
  clips?: Array<{
    shotId?: string;
    clipFile?: string;
    priorClipFiles?: string[];
    clipStatus?: string;
    durationSec?: number;
  }>;
  cuts?: Array<{
    shotId?: string;
    clipFile?: string;
    plateFile?: string;
    status?: string;
    durationSec?: number;
  }>;
  plateTimings?: PlateTiming[];
  skipShotIds?: string[];
  skipClipFiles?: string[];
}): UnhungDoneClip[] {
  // Exact ids only. Mapping skip through hangPlateShotId used to treat
  // `car~6ir` as skip-the-whole-car, so Add missed the leftover mp4 and
  // fell through to a 15s WAITING desk rebuild.
  const skipped = new Set((opts.skipShotIds || []).map((id) => id.trim()).filter(Boolean));
  const skippedFiles = new Set(
    (opts.skipClipFiles || []).map((f) => hangClipBasename(f)).filter(Boolean),
  );
  const clock = { cuts: opts.cuts, plateTimings: opts.plateTimings };
  const impliedHung = impliedHungClipFiles(opts);
  const seen = new Set<string>();
  const out: UnhungDoneClip[] = [];
  const take = (
    shotId: string,
    clipFile: string,
    plateFile?: string,
    durationSec?: number,
  ) => {
    const file = hangClipBasename(clipFile);
    const shot = hangPlateShotId(shotId);
    if (!file || !shot) return;
    if (skippedFiles.has(file)) return;
    if (skipped.has(shot) || skipped.has(extraTakeHangPlateId(shot, file))) return;
    if (clipFileOnWave(clock, file) || impliedHung.has(file)) return;
    const existing = out.find((r) => r.clipFile === file);
    const dur = realHangDurationSec(existing?.durationSec, durationSec);
    if (existing) {
      if (dur != null) existing.durationSec = dur;
      if (!existing.plateFile && plateFile) existing.plateFile = plateFile;
      return;
    }
    seen.add(file);
    out.push({
      shotId: shot,
      clipFile: file,
      ...(plateFile ? { plateFile } : {}),
      ...(dur != null ? { durationSec: dur } : {}),
    });
  };
  for (const clip of opts.clips || []) {
    if (clip.clipStatus && clip.clipStatus !== "done") continue;
    const stacked = [...(clip.priorClipFiles || []), clip.clipFile || ""];
    const current = hangClipBasename(clip.clipFile || "");
    for (const file of stacked) {
      const cut = (opts.cuts || []).find(
        (c) => hangClipBasename(c.clipFile || "") === hangClipBasename(file),
      );
      take(
        clip.shotId || "",
        file,
        cut?.plateFile,
        realHangDurationSec(
          hangClipBasename(file) === current ? clip.durationSec : undefined,
          cut?.durationSec,
          hangClipBasename(file) !== current && !cut ? clip.durationSec : undefined,
        ),
      );
    }
  }
  for (const cut of opts.cuts || []) {
    if (cut.status && cut.status !== "done") continue;
    take(cut.shotId || "", cut.clipFile || "", cut.plateFile, cut.durationSec);
  }
  return out;
}

/**
 * Hung bar with no cut.clipFile still owns the first done mp4 on that
 * still — TRACK can show 3 bars while STILLS says 3 WAITING. Extra takes
 * on the same still stay leftover.
 */
function impliedHungClipFiles(opts: {
  clips?: Array<{
    shotId?: string;
    clipFile?: string;
    priorClipFiles?: string[];
    clipStatus?: string;
  }>;
  cuts?: Array<{ shotId?: string; clipFile?: string }>;
  plateTimings?: PlateTiming[];
}): Set<string> {
  const implied = new Set<string>();
  const timings = sortPlateTimings(opts.plateTimings || []).filter((t) => isRealPlateHang(t));
  const takenShots = new Set<string>();
  for (const t of timings) {
    const onSlot = (opts.cuts || []).find(
      (c) => (c.shotId || "").trim() === t.plateId && hangClipBasename(c.clipFile || ""),
    );
    if (onSlot) {
      implied.add(hangClipBasename(onSlot.clipFile || ""));
      if (t.plateId === hangPlateShotId(t.plateId)) {
        takenShots.add(t.plateId);
      }
    }
  }
  const firstByShot = new Map<string, string>();
  for (const clip of opts.clips || []) {
    if (clip.clipStatus && clip.clipStatus !== "done") continue;
    const shot = hangPlateShotId(clip.shotId || "");
    if (!shot || firstByShot.has(shot)) continue;
    for (const raw of [...(clip.priorClipFiles || []), clip.clipFile || ""]) {
      const file = hangClipBasename(raw);
      if (!file) continue;
      firstByShot.set(shot, file);
      break;
    }
  }
  for (const t of timings) {
    const shot = hangPlateShotId(t.plateId);
    if (t.plateId !== shot || takenShots.has(shot)) continue;
    const first = firstByShot.get(shot);
    if (first) implied.add(first);
  }
  return implied;
}

/**
 * File first — hang every unhung done mp4 in a gap or at 0. Same still,
 * second take → next gap, not another 0:20. Waiting 0/3 cuts do not
 * block. Does not cook. Does not move existing bars.
 * Call only from explicit Add / Hang / Put stills — never on TRACK open.
 */
export function hangUnhungDoneClips(opts: {
  plateTimings?: PlateTiming[];
  cuts: ScratchSongCut[];
  clips?: Array<{
    shotId?: string;
    clipFile?: string;
    priorClipFiles?: string[];
    clipStatus?: string;
    durationSec?: number;
  }>;
  skipShotIds?: string[];
  skipClipFiles?: string[];
  plateFileFor: (shotId: string) => string;
  newCutId: () => string;
  onlyShotId?: string;
}): { plateTimings: PlateTiming[]; cuts: ScratchSongCut[] } {
  let plateTimings = opts.plateTimings;
  let cuts = opts.cuts;
  const only = hangPlateShotId(opts.onlyShotId || "");
  const rows = listUnhungDoneClips({
    clips: opts.clips,
    cuts,
    plateTimings,
    skipShotIds: opts.skipShotIds,
    skipClipFiles: opts.skipClipFiles,
  }).filter((row) => !only || row.shotId === only);
  for (const row of rows) {
    const hung = hangOneClipOnWave({
      plateTimings,
      cuts,
      shotId: row.shotId,
      plateFile: (opts.plateFileFor(row.shotId) || row.plateFile || "").trim(),
      clipFile: row.clipFile,
      durationSec: row.durationSec,
      newCutId: opts.newCutId,
    });
    if (!hung) continue;
    plateTimings = hung.plateTimings;
    cuts = hung.cuts;
  }
  return { plateTimings: plateTimings || [], cuts };
}

/**
 * STILLS ADD / plate-row Add / Open→Add: if this still already has an
 * unhung mp4, hang that file in a gap — or on an unused lyric pin only
 * when this still is not already on the wave. A pin a hung bar covers
 * is not unused. Cut + plateTiming together. Does not mint a waiting
 * cook. hung=false when there is no leftover file (caller may queue a
 * still with no clip).
 */
export function addPlateFileFirstHang(opts: {
  shotId: string;
  plateFile?: string;
  plateTimings?: PlateTiming[];
  cuts: ScratchSongCut[];
  clips?: Array<{
    shotId?: string;
    clipFile?: string;
    priorClipFiles?: string[];
    clipStatus?: string;
    durationSec?: number;
  }>;
  skipShotIds?: string[];
  skipClipFiles?: string[];
  singing?: boolean;
  lyricCues?: LyricCue[];
  newCutId: () => string;
}): { plateTimings: PlateTiming[]; cuts: ScratchSongCut[]; hung: boolean } {
  const shotId = hangPlateShotId(opts.shotId);
  const leftover = listUnhungDoneClips({
    clips: opts.clips,
    cuts: opts.cuts,
    plateTimings: opts.plateTimings,
    skipShotIds: opts.skipShotIds,
    skipClipFiles: opts.skipClipFiles,
  }).filter((row) => row.shotId === shotId);
  if (!shotId || !leftover.length) {
    return {
      plateTimings: sortPlateTimings(opts.plateTimings || []).filter((t) => !isLeftoverPlateHang(t)),
      cuts: opts.cuts,
      hung: false,
    };
  }
  const alreadyOnWave = (opts.plateTimings || []).some(
    (t) => hangPlateShotId(t.plateId) === shotId && isRealPlateHang(t),
  );
  let plateTimings = opts.plateTimings;
  let cuts = opts.cuts;
  let first = true;
  for (const row of leftover) {
    const lyricStart = singingHangStartMs({
      singing: Boolean(first && opts.singing),
      lyricCues: opts.lyricCues,
      plateTimings,
      alreadyOnWave,
    });
    first = false;
    const hung = hangOneClipOnWave({
      plateTimings,
      cuts,
      shotId: row.shotId,
      plateFile: (opts.plateFile || row.plateFile || "").trim(),
      clipFile: row.clipFile,
      durationSec: row.durationSec,
      ...(lyricStart != null ? { preferStartMs: lyricStart } : {}),
      newCutId: opts.newCutId,
    });
    if (!hung) continue;
    plateTimings = hung.plateTimings;
    cuts = hung.cuts;
  }
  return { plateTimings: plateTimings || [], cuts, hung: true };
}

/**
 * Both Add buttons (STILLS + plate-row) share this. File first: leftover
 * mp4 in a gap or at 0. Then hang the still if it has no unique slot.
 * Waiting 0/3 cuts do not block. Does not cook. Does not slide Jack.
 */
export function addPlateHangOnTrack(opts: {
  plateTimings?: PlateTiming[];
  cuts: ScratchSongCut[];
  clips?: Array<{
    shotId?: string;
    clipFile?: string;
    priorClipFiles?: string[];
    clipStatus?: string;
    durationSec?: number;
  }>;
  shotId: string;
  hangCuts: Array<Pick<ScratchSongCut, "shotId" | "startSec"> & { durationSec?: number }>;
  extraIds: string[];
  skipShotIds?: string[];
  skipClipFiles?: string[];
  plateFileFor: (shotId: string) => string;
  newCutId: () => string;
}): { plateTimings: PlateTiming[]; cuts: ScratchSongCut[] } {
  const leftover = hangUnhungDoneClips({
    plateTimings: opts.plateTimings,
    cuts: opts.cuts,
    clips: opts.clips,
    skipShotIds: opts.skipShotIds,
    skipClipFiles: opts.skipClipFiles,
    plateFileFor: opts.plateFileFor,
    newCutId: opts.newCutId,
    onlyShotId: opts.shotId,
  });
  return {
    plateTimings: hangMissingPlateTimings(
      leftover.plateTimings,
      opts.hangCuts,
      opts.extraIds,
    ),
    cuts: leftover.cuts,
  };
}

/**
 * TRACK paints plateTimings, not the cut list. Add-on-stills used to
 * write a waiting cut and leave the wave empty. Keep any real clock
 * already on the wave — leftover 0.5s is not a clock. Hang each cut
 * that has no real timing yet. Three 0:00 clips sequence at the next
 * gap (duration = known mp4 / clip / cut length else 15 — a 5s file
 * wins over a 15s cook window). extraIds is Add on a
 * still with no clip — hang-plates must not pass those.
 */
export function hangMissingPlateTimings(
  existing: PlateTiming[] | undefined,
  cuts: Array<Pick<ScratchSongCut, "shotId" | "startSec"> & { durationSec?: number }>,
  extraIds: string[] = [],
): PlateTiming[] {
  const kept = sortPlateTimings(existing || []).filter((t) => !isLeftoverPlateHang(t));
  const have = new Set(kept.map((t) => t.plateId));
  const next = [...kept];
  let sort = next.length;
  const seen = new Set<string>();
  for (const c of cuts) {
    const plateId = (c.shotId || "").trim();
    if (!plateId || have.has(plateId) || seen.has(plateId)) continue;
    seen.add(plateId);
    have.add(plateId);
    const durMs = hangClipDurationMs(c.durationSec);
    const askedStart = secToMs(Number(c.startSec) || 0);
    const overlaps = next.some(
      (t) => askedStart < t.endMs && askedStart + durMs > t.startMs,
    );
    const startMs = !askedStart || overlaps ? nextPlateHangStartMs(next, durMs) : askedStart;
    const endMs = Math.max(startMs + 100, startMs + durMs);
    next.push({
      plateId,
      startMs,
      endMs,
      sortIndex: sort++,
    });
  }
  for (const raw of extraIds) {
    const plateId = (raw || "").trim();
    if (!plateId || have.has(plateId) || seen.has(plateId)) continue;
    seen.add(plateId);
    have.add(plateId);
    const durMs = secToMs(SCRATCH_SONG_SLICE_DEFAULT_SEC);
    const startMs = nextPlateHangStartMs(next, durMs);
    next.push({
      plateId,
      startMs,
      endMs: Math.max(startMs + 100, startMs + durMs),
      sortIndex: sort++,
    });
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
