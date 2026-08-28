/** Run: npx tsx scripts/check-mobile-episode-clips.mjs */
import assert from "node:assert/strict";
import {
  isEpisodeClipPlanError,
  planBinFailedEpisodeClips,
  planDismissEpisodeClip,
  planParkClipsUnderPlate,
  planRemoveEpisodeClipTake,
} from "../src/lib/mobileEpisodeClips.ts";
import { stackedClipFiles } from "../src/lib/mobilePlateClips.ts";

function clip(partial) {
  return {
    beatId: "beat-1",
    shotId: "shot-1",
    sceneId: "scene-1",
    clipFile: "",
    priorClipFiles: [],
    clipStatus: "pending",
    error: "",
    speaker: "JO",
    line: "oi",
    voiceFile: "voice_jo.mp3",
    ...partial,
  };
}

const stacked = clip({
  clipFile: "clip_b.mp4",
  priorClipFiles: ["clip_a.mp4"],
  clipStatus: "done",
});
const take = planRemoveEpisodeClipTake([stacked], "beat-1", "clip_b.mp4");
assert.equal(isEpisodeClipPlanError(take), false);
assert.deepEqual(stackedClipFiles(take.next[0]), ["clip_a.mp4"]);
assert.deepEqual(take.filesToPark, ["clip_b.mp4"]);
assert.equal(take.next[0].clipStatus, "done");

const last = planRemoveEpisodeClipTake(take.next, "beat-1", "clip_a.mp4");
assert.equal(isEpisodeClipPlanError(last), false);
assert.equal(last.next[0].clipFile, "");
assert.equal(last.next[0].clipStatus, "pending");

const running = planRemoveEpisodeClipTake(
  [clip({ clipFile: "run.mp4", clipStatus: "running" })],
  "beat-1",
  "run.mp4",
);
assert.equal(isEpisodeClipPlanError(running), true);
assert.equal(running.status, 409);

const missing = planRemoveEpisodeClipTake([stacked], "beat-1", "nope.mp4");
assert.equal(isEpisodeClipPlanError(missing), true);
assert.equal(missing.status, 404);

const failedEmpty = clip({
  clipStatus: "error",
  error: "Comfy timed out",
});
const dismissed = planDismissEpisodeClip([failedEmpty], "beat-1");
assert.equal(isEpisodeClipPlanError(dismissed), false);
assert.equal(dismissed.next[0].clipStatus, "pending");
assert.equal(dismissed.next[0].error, "");
assert.equal(dismissed.clearedEpisodeErrors, true);
assert.deepEqual(dismissed.filesToPark, []);

const failedKeepPrior = clip({
  clipFile: "good.mp4",
  clipStatus: "error",
  error: "second take failed",
});
const keep = planDismissEpisodeClip([failedKeepPrior], "beat-1");
assert.equal(isEpisodeClipPlanError(keep), false);
assert.equal(keep.next[0].clipFile, "good.mp4");
assert.equal(keep.next[0].clipStatus, "done");
assert.equal(keep.next[0].error, "");

const notFailed = planDismissEpisodeClip([stacked], "beat-1");
assert.equal(isEpisodeClipPlanError(notFailed), true);
assert.equal(notFailed.status, 400);

const episodeFailed = clip({
  beatId: "ep",
  shotId: "ep-shot",
  clipStatus: "error",
  error: "LTX failed",
});
const scratchFailed = clip({
  beatId: "scratch",
  shotId: "scratch-shot",
  clipStatus: "error",
  error: "Siray failed",
});
const binned = planBinFailedEpisodeClips(
  [episodeFailed, scratchFailed],
  (c) => c.shotId !== "scratch-shot",
);
assert.equal(binned.next[0].clipStatus, "pending");
assert.equal(binned.next[0].error, "");
assert.equal(binned.next[1].clipStatus, "error");
assert.equal(binned.next[1].error, "Siray failed");
assert.equal(binned.clearedEpisodeErrors, true);

const noop = planBinFailedEpisodeClips([stacked]);
assert.equal(noop.next[0].clipStatus, "done");
assert.equal(noop.clearedEpisodeErrors, true);

