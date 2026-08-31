/** Run: npx tsx scripts/check-song-script.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SONG_SCRIPT_FALLBACK_SUNG_MS,
  buildSongScriptText,
  formatSongScript,
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
