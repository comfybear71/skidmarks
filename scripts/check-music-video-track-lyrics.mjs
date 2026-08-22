/** Run: npx tsx scripts/check-music-video-track-lyrics.mjs */
import assert from "node:assert/strict";
import {
  TRACK_ACID,
  activeLyricLineIndex,
  lyricCueFor,
  lyricLinesFrom,
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
  // The strip carries the line or nothing — never instructions about the line.
  assert.doesNotMatch(ui, /m-track-marquee-idle/, "no placeholder text in the marquee");
  assert.doesNotMatch(ui, /tap a line to pin it at the playhead/i);
  // LYRICS is a paste box and nothing else — no list of lines under it.
  assert.doesNotMatch(ui, /pinRail/, "no pin list in the lyrics panel");
  assert.doesNotMatch(ui, /m-track-lyric-list/, "no lyric list anywhere on the page");

  // The lyric line reads above the player, not buried under the section list.
  assert.ok(
    ui.indexOf("m-track-marquee") < ui.indexOf("m-track-toolbar"),
    "marquee sits above the player",
  );
  // Where the plate thumbnails are going.
  assert.match(ui, /m-track-rail/, "plates rail placeholder is held open");
  // Music does not come in 15s blocks — Add section must not assume one.
  assert.doesNotMatch(ui, /startMs \+ 15000/, "no hardwired 15s section");
  assert.doesNotMatch(ui, /m-track-range/, "no range readout beside Add section");
  assert.match(ui, /inputMode="decimal"/, "time boxes get a decimal point");
  // A marquee moves one word, and only while the song is playing.
  assert.match(ui, /m-track-marquee-word/);
  assert.doesNotMatch(ui, /m-track-marquee-line/, "not a whole line sliding past");
  assert.ok(ui.includes("playing && activeWord"), "nothing moves before Play");
  assert.match(ui, /sectionsOpen/, "the section list folds away");

  // One UI, empty or full. No second screen in front of the track.
  assert.doesNotMatch(ui, /m-track-empty/, "no separate empty-state layout");
  assert.doesNotMatch(ui, /Add the song before you time plates/);
  assert.equal(
    (ui.match(/<SongDropRow/g) || []).length,
    1,
    "exactly one drop box in the music video UI",
  );

  const tree = readFileSync(
    new URL("../src/components/mobile/StudioTree.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(tree, /MusicVideoStart/, "the pre-lock panel is gone");
  assert.match(
    tree,
    /!isMusicVideoSongJob\(job\)/,
    "the paste-a-script panel is for the other shows only",
  );
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

// ── Typed section times: one Intro 0:00–0:35, not two 15s blobs ─────────────
{
  const { nextSectionStartMs, parseTrackClock, withSectionLabel, withSectionTime } =
    await import("../src/lib/musicVideoTrack.ts");

  assert.equal(parseTrackClock("0:35"), 35_000);
  assert.equal(parseTrackClock("35"), 35_000, "bare seconds work");
  assert.equal(parseTrackClock("1:04"), 64_000);
  assert.equal(parseTrackClock("2:07.5"), 127_500);
  assert.equal(parseTrackClock(" 0:35 "), 35_000);
  assert.equal(parseTrackClock(""), null);
  assert.equal(parseTrackClock("banana"), null);
  assert.equal(parseTrackClock("1:75"), null, "75 seconds past a minute is a typo");

  const song = 120_000;
  const markers = [{ id: "a", label: "intro", startMs: 0, endMs: 15_000 }];

  // The whole point: stretch one Intro out to 0:35.
  const stretched = withSectionTime(markers, "a", "end", 35_000, song);
  assert.equal(stretched[0].endMs, 35_000);
  assert.equal(stretched.length, 1, "editing never adds a row");

  // A backwards typo cannot make a section that draws inside out.
  assert.equal(withSectionTime(markers, "a", "end", 0, song)[0].endMs, 1000);
  assert.equal(withSectionTime(markers, "a", "start", 99_000, song)[0].startMs, 14_000);
  // Nor run past the song, or before it starts.
  assert.equal(withSectionTime(markers, "a", "end", 999_000, song)[0].endMs, song);
  assert.equal(withSectionTime(markers, "a", "start", -5000, song)[0].startMs, 0);
  // Other rows are left alone.
  assert.equal(withSectionTime(markers, "nope", "end", 1000, song)[0].endMs, 15_000);

  // A new section starts where the last one ended — end to end, not stacked.
  assert.equal(nextSectionStartMs([]), 0);
  assert.equal(nextSectionStartMs(stretched), 35_000);
  assert.equal(
    nextSectionStartMs([
      { id: "a", label: "intro", startMs: 0, endMs: 35_000 },
      { id: "b", label: "verse", startMs: 35_000, endMs: 70_000 },
    ]),
    70_000,
  );

  assert.equal(withSectionLabel(markers, "a", "Chainsaw solo")[0].label, "Chainsaw solo");
  assert.equal(withSectionLabel(markers, "a", "  ")[0].label, "intro", "blank keeps the name");
}

console.log("check-music-video-section-times OK");

// ── Pasted lyrics time themselves across the song ──────────────────────────
{
  const { evenLyricHoldMs, evenLyricIndexAt } = await import(
    "../src/lib/musicVideoTrack.ts"
  );
  const song = 120_000;

  // Four lines over two minutes: thirty seconds each, in order.
  assert.equal(evenLyricIndexAt(4, 0, song), 0);
  assert.equal(evenLyricIndexAt(4, 29_999, song), 0);
  assert.equal(evenLyricIndexAt(4, 30_000, song), 1);
  assert.equal(evenLyricIndexAt(4, 119_999, song), 3);
  // Past the end holds the last line rather than blanking.
  assert.equal(evenLyricIndexAt(4, song, song), 3);
  assert.equal(evenLyricIndexAt(4, 999_999, song), 3);
  // Nothing to show is null, never index -1 or a crash.
  assert.equal(evenLyricIndexAt(0, 1000, song), null);
  assert.equal(evenLyricIndexAt(4, 1000, 0), null);
  assert.equal(evenLyricIndexAt(4, -1, song), null);

  assert.equal(evenLyricHoldMs(4, song), 30_000 > 12_000 ? 12_000 : 30_000);
  // A wall of lines over a short song still has to be readable, and one line
  // over a long song must not sit there for the whole track.
  assert.equal(evenLyricHoldMs(400, song), 1200);
  assert.equal(evenLyricHoldMs(1, song), 12_000);
  assert.equal(evenLyricHoldMs(0, song), 5200);
  assert.equal(evenLyricHoldMs(4, 0), 5200);
}

console.log("check-music-video-paste-lyrics OK");

// ── Typing a time on a phone keypad ────────────────────────────────────────
{
  const { marqueeWordAt, evenLineStartMs, parseTrackClock } = await import(
    "../src/lib/musicVideoTrack.ts"
  );

  // The decimal keypad has no colon. "0.35" must mean 0:35 — read as 0.35
  // seconds it snapped to the minimum length, which made 0:00-0:01 sections.
  assert.equal(parseTrackClock("0.35"), 35_000);
  assert.equal(parseTrackClock("1.35"), 95_000);
  assert.equal(parseTrackClock("0:35"), 35_000);
  // Bare digits read from the right, like a microwave.
  assert.equal(parseTrackClock("35"), 35_000);
  assert.equal(parseTrackClock("135"), 95_000);
  assert.equal(parseTrackClock("1035"), 635_000);
  assert.equal(parseTrackClock("5"), 5000);
  assert.equal(parseTrackClock("90"), 90_000, "bare seconds may pass a minute");
  // Colon form keeps tenths for a real keyboard.
  assert.equal(parseTrackClock("1:04.5"), 64_500);
  // Rubbish snaps back rather than saving.
  assert.equal(parseTrackClock("1.75"), null, "75 seconds in a minute is a typo");
  assert.equal(parseTrackClock("banana"), null);
  assert.equal(parseTrackClock(""), null);

  // One word at a time, evenly through the line's slot.
  assert.deepEqual(
    marqueeWordAt({ words: 4, lineStartMs: 0, lineHoldMs: 4000, atMs: 0 }),
    { index: 0, holdMs: 1000 },
  );
  assert.equal(marqueeWordAt({ words: 4, lineStartMs: 0, lineHoldMs: 4000, atMs: 999 })?.index, 0);
  assert.equal(marqueeWordAt({ words: 4, lineStartMs: 0, lineHoldMs: 4000, atMs: 1000 })?.index, 1);
  // Past the end holds the last word rather than running off the array.
  assert.equal(marqueeWordAt({ words: 4, lineStartMs: 0, lineHoldMs: 4000, atMs: 99_000 })?.index, 3);
  // Before the line starts there is no word.
  assert.equal(marqueeWordAt({ words: 4, lineStartMs: 5000, lineHoldMs: 4000, atMs: 0 }), null);
  assert.equal(marqueeWordAt({ words: 0, lineStartMs: 0, lineHoldMs: 4000, atMs: 0 }), null);
  // A pass never gets so short it cannot be read.
  assert.ok(
    marqueeWordAt({ words: 40, lineStartMs: 0, lineHoldMs: 1200, atMs: 0 }).holdMs >= 280,
  );

  assert.equal(evenLineStartMs(0, 4, 120_000), 0);
  assert.equal(evenLineStartMs(2, 4, 120_000), 60_000);
  assert.equal(evenLineStartMs(0, 0, 120_000), 0);
}

console.log("check-music-video-marquee-word OK");
