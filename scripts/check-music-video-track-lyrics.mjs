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
  assert.match(ui, /Marquee/, "marquee pin tab beside Lyrics");
  assert.match(ui, /m-track-lyric-list/, "pin list under Marquee tab");
  assert.match(ui, /activeLyricLineIndex/, "marquee uses pinned cues when set");
  // The strip carries the line or nothing — never instructions about the line.
  assert.doesNotMatch(ui, /m-track-marquee-idle/, "no placeholder text in the marquee");
  assert.doesNotMatch(ui, /tap a line to pin it at the playhead/i);
  assert.doesNotMatch(ui, /pinRail/, "no pin list in the lyrics paste panel");

  // The lyric line reads above the player, not buried under the section list.
  assert.ok(
    ui.indexOf("m-track-marquee") < ui.indexOf("m-track-toolbar"),
    "marquee sits above the player",
  );
  // Where the plate thumbnails are going.
  // The plates are a strip at the top of the section, above the title, and
  // they are real plates now — not a placeholder.
  assert.match(ui, /m-track-rail/);
  // Plates outrank the section list, so the strip sits above it.
  assert.ok(
    ui.indexOf("m-track-rail") < ui.indexOf('label="Sections"'),
    "the plates strip sits above the sections",
  );

  // Every class the strip uses has a rule. These were lost in an edit once and
  // the plate names rendered as run-on plain text with no tiles.
  const { readFileSync: readCss } = await import("node:fs");
  const railCss = readCss(new URL("../src/app/(mobile)/m/mobile.css", import.meta.url), "utf8");
  for (const cls of [
    "m-track-rail",
    "m-track-rail-scroll",
    "m-track-rail-cell",
    "m-track-rail-label",
    "m-track-rail-empty",
    "m-track-rail-add",
  ]) {
    assert.ok(railCss.includes(`.${cls} `) || railCss.includes(`.${cls}.`) || railCss.includes(`.${cls}{`) || railCss.includes(`.${cls},`), `${cls} has a rule`);
  }
  assert.match(ui, /onOpenPlate/, "tapping a plate opens its prompts");
  assert.match(ui, /onCreatePlate/, "the plus makes the plate itself");
  // One place picker in the app, not two.
  assert.doesNotMatch(ui, /locationCandidates/, "no second place picker inside Plates");
  // Music does not come in 15s blocks — Add section must not assume one.
  assert.doesNotMatch(ui, /startMs \+ 15000/, "no hardwired 15s section");
  assert.doesNotMatch(ui, /m-track-range/, "no range readout beside Add section");
  assert.match(ui, /inputMode="decimal"/, "time boxes get a decimal point");
  // The line rides through as one ribbon; the word at the centre is the lit
  // one, its neighbours smaller and dimmer. Not one word alone, not a whole
  // line sliding past as a block.
  assert.match(ui, /LyricRibbon/);
  assert.match(ui, /m-track-ribbon-word/);
  assert.doesNotMatch(ui, /m-track-marquee-line/);
  assert.doesNotMatch(ui, /m-track-marquee-word/);
  assert.ok(ui.includes("playing && ribbon"), "nothing moves before Play");
  assert.match(ui, /sectionsOpen/, "the section list folds away");
  assert.match(ui, /openSectionId/, "each section row folds");
  assert.match(ui, /platesOnTrackOpen/, "plates on the track fold away");
  assert.match(ui, /<DeskFold/, "long lists share the desk fold");
  assert.match(ui, /Import from lyrics/, "sections import from lyric tags");
  assert.match(ui, /Start here/, "pin section start at playhead");
  assert.match(ui, /Clear sections/, "wipe broken section rows");
  assert.match(ui, /m-track-time-set/, "explicit Set on time boxes");
  assert.match(ui, /sectionPeopleOnPlates/, "who is on the stills in that section");

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
  // A Verse band in the waveform's own acid was invisible against the wave.
  assert.notEqual(sectionColor("verse").toLowerCase(), TRACK_ACID.toLowerCase());
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

  // A backwards typo on end still has a floor; start can grow a tiny band open again.
  assert.equal(withSectionTime(markers, "a", "end", 0, song)[0].endMs, 1000);
  const tiny = [{ id: "a", label: "verse", startMs: 1000, endMs: 2000 }];
  const grown = withSectionTime(tiny, "a", "start", 35_000, song);
  assert.equal(grown[0].startMs, 35_000, "a 1s band is not a dead end");
  assert.ok(grown[0].endMs > 35_000);
  assert.equal(withSectionTime(markers, "a", "end", 999_000, song)[0].endMs, song);
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

  const {
    importSectionMarkersFromLyrics,
    meaningfulLyricTags,
    sectionPeopleOnPlates,
    sectionNeedsStartHere,
    withSectionStartAt,
  } = await import("../src/lib/musicVideoTrack.ts");

  const jackLyrics = [
    "[Instrumental Intro]",
    "[Verse 1] Silver glass",
    "[Chorus] Blow the glass",
    "[Sax break]",
    "[Outro]",
  ].join("\n");
  assert.equal(meaningfulLyricTags(jackLyrics).map((t) => t.label).join(","), "intro,verse,chorus,sax_break,outro");

  const fresh = importSectionMarkersFromLyrics({ lyrics: jackLyrics, durationMs: 268_000 });
  assert.equal(fresh.length, 5);
  assert.equal(fresh[0].startMs, 0);
  assert.ok(fresh[0].endMs < 268_000, "intro does not swallow the whole song");
  assert.ok(fresh[1].startMs > 0, "verse starts where [Verse 1] sits on the sheet");
  assert.ok(fresh[1].endMs > fresh[1].startMs);
  assert.equal(fresh[fresh.length - 1].endMs, 268_000, "outro reaches the end");
  assert.ok(!sectionNeedsStartHere(fresh[1], 268_000), "lyric tags are already timed");

  const split = withSectionStartAt(
    fresh,
    fresh[1].id,
    35_000,
    268_000,
  );
  assert.equal(split[0].endMs, 35_000);
  assert.equal(split[1].startMs, 35_000);

  const jackPlates = [
    { startMs: 0, endMs: 18_100, label: "DRUMMER" },
    { startMs: 18_100, endMs: 35_000, label: "JACK GHOST" },
    { startMs: 35_000, endMs: 101_000, label: "JACK GHOST" },
    { startMs: 133_000, endMs: 154_600, label: "SAXOPHONE" },
    { startMs: 232_000, endMs: 247_500, label: "SAXOPHONE" },
    { startMs: 247_500, endMs: 267_534, label: "GUITAR" },
  ];
  assert.equal(
    sectionPeopleOnPlates({ startMs: 0, endMs: 35_000 }, jackPlates),
    "DRUMMER · JACK GHOST",
  );
  assert.equal(
    sectionPeopleOnPlates({ startMs: 133_000, endMs: 150_000 }, jackPlates),
    "SAXOPHONE",
  );
  assert.equal(
    sectionPeopleOnPlates({ startMs: 232_000, endMs: 247_500 }, jackPlates),
    "SAXOPHONE",
  );
  assert.equal(
    sectionPeopleOnPlates({ startMs: 247_500, endMs: 267_534 }, jackPlates),
    "GUITAR",
  );

  const { FORGOTTEN_LYRICS: forgottenLyrics } = await import(
    "../src/lib/musicVideoGroupPlate.ts",
  );
  const { trackPlayheadScrollLeft: scrollLeft, trackWaveCssWidth: waveW } = await import(
    "../src/lib/musicVideoTrack.ts",
  );
  const forgotten = importSectionMarkersFromLyrics({
    lyrics: forgottenLyrics,
    durationMs: 291_480,
  });
  assert.equal(forgotten.map((m) => m.label).join(","), "intro,verse,chorus,verse,chorus,bridge,outro");
  assert.ok(forgotten[0].endMs < 80_000, "Forgotten intro is not the whole 4:51");
  assert.ok(forgotten.some((m) => m.label === "chorus" && m.startMs > 30_000));

  const inner = waveW(291_480, 400);
  assert.ok(inner > 400, "a 4:51 song is wider than the phone");
  const at30 = scrollLeft({
    playheadMs: 30_000,
    durationMs: 291_480,
    viewW: 400,
    innerW: inner,
  });
  const at90 = scrollLeft({
    playheadMs: 90_000,
    durationMs: 291_480,
    viewW: 400,
    innerW: inner,
  });
  assert.ok(at90 > at30, "the wave slides so the needle stays on screen");
  assert.equal(
    scrollLeft({ playheadMs: 0, durationMs: 291_480, viewW: 400, innerW: inner }),
    0,
  );
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