const table = clip({
  beatId: "table-1",
  shotId: "table-shot",
  clipFile: "table_a.mp4",
  priorClipFiles: ["table_b.mp4"],
  clipStatus: "done",
});
const other = clip({
  beatId: "bar-1",
  shotId: "bar-shot",
  clipFile: "bar.mp4",
  clipStatus: "done",
});
const parkedPlate = planParkClipsUnderPlate([table, other], "table-shot", ["table-1"]);
assert.equal(isEpisodeClipPlanError(parkedPlate), false);
assert.equal(parkedPlate.next.length, 1);
assert.equal(parkedPlate.next[0].beatId, "bar-1");
assert.deepEqual(parkedPlate.filesToPark.sort(), ["table_a.mp4", "table_b.mp4"].sort());

const runningPlate = planParkClipsUnderPlate(
  [clip({ beatId: "run", shotId: "table-shot", clipFile: "run.mp4", clipStatus: "running" })],
  "table-shot",
  ["run"],
);
assert.equal(isEpisodeClipPlanError(runningPlate), true);
assert.equal(runningPlate.status, 409);


import { planParkDeskClipTake } from "../src/lib/parkDeskClip.ts";
import { clipsForStillsDesk } from "../src/lib/mobilePlateClips.ts";

const song = {
  fileName: "give-me-something.mp3",
  durationSec: 180,
  sliceStartSec: 0,
  sliceDurationSec: 24,
  plateTimings: [{ plateId: "jack", startMs: 0, endMs: 24000, sortIndex: 0 }],
  cuts: [
    {
      id: "cut-jack",
      plateFile: "jack.png",
      shotId: "jack",
      startSec: 0,
      durationSec: 24,
      clipFile: "01_JACK_GHOST.mp4",
      status: "done",
      error: "",
    },
    {
      id: "cut-fail",
      plateFile: "p6.png",
      shotId: "s6",
      startSec: 90,
      durationSec: 15,
      clipFile: "",
      status: "error",
      error: "failed",
    },
    {
      id: "cut-run",
      plateFile: "p7.png",
      shotId: "s7",
      startSec: 105,
      durationSec: 15,
      clipFile: "",
      status: "running",
      error: "",
    },
  ],
};
const deskClip = clip({
  beatId: "beat-jack",
  shotId: "jack",
  clipFile: "01_JACK_GHOST.mp4",
  clipStatus: "done",
});
const both = planParkDeskClipTake({
  clips: [deskClip],
  song,
  beatId: "beat-jack",
  fileName: "01_JACK_GHOST.mp4",
});
assert.equal(isEpisodeClipPlanError(both), false);
assert.equal(both.next[0].clipFile, "");
assert.equal(both.next[0].clipStatus, "pending");
assert.equal(both.nextSong.cuts[0].clipFile, "");
assert.equal(both.nextSong.cuts[0].status, "pending");
assert.equal(both.nextSong.cuts[1].status, "error");
assert.equal(both.nextSong.cuts[2].status, "pending");
assert.equal(both.stoppedCook, true);
assert.deepEqual(both.filesToPark, ["01_JACK_GHOST.mp4"]);
assert.equal(both.nextSong.plateTimings[0].plateId, "jack");

const railBefore = clipsForStillsDesk({
  clips: [deskClip],
  shots: [{ shotId: "jack", sceneId: "scene-1" }],
  scratchSong: song,
});
assert.equal(railBefore.some((c) => stackedClipFiles(c).includes("01_JACK_GHOST.mp4")), true);
const railAfter = clipsForStillsDesk({
  clips: both.next,
  shots: [{ shotId: "jack", sceneId: "scene-1" }],
  scratchSong: both.nextSong,
});
assert.equal(railAfter.some((c) => stackedClipFiles(c).includes("01_JACK_GHOST.mp4")), false);

const synth = planParkDeskClipTake({
  clips: [],
  song,
  beatId: "cut-jack",
  fileName: "01_JACK_GHOST.mp4",
});
assert.equal(isEpisodeClipPlanError(synth), false);
assert.equal(synth.nextSong.cuts[0].status, "pending");
assert.deepEqual(synth.filesToPark, ["01_JACK_GHOST.mp4"]);


