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
 */

import {
  formatTrackClock,
  lyricLinesFrom,
  lyricTagsFrom,
  parseTrackClock,
  type LyricCue,
  type LyricTag,
} from "./musicVideoTrack";

/** Same ceiling as the marquee hold — a 20s hole is not one sung line. */
export const SONG_SCRIPT_MAX_SUNG_MS = 9000;
/** Leftover shorter than this stays on the sung line. */
export const SONG_SCRIPT_MIN_BREAK_MS = 2000;
/** Last line / sparse pins, when there is no tight cluster to copy. */
export const SONG_SCRIPT_FALLBACK_SUNG_MS = 5200;

export type SongScriptBeatKind = "sing" | "break";

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
}): SongScriptBeat[] {
  const lyrics = String(opts.lyrics || "");
  const sung = lyricLinesFrom(lyrics);
  const byIndex = new Map(sung.map((l) => [l.index, l]));
  const cues = [...(opts.lyricCues || [])]
    .filter((c) => byIndex.has(c.lineIndex) && Number.isFinite(c.atMs) && c.atMs >= 0)
    .sort((a, b) => a.atMs - b.atMs || a.lineIndex - b.lineIndex);
  if (!cues.length) return [];

  const songMs = Math.max(
    cues[cues.length - 1]!.atMs + SONG_SCRIPT_FALLBACK_SUNG_MS,
    Math.round(opts.durationMs || 0),
  );
  const tags = lyricTagsFrom(lyrics);
  const typical = typicalSungMs(cues);
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

    const sungEnd = Math.min(nextAt, cue.atMs + typical);
    const leftover = nextAt - sungEnd;
    if (leftover < SONG_SCRIPT_MIN_BREAK_MS) {
      pushBeat(out, cue.atMs, nextAt, "sing", words);
      continue;
    }

    pushBeat(out, cue.atMs, sungEnd, "sing", words);
    const afterLine = cue.lineIndex;
    const beforeLine = next ? next.lineIndex : Number.POSITIVE_INFINITY;
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

export function buildSongScriptText(opts: {
  lyrics: string;
  lyricCues: LyricCue[];
  durationMs: number;
  previousText?: string;
}): string {
  const built = songScriptBeatsFromLyricsAndMarquee(opts);
  const previous = parseSongScript(opts.previousText || "");
  return formatSongScript(mergeSongScriptWho(built, previous));
}
