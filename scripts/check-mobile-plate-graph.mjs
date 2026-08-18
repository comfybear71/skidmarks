import assert from "node:assert/strict";
import {
  episodePlateCounts,
  nextUnplatedEpisodeShot,
  shotHasPlate,
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

console.log("check-mobile-plate-graph: ok");