// ── The song is saved the moment it is dropped ─────────────────────────────
{
  const { readFileSync, existsSync } = await import("node:fs");
  const route = new URL("../src/app/api/crash/mobile/track/song/route.ts", import.meta.url);
  assert.ok(existsSync(route), "there is a route that saves the song on drop");
  const src = readFileSync(route, "utf8");
  assert.match(src, /uploadMobileMedia/, "the mp3 goes to Blob, not just memory");
  assert.match(src, /songFile/, "the job remembers the file name");
  assert.match(src, /export async function GET/, "and it can be streamed back after a refresh");
  assert.match(src, /action === "prepare"/, "big songs prepare a Blob path");
  assert.match(src, /action === "attach"/, "then attach the Blob URL");
  assert.match(src, /registerMobileMediaBlob/, "client Blob drops get a Neon row");

  const drop = readFileSync(
    new URL("../src/components/mobile/MusicVideoStart.tsx", import.meta.url),
    "utf8",
  );
  assert.match(drop, /track\/song/, "dropping an mp3 posts it straight away");
  assert.match(drop, /dropTrackSongViaBlob/, "songs over the Studio POST limit go to Blob");
  assert.match(drop, /arrayBuffer/, "the File is copied before the handle can vanish");

  const blob = readFileSync(
    new URL("../src/lib/scratchSongDrop.ts", import.meta.url),
    "utf8",
  );
  assert.match(blob, /export async function dropTrackSongViaBlob/, "track drop has its own Blob pipe");
  assert.match(blob, /track\/song-blob/, "token route does not need a beat");
  const errSrc = readFileSync(
    new URL("../src/lib/studioFetchError.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    errSrc,
    /requested file or directory could not be found/,
    "the OneDrive/Chrome vanish error is translated",
  );

  const token = new URL("../src/app/api/crash/mobile/track/song-blob/route.ts", import.meta.url);
  assert.ok(existsSync(token), "there is a token route for the track song Blob drop");

  const ui = readFileSync(
    new URL("../src/components/mobile/MusicVideoTrack.tsx", import.meta.url),
    "utf8",
  );
  assert.match(ui, /trackDraft\?\.songFile/, "a reload plays the saved song");
}

console.log("check-music-video-song-saved OK");

// ── The ribbon ────────────────────────────────────────────────────────────
{
  const { readFileSync } = await import("node:fs");
  const ui = readFileSync(
    new URL("../src/components/mobile/MusicVideoTrack.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(
    new URL("../src/app/(mobile)/m/mobile.css", import.meta.url),
    "utf8",
  );

  // The bug that made the marquee invisible: translateX(50%) resolves against
  // the strip's own width, not the stage's, so a long line was pushed right
  // off screen. The offset must be the stage's half-width in pixels.
  assert.doesNotMatch(ui, /translateX\(calc\(50%/, "no percentage offset on the strip");
  assert.match(ui, /halfStageRef/, "the stage's half-width is measured");
  assert.match(ui, /clientWidth \/ 2/);

  // A marquee drifts: position off the song clock every frame, not a step per
  // word with a transition papering over it.
  assert.match(ui, /requestAnimationFrame/);
  assert.match(ui, /audio\.currentTime/, "position comes from the song");
  assert.doesNotMatch(ui, /transitionDuration/);

  // Depth of field — words read as far away, not merely small.
  assert.match(ui, /blur\(/, "words blur with distance");
  assert.match(ui, /el\.style\.opacity/);
  assert.match(ui, /scale\(/);

  // One word at full size and full light. The four fixed steps are gone, and
  // no CSS transition fights the per-frame drift.
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const step of ["is-0", "is-1", "is-2", "is-3"]) {
    assert.ok(!bare.includes(`.m-track-ribbon-word.${step}`), `no fixed step ${step}`);
  }
  assert.ok(
    !/\.m-track-ribbon(-word)?\s*\{[^}]*\btransition\s*:/.test(bare),
    "no CSS transition fighting the drift",
  );

  // A window onto a longer line: clipped, with the ends faded rather than cut.
  const marquee = css.slice(css.indexOf(".m-track-marquee {"), css.indexOf(".m-track-ribbon {"));
  assert.match(marquee, /overflow:\s*hidden/);
  assert.match(marquee, /mask-image/);
}

console.log("check-music-video-ribbon OK");

// ── Brackets are structure, not lyrics ─────────────────────────────────────
{
  const { lyricLinesFrom, lyricTagLabel, lyricTagsFrom, lyricWords, stripLyricTags } =
    await import("../src/lib/musicVideoTrack.ts");

  const sheet = [
    "[Instrumental Intro] [Tension-strummed 12-string, slow dragging bass pulse]",
    "",
    "[Verse 1]Silver glass on the table catching cold blue fire",
    "A tiny church of smoke built on high wire",
    "",
    "[Chorus]Blow the glass clean, watch the white smoke spin",
    "",
    "[Outro]",
    " [Fading 12-string drone, a single slow bass thud dying out]",
  ].join("\n");

  // A direction-only line is not sung, so it never reaches the marquee.
  const lines = lyricLinesFrom(sheet).map((l) => l.text);
  assert.deepEqual(lines, [
    "Silver glass on the table catching cold blue fire",
    "A tiny church of smoke built on high wire",
    "Blow the glass clean, watch the white smoke spin",
  ]);

  // The bracket is written hard against the first word. Splitting before
  // stripping gave "1]Silver" as a word on screen.
  assert.deepEqual(lyricWords("[Verse 1]Silver glass on the table"), [
    "Silver",
    "glass",
    "on",
    "the",
    "table",
  ]);
  assert.equal(stripLyricTags("[Chorus]Blow the glass"), "Blow the glass");
  assert.equal(stripLyricTags("[Outro]"), "");
  assert.equal(stripLyricTags("no tags here"), "no tags here");
  assert.equal(stripLyricTags(""), "");
  // Several tags on one line collapse without leaving double spaces.
  assert.equal(stripLyricTags("[A] [B] word"), "word");

  // The sheet already carries the song's structure.
  const tags = lyricTagsFrom(sheet);
  assert.deepEqual(
    tags.map((t) => t.label),
    ["intro", "custom", "verse", "chorus", "outro", "custom"],
  );
  assert.equal(tags[2].raw, "Verse 1");
  assert.equal(tags[2].lineIndex, 2, "a tag remembers the line it sat on");

  assert.equal(lyricTagLabel("Sax break"), "sax_break");
  assert.equal(lyricTagLabel("Guitar solo"), "lead_break");
  assert.equal(lyricTagLabel("Hook"), "chorus");
  assert.equal(lyricTagLabel("Bridge"), "bridge");
  // A stage direction ending "dying out" is not the outro.
  assert.equal(lyricTagLabel("Fading drone, dying out"), "custom");
  assert.equal(lyricTagLabel("whatever Stuie types"), "custom");
  assert.equal(lyricTagLabel(""), "custom");
}

console.log("check-music-video-lyric-tags OK");

// ── The + makes a plate, in the Plates section ─────────────────────────────
{
  const { readFileSync } = await import("node:fs");
  const ui = readFileSync(
    new URL("../src/components/mobile/MusicVideoTrack.tsx", import.meta.url),
    "utf8",
  );
  const tree = readFileSync(
    new URL("../src/components/mobile/StudioTree.tsx", import.meta.url),
    "utf8",
  );

  // One person, one place, one plate — picked without leaving Plates.
  assert.match(ui, /m-plate-pick/, "the picker lives in the Plates section");
  assert.match(ui, /castOptions/);
  assert.match(ui, /placeOptions/);
  assert.match(ui, /onCreatePlate/);

  // The + is the last thing in the strip, after the plates.
  assert.ok(
    ui.indexOf("m-track-rail-cell") < ui.indexOf("m-track-rail-add"),
    "the + sits to the right of the plates",
  );

  // It no longer bounces the user over to Locations.
  assert.doesNotMatch(ui, /onAddPlate/, "the + does the job itself");
  assert.doesNotMatch(tree, /m-locations-strip.*scrollIntoView/s);

  // No pack yet is not a wall: the + starts the video and holds the pick.
  assert.match(tree, /pendingPlate/, "a pick made before Start is held");
  assert.match(tree, /Start the video & add|onStartMusicVideo/);
  assert.match(ui, /Start the video & add/, "the button says what it will do");

  // One creation path, not two.
  assert.equal(
    (tree.match(/action: "add", sceneId/g) || []).length,
    1,
    "plates are still created through the one existing call",
  );
}

console.log("check-music-video-plate-picker OK");

// ── The × on the song row actually drops the song ──────────────────────────
{
  const { readFileSync } = await import("node:fs");
  const ui = readFileSync(
    new URL("../src/components/mobile/MusicVideoTrack.tsx", import.meta.url),
    "utf8",
  );
  const route = readFileSync(
    new URL("../src/app/api/crash/mobile/track/route.ts", import.meta.url),
    "utf8",
  );

  // Clearing only the browser copy left trackDraft.songFile pointing at the
  // mp3, so the player carried on and the x looked dead.
  const drop = ui.slice(ui.indexOf("async function dropSong"), ui.indexOf("async function dropSong") + 1200);
  assert.match(drop, /clearPendingSong/, "the browser copy goes");
  assert.match(drop, /drop-song/, "and the saved reference goes with it");

  assert.match(route, /action === "drop-song"/);
  // Park, never delete: the mp3 stays in Blob so dropping cannot lose a file.
  const action = route.slice(route.indexOf('action === "drop-song"'), route.indexOf('action === "drop-song"') + 700);
  assert.match(action, /delete draft\.songFile/);
  assert.doesNotMatch(action, /deleteBlob|deleteNeon|rmSync|unlink/, "nothing is deleted");
}

console.log("check-music-video-drop-song OK");

// ── One + for plates, not three ────────────────────────────────────────────
{
  const { readFileSync } = await import("node:fs");
  const editor = readFileSync(
    new URL("../src/components/mobile/PlateReviewEditor.tsx", import.meta.url),
    "utf8",
  );

  // Music video makes plates from the + on the strip above. The hint line and
  // the big empty card underneath were a second and third way to do the same
  // thing, taking a screen's worth of room to say so.
  assert.match(
    editor,
    /musicVideoTrackOwnsEmptyPlates/,
    "music video with no plates hides the duplicate empty hint",
  );
  assert.match(
    editor,
    /isMusicVideoSongJob\(job\) \? null : \(\s*<button/,
    "the big empty + card is for the other shows",
  );
  // The other shows keep both — this is a music-video-only trim.
  assert.match(editor, /No plates yet\. Tap \+ for an empty card/);
  assert.match(editor, /aria-label="Add a new plate"/);

  const attach = readFileSync(
    new URL("../src/lib/scratchSongAttach.ts", import.meta.url),
    "utf8",
  );
  assert.match(attach, /carrierBeatId: opts\.beatId/, "attached song remembers its beat");

  const songAudio = readFileSync(
    new URL("../src/app/api/crash/mobile/song/audio/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(songAudio, /findSongCarrierBeatId/, "cold refresh can stream without deskStory");
}

console.log("check-music-video-one-plus OK");