const dupSong = {
  fileName: "jack-ghost.mp3",
  durationSec: 180,
  sliceStartSec: 0,
  sliceDurationSec: 15,
  plateTimings: [
    { plateId: "plate-crouch", startMs: 0, endMs: 45000, sortIndex: 0 },
    { plateId: "plate-car", startMs: 45000, endMs: 60000, sortIndex: 1 },
  ],
  cuts: [
    {
      id: "c1",
      plateFile: "crouch.png",
      shotId: "plate-crouch",
      startSec: 0,
      durationSec: 15,
      clipFile: "",
      status: "pending",
      error: "",
    },
    {
      id: "c4",
      plateFile: "car.png",
      shotId: "plate-car",
      startSec: 45,
      durationSec: 15,
      clipFile: "01_JACK_GHOST.mp4",
      status: "done",
      error: "",
    },
  ],
};
const crouchGhost = clip({
  beatId: "beat-crouch",
  shotId: "plate-crouch",
  clipFile: "01_JACK_GHOST.mp4",
  clipStatus: "done",
});
const carHung = clip({
  beatId: "beat-car",
  shotId: "plate-car",
  clipFile: "01_JACK_GHOST.mp4",
  clipStatus: "done",
});
const xExtra = planParkDeskClipTake({
  clips: [crouchGhost, carHung],
  song: dupSong,
  beatId: "beat-crouch",
  fileName: "01_JACK_GHOST.mp4",
});
assert.equal(isEpisodeClipPlanError(xExtra), false);
assert.equal(xExtra.next.find((c) => c.beatId === "beat-crouch")?.clipFile, "");
assert.equal(xExtra.next.find((c) => c.beatId === "beat-car")?.clipFile, "01_JACK_GHOST.mp4");
assert.equal(xExtra.nextSong.cuts.find((c) => c.id === "c4")?.clipFile, "01_JACK_GHOST.mp4");
assert.equal(xExtra.nextSong.cuts.find((c) => c.id === "c4")?.status, "done");
assert.deepEqual(xExtra.filesToPark, []);

const xHung = planParkDeskClipTake({
  clips: [crouchGhost, carHung],
  song: dupSong,
  beatId: "beat-car",
  fileName: "01_JACK_GHOST.mp4",
});
assert.equal(isEpisodeClipPlanError(xHung), false);
assert.equal(xHung.next.every((c) => !stackedClipFiles(c).includes("01_JACK_GHOST.mp4")), true);
assert.equal(xHung.nextSong.cuts.find((c) => c.id === "c4")?.status, "pending");
assert.deepEqual(xHung.filesToPark, ["01_JACK_GHOST.mp4"]);

/** X one take on a stacked row must leave the other mp4 on CLIPS. */
const stackedTakes = clip({
  beatId: "beat-jack",
  shotId: "jack",
  clipFile: "04_crouch.mp4",
  priorClipFiles: ["03_stand.mp4"],
  clipStatus: "done",
});
const carTake = clip({
  beatId: "beat-car",
  shotId: "car",
  clipFile: "02_car.mp4",
  clipStatus: "done",
});
const xOneTake = planParkDeskClipTake({
  clips: [stackedTakes, carTake],
  song: {
    fileName: "song.mp3",
    durationSec: 60,
    sliceStartSec: 0,
    sliceDurationSec: 15,
    plateTimings: [
      { plateId: "car", startMs: 15000, endMs: 20000, sortIndex: 0 },
      { plateId: "jack", startMs: 20000, endMs: 25000, sortIndex: 1 },
    ],
    cuts: [
      {
        id: "c-car",
        plateFile: "car.png",
        shotId: "car",
        startSec: 15,
        durationSec: 5,
        clipFile: "02_car.mp4",
        status: "done",
        error: "",
      },
      {
        id: "c-jack",
        plateFile: "jack.png",
        shotId: "jack",
        startSec: 20,
        durationSec: 5,
        clipFile: "04_crouch.mp4",
        status: "done",
        error: "",
      },
    ],
  },
  beatId: "beat-jack",
  fileName: "04_crouch.mp4",
});
assert.equal(isEpisodeClipPlanError(xOneTake), false);
assert.deepEqual(stackedClipFiles(xOneTake.next.find((c) => c.beatId === "beat-jack")), [
  "03_stand.mp4",
]);
assert.equal(xOneTake.next.find((c) => c.beatId === "beat-car")?.clipFile, "02_car.mp4");
assert.equal(xOneTake.nextSong.cuts.find((c) => c.id === "c-car")?.clipFile, "02_car.mp4");
assert.equal(xOneTake.nextSong.cuts.find((c) => c.id === "c-car")?.status, "done");
assert.ok(!xOneTake.filesToPark.includes("02_car.mp4"));
assert.ok(!xOneTake.filesToPark.includes("03_stand.mp4"));

console.log("check-mobile-episode-clips: ok");
