import assert from "node:assert/strict";
import {
  appendSoloCastShot,
  episodePlateCounts,
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
assert.deepEqual(speakersMissingEpisodeShot(rosterJob, rosterStory), ["LAND LADY"]);
assert.deepEqual(episodePlateCounts(rosterJob, rosterStory), { done: 2, total: 3 });
assert.equal(nextUnplatedEpisodeShot(rosterJob, rosterStory), null);

const minted = appendSoloCastShot({
  job: rosterJob,
  story: rosterStory,
  speaker: "LAND LADY",
});
assert.equal(minted.shots.length, 3);
assert.equal(minted.placeName, "Jo's bedroom (the cell)");
const landShot = minted.story.scenes[0].shots.find((s) => s.id === minted.shotId);
assert.equal(landShot?.beats[0]?.speaker, "LAND LADY");
assert.equal(landShot?.staging, "");
assert.deepEqual(speakersMissingEpisodeShot({ ...rosterJob, shots: minted.shots }, minted.story), []);

console.log("check-mobile-plate-graph: ok");
