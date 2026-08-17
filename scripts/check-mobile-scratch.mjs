import assert from "node:assert/strict";
import { clipsUnderPlate } from "../src/lib/mobilePlateClips.ts";
import { episodeJobShots, isScratchShotTitle } from "../src/lib/mobileScratch.ts";
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

assert.equal(normalizeDeskId("Mum"), "mum");
assert.equal(jobDeskId({}), "stuie");
assert.equal(jobDeskId({ deskId: "mum" }), "mum");

console.log("check-mobile-scratch: ok");
