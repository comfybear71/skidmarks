import assert from "node:assert/strict";
import { clipsUnderPlate, rememberClipTake, stackedClipFiles } from "../src/lib/mobilePlateClips.ts";
import {
  episodeJobShots,
  isOffEpisodeDeskShot,
  isScratchShotTitle,
  scratchDrawStillInFlight,
  scratchPadClips,
} from "../src/lib/mobileScratch.ts";
import { isCampaignShotId, isCampaignShotTitle } from "../src/lib/mobilePlateLtxCampaign.ts";
import { jobDeskId, normalizeDeskId } from "../src/lib/mobileDesk.ts";

assert.equal(isScratchShotTitle("Scratch"), true);
assert.equal(isScratchShotTitle("Jo sitting"), false);

const job = {
  shots: [
    { shotId: "ep1", sceneId: "sc1", plateFile: "a.png" },
    { shotId: "scr1", sceneId: "sc1", plateFile: "b.png" },
  ],
  scratchPlate: { shotId: "scr1", sceneId: "sc1", speaker: "Jo" },
};
assert.deepEqual(
  episodeJobShots(job).map((s) => s.shotId),
  ["ep1"],
);

const clips = [
  { beatId: "b1", shotId: "ep1", sceneId: "sc1", clipFile: "1.mp4", clipStatus: "done", error: "" },
  { beatId: "b2", shotId: "ep1", sceneId: "sc1", clipFile: "2.mp4", clipStatus: "done", error: "" },
  { beatId: "b3", shotId: "ep1", sceneId: "sc1", clipFile: "", clipStatus: "pending", error: "" },
];
assert.equal(clipsUnderPlate("ep1", ["b1", "b2", "b3"], clips).length, 3);

assert.deepEqual(stackedClipFiles({ clipFile: "b.mp4", priorClipFiles: ["a.mp4"] }), ["a.mp4", "b.mp4"]);
assert.deepEqual(
  rememberClipTake({ clipFile: "a.mp4", priorClipFiles: [] }, "b.mp4"),
  { priorClipFiles: ["a.mp4"], clipFile: "b.mp4" },
);
assert.deepEqual(
  rememberClipTake({ clipFile: "b.mp4", priorClipFiles: ["a.mp4"] }, "c.mp4"),
  { priorClipFiles: ["a.mp4", "b.mp4"], clipFile: "c.mp4" },
);

assert.equal(normalizeDeskId("Mum"), "mum");
assert.equal(jobDeskId({}), "stuie");
assert.equal(jobDeskId({ deskId: "mum" }), "mum");

assert.equal(isCampaignShotTitle("01 Closer MCU + phone"), true);
assert.equal(isCampaignShotTitle("CRAZY BIG HOLE JO"), false);
const campaignJob = {
  shots: [
    { shotId: "ep1", sceneId: "sc1", plateFile: "a.png" },
    { shotId: "t01", sceneId: "sc1", plateFile: "b.png" },
  ],
  scratchPlate: { shotId: "", sceneId: "", speaker: "" },
  plateLtxCampaign: { shotIds: ["t01"], tests: [{ shotId: "t01" }] },
};
assert.equal(isCampaignShotId(campaignJob.plateLtxCampaign, "t01"), true);
assert.equal(isOffEpisodeDeskShot(campaignJob, "t01"), true);
assert.deepEqual(
  episodeJobShots(campaignJob).map((s) => s.shotId),
  ["ep1"],
);

const stacked = {
  ...campaignJob,
  clips: [
    { beatId: "b-ep", shotId: "ep1", clipFile: "ep.mp4", clipStatus: "done" },
    { beatId: "b-t", shotId: "t01", clipFile: "t.mp4", clipStatus: "done" },
    { beatId: "b-wait", shotId: "t01", clipFile: "", clipStatus: "pending" },
  ],
};
assert.deepEqual(
  scratchPadClips(stacked).map((c) => c.beatId),
  ["b-t"],
);

const drawTask = {
  taskId: "siray-1",
  shotId: "scr1",
  sceneId: "sc1",
  staging: "Adult TEE, fully nude at the bar",
  speaker: "TEE",
  cast: ["TEE"],
  castNames: ["TEE"],
  placeName: "the bar",
  startedAt: new Date().toISOString(),
};
assert.equal(
  scratchDrawStillInFlight(drawTask, {
    shotId: "scr1",
    staging: "Adult TEE, fully nude at the bar",
    speaker: "TEE",
    cast: ["TEE"],
  }),
  true,
);
assert.equal(
  scratchDrawStillInFlight(drawTask, {
    shotId: "scr1",
    staging: "Adult TEE, fully nude at the bar",
    speaker: "TEE",
    cast: ["BEX"],
  }),
  false,
);
assert.equal(
  scratchDrawStillInFlight(
    { ...drawTask, startedAt: new Date(Date.now() - 241_000).toISOString() },
    {
      shotId: "scr1",
      staging: "Adult TEE, fully nude at the bar",
      speaker: "TEE",
      cast: ["TEE"],
    },
  ),
  false,
);

console.log("check-mobile-scratch: ok");
