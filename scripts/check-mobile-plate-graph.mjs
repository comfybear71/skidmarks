import assert from "node:assert/strict";
import {
  appendSoloCastShot,
  episodePlateCounts,
  missingCastPlacePlates,
  nextUnplatedEpisodeShot,
  shotHasPlate,
  speakersMissingEpisodeShot,
  storyShotSpeaker,
} from "../src/lib/mobilePlateGraph.ts";

assert.equal(shotHasPlate({ plateFile: "" }), false);
assert.equal(shotHasPlate({ plateFile: "__error__" }), false);
assert.equal(shotHasPlate({ plateFile: "cplate_jo.png" }), true);

const job = {
  shots: [
    { shotId: "a", sceneId: "sc1", plateFile: "cplate_a.png" },
    { shotId: "b", sceneId: "sc1", plateFile: "" },
  ],
};
assert.equal(nextUnplatedEpisodeShot(job)?.shotId, "b");
assert.deepEqual(episodePlateCounts(job), { done: 1, total: 2 });

const full = {
  shots: [
    { shotId: "a", sceneId: "sc1", plateFile: "cplate_a.png" },
    { shotId: "b", sceneId: "sc1", plateFile: "cplate_b.png" },
  ],
};
assert.equal(nextUnplatedEpisodeShot(full), null);
assert.deepEqual(episodePlateCounts(full), { done: 2, total: 2 });

const story = {
  styleId: "skidmarks",
  title: "t",
  logline: "",
  scenes: [
    {
      id: "sc1",
      placeName: "Jo's bedroom (the cell)",
      worldThumbKey: "",
      shots: [
        {
          id: "b",
          title: "JO",
          summary: "",
          staging: "",
          plateFile: "",
          beats: [{ id: "beat1", speaker: "CRAZY BIG HOLE JO", text: "filler" }],
        },
      ],
    },
  ],
};
assert.deepEqual(storyShotSpeaker(story, "b"), {
  speaker: "CRAZY BIG HOLE JO",
  placeName: "Jo's bedroom (the cell)",
});

const rosterJob = {
  speakers: ["CRAZY BIG HOLE JO", "BIG SEXY", "LAND LADY"],
  castCandidates: {
    "CRAZY BIG HOLE JO": [{ approved: true, fileName: "jo.png" }],
    "BIG SEXY": [{ approved: true, fileName: "sexy.png" }],
    "LAND LADY": [{ approved: true, fileName: "land.png" }],
  },
  scenes: [{ id: "sc1", placeName: "Jo's bedroom (the cell)", worldThumbKey: "" }],
  shots: [
    { shotId: "a", sceneId: "sc1", plateFile: "cplate_a.png" },
    { shotId: "b", sceneId: "sc1", plateFile: "cplate_b.png" },
  ],
};
const rosterStory = {
  styleId: "skidmarks",
  title: "t",
  logline: "",
  scenes: [
    {
      id: "sc1",
      placeName: "Jo's bedroom (the cell)",
      worldThumbKey: "",
      shots: [
        {
          id: "a",
          title: "JO",
          summary: "",
          staging: "",
          plateFile: "cplate_a.png",
          beats: [{ id: "beat_a", speaker: "CRAZY BIG HOLE JO", text: "filler" }],
        },
        {
          id: "b",
          title: "BIG SEXY",
          summary: "",
          staging: "",
          plateFile: "cplate_b.png",
          beats: [{ id: "beat_b", speaker: "BIG SEXY", text: "filler" }],
        },
      ],
    },
  ],
};
assert.deepEqual(speakersMissingEpisodeShot(rosterJob, rosterStory), []);
assert.deepEqual(missingCastPlacePlates(rosterJob, rosterStory), []);
assert.deepEqual(episodePlateCounts(rosterJob, rosterStory), { done: 2, total: 2 });
assert.equal(nextUnplatedEpisodeShot(rosterJob, rosterStory), null);

const houseJob = {
  ...rosterJob,
  speakers: [...rosterJob.speakers, "TEE"],
  castCandidates: {
    ...rosterJob.castCandidates,
    TEE: [{ approved: true, fileName: "tee.png" }],
  },
  scenes: [
    { id: "sc1", placeName: "Jo's bedroom (the cell)", worldThumbKey: "" },
    { id: "lounge", placeName: "Upstairs lounge", worldThumbKey: "" },
    { id: "pool", placeName: "Pool", worldThumbKey: "" },
    { id: "bar", placeName: "Matty's bar", worldThumbKey: "" },
    { id: "donga", placeName: "The donga", worldThumbKey: "" },
    { id: "front", placeName: "Front house", worldThumbKey: "" },
    { id: "llbed", placeName: "Land lady bedroom", worldThumbKey: "" },
  ],
};
const houseStory = {
  ...rosterStory,
  scenes: [
    ...rosterStory.scenes,
    { id: "lounge", placeName: "Upstairs lounge", worldThumbKey: "", shots: [] },
    { id: "pool", placeName: "Pool", worldThumbKey: "", shots: [] },
    { id: "bar", placeName: "Matty's bar", worldThumbKey: "", shots: [] },
    { id: "donga", placeName: "The donga", worldThumbKey: "", shots: [] },
    { id: "front", placeName: "Front house", worldThumbKey: "", shots: [] },
    { id: "llbed", placeName: "Land lady bedroom", worldThumbKey: "", shots: [] },
  ],
};
const missing = missingCastPlacePlates(houseJob, houseStory);
assert.ok(missing.some((r) => r.speaker === "TEE" && r.kind === "jo_lounge"));
assert.ok(missing.some((r) => r.speaker === "TEE" && r.kind === "jo_pool"));
assert.ok(!missing.some((r) => r.speaker === "TEE" && r.kind === "matty_bar" && !r.ensemble));
assert.ok(!missing.some((r) => r.speaker === "TEE" && r.kind === "jo_cell"));
assert.ok(!missing.some((r) => r.speaker === "LAND LADY" && r.kind === "jo_cell"));
assert.ok(missing.some((r) => r.speaker === "LAND LADY" && r.kind === "ll_bedroom"));
assert.ok(missing.some((r) => r.speaker === "BIG SEXY" && r.kind === "donga"));
assert.ok(!missing.some((r) => r.speaker === "CRAZY BIG HOLE JO"));
const barMixes = missing.filter((r) => r.ensemble);
assert.ok(barMixes.length >= 1);
assert.ok(barMixes.every((r) => (r.speakers || []).length >= 2 && (r.speakers || []).length <= 3));
assert.ok(barMixes.some((r) => (r.speakers || []).includes("LAND LADY")));

const minted = appendSoloCastShot({
  job: houseJob,
  story: houseStory,
  speaker: "TEE",
  sceneId: "lounge",
});
assert.equal(minted.placeName, "Upstairs lounge");
const teeShot = minted.story.scenes.find((sc) => sc.id === "lounge")?.shots.find((s) => s.id === minted.shotId);
assert.equal(teeShot?.beats[0]?.speaker, "TEE");
assert.equal(teeShot?.staging, "");

console.log("check-mobile-plate-graph: ok");
