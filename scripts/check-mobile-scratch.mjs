import assert from "node:assert/strict";
import { clipsUnderPlate, mobileClipSrc, rememberClipTake, stackedClipFiles } from "../src/lib/mobilePlateClips.ts";
import {
  episodeJobShots,
  isOffEpisodeDeskShot,
  isScratchShotTitle,
  scratchClipStillInFlight,
  scratchDrawStillInFlight,
  scratchPadClips,
} from "../src/lib/mobileScratch.ts";
import { isCampaignShotId, isCampaignShotTitle } from "../src/lib/mobilePlateLtxCampaign.ts";
import { jobDeskId, normalizeDeskId } from "../src/lib/mobileDesk.ts";
import {
  expandScratchLayoutMarks,
  keepScratchPositionLines,
  stripScratchLayoutMarks,
} from "../src/lib/scratchBench/padDrop.ts";
import { mergePlacementsIntoStaging } from "../src/lib/scratchBench/promptFormatter.ts";
import {
  appendBenchRun,
  emptyBenchSession,
  removeBenchRun,
} from "../src/lib/scratchBench/runLog.ts";
import {
  scratchBlobFolderForRun,
  scratchBlobFolderPath,
  scratchMediaFileFromUrl,
} from "../src/lib/scratchBench/blobFolder.ts";

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

assert.equal(isCampaignShotTitle("01 Closer MCU"), true);
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

const clipTask = {
  taskId: "vid-1",
  shotId: "scr1",
  sceneId: "sc1",
  beatId: "b1",
  i2v: "seedance-20",
  model: "bytedance/seedance-2.0-i2v-spicy",
  label: "Seedance 2.0 Spicy",
  startedAt: new Date().toISOString(),
};
assert.equal(
  scratchClipStillInFlight(clipTask, { shotId: "scr1", beatId: "b1", i2v: "seedance-20" }),
  true,
);
assert.equal(
  scratchClipStillInFlight(clipTask, { shotId: "scr1", beatId: "b1", i2v: "seedance-25" }),
  false,
);

