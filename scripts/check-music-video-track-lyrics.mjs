/** Run: npx tsx scripts/check-music-video-track-lyrics.mjs */
import assert from "node:assert/strict";
import {
  TRACK_ACID,
  activeLyricLineIndex,
  coverageLine,
  lyricCueFor,
  lyricLinesFrom,
  trackCoverage,
  withLyricCue,
  withoutLyricCue,
} from "../src/lib/musicVideoTrack.ts";

// Canvas cannot resolve CSS vars — the wave drew black on black.
assert.match(TRACK_ACID, /^#[0-9a-f]{6}$/i, "TRACK_ACID must be a real colour");

// Lyrics: blank lines are spacing on screen, never cue targets.
const lines = lyricLinesFrom("one\n\n  two  \n\nthree\n");
assert.equal(lines.length, 3);
assert.deepEqual(lines.map((l) => l.text), ["one", "two", "three"]);
assert.deepEqual(lyricLinesFrom(""), []);

// Pinning is upsert-by-line and stays in clock order.
let cues = withLyricCue([], 2, 8000);
cues = withLyricCue(cues, 0, 1500);
assert.deepEqual(cues.map((c) => c.lineIndex), [0, 2], "cues sort by time");
cues = withLyricCue(cues, 2, 500);
assert.equal(cues.length, 3 - 1, "re-pinning a line replaces, never duplicates");
assert.equal(lyricCueFor(cues, 2)?.atMs, 500);
assert.equal(lyricCueFor(cues, 9), null);
assert.equal(withoutLyricCue(cues, 2).length, 1);

// The line playing now is the last one started, not the nearest.
const timed = [
  { lineIndex: 0, atMs: 0 },
  { lineIndex: 1, atMs: 10_000 },
  { lineIndex: 2, atMs: 20_000 },
];
assert.equal(activeLyricLineIndex(timed, 0), 0);
assert.equal(activeLyricLineIndex(timed, 9_999), 0);
assert.equal(activeLyricLineIndex(timed, 10_000), 1);
assert.equal(activeLyricLineIndex(timed, 19_500), 1, "not the nearest — the last started");
assert.equal(activeLyricLineIndex([], 5000), null);

// Coverage: the holes in the song, before any LTX credit is spent.
const song = 60_000;
const full = trackCoverage(
  [
    { plateId: "a", startMs: 0, endMs: 30_000, sortIndex: 0 },
    { plateId: "b", startMs: 30_000, endMs: 60_000, sortIndex: 1 },
  ],
  song,
);
assert.equal(full.pct, 100);
assert.deepEqual(full.gaps, [], "back-to-back plates leave no gap");
assert.deepEqual(full.overlaps, []);

const holed = trackCoverage(
  [
    { plateId: "a", startMs: 0, endMs: 15_000, sortIndex: 0 },
    { plateId: "b", startMs: 45_000, endMs: 60_000, sortIndex: 1 },
  ],
  song,
);
assert.equal(holed.coveredMs, 30_000);
assert.equal(holed.pct, 50);
assert.deepEqual(holed.gaps, [{ startMs: 15_000, endMs: 45_000 }]);

// A trailing hole counts — the song outlasting the plates is the common one.
const short = trackCoverage([{ plateId: "a", startMs: 0, endMs: 20_000, sortIndex: 0 }], song);
assert.deepEqual(short.gaps, [{ startMs: 20_000, endMs: 60_000 }]);

// Two plates on the same seconds is a real mistake, not silent overwrite.
const clash = trackCoverage(
  [
    { plateId: "a", startMs: 0, endMs: 30_000, sortIndex: 0 },
    { plateId: "b", startMs: 20_000, endMs: 60_000, sortIndex: 1 },
  ],
  song,
);
assert.equal(clash.overlaps.length, 1);
assert.deepEqual(clash.overlaps[0], { startMs: 20_000, endMs: 30_000 });
assert.equal(clash.coveredMs, 60_000, "overlap is not double counted");

// No song, no numbers — never a divide by zero on screen.
assert.equal(trackCoverage([], 0).pct, 0);
assert.equal(coverageLine(trackCoverage([], 0)), "");
assert.match(coverageLine(holed), /0:30 \/ 1:00 covered · 1 gap$/);
assert.match(coverageLine(clash), /1 overlap$/);

console.log("check-music-video-track-lyrics OK");
