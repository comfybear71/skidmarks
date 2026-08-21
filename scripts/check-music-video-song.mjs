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
  songOrdinal,
  formatSongSpan,
  deskPlateClocks,
  withSongPlate,
  withoutSongPlateAt,
  songDeskRowSlices,
  withSongRowSlice,
  rebuildSongCutsFromDesk,
  cutsForDeskRow,
  deskRowAllDone,
  shortPlateLabel,
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
assert.deepEqual(songDeskPlateIds({ songPlateIds: ["a", "b", "a"] }), ["a", "b", "a"]);
assert.deepEqual(withSongPlate(["a"], "b"), ["a", "b"]);
assert.deepEqual(withSongPlate(["a"], "a"), ["a", "a"]);
assert.deepEqual(withoutSongPlateAt(["a", "b", "a"], 0), ["b", "a"]);
assert.deepEqual(withoutSongPlateAt(["a", "b", "a"], 2), ["a", "b"]);
assert.deepEqual(songDeskRowSlices({ rowSlices: [2] }, ["a", "b"]), [2, 1]);
assert.deepEqual(withSongRowSlice([1, 1]), [1, 1, 1]);
const rebuilt = rebuildSongCutsFromDesk({
  songPlateIds: ["jack", "stage", "jack"],
  rowSlices: [1, 1, 2],
  plateFileByShotId: { jack: "j.png", stage: "s.png" },
  songSec: 180,
  newCutId: () => "cut",
});
assert.equal(rebuilt.length, 4);
assert.equal(rebuilt[0].startSec, 0);
assert.equal(rebuilt[3].startSec, 45);
assert.equal(cutsForDeskRow(rebuilt, [1, 1, 2], 2).length, 2);
assert.equal(deskRowAllDone([{ status: "done", clipFile: "a.mp4" }]), true);
assert.equal(deskRowAllDone([{ status: "pending" }]), false);
assert.match(shortPlateLabel(null, "x", 1), /Plate 1/);
assert.equal(songOrdinal(1), "1st");
assert.equal(songOrdinal(2), "2nd");
assert.equal(songOrdinal(3), "3rd");
assert.equal(formatSongSpan(0, 15), "0:00.0–0:15.0");
assert.equal(formatSongSpan(15, 30), "0:15.0–0:30.0");
const clocks = deskPlateClocks(["a", "b"], [], {}, 180, [1, 1]);
assert.equal(formatSongSpan(clocks[0].startSec, clocks[0].endSec), "0:00.0–0:15.0");
assert.equal(formatSongSpan(clocks[1].startSec, clocks[1].endSec), "0:15.0–0:30.0");
const jackAgain = deskPlateClocks(["jack", "stage", "jack"], rebuilt, {}, 180, [1, 1, 2]);
assert.equal(formatSongSpan(jackAgain[0].startSec, jackAgain[0].endSec), "0:00.0–0:15.0");
assert.equal(formatSongSpan(jackAgain[2].startSec, jackAgain[2].endSec), "0:30.0–1:00.0");
assert.equal(jackAgain[2].slices, 2);

assert.match(songRoute, /remove-plate-parked/);
assert.match(songRoute, /skip-plate/);
assert.match(songRoute, /set-row-slices/);
assert.match(songRoute, /rebuildSongCutsFromDesk/);
assert.match(songRoute, /listIndex/);
assert.match(songRoute, /withoutSongPlateAt/);
assert.match(songUi, /hidePlateFromSong/);
assert.match(songUi, /Leave song/);
assert.match(songUi, /setRowSlices/);
assert.match(songUi, /Take this plate off the song/);
assert.match(emptyStageFarOutStaging("A dark stage"), /Far out/);
assert.match(emptyStageFarOutStaging("A dark stage"), /No people/);
assert.match(songRoute, /copyPlaceStillAsEmptyPlate/);
assert.match(songRoute, /Need the place still first/);
assert.match(tree, /Add empty stage/);
assert.match(tree, /songPlates/);
assert.match(songUi, /songDeskPlateIds/);
assert.match(songUi, /m-song-plate-x/);
assert.match(songUi, /m-song-plate-x-inline/);
assert.match(songUi, /m-song-plate-head/);
assert.match(songRoute, /remove-stitch/);
assert.match(songUi, /Drop stitch/);
assert.doesNotMatch(songUi, /Drop parked/);
assert.doesNotMatch(songUi, /"PARKED"/);
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
assert.doesNotMatch(songUi, /You pick/);
assert.doesNotMatch(songUi, /Set 1 × 15s or 4 × 15s/);
assert.match(songUi, /songOrdinal/);
assert.match(songUi, /m-song-cut-clock/);
assert.match(songUi, /\{n\} × 15s/);
assert.match(songUi, /shortPlateLabel/);
assert.match(songUi, /deskRowAllDone/);
assert.match(songRoute, /put a plate on the list at 1 × 15s/);
assert.match(songUi, /cookPendingSongCuts/);
assert.doesNotMatch(songUi, /m-song-cut-chip/);
const songCss = readFileSync(join(here, "../src/app/(mobile)/m/mobile.css"), "utf8");
assert.match(songCss, /\.m-swipe-drop-action/);
assert.match(songCss, /\.scratch-song-cut\.is-done \.scratch-song-cut-meta/);
assert.match(songUi, /cooking \$\{cookingN\}/);
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
assert.doesNotMatch(songUi, /parkPlate/);
assert.match(editor, /addPlateToSong/);
assert.doesNotMatch(editor, /Tap Add\. It goes on the song list/);
assert.doesNotMatch(editor, /Position this plate/);
assert.doesNotMatch(editor, /Song slices are under/);
assert.doesNotMatch(songUi, /Singer plates sing/);
assert.doesNotMatch(songUi, /Tap a plate\. Tap Add/);
assert.match(songUi, /scratch-song-mp3/);
assert.match(songUi, /Song · \{song\.fileName\}/);
assert.match(songCss, /\.scratch-song-mp3/);
assert.match(songCss, /\.m-song-cut-clock/);
assert.match(songUi, /setRowSlices\(row\.listIndex, n - 1\)/);
assert.match(songUi, /setRowSlices\(row\.listIndex, n \+ 1\)/);
assert.match(songUi, /\n\s+−\n/);
assert.match(songUi, /\n\s+\+\n/);
assert.doesNotMatch(songUi, /Drop parked/);
assert.doesNotMatch(songUi, /ol className="scratch-song-cuts"/);

console.log("check-music-video-song: ok");
