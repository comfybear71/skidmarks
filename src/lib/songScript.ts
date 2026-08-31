/**
 * TRACK Script — lyrics + marquee pins become the clip clock.
 *
 * Sung lines take the pin-to-pin window. A long gap is not more singing:
 * the line keeps a typical hold, the leftover is dance / break — no talking.
 * Who sings stays blank until it is typed as [SOUL REBEL] or
 * [CENTRE-LEFT] — one name, one plate. Two names on one row keep the first.
 *
 * This file only builds and reads the text. It does not cook, hang, or
 * Start directing.
 *
 * Never write H3, MATH, GROK, camera, place, or position into this text.
 * Those stay off the script. A later plate pass picks them.
 *
 * Pass 2 — hang from the listen, not the pins: when a Listen report
 * (songVocalListen.ts) is passed in, a pin that lands in real silence is
 * snapped onto the nearest real sound onset (bounded — see
 * SONG_SCRIPT_LISTEN_SNAP_MAX_MS), and a break in a long gap uses the real
 * detected quiet stretch's boundaries instead of the typical-hold guess.
 * Without a listen report this file behaves exactly as before — the
 * pin-to-pin math is the fallback, not replaced.
 */

import {
  formatTrackClock,
  lyricLinesFrom,
  lyricTagsFrom,
  parseTrackClock,
  type LyricCue,
  type LyricTag,
} from "./musicVideoTrack";
import {
  isInSilence,
  longQuietStretches,
  nearestSoundStart,
  type SilenceWindow,
  type SoundWindow,
} from "./songVocalListen";

/** Same ceiling as the marquee hold — a 20s hole is not one sung line. */
export const SONG_SCRIPT_MAX_SUNG_MS = 9000;
/** Leftover shorter than this stays on the sung line. */
export const SONG_SCRIPT_MIN_BREAK_MS = 2000;
/** Last line / sparse pins, when there is no tight cluster to copy. */
export const SONG_SCRIPT_FALLBACK_SUNG_MS = 5200;
/**
 * How far a pin can snap onto the nearest real sound before the snap is
 * dropped. Listen is amplitude-only, not word-level — a wild snap onto some
 * unrelated sound onset is worse than leaving the pin alone.
 */
export const SONG_SCRIPT_LISTEN_SNAP_MAX_MS = SONG_SCRIPT_MAX_SUNG_MS;

export type SongScriptBeatKind = "sing" | "break";

/** The Listen report's sound/silence timeline — the "hang from the listen" input. */
export type SongScriptListenInput = { soundWindows: SoundWindow[] };

function silenceWindowsFrom(soundWindows: SoundWindow[]): SilenceWindow[] {
  return soundWindows
    .filter((w) => w.kind === "silence")
    .map((w) => ({ startMs: w.startMs, endMs: w.endMs }));
}

/**
 * A pin sitting in real silence is snapped onto the nearest real sound
 * onset, bounded by SONG_SCRIPT_LISTEN_SNAP_MAX_MS. A pin already on real
 * sound is left exactly where it is — Listen only corrects what it can show
 * is wrong. Snapped times never move earlier than the previous line's
 * (already snapped) time, so line order can never invert.
 */
function snapCuesToListen(cues: LyricCue[], listen: SongScriptListenInput): LyricCue[] {
  const silences = silenceWindowsFrom(listen.soundWindows);
  let prevAt = 0;
  return cues.map((cue) => {
    let at = cue.atMs;
    if (isInSilence(silences, at)) {
      const nearest = nearestSoundStart(listen.soundWindows, at);
      if (nearest !== null && Math.abs(nearest - at) <= SONG_SCRIPT_LISTEN_SNAP_MAX_MS) {
        at = nearest;
      }
    }
    at = Math.max(at, prevAt);
    prevAt = at;
    return { ...cue, atMs: at };
  });
}

export type SongScriptBeat = {
  startMs: number;
  endMs: number;
  kind: SongScriptBeatKind;
  line: string;
  who: string;
};

const BREAK_LINE = "dance / break — no singing";

/** Sheet tags — not a singer. */
const STRUCTURE_WHO =
  /\b(verse|chorus|hook|intro|outro|bridge|instrumental|solo|break|interlude|percussion|guitar|bass|skank|drone|fade)\b/i;

export function isSongScriptStructureTag(raw: string): boolean {
  return STRUCTURE_WHO.test(String(raw || "").trim());
}

/**
 * One singer from [SOUL REBEL] / [CENTRE-LEFT]. A second [name] on the
 * same row is dropped — two faces on one plate has not worked.
 */
export function oneSongScriptSinger(raw: string): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  const tags = [...text.matchAll(/\[([^\]]+)\]/g)]
    .map((m) => (m[1] || "").trim())
    .filter((t) => t && !isSongScriptStructureTag(t));
  if (tags.length) return tags[0]!;
  const bare = text
    .replace(/\[|\]/g, " ")
    .split(/\s*(?:\/|&|,| and )\s*/i)[0]
    ?.trim() || "";
  if (!bare || isSongScriptStructureTag(bare)) return "";
  return bare.replace(/\s+/g, " ");
}

