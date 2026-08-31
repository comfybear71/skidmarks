/** Run: npx tsx scripts/check-song-script.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SONG_SCRIPT_FALLBACK_SUNG_MS,
  buildSongScriptText,
  formatSongScript,
  mergeSongScriptWho,
  parseSongScript,
  songScriptBeatsFromLyricsAndMarquee,
  songScriptHasWho,
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

const named = parseSongScript(`0:27–0:31  JACK
The sun is shining bright

0:31–0:35
Everything is feeling right`);
assert.equal(named[0]?.who, "JACK");
assert.equal(named[1]?.who, "");
assert.equal(named[0]?.kind, "sing");
assert.equal(true, songScriptHasWho(`0:27–0:31  JACK\nThe sun is shining bright`));
assert.equal(false, songScriptHasWho(text));

const merged = mergeSongScriptWho(beats, named);
assert.equal(
  merged.find((b) => b.line === "The sun is shining bright")?.who,
  "JACK",
  "rebuild keeps the typed name",
);

const rebuilt = buildSongScriptText({
  lyrics,
  lyricCues: cues,
  durationMs: 263_000,
  previousText: `0:00–0:27  BAND\ndance / break — no singing`,
});
assert.match(rebuilt, /0:00–0:27  BAND/);
assert.match(rebuilt, /I'm a soul rebel, moving with the tide/);

{
  const ui = readFileSync(new URL("../src/components/mobile/MusicVideoStart.tsx", import.meta.url), "utf8");
  const track = readFileSync(new URL("../src/components/mobile/MusicVideoTrack.tsx", import.meta.url), "utf8");
  assert.match(ui, /Fill from marquee/);
  assert.match(ui, /buildSongScriptText/);
  assert.match(ui, /type who sings/);
  assert.match(track, /lyrics=\{job\.lyrics/);
  assert.match(track, /lyricCues=\{lyricCues\}/);
  assert.doesNotMatch(ui, /Start directing/);
}

console.log("check-song-script: ok");
