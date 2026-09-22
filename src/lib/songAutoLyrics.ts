/**
 * Turn word-level STT timestamps into a lyric sheet + marquee pins.
 *
 * Happy path for /m: drop mp3 → Scribe → this → lyrics text + lyricCues.
 * Marquee reads lyricCues the same way hand-pins did; no paste required.
 *
 * Line breaks: a pause between words longer than LINE_GAP_SEC starts a
 * new line, or we cap a line at MAX_WORDS_PER_LINE so the ribbon stays
 * readable. Cue time is the first word of each line (ms).
 */

import type { LyricCue } from "./musicVideoTrack";
import type { ScribeWord } from "./elevenLabsScribe";

/** Pause between words that starts a new sung line (seconds). */
export const AUTO_LYRIC_LINE_GAP_SEC = 0.55;

/** Soft cap so one sung breath does not become a wall of text. */
export const AUTO_LYRIC_MAX_WORDS_PER_LINE = 10;

export type AutoLyricLine = {
  text: string;
  startSec: number;
  endSec: number;
  words: ScribeWord[];
};

export type AutoLyricsResult = {
  lyrics: string;
  lyricCues: LyricCue[];
  lines: AutoLyricLine[];
  wordCount: number;
};

function cleanWord(raw: string): string {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Group consecutive words into sung lines.
 * Empty/spacing-only tokens are dropped. Words must already be sorted.
 */
export function groupWordsIntoLyricLines(
  words: ScribeWord[],
  opts?: { gapSec?: number; maxWords?: number },
): AutoLyricLine[] {
  const gapSec = opts?.gapSec ?? AUTO_LYRIC_LINE_GAP_SEC;
  const maxWords = opts?.maxWords ?? AUTO_LYRIC_MAX_WORDS_PER_LINE;
  const sorted = [...(words || [])]
    .filter((w) => cleanWord(w.word) && Number.isFinite(w.startSec) && Number.isFinite(w.endSec))
    .sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec);

  if (!sorted.length) return [];

  const lines: AutoLyricLine[] = [];
  let bucket: ScribeWord[] = [sorted[0]!];

  const flush = () => {
    if (!bucket.length) return;
    const text = bucket.map((w) => cleanWord(w.word)).filter(Boolean).join(" ");
    if (!text) {
      bucket = [];
      return;
    }
    lines.push({
      text,
      startSec: bucket[0]!.startSec,
      endSec: bucket[bucket.length - 1]!.endSec,
      words: bucket,
    });
    bucket = [];
  };

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const pause = cur.startSec - prev.endSec;
    const full = bucket.length >= maxWords;
    if (pause > gapSec || full) {
      flush();
    }
    bucket.push(cur);
  }
  flush();
  return lines;
}

/**
 * Build the paste-compatible lyrics string and marquee lyricCues from STT words.
 * lineIndex matches lyricLinesFrom(lyrics) — one cue per non-empty line, no tags.
 */
export function lyricsAndCuesFromWords(
  words: ScribeWord[],
  opts?: { gapSec?: number; maxWords?: number },
): AutoLyricsResult {
  const lines = groupWordsIntoLyricLines(words, opts);
  const lyrics = lines.map((l) => l.text).join("\n");
  const lyricCues: LyricCue[] = lines.map((l, lineIndex) => ({
    lineIndex,
    atMs: Math.max(0, Math.round(l.startSec * 1000)),
  }));
  return {
    lyrics,
    lyricCues,
    lines,
    wordCount: words?.length || 0,
  };
}