export function songScriptWhoTag(who: string): string {
  const name = oneSongScriptSinger(who);
  return name ? `[${name}]` : "";
}

export function typicalSungMs(cues: LyricCue[]): number {
  const sorted = [...(cues || [])].sort((a, b) => a.atMs - b.atMs || a.lineIndex - b.lineIndex);
  const gaps: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1]!.atMs - sorted[i]!.atMs;
    if (gap > 0 && gap <= SONG_SCRIPT_MAX_SUNG_MS) gaps.push(gap);
  }
  if (!gaps.length) return SONG_SCRIPT_FALLBACK_SUNG_MS;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)]!;
}

function isSingingSectionTag(raw: string): boolean {
  return /\b(verse|chorus|hook)\b/i.test(String(raw || ""));
}

function breakLineFromTags(tags: LyricTag[]): string {
  const useful = (tags || []).filter((t) => t.raw && !isSingingSectionTag(t.raw));
  const raw = useful[0]?.raw?.trim();
  if (raw) return `${raw} — no singing`;
  return BREAK_LINE;
}

function tagsBetweenLines(tags: LyricTag[], afterLine: number, beforeLine: number): LyricTag[] {
  return (tags || []).filter((t) => t.lineIndex > afterLine && t.lineIndex < beforeLine);
}

function pushBeat(
  out: SongScriptBeat[],
  startMs: number,
  endMs: number,
  kind: SongScriptBeatKind,
  line: string,
): void {
  const start = Math.max(0, Math.round(startMs));
  const end = Math.max(start, Math.round(endMs));
  if (end <= start) return;
  out.push({ startMs: start, endMs: end, kind, line, who: "" });
}

/**
 * One beat per sung pin, plus a dance/break beat in every hole big enough
 * that the next pin is not the same line still going.
 */
export function songScriptBeatsFromLyricsAndMarquee(opts: {
  lyrics: string;
  lyricCues: LyricCue[];
  durationMs: number;
  /** From Listen (Pass 1). Omit to get the old pin-only behavior exactly. */
  listen?: SongScriptListenInput;
}): SongScriptBeat[] {
  const lyrics = String(opts.lyrics || "");
  const sung = lyricLinesFrom(lyrics);
  const byIndex = new Map(sung.map((l) => [l.index, l]));
  let cues = [...(opts.lyricCues || [])]
    .filter((c) => byIndex.has(c.lineIndex) && Number.isFinite(c.atMs) && c.atMs >= 0)
    .sort((a, b) => a.atMs - b.atMs || a.lineIndex - b.lineIndex);
  if (!cues.length) return [];
  if (opts.listen) cues = snapCuesToListen(cues, opts.listen);

  const songMs = Math.max(
    cues[cues.length - 1]!.atMs + SONG_SCRIPT_FALLBACK_SUNG_MS,
    Math.round(opts.durationMs || 0),
  );
  const tags = lyricTagsFrom(lyrics);
  const typical = typicalSungMs(cues);
  const longQuiet = opts.listen ? longQuietStretches(silenceWindowsFrom(opts.listen.soundWindows)) : [];
  const out: SongScriptBeat[] = [];

  const firstAt = cues[0]!.atMs;
  if (firstAt >= SONG_SCRIPT_MIN_BREAK_MS) {
    pushBeat(
      out,
      0,
      firstAt,
      "break",
      breakLineFromTags(tagsBetweenLines(tags, -1, cues[0]!.lineIndex)),
    );
  }

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i]!;
    const line = byIndex.get(cue.lineIndex)!;
    const next = cues[i + 1];
    const nextAt = next ? next.atMs : songMs;
    const gap = Math.max(0, nextAt - cue.atMs);
    const words = line.text;

    if (gap <= SONG_SCRIPT_MAX_SUNG_MS) {
      pushBeat(out, cue.atMs, nextAt, "sing", words);
      continue;
    }

    const afterLine = cue.lineIndex;
    const beforeLine = next ? next.lineIndex : Number.POSITIVE_INFINITY;

    // A real detected quiet stretch in this gap is the actual break — use
    // its own boundaries instead of guessing from the typical sung hold.
    const realQuiet = longQuiet.find((q) => q.startMs > cue.atMs && q.startMs < nextAt);
    if (realQuiet) {
      const sungEnd = Math.max(cue.atMs, realQuiet.startMs);
      pushBeat(out, cue.atMs, sungEnd, "sing", words);
      pushBeat(out, sungEnd, nextAt, "break", breakLineFromTags(tagsBetweenLines(tags, afterLine, beforeLine)));
      continue;
    }

    const sungEnd = Math.min(nextAt, cue.atMs + typical);
    const leftover = nextAt - sungEnd;
    if (leftover < SONG_SCRIPT_MIN_BREAK_MS) {
      pushBeat(out, cue.atMs, nextAt, "sing", words);
      continue;
    }

    pushBeat(out, cue.atMs, sungEnd, "sing", words);
    pushBeat(out, sungEnd, nextAt, "break", breakLineFromTags(tagsBetweenLines(tags, afterLine, beforeLine)));
  }

  return out;
}

