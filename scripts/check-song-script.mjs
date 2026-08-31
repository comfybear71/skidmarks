/** Run: npx tsx scripts/check-song-script.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SONG_SCRIPT_FALLBACK_SUNG_MS,
  buildSongScriptText,
  formatSongScript,
  mergeAdjacentSameWho,
  mergeSongScriptWho,
  oneSongScriptSinger,
  parseSongScript,
  songScriptBeatsFromLyricsAndMarquee,
  songScriptHasWho,
  songScriptWhoTag,
  typicalSungMs,
} from "../src/lib/songScript.ts";

const lyrics = [
  "[Instrumental intro]",
  "[Clean acoustic guitar skank, minimalist bassline groove]",
  "[Verse 1]",
  "The sun is shining bright",
  "Everything is feeling right",
  "This easy life, where the music never ends",
  "I'm a soul rebel, moving with the tide",
].join("\n");

// lyricLinesFrom keeps original indexes: sung lines sit at 3,4,5,6.
const cues = [
  { lineIndex: 3, atMs: 27_000 },
  { lineIndex: 4, atMs: 31_000 },
  { lineIndex: 5, atMs: 76_000 },
  { lineIndex: 6, atMs: 96_000 },
];

assert.equal(typicalSungMs(cues), 4000, "tight pins set the typical sung hold");
assert.equal(typicalSungMs([]), SONG_SCRIPT_FALLBACK_SUNG_MS);

const beats = songScriptBeatsFromLyricsAndMarquee({
  lyrics,
  lyricCues: cues,
  durationMs: 263_000,
});

assert.equal(beats[0]?.kind, "break");
assert.equal(beats[0]?.startMs, 0);
assert.equal(beats[0]?.endMs, 27_000);
assert.match(beats[0]?.line || "", /Instrumental intro/);
assert.doesNotMatch(beats[0]?.line || "", /talk/i);
assert.equal(beats[0]?.who, "", "who stays blank until typed");

assert.deepEqual(
  beats.filter((b) => b.kind === "sing").map((b) => [b.startMs, b.endMs, b.line]),
  [
    [27_000, 31_000, "The sun is shining bright"],
    [31_000, 35_000, "Everything is feeling right"],
    [76_000, 80_000, "This easy life, where the music never ends"],
    [96_000, 100_000, "I'm a soul rebel, moving with the tide"],
  ],
);

const midBreak = beats.find((b) => b.startMs === 35_000);
assert.ok(midBreak, "1:16 hole after a 4s line is a dance break, not more singing");
assert.equal(midBreak.kind, "break");
assert.equal(midBreak.endMs, 76_000);
assert.match(midBreak.line, /dance \/ break/);

const lastBreak = beats.find((b) => b.startMs === 80_000);
assert.ok(lastBreak);
assert.equal(lastBreak.endMs, 96_000);
assert.equal(lastBreak.kind, "break");

const outro = beats[beats.length - 1];
assert.equal(outro?.kind, "break");
assert.equal(outro?.startMs, 100_000);
assert.equal(outro?.endMs, 263_000, "after the last sung hold, the rest of the song is a break");

assert.equal(
  songScriptBeatsFromLyricsAndMarquee({ lyrics, lyricCues: [], durationMs: 263_000 }).length,
  0,
  "no marquee pins → no script clock",
);

const text = formatSongScript(beats.slice(0, 3));
assert.match(text, /^0:00–0:27\n/);
assert.match(text, /0:27–0:31\nThe sun is shining bright/);
assert.doesNotMatch(text, /  JACK/, "names are not invented");

assert.equal(oneSongScriptSinger("[SOUL REBEL]"), "SOUL REBEL");
assert.equal(oneSongScriptSinger("[SOUL REBEL] [CENTRE-LEFT]"), "SOUL REBEL");
assert.equal(oneSongScriptSinger("[Verse 1]"), "", "sheet tags are not a singer");
assert.equal(songScriptWhoTag("CENTRE-LEFT"), "[CENTRE-LEFT]");

const named = parseSongScript(`0:27–0:31  [SOUL REBEL]
The sun is shining bright

0:31–0:35
Everything is feeling right`);
assert.equal(named[0]?.who, "SOUL REBEL");
assert.equal(named[1]?.who, "");
assert.equal(named[0]?.kind, "sing");
assert.equal(true, songScriptHasWho(`0:27–0:31  [SOUL REBEL]\nThe sun is shining bright`));
assert.equal(false, songScriptHasWho(text));

const two = parseSongScript(`0:27–0:31  [SOUL REBEL] [CENTRE-LEFT]
The sun is shining bright`);
assert.equal(two[0]?.who, "SOUL REBEL", "two names on one row keep the first");

const stacked = parseSongScript(`0:27–0:31
[CENTRE-LEFT]
The sun is shining bright`);
assert.equal(stacked[0]?.who, "CENTRE-LEFT");
assert.equal(stacked[0]?.line, "The sun is shining bright");

const merged = mergeSongScriptWho(beats, named);
assert.equal(
  merged.find((b) => b.line === "The sun is shining bright")?.who,
  "SOUL REBEL",
  "rebuild keeps the typed name",
);

const rebuilt = buildSongScriptText({
  lyrics,
  lyricCues: cues,
  durationMs: 263_000,
  previousText: `0:00–0:27  [CENTRE-LEFT]\ndance / break — no singing`,
});
assert.match(rebuilt, /0:00–0:27  \[CENTRE-LEFT\]/);
assert.match(rebuilt, /I'm a soul rebel, moving with the tide/);
assert.doesNotMatch(rebuilt, /\bH3\b/);
assert.doesNotMatch(rebuilt, /\bMATH\b/);
assert.doesNotMatch(rebuilt, /\bGROK\b/);
assert.doesNotMatch(rebuilt, /camera/i);
assert.doesNotMatch(rebuilt, /three-quarter|over.shoulder/i);

// --- Pass 2: hang from the listen, not the pins ---

{
  // A pin sitting in real silence snaps onto the nearest real sound onset.
  // A pin already on real sound is left exactly where it is.
  const listenCues = [
    { lineIndex: 3, atMs: 500 }, // inside the 0–2000 silence
    { lineIndex: 4, atMs: 2_400 }, // already on real sound — must not move
  ];
  const soundWindows = [
    { startMs: 0, endMs: 2_000, kind: "silence" },
    { startMs: 2_000, endMs: 20_000, kind: "sound" },
  ];
  const snapped = songScriptBeatsFromLyricsAndMarquee({
    lyrics,
    lyricCues: listenCues,
    durationMs: 20_000,
    listen: { soundWindows },
  });
  const line1 = snapped.find((b) => b.line === "The sun is shining bright");
  const line2 = snapped.find((b) => b.line === "Everything is feeling right");
  assert.equal(line1?.startMs, 2_000, "pin in real silence snaps to the real sound onset");
  assert.equal(line2?.startMs, 2_400, "pin already on real sound is left alone");
}

{
  // A real detected quiet stretch inside a long gap becomes the break —
  // its own boundaries, not the typical-sung-hold guess.
  const soundWindows = [
    { startMs: 0, endMs: 40_000, kind: "sound" },
    { startMs: 40_000, endMs: 70_000, kind: "silence" }, // the real instrumental break
    { startMs: 70_000, endMs: 263_000, kind: "sound" },
  ];
  const listenBeats = songScriptBeatsFromLyricsAndMarquee({
    lyrics,
    lyricCues: cues,
    durationMs: 263_000,
    listen: { soundWindows },
  });
  const realBreak = listenBeats.find((b) => b.startMs === 40_000);
  assert.ok(realBreak, "break starts at the real quiet stretch, not the typical-hold guess (35,000)");
  assert.equal(realBreak.kind, "break");
  assert.equal(realBreak.endMs, 76_000, "break runs to the next pin");
  const sungBeforeBreak = listenBeats.find((b) => b.line === "Everything is feeling right");
  assert.equal(sungBeforeBreak?.endMs, 40_000, "sung hold shortens to where the real quiet actually starts");
}

{
  // Without a listen report, behavior is exactly the old pin-only math —
  // Pass 2 is additive, never a silent behavior change.
  const noListen = songScriptBeatsFromLyricsAndMarquee({ lyrics, lyricCues: cues, durationMs: 263_000 });
  assert.deepEqual(noListen, beats, "omitting `listen` reproduces the pin-only beats exactly");
}

console.log("check-song-script: Pass 2 (listen) ok");

// --- mergeAdjacentSameWho: one continuous take per singer, not a clip per line ---

{
  const rows = [
    { startMs: 0, endMs: 4_000, kind: "sing", line: "line one", who: "SOUL REBEL" },
    { startMs: 4_000, endMs: 8_000, kind: "sing", line: "line two", who: "SOUL REBEL" },
    { startMs: 8_000, endMs: 12_000, kind: "sing", line: "line three", who: "SOUL REBEL" },
  ];
  const merged = mergeAdjacentSameWho(rows);
  assert.equal(merged.length, 1, "three consecutive same-singer lines become one beat");
  assert.equal(merged[0].startMs, 0);
  assert.equal(merged[0].endMs, 12_000);
  assert.equal(merged[0].line, "line one line two line three", "merged beat keeps every line's words");
  assert.equal(merged[0].who, "SOUL REBEL");
}

{
  // A different singer, a break, and a real gap all stop the run.
  const rows = [
    { startMs: 0, endMs: 4_000, kind: "sing", line: "a", who: "SOUL REBEL" },
    { startMs: 4_000, endMs: 8_000, kind: "sing", line: "b", who: "CENTRE-LEFT" },
    { startMs: 8_000, endMs: 12_000, kind: "sing", line: "c", who: "CENTRE-LEFT" },
    { startMs: 12_000, endMs: 16_000, kind: "break", line: "dance / break — no singing", who: "" },
    { startMs: 16_000, endMs: 20_000, kind: "sing", line: "d", who: "CENTRE-LEFT" },
    { startMs: 30_000, endMs: 34_000, kind: "sing", line: "e", who: "CENTRE-LEFT" }, // real gap before it
  ];
  const merged = mergeAdjacentSameWho(rows);
  assert.equal(merged.length, 5, "different singer, a break, and a real gap each stay separate");
  assert.equal(merged[0].who, "SOUL REBEL");
  assert.equal(merged[1].line, "b c", "the two CENTRE-LEFT lines before the break merge");
  assert.equal(merged[1].endMs, 12_000);
  assert.equal(merged[2].kind, "break");
  assert.equal(merged[3].line, "d");
  assert.equal(merged[4].line, "e", "a real 10s gap after the break keeps the last line on its own");
}

{
  // Still-blank who is left alone — merging strangers' lines would invent a
  // singer nobody typed.
  const rows = [
    { startMs: 0, endMs: 4_000, kind: "sing", line: "a", who: "" },
    { startMs: 4_000, endMs: 8_000, kind: "sing", line: "b", who: "" },
  ];
  const merged = mergeAdjacentSameWho(rows);
  assert.equal(merged.length, 2, "untyped lines never merge on their own");
}

{
  // The real-world case: buildSongScriptText keeps a hand-typed run merged
  // across a rebuild, instead of a fresh Fill re-fragmenting it back into
  // one short beat per lyric line.
  const previousText = `0:27–0:35  [CENTRE-LEFT]
Everything is feeling right`;
  const rebuilt = buildSongScriptText({ lyrics, lyricCues: cues, durationMs: 263_000, previousText });
  const earlyBeats = parseSongScript(rebuilt).filter((b) => b.startMs < 35_000);
  assert.equal(
    earlyBeats.length,
    2,
    "a rebuild does not re-fragment a hand-typed singer run back into one beat per line",
  );
  const merged = earlyBeats.find((b) => b.kind === "sing");
  assert.ok(merged, "the two opening verse lines are one sing beat");
  assert.equal(merged.startMs, 27_000);
  assert.equal(merged.endMs, 35_000);
  assert.equal(merged.who, "CENTRE-LEFT");
  assert.equal(merged.line, "The sun is shining bright Everything is feeling right");
}

console.log("check-song-script: mergeAdjacentSameWho ok");

// --- Auto-who: one or two named speakers means nobody has to type [NAME] ---

{
  // Every sung/break beat here sits under [Verse 1] — one speaker means
  // there is no ambiguity, so it is filled in without being asked.
  const oneSpeaker = songScriptBeatsFromLyricsAndMarquee({
    lyrics,
    lyricCues: cues,
    durationMs: 263_000,
    speakers: ["SOUL REBEL"],
  });
  assert.ok(oneSpeaker.length, "still builds beats");
  assert.ok(
    oneSpeaker.every((b) => b.who === "SOUL REBEL"),
    "one named speaker auto-fills every beat, sung and break alike",
  );

  const twoSpeakers = songScriptBeatsFromLyricsAndMarquee({
    lyrics,
    lyricCues: cues,
    durationMs: 263_000,
    speakers: ["SOUL REBEL", "CENTRE-LEFT"],
  });
  assert.ok(
    twoSpeakers.every((b) => b.who === "SOUL REBEL"),
    "verse/break rows default to the lead when there are two speakers",
  );

  const threeSpeakers = songScriptBeatsFromLyricsAndMarquee({
    lyrics,
    lyricCues: cues,
    durationMs: 263_000,
    speakers: ["SOUL REBEL", "CENTRE-LEFT", "THIRD"],
  });
  assert.ok(
    threeSpeakers.every((b) => b.who === ""),
    "three-plus speakers is genuinely ambiguous — who stays blank, same as before",
  );

  const noSpeakers = songScriptBeatsFromLyricsAndMarquee({
    lyrics,
    lyricCues: cues,
    durationMs: 263_000,
  });
  assert.deepEqual(noSpeakers, beats, "omitting speakers reproduces the old blank-who beats exactly");
}

{
  // A [Chorus] section with two speakers alternates per row — backing leads
  // the chorus, same convention revolveChorusBeats already expects.
  const chorusLyrics = [
    "[Verse 1]",
    "verse line one",
    "[Chorus]",
    "chorus line one",
    "chorus line two",
    "chorus line three",
    "chorus line four",
  ].join("\n");
  const chorusCues = [
    { lineIndex: 1, atMs: 0 },
    { lineIndex: 3, atMs: 4_000 },
    { lineIndex: 4, atMs: 8_000 },
    { lineIndex: 5, atMs: 12_000 },
    { lineIndex: 6, atMs: 16_000 },
  ];
  const chorusBeats = songScriptBeatsFromLyricsAndMarquee({
    lyrics: chorusLyrics,
    lyricCues: chorusCues,
    durationMs: 20_000,
    speakers: ["SOUL REBEL", "CENTRE-LEFT"],
  });
  const sung = chorusBeats.filter((b) => b.kind === "sing");
  assert.deepEqual(
    sung.map((b) => [b.line, b.who]),
    [
      ["verse line one", "SOUL REBEL"],
      ["chorus line one", "CENTRE-LEFT"],
      ["chorus line two", "SOUL REBEL"],
      ["chorus line three", "CENTRE-LEFT"],
      ["chorus line four", "SOUL REBEL"],
    ],
    "verse stays lead; chorus alternates starting with backing",
  );
}

{
  // A hand-typed name still wins over the auto default on a rebuild — the
  // operator correcting the sheet is never silently overwritten.
  const previousText = `0:27–0:31  [CENTRE-LEFT]
The sun is shining bright`;
  const rebuilt = buildSongScriptText({
    lyrics,
    lyricCues: cues,
    durationMs: 263_000,
    previousText,
    speakers: ["SOUL REBEL", "CENTRE-LEFT"],
  });
  const parsed = parseSongScript(rebuilt);
  assert.equal(
    parsed.find((b) => b.line === "The sun is shining bright")?.who,
    "CENTRE-LEFT",
    "typed override beats the auto-filled lead",
  );
  assert.equal(
    parsed.find((b) => b.line === "Everything is feeling right")?.who,
    "SOUL REBEL",
    "untouched rows still get the auto default",
  );
}

console.log("check-song-script: auto-who from section tags ok");

{
  const ui = readFileSync(new URL("../src/components/mobile/MusicVideoStart.tsx", import.meta.url), "utf8");
  const track = readFileSync(new URL("../src/components/mobile/MusicVideoTrack.tsx", import.meta.url), "utf8");
  const scriptBox = ui.slice(ui.indexOf("export function ScriptBox"), ui.indexOf("export function SongDropRow"));
  assert.match(scriptBox, /Fill from marquee/);
  assert.match(scriptBox, /Fill from listen \+ marquee/, "Fill relabels once Listen has run");
  assert.match(scriptBox, /listen:\s*listenReport/, "Fill from marquee threads the listen report through");
  assert.match(scriptBox, />\s*Save\s*</);
  assert.doesNotMatch(scriptBox, /1200/, "Script does not auto-save on a timer");
  assert.doesNotMatch(scriptBox, /onBlur/, "Script does not save on tap-out");
  assert.match(ui, /buildSongScriptText/);
  assert.match(ui, /\[SOUL REBEL\] or \[CENTRE-LEFT\]/);
  assert.match(ui, /Do not put H3 \/ MATH \/ GROK \/ camera \/ place here/);
  assert.match(track, /lyrics=\{job\.lyrics/);
  assert.match(track, /lyricCues=\{lyricCues\}/);
  assert.doesNotMatch(ui, /Start directing/);
}

console.log("check-song-script: ok");