const joMark = "[Position: CRAZY BIG HOLE JO framed on the left third of the screen, mid height (drop 22% / 58%).]";
const kept = keepScratchPositionLines(
  joMark,
  "Adult MATTY, fully nude at THE DONGA.",
);
assert.match(kept, /CRAZY BIG HOLE JO/);
assert.match(kept, /MATTY/);
const laid = mergePlacementsIntoStaging("just a thin line", [
  { name: "MATTY", xPercent: 72, yPercent: 60 },
  { name: "CRAZY BIG HOLE JO", xPercent: 20, yPercent: 55 },
], "the bedroom");
assert.match(laid, /MATTY/);
assert.match(laid, /CRAZY BIG HOLE JO/);
assert.doesNotMatch(laid, /\[Position:/);
assert.match(laid, /picture-in-picture|same room|ONE photograph|full person/i);

const marksOnly = `[Backdrop: COMFY AND THE LAND LADY'S BEDROOM — drop anchor 48% / 59%.]

[Position: MATTY framed on the right third of the screen, lower band (drop 71% / 76%).]

[Position: CRAZY BIG HOLE JO TOO framed on the left third of the screen, mid height (drop 28% / 45%).]`;
const expanded = expandScratchLayoutMarks(marksOnly);
assert.match(expanded, /ONE photograph of COMFY AND THE LAND LADY'S BEDROOM/i);
assert.match(expanded, /MATTY is on the sofa/i);
assert.match(expanded, /CRAZY BIG HOLE JO TOO is on her back on the bed/i);
assert.match(expanded, /share the same room/i);
assert.match(expanded, /not a floating bust/i);
assert.equal(expandScratchLayoutMarks(expanded), expanded);

const letter = [
  "ONE photograph, ONE camera, ONE room: COMFY AND THE LAND LADY'S BEDROOM. Not a collage, not a comic page, not three panels, not inset portraits.",
  "Adult CRAZY BIG HOLE JO TOO is fully nude on the bed, left of frame — on her back on the quilt, shoulders and head on the mattress, looking toward MATTY. Empty hands, arms down at her sides, no phone — do not copy a phone from the face card. Same face as her face card. Ignore face-card clothes. Full body lying on the mattress — not sitting up, not leaning forward, not a floating bust, not framed in a window.",
  "Adult man MATTY is fully nude on the sofa / armchair, right of frame, lower — sitting back, head tipped up, eyes closed. Same face, tattoos and build as his face card. Visible human penis, two human feet on the floor. Not a Ken doll. No extra limbs. Full body in the seat — not a floating bust, not framed in a window.",
  "Only CRAZY BIG HOLE JO TOO and MATTY in frame. Full people using the furniture. No picture-in-picture. No text. Adults only, no one under 21.",
].join("\n\n");
assert.match(letter, /CRAZY BIG HOLE JO TOO is fully nude on the bed/i);
assert.match(letter, /on her back/i);
assert.match(letter, /MATTY is fully nude on the sofa/i);
assert.match(letter, /not a floating bust/i);
assert.match(letter, /no phone/i);
assert.equal(expandScratchLayoutMarks(letter), letter);
assert.equal(
  mergePlacementsIntoStaging(letter, [
    { name: "MATTY", xPercent: 74, yPercent: 68 },
    { name: "CRAZY BIG HOLE JO TOO", xPercent: 28, yPercent: 48 },
  ], "the bedroom"),
  letter,
);

const polluted = `[Position: CRAZY BIG HOLE JO TOO framed on the left third of the screen, mid height (drop 28% / 48%).]
[Position: MATTY framed on the right third of the screen, lower band (drop 74% / 68%).]

${letter}`;
assert.doesNotMatch(stripScratchLayoutMarks(polluted), /\[Position:/);
assert.doesNotMatch(stripScratchLayoutMarks(polluted), /left third of the screen/);
assert.equal(mergePlacementsIntoStaging(polluted, [
  { name: "MATTY", xPercent: 74, yPercent: 68 },
  { name: "CRAZY BIG HOLE JO TOO", xPercent: 28, yPercent: 48 },
], "the bedroom"), letter);

assert.equal(
  scratchBlobFolderPath("skidmarks", "mgen_abc", "plates"),
  "shows/skidmarks/episodes/mgen_abc/plates/",
);
assert.equal(
  scratchMediaFileFromUrl("/api/crash/gen/file?name=cplate_1.png"),
  "cplate_1.png",
);
const blob = scratchBlobFolderForRun(
  {
    kind: "still",
    styleId: "skidmarks",
    mediaFolder: "CRAZY_PACK",
    plateUrl: "/api/crash/gen/file?name=cplate_1.png",
  },
);
assert.ok(blob);
assert.equal(blob.path, "shows/skidmarks/episodes/CRAZY_PACK/plates/");
assert.equal(blob.href, "/api/crash/gen/file?name=cplate_1.png");

let bench = emptyBenchSession();
bench = appendBenchRun(bench, {
  kind: "still",
  backend: "xai",
  chaosId: "none",
  tags: [],
});
assert.equal(bench.runs.length, 1);
const goneId = bench.runs[0].id;
bench = removeBenchRun(bench, goneId);
assert.equal(bench.runs.length, 0);
assert.equal(removeBenchRun(bench, goneId).runs.length, 0);

assert.match(
  mobileClipSrc({ id: "mgen_test", styleId: "skidmarks", folderName: "" }, "sclip_abc.mp4"),
  /folderName=mgen_test/,
);
assert.deepEqual(
  stackedClipFiles(
    rememberClipTake({ clipFile: "sclip_one.mp4", priorClipFiles: [] }, "sclip_two.mp4"),
  ),
  ["sclip_one.mp4", "sclip_two.mp4"],
);

console.log("check-mobile-scratch: ok");
