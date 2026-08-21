/** Run: npx tsx scripts/check-scratch-song-slice.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clampSongWindow,
  formatSongClock,
  scheduledSongSeconds,
  songWindowLabel,
  songWindowLeftSec,
  SCRATCH_SONG_SLICE_DEFAULT_SEC,
  SCRATCH_SONG_SLICE_MAX_SEC,
} from "../src/lib/scratchSongSlice.ts";

const here = dirname(fileURLToPath(import.meta.url));
const clip = readFileSync(join(here, "../src/lib/mobileScratchClip.ts"), "utf8");
const route = readFileSync(join(here, "../src/app/api/crash/mobile/scratch/route.ts"), "utf8");
const upload = readFileSync(join(here, "../src/app/api/crash/mobile/beat-audio/upload/route.ts"), "utf8");
const step = readFileSync(join(here, "../src/app/api/crash/mobile/step/route.ts"), "utf8");
const page = readFileSync(join(here, "../src/app/(mobile)/scratch/page.tsx"), "utf8");

assert.equal(SCRATCH_SONG_SLICE_DEFAULT_SEC, 15);
assert.equal(SCRATCH_SONG_SLICE_MAX_SEC, 30);
assert.deepEqual(clampSongWindow(0, 15, 139.4), { startSec: 0, durationSec: 15 });
assert.equal(formatSongClock(139.4), "2:19.4");
const cuts = [{ durationSec: 15 }, { durationSec: 10 }, { durationSec: 30 }, { durationSec: 30 }, { durationSec: 30 }];
assert.equal(scheduledSongSeconds(cuts), 115);
assert.equal(songWindowLeftSec(139.4, cuts), 24.4);
assert.match(songWindowLabel(139.4, cuts), /Song window 2:19.4 \| scheduled 1:55.0 \| left 0:24.4/);

assert.match(clip, /sliceSongMp3/);
assert.match(clip, /buildScratchSongLtxMotion/);
assert.match(route, /action === "song-cut-run"/);
assert.match(route, /action === "song-stitch"/);
assert.match(route, /endPlateFile/);
assert.match(route, /Does not write job.finalVideoFile/);
assert.match(upload, /scratchSong/);
assert.match(upload, /isScratchShotTitle/);
assert.doesNotMatch(step, /scratchSong/);
assert.doesNotMatch(step, /song-cut-run/);
assert.match(page, /ScratchSongCuts/);
assert.match(page, /song-cut-run/);

console.log("check-scratch-song-slice: ok");
