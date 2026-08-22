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

// ── Marquee hold: how long one line owns the strip ──────────────────────────
{
  const { lyricHoldMs } = await import("../src/lib/musicVideoTrack.ts");
  const cues = [
    { lineIndex: 0, atMs: 0 },
    { lineIndex: 1, atMs: 4000 },
    { lineIndex: 2, atMs: 9000 },
  ];
  assert.equal(lyricHoldMs(cues, 0), 4000, "runs until the next pinned line");
  assert.equal(lyricHoldMs(cues, 1), 5000);
  assert.equal(lyricHoldMs(cues, 2), 5200, "last line falls back to a readable hold");
  assert.equal(lyricHoldMs(cues, null), 5200);
  assert.equal(lyricHoldMs([], 0), 5200, "unpinned line falls back");
  // A long instrumental gap must not park one line on screen for a minute.
  assert.equal(
    lyricHoldMs([{ lineIndex: 0, atMs: 0 }, { lineIndex: 1, atMs: 120_000 }], 0),
    9000,
  );
  // Nor flash past unreadably when two pins sit almost on top of each other.
  assert.equal(
    lyricHoldMs([{ lineIndex: 0, atMs: 0 }, { lineIndex: 1, atMs: 300 }], 0),
    2400,
  );
}

// The page carries the marquee only — the sheet stays behind the LYRICS toggle.
{
  const { readFileSync } = await import("node:fs");
  const ui = readFileSync(
    new URL("../src/components/mobile/MusicVideoTrack.tsx", import.meta.url),
    "utf8",
  );
  assert.match(ui, /m-track-marquee/);
  const marqueeAt = ui.indexOf("m-track-marquee");
  const listAt = ui.indexOf("m-track-lyric-list");
  assert.ok(listAt > 0 && listAt < marqueeAt, "the pin list sits inside the LyricsBox pinRail");
  assert.match(ui, /pinRail=/, "pin list is passed into the collapsed lyrics panel");
}

console.log("check-music-video-marquee OK");


// ── Section colours: Intro and Outro, and every type its own colour ─────────
{
  const {
    TRACK_SECTION_LABELS,
    sectionColor,
    sectionTint,
    sectionTitle,
  } = await import("../src/lib/musicVideoTrack.ts");

  const ids = TRACK_SECTION_LABELS.map((o) => o.id);
  assert.ok(ids.includes("intro"), "Intro is a section");
  assert.ok(ids.includes("outro"), "Outro is a section");
  // Song order: a picker that opens on Intro reads the way a track runs.
  assert.equal(ids[0], "intro");
  assert.ok(ids.indexOf("outro") > ids.indexOf("chorus"), "outro sits late in the list");

  // Every section is distinguishable, or a coloured wave says nothing.
  const colors = TRACK_SECTION_LABELS.map((o) => o.color);
  assert.equal(new Set(colors).size, colors.length, "no two sections share a colour");
  for (const c of colors) assert.match(c, /^#[0-9a-f]{6}$/i);

  assert.equal(sectionColor("chorus"), "#ff3ea5");
  assert.equal(sectionColor("CHORUS"), "#ff3ea5", "case does not lose the colour");
  assert.equal(sectionColor("  intro  "), "#35d6d0");
  // A hand-typed label still draws — it must never come back undefined.
  assert.match(sectionColor("whatever Stuie typed"), /^#[0-9a-f]{6}$/i);
  assert.match(sectionColor(""), /^#[0-9a-f]{6}$/i);

  // The wave shows a name, not a code.
  assert.equal(sectionTitle("lead_break"), "Lead break");
  assert.equal(sectionTitle("outro"), "Outro");
  assert.equal(sectionTitle("Chainsaw solo"), "Chainsaw solo", "custom text survives");
  assert.equal(sectionTitle(""), "Section");

  // Bands are the same colour, just quieter.
  assert.equal(sectionTint("intro", 0.13), "rgba(53, 214, 208, 0.13)");
  assert.equal(sectionTint("intro", 5), "rgba(53, 214, 208, 1)", "alpha is clamped");
  assert.equal(sectionTint("intro", -1), "rgba(53, 214, 208, 0)");
}

console.log("check-music-video-sections OK");

// ── The plate bar wears its section's colour ───────────────────────────────
{
  const { PLATE_BAR_NO_SECTION, plateBarColor, sectionAtMs, sectionColor } =
    await import("../src/lib/musicVideoTrack.ts");

  const markers = [
    { id: "m1", label: "intro", startMs: 0, endMs: 20_000 },
    { id: "m2", label: "chorus", startMs: 20_000, endMs: 60_000 },
  ];

  assert.equal(sectionAtMs(markers, 0)?.label, "intro");
  assert.equal(sectionAtMs(markers, 19_999)?.label, "intro");
  assert.equal(sectionAtMs(markers, 20_000)?.label, "chorus", "ends are exclusive");
  assert.equal(sectionAtMs(markers, 90_000), null, "past the last marker is no section");
  assert.equal(sectionAtMs([], 1000), null);
  // A zero-width marker is not a section anything can sit in.
  assert.equal(sectionAtMs([{ id: "z", label: "verse", startMs: 5, endMs: 5 }], 5), null);

  // A plate inside the chorus draws chorus-coloured.
  assert.equal(
    plateBarColor(markers, { startMs: 25_000, endMs: 40_000 }),
    sectionColor("chorus"),
  );
  // One that only clips the chorus edge still belongs to the intro it plays over.
  assert.equal(
    plateBarColor(markers, { startMs: 2000, endMs: 21_000 }),
    sectionColor("intro"),
  );
  // Nothing marked yet: neutral, never a colour that means a section.
  assert.equal(plateBarColor([], { startMs: 0, endMs: 15_000 }), PLATE_BAR_NO_SECTION);
  assert.equal(
    plateBarColor(markers, { startMs: 80_000, endMs: 95_000 }),
    PLATE_BAR_NO_SECTION,
  );
}

console.log("check-music-video-plate-bar OK");
