/** Run: npx tsx scripts/check-music-video-start.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMusicVideoStartStory,
  defaultMusicVideoBandStaging,
  formatSongLength,
  isMp3File,
  lyricLineCount,
  lyricsPanelOpensAt,
  parkPendingSong,
  peekPendingSong,
  songChipName,
  takePendingSong,
} from "../src/lib/musicVideoStart.ts";

const here = dirname(fileURLToPath(import.meta.url));
const tree = readFileSync(join(here, "../src/components/mobile/StudioTree.tsx"), "utf8");
const mPage = readFileSync(join(here, "../src/app/(mobile)/m/page.tsx"), "utf8");
const mvStart = readFileSync(join(here, "../src/components/mobile/MusicVideoStart.tsx"), "utf8");
const mvTrack = readFileSync(join(here, "../src/components/mobile/MusicVideoTrack.tsx"), "utf8");
const songRoute = readFileSync(join(here, "../src/app/api/crash/mobile/song/route.ts"), "utf8");
const startRoute = readFileSync(
  join(here, "../src/app/api/crash/mobile/music-video/start/route.ts"),
  "utf8",
);
const songCuts = readFileSync(join(here, "../src/components/mobile/MusicVideoSongCuts.tsx"), "utf8");
const mobileCss = readFileSync(join(here, "../src/app/(mobile)/m/mobile.css"), "utf8");

assert.equal(isMp3File({ name: "track.mp3", type: "" }), true);
assert.equal(isMp3File({ name: "track.wav", type: "audio/mpeg" }), true);
assert.equal(formatSongLength(267), "4:27");
assert.equal(lyricLineCount("a\n\nb\n"), 2);
assert.equal(lyricsPanelOpensAt(""), false);
assert.equal(lyricsPanelOpensAt("hello"), true);
assert.match(songChipName("My Song Title.mp3"), /My Song Title/);

parkPendingSong("job_a", { file: { name: "a.mp3", size: 1, type: "audio/mpeg" }, durationSec: 120 });
assert.ok(peekPendingSong("job_a"));
assert.equal(takePendingSong("job_a")?.durationSec, 120);
assert.equal(peekPendingSong("job_a"), null);

const staging = defaultMusicVideoBandStaging("SAXOPHONE", "A dark stage");
assert.match(staging, /half turned away/i);
assert.match(staging, /NO SINGING MOUTH NOT MOVE/);
assert.doesNotMatch(staging, /facing camera/i);

const built = buildMusicVideoStartStory({
  id: "mgen_test",
  styleId: "music_video",
  folderName: "",
  prompt: "SKIDS_MUSIC_TV",
  artist: "Jack Ghost",
  songTitle: "Take Me Down",
  targetDurationSec: 0,
  secondsPerShot: 15,
  phase: "location_images",
  speakers: ["JACK GHOST", "DRUMMER"],
  roster: [],
  scenes: [{ id: "scene_x", placeName: "A dark stage at a saloon bar" }],
  castCandidates: {},
  locationCandidates: {},
  shots: [],
  clips: [],
  finalVideoFile: "",
  error: "",
  createdAt: "",
  updatedAt: "",
});
assert.equal(built.story.scenes.length, 1);
assert.equal(built.story.scenes[0].shots.length, 2);
assert.equal(built.story.scenes[0].id, "scene_x");
assert.equal(built.story.scenes[0].shots[0].beats[0].text, "");
assert.match(built.title, /Jack Ghost/);

const solo = buildMusicVideoStartStory({
  id: "mgen_babe_test",
  styleId: "music_video",
  folderName: "",
  prompt: "Spit Roast",
  artist: "Babe",
  songTitle: "Spit Roast",
  targetDurationSec: 0,
  secondsPerShot: 15,
  phase: "location_images",
  speakers: ["Babe"],
  roster: [],
  scenes: [{ id: "scene_babe", placeName: "Late bar corner" }],
  castCandidates: {},
  locationCandidates: {},
  shots: [],
  clips: [],
  finalVideoFile: "",
  error: "",
  createdAt: "",
  updatedAt: "",
});
assert.equal(solo.story.scenes[0].shots.length, 2);
assert.match(solo.story.scenes[0].shots[0].title, /three-quarter/i);
assert.match(solo.story.scenes[0].shots[1].title, /over shoulder/i);
assert.match(solo.story.scenes[0].shots[0].staging, /Three-quarter/);
assert.match(solo.story.scenes[0].shots[1].staging, /over the shoulder/i);
assert.doesNotMatch(solo.story.scenes[0].shots[0].staging, /blood crimson/);
assert.doesNotMatch(solo.story.scenes[0].shots[1].staging, /muted trumpet/);

assert.match(startRoute, /buildMusicVideoStartStory/);
assert.match(startRoute, /carrierBeatId/);
assert.match(songRoute, /action === "set-lyrics"/);
assert.match(songRoute, /action === "set-song-script"/);
assert.match(mvStart, /export function ScriptBox/);
assert.match(mvStart, /set-song-script/);
assert.match(mvStart, /attachParkedSongToBeat/);
assert.match(mvStart, /attachTakenPendingSong/);
// "Start the video" is a button inside the one track UI now, not a panel of
// its own — the music video looks the same empty or full.
assert.match(mvTrack, /Start the video/);
assert.doesNotMatch(mvStart, /export function MusicVideoStart/);
assert.match(songCuts, /attachParkedSongToBeat/);
assert.match(songCuts, /takePendingSong/);
assert.match(tree, /onStartMusicVideo/);
assert.match(mPage, /music-video\/start/);
assert.match(mPage, /attachTakenPendingSong/);
assert.match(mobileCss, /\.m-mv-drop/);
assert.match(mobileCss, /\.m-mv-lyrics/);
assert.match(mobileCss, /\.m-track-song-head/);

{
  // The paste-a-script panel belongs to the other shows only.
  const scriptBlock = tree.slice(tree.indexOf('placeholder="EPISODE:'));
  assert.match(scriptBlock, /AI the story/);
  assert.match(tree, /!isMusicVideoSongJob\(job\)/);
  assert.doesNotMatch(mvTrack, /AI the story/);
}

console.log("check-music-video-start: ok");
