/** Run: npx tsx scripts/check-mobile-episode-clips.mjs */
import assert from "node:assert/strict";
import {
  isEpisodeClipPlanError,
  planBinFailedEpisodeClips,
  planDismissEpisodeClip,
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

console.log("check-mobile-episode-clips: ok");
