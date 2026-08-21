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
} from "../src/lib/scratchSongWindow.ts";

const here = dirname(fileURLToPath(import.meta.url));
const slice = readFileSync(join(here, "../src/lib/scratchSongSlice.ts"), "utf8");
const ui = readFileSync(join(here, "../src/components/scratch/ScratchSongCuts.tsx"), "utf8");
const clip = readFileSync(join(here, "../src/lib/mobileScratchClip.ts"), "utf8");
const route = readFileSync(join(here, "../src/app/api/crash/mobile/scratch/route.ts"), "utf8");
const upload = readFileSync(join(here, "../src/app/api/crash/mobile/beat-audio/upload/route.ts"), "utf8");
const step = readFileSync(join(here, "../src/app/api/crash/mobile/step/route.ts"), "utf8");
const page = readFileSync(join(here, "../src/app/(mobile)/scratch/page.tsx"), "utf8");
const drop = readFileSync(join(here, "../src/lib/scratchSongDrop.ts"), "utf8");
const blob = readFileSync(join(here, "../src/app/api/crash/mobile/beat-audio/song-blob/route.ts"), "utf8");
const fetchErr = readFileSync(join(here, "../src/lib/studioFetchError.ts"), "utf8");

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
assert.match(upload, /scratchSongAttach/);
assert.match(upload, /action === "prepare"/);
assert.match(upload, /action === "attach"/);
assert.match(upload, /registerMobileMediaBlob/);
assert.doesNotMatch(step, /scratchSong/);
assert.doesNotMatch(step, /song-cut-run/);
assert.match(page, /ScratchSongCuts/);
assert.match(page, /song-cut-run/);
assert.match(page, /dropScratchSongViaBlob/);
assert.match(slice, /from "\.\/scratchSongWindow"/);
assert.doesNotMatch(ui, /scratchSongSlice/);
assert.doesNotMatch(ui, /from "fs"/);
assert.match(ui, /Parking…/);
assert.match(ui, / · parked/);
assert.match(ui, /is-just-added/);
assert.doesNotMatch(drop, /from "fs"/);
assert.match(blob, /handleUpload/);
assert.match(fetchErr, /too big for one drop/);

console.log("check-scratch-song-slice: ok");