export function formatSongScript(beats: SongScriptBeat[]): string {
  return (beats || [])
    .map((b) => {
      const clock = `${formatTrackClock(b.startMs)}–${formatTrackClock(b.endMs)}`;
      const tag = songScriptWhoTag(b.who);
      const head = tag ? `${clock}  ${tag}` : clock;
      return `${head}\n${b.line}`;
    })
    .join("\n\n");
}

const HEADER =
  /^(\d+:\d{1,2}(?:\.\d+)?)\s*[–-]\s*(\d+:\d{1,2}(?:\.\d+)?)\s*(.*)$/;

export function parseSongScript(text: string): SongScriptBeat[] {
  const raw = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return [];
  const chunks = raw.split(/\n{2,}/);
  const out: SongScriptBeat[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const hit = lines[0]!.match(HEADER);
    if (!hit) continue;
    const startMs = parseTrackClock(hit[1]!);
    const endMs = parseTrackClock(hit[2]!);
    if (startMs == null || endMs == null) continue;
    const headWho = oneSongScriptSinger(hit[3] || "");
    const rest = lines.slice(1);
    const onlyTag = rest[0]?.match(/^\[([^\]]+)\]$/);
    const bodyWho = onlyTag && !isSongScriptStructureTag(onlyTag[1] || "")
      ? (onlyTag[1] || "").trim()
      : "";
    const who = headWho || bodyWho;
    const bodyLines = headWho || !bodyWho ? rest : rest.slice(1);
    const body = bodyLines.join(" ").trim();
    const kind: SongScriptBeatKind = /no singing/i.test(body) || /dance\s*\/\s*break/i.test(body)
      ? "break"
      : "sing";
    out.push({
      startMs,
      endMs: Math.max(startMs, endMs),
      kind,
      line: body,
      who,
    });
  }
  return out;
}

export function songScriptHasWho(text: string): boolean {
  return parseSongScript(text).some((b) => b.who.trim().length > 0);
}

function normLine(s: string): string {
  return String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Keep typed names when the marquee is rebuilt. */
export function mergeSongScriptWho(
  built: SongScriptBeat[],
  previous: SongScriptBeat[],
): SongScriptBeat[] {
  const prev = previous || [];
  return (built || []).map((beat) => {
    const sameLine = prev.find(
      (p) => p.kind === beat.kind && p.who.trim() && normLine(p.line) === normLine(beat.line),
    );
    if (sameLine) return { ...beat, who: oneSongScriptSinger(sameLine.who) };
    const overlap = prev.find((p) => {
      if (!p.who.trim()) return false;
      if (p.kind !== beat.kind) return false;
      return p.startMs < beat.endMs && p.endMs > beat.startMs;
    });
    if (overlap) return { ...beat, who: oneSongScriptSinger(overlap.who) };
    return beat;
  });
}

/** Same-singer beats within this gap of each other are one continuous take. */
export const SONG_SCRIPT_MERGE_GAP_MS = 500;

/**
 * Consecutive sung lines the same singer takes are one continuous take, not
 * a new clip per line — Script Go cooks one clip per beat, so leaving a run
 * of same-singer lines as separate beats is what makes a single verse or
 * chorus pass keep switching every few seconds. Only merges once a who is
 * actually typed (a run of still-blank lines is left alone, waiting for the
 * operator); a break, a different singer, or a real gap between lines ends
 * the run. Run this after mergeSongScriptWho, once who is known.
 */
export function mergeAdjacentSameWho(beats: SongScriptBeat[]): SongScriptBeat[] {
  const out: SongScriptBeat[] = [];
  for (const beat of beats) {
    const prev = out[out.length - 1];
    const who = oneSongScriptSinger(beat.who);
    const prevWho = prev ? oneSongScriptSinger(prev.who) : "";
    const canMerge =
      prev &&
      beat.kind === "sing" &&
      prev.kind === "sing" &&
      who &&
      prevWho.toLowerCase() === who.toLowerCase() &&
      beat.startMs - prev.endMs <= SONG_SCRIPT_MERGE_GAP_MS;
    if (canMerge) {
      prev!.endMs = Math.max(prev!.endMs, beat.endMs);
      prev!.line = `${prev!.line} ${beat.line}`.trim();
    } else {
      out.push({ ...beat });
    }
  }
  return out;
}

export function buildSongScriptText(opts: {
  lyrics: string;
  lyricCues: LyricCue[];
  durationMs: number;
  previousText?: string;
  listen?: SongScriptListenInput;
}): string {
  const built = songScriptBeatsFromLyricsAndMarquee(opts);
  const previous = parseSongScript(opts.previousText || "");
  const named = mergeSongScriptWho(built, previous);
  return formatSongScript(mergeAdjacentSameWho(named));
}
