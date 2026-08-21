/** Run: npx tsx scripts/check-music-video-song.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clampPlateSliceCount,
  isMusicVideoSongJob,
  musicVideoCreditLine,
  MUSIC_VIDEO_SLICE_DEFAULT,
  plateSliceWindows,
  songCutTallyLine,
  tallySongCuts,
  withoutPlateParkedCuts,
  withSkippedSongPlate,
  withoutSkippedSongPlate,
  songDeskPlateIds,
  withSongPlate,
} from "../src/lib/musicVideoSong.ts";
import { emptyStageFarOutStaging } from "../src/lib/emptyStagePlate.ts";
import { isInstrumentalStaging, buildScratchSongLtxMotion } from "../src/lib/mobileImageMotion.ts";
import { songCookStorageKey } from "../src/lib/songCutCook.ts";

const here = dirname(fileURLToPath(import.meta.url));
const tree = readFileSync(join(here, "../src/components/mobile/StudioTree.tsx"), "utf8");
const mPage = readFileSync(join(here, "../src/app/(mobile)/m/page.tsx"), "utf8");
const jobIdRoute = readFileSync(join(here, "../src/app/api/crash/mobile/job/[id]/route.ts"), "utf8");
const jobCreate = readFileSync(join(here, "../src/app/api/crash/mobile/job/route.ts"), "utf8");
const songUi = readFileSync(join(here, "../src/components/mobile/MusicVideoSongCuts.tsx"), "utf8");
const songRoute = readFileSync(join(here, "../src/app/api/crash/mobile/song/route.ts"), "utf8");
const scratchPage = readFileSync(join(here, "../src/app/(mobile)/scratch/page.tsx"), "utf8");
const scratchRoute = readFileSync(join(here, "../src/app/api/crash/mobile/scratch/route.ts"), "utf8");
const attach = readFileSync(join(here, "../src/lib/scratchSongAttach.ts"), "utf8");
const clip = readFileSync(join(here, "../src/lib/mobileScratchClip.ts"), "utf8");
const editor = readFileSync(join(here, "../src/components/mobile/PlateReviewEditor.tsx"), "utf8");

assert.equal(isMusicVideoSongJob({ styleId: "music_video" }), true);
assert.equal(isMusicVideoSongJob({ styleId: "skidmarks" }), false);
assert.equal(musicVideoCreditLine({ artist: "Jack Ghost", songTitle: "Take Me Down" }), "Jack Ghost — Take Me Down");
assert.equal(musicVideoCreditLine({ artist: "Jack Ghost" }), "Jack Ghost");
assert.equal(clampPlateSliceCount(4), 4);
assert.equal(clampPlateSliceCount(99), 16);
assert.equal(MUSIC_VIDEO_SLICE_DEFAULT, 1);
const parked = plateSliceWindows([], 180, 4);
assert.equal(parked.length, 4);
assert.equal(parked[0].durationSec, 15);
assert.equal(parked[3].startSec, 45);
const more = plateSliceWindows(parked, 180, 2);
assert.equal(more[0].startSec, 60);
assert.deepEqual(tallySongCuts([{ status: "done" }, { status: "running" }, { status: "pending" }]), {
  total: 3,
  parked: 1,
  cooking: 1,
  done: 1,
  error: 0,
});
assert.match(songCutTallyLine({ total: 3, parked: 1, cooking: 1, done: 1, error: 0 }), /1\/3 done/);

const kept = withoutPlateParkedCuts(
  [
    { id: "a", plateFile: "p.png", shotId: "s1", startSec: 0, durationSec: 15, status: "done", clipFile: "a.mp4" },
    { id: "b", plateFile: "p.png", shotId: "s1", startSec: 15, durationSec: 15, status: "pending" },
    { id: "c", plateFile: "q.png", shotId: "s2", startSec: 30, durationSec: 15, status: "pending" },
  ],
  "s1",
  "p.png",
);
assert.equal(kept.dropped, 1);
assert.deepEqual(kept.next.map((c) => c.id), ["a", "c"]);

assert.deepEqual(withSkippedSongPlate(["a"], "b"), ["a", "b"]);
assert.deepEqual(withoutSkippedSongPlate(["a", "b"], "a"), ["b"]);
assert.deepEqual(songDeskPlateIds({ cuts: [{ shotId: "a" }] }), ["a"]);
assert.deepEqual(songDeskPlateIds({ songPlateIds: [], cuts: [{ shotId: "a" }] }), []);
assert.deepEqual(withSongPlate(["a"], "b"), ["a", "b"]);

assert.match(songRoute, /remove-plate-parked/);
assert.match(songRoute, /skip-plate/);
assert.match(songUi, /hidePlateFromSong/);
assert.match(songUi, /Leave song/);
assert.match(emptyStageFarOutStaging("A dark stage"), /Far out/);
assert.match(emptyStageFarOutStaging("A dark stage"), /No people/);
assert.match(songRoute, /copyPlaceStillAsEmptyPlate/);
assert.match(songRoute, /Need the place still first/);
assert.match(tree, /Add empty stage/);
assert.match(tree, /songPlates/);
assert.match(songUi, /songDeskPlateIds/);
assert.match(songUi, /m-song-plate-x/);
assert.match(songUi, /m-song-plate-x-inline/);
assert.match(songUi, /Take this plate off the song/);
assert.match(songUi, /m-song-plate-head/);
assert.match(songRoute, /remove-stitch/);
assert.match(songUi, /Drop stitch/);
assert.match(songUi, /Drop parked/);
assert.match(songUi, /SwipeDropRow/);
assert.doesNotMatch(
  songUi,
  /\? "DONE"/,
  "Finished cuts use green text — do not show a DONE chip",
);

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
assert.match(songUi, /Add \$\{n\} × 15s/);
assert.match(songUi, /Set 1 × 15s or 4 × 15s/);
assert.match(songUi, /\$\{n\} × 15s/);
assert.match(songUi, /cookPendingSongCuts/);
assert.match(songUi, /m-song-cut-chip/);
const songCss = readFileSync(join(here, "../src/app/(mobile)/m/mobile.css"), "utf8");
assert.match(songCss, /\.m-swipe-drop-action/);
assert.match(songUi, /now cooking/);
assert.match(editor, /m-song-plate-tally/);
assert.match(tree, /MusicVideoSongCuts/);
assert.match(tree, /isMusicVideoSongJob/);
assert.match(tree, /Edit vibe/);
assert.match(tree, /\{vibeBusy \? "Saving…" : "Save"\}/);
assert.match(tree, /Cancel/);
assert.doesNotMatch(tree, /Keep vibe/);
assert.doesNotMatch(tree, /Leave it/);
assert.match(tree, /method: "PATCH"/);
assert.match(mPage, /placeholder="Artist"/);
assert.match(mPage, /placeholder="Song"/);
assert.match(jobIdRoute, /export async function PATCH/);
assert.match(jobCreate, /artist: body.artist/);
assert.doesNotMatch(tree, /from "fs"/);
assert.match(attach, /styleId === "music_video"/);
assert.match(clip, /skipLipSyncLead/);
assert.match(editor, /songDesk=\{styleId === "music_video"\}/);
assert.match(editor, /action: "add-plate"/);
assert.match(editor, /\{songAdding \? "Adding…" : "Add"\}/);
assert.doesNotMatch(songUi, /Put back/);
assert.match(songRoute, /add-plate/);
assert.match(songUi, /addPlateToSong/);
assert.match(editor, /addPlateToSong/);
assert.match(editor, /Tap Add\. It goes on the song list/);
assert.doesNotMatch(songUi, /Singer plates sing/);
assert.match(songUi, /Tap a plate\. Tap Add/);
assert.match(songUi, /scratch-song-mp3/);
assert.match(songUi, /Song · \{song\.fileName\}/);
assert.match(songCss, /\.scratch-song-mp3/);

console.log("check-music-video-song: ok");
