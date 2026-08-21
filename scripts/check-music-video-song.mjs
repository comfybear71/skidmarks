/** Run: npx tsx scripts/check-music-video-song.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clampPlateSliceCount,
  isMusicVideoSongJob,
  MUSIC_VIDEO_SLICE_DEFAULT,
  plateSliceWindows,
} from "../src/lib/musicVideoSong.ts";
import { isInstrumentalStaging, buildScratchSongLtxMotion } from "../src/lib/mobileImageMotion.ts";
import { songCookStorageKey } from "../src/lib/songCutCook.ts";

const here = dirname(fileURLToPath(import.meta.url));
const tree = readFileSync(join(here, "../src/components/mobile/StudioTree.tsx"), "utf8");
const songUi = readFileSync(join(here, "../src/components/mobile/MusicVideoSongCuts.tsx"), "utf8");
const songRoute = readFileSync(join(here, "../src/app/api/crash/mobile/song/route.ts"), "utf8");
const scratchPage = readFileSync(join(here, "../src/app/(mobile)/scratch/page.tsx"), "utf8");
const scratchRoute = readFileSync(join(here, "../src/app/api/crash/mobile/scratch/route.ts"), "utf8");
const attach = readFileSync(join(here, "../src/lib/scratchSongAttach.ts"), "utf8");
const clip = readFileSync(join(here, "../src/lib/mobileScratchClip.ts"), "utf8");
const editor = readFileSync(join(here, "../src/components/mobile/PlateReviewEditor.tsx"), "utf8");

assert.equal(isMusicVideoSongJob({ styleId: "music_video" }), true);
assert.equal(isMusicVideoSongJob({ styleId: "skidmarks" }), false);
assert.equal(clampPlateSliceCount(4), 4);
assert.equal(clampPlateSliceCount(99), 16);
assert.equal(MUSIC_VIDEO_SLICE_DEFAULT, 4);
const parked = plateSliceWindows([], 180, 4);
assert.equal(parked.length, 4);
assert.equal(parked[0].durationSec, 15);
assert.equal(parked[3].startSec, 45);
const more = plateSliceWindows(parked, 180, 2);
assert.equal(more[0].startSec, 60);

assert.equal(isInstrumentalStaging("on stage playing saxophone"), true);
assert.equal(isInstrumentalStaging("Facing camera, mouth clear"), false);
const sax = buildScratchSongLtxMotion({
  styleId: "music_video",
  speaker: "Frank",
  staging: "on stage playing saxophone",
});
assert.match(sax, /instrument/i);
assert.doesNotMatch(sax, /singing, lip-sync/);
const sing = buildScratchSongLtxMotion({
  styleId: "music_video",
  speaker: "Frank",
  staging: "Facing camera, mouth clear",
});
assert.match(sing, /singing, lip-sync/);

assert.equal(songCookStorageKey("abc"), "skidmarks.songCook.abc");
assert.match(scratchPage, /cookPendingSongCuts/);
assert.match(scratchPage, /visibilitychange/);
assert.match(scratchRoute, /song-cut-unstick/);
assert.match(songRoute, /action === "assign"/);
assert.match(songRoute, /Does not write job.finalVideoFile/);
assert.match(songUi, /Park \$\{n\} × 15s/);
assert.match(songUi, /cookPendingSongCuts/);
assert.match(tree, /MusicVideoSongCuts/);
assert.match(tree, /isMusicVideoSongJob/);
assert.doesNotMatch(tree, /from "fs"/);
assert.match(attach, /styleId === "music_video"/);
assert.match(clip, /skipLipSyncLead/);
assert.match(editor, /songDesk=\{styleId === "music_video"\}/);

console.log("check-music-video-song: ok");
