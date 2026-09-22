/** Run: npx tsx scripts/check-song-auto-lyrics.mjs */
import assert from "node:assert/strict";
import {
  AUTO_LYRIC_LINE_GAP_SEC,
  groupWordsIntoLyricLines,
  lyricsAndCuesFromWords,
} from "../src/lib/songAutoLyrics.ts";
import { lyricLinesFrom } from "../src/lib/musicVideoTrack.ts";

assert.ok(AUTO_LYRIC_LINE_GAP_SEC > 0.2 && AUTO_LYRIC_LINE_GAP_SEC < 1.5);

const words = [
  { word: "Silver", startSec: 31.0, endSec: 31.4 },
  { word: "glass", startSec: 31.45, endSec: 31.8 },
  { word: "rain", startSec: 31.9, endSec: 32.3 },
  // pause → new line
  { word: "on", startSec: 34.0, endSec: 34.2 },
  { word: "the", startSec: 34.25, endSec: 34.4 },
  { word: "window", startSec: 34.5, endSec: 35.0 },
];

const lines = groupWordsIntoLyricLines(words);
assert.equal(lines.length, 2, "pause splits lines");
assert.equal(lines[0].text, "Silver glass rain");
assert.equal(lines[1].text, "on the window");
assert.ok(Math.abs(lines[0].startSec - 31.0) < 0.001);

const built = lyricsAndCuesFromWords(words);
assert.equal(built.lyrics, "Silver glass rain\non the window");
assert.deepEqual(
  built.lyricCues.map((c) => c.lineIndex),
  [0, 1],
);
assert.equal(built.lyricCues[0].atMs, 31000);
assert.equal(built.lyricCues[1].atMs, 34000);

// lyricLinesFrom must agree with our sheet — marquee pins by lineIndex.
const sheetLines = lyricLinesFrom(built.lyrics);
assert.equal(sheetLines.length, built.lyricCues.length);
assert.deepEqual(
  sheetLines.map((l) => l.text),
  built.lines.map((l) => l.text),
);

// Cap long runs without a big pause.
const long = Array.from({ length: 24 }, (_, i) => ({
  word: `w${i}`,
  startSec: i * 0.2,
  endSec: i * 0.2 + 0.15,
}));
const capped = groupWordsIntoLyricLines(long, { maxWords: 10, gapSec: 2 });
assert.ok(capped.length >= 3, "max words forces breaks");
assert.ok(capped.every((l) => l.words.length <= 10));

assert.deepEqual(lyricsAndCuesFromWords([]).lyricCues, []);
assert.equal(lyricsAndCuesFromWords([]).lyrics, "");

// Spacing-only tokens dropped.
assert.equal(
  groupWordsIntoLyricLines([
    { word: "  ", startSec: 0, endSec: 0.1 },
    { word: "Hey", startSec: 0.2, endSec: 0.4 },
  ]).length,
  1,
);

console.log("check-song-auto-lyrics OK");
