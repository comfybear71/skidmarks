/** Run: npx tsx scripts/check-plate-add-at-end.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appendPlacePlate } from "../src/lib/mobilePlateGraph.ts";

const scene = (id, placeName, shotIds) => ({
  id,
  title: placeName,
  placeName,
  worldThumbKey: "",
  shots: shotIds.map((sid) => ({
    id: sid,
    title: sid,
    summary: "",
    staging: "",
    plateFile: "p.png",
    beats: [{ id: `${sid}_b`, speaker: "Shazza", text: "hi" }],
    sfx: [],
  })),
});

const story = {
  styleId: "sunny_banks",
  campaignLabel: "EP02",
  gagNote: "",
  intro: { title: "", notes: "", sfx: [] },
  outro: { title: "", notes: "", sfx: [] },
  updatedAt: "",
  scenes: [
    scene("scene_deck", "Caravan park", ["shot_1", "shot_2"]),
    scene("scene_office", "Ranger office", ["shot_3"]),
  ],
};
const job = {
  scenes: [
    { id: "scene_deck", placeName: "Caravan park", worldThumbKey: "" },
    { id: "scene_office", placeName: "Ranger office", worldThumbKey: "" },
  ],
  shots: [
    { shotId: "shot_1", sceneId: "scene_deck", plateFile: "p.png" },
    { shotId: "shot_2", sceneId: "scene_deck", plateFile: "p.png" },
    { shotId: "shot_3", sceneId: "scene_office", plateFile: "p.png" },
  ],
};

const flat = (st) => st.scenes.flatMap((sc) => sc.shots.map((sh) => sh.id));

// THE BUG: picking the caravan park (scene 1 of 2) used to append inside that
// scene, so the new shot landed at position 3 of 4 — mid-episode — with the
// ranger office still after it.
const mid = appendPlacePlate({ job, story, sceneId: "scene_deck", speaker: "Dazza" });
const order = flat(mid.story);
assert.equal(order.length, 4);
assert.equal(order[3], mid.shotId, "a new shot belongs at the END of the episode");
assert.notEqual(order[2], mid.shotId);

// It gets its own scene at the end, with a new id (a duplicate scene id breaks
// the animate lookup) and the same place.
assert.notEqual(mid.sceneId, "scene_deck");
assert.equal(mid.story.scenes.length, 3);
assert.equal(mid.story.scenes[2].id, mid.sceneId);
assert.equal(mid.story.scenes[2].placeName, "Caravan park");
const ids = mid.story.scenes.map((sc) => sc.id);
assert.equal(new Set(ids).size, ids.length, "scene ids stay unique");
// And it tells the route which scene's still to copy.
assert.equal(mid.carryStillFrom, "scene_deck");

const stay = appendPlacePlate({
  job,
  story,
  sceneId: "scene_deck",
  speaker: "Dazza",
  reuseScene: true,
});
assert.equal(stay.sceneId, "scene_deck", "talking desk stays on this act");
assert.equal(stay.story.scenes.length, 2);
assert.equal(stay.story.scenes[0].shots.at(-1).id, stay.shotId);

// Picking the place that IS already last just appends there — no extra scene.
const tail = appendPlacePlate({ job, story, sceneId: "scene_office", speaker: "Dazza" });
assert.equal(tail.sceneId, "scene_office");
assert.equal(tail.story.scenes.length, 2);
assert.equal(flat(tail.story).at(-1), tail.shotId);
assert.equal(tail.carryStillFrom, undefined);

// A single-scene episode is unchanged.
const one = { ...story, scenes: [story.scenes[0]] };
const solo = appendPlacePlate({
  job: { ...job, scenes: [job.scenes[0]] },
  story: one,
  sceneId: "scene_deck",
  speaker: "Dazza",
});
assert.equal(solo.sceneId, "scene_deck");
assert.equal(solo.story.scenes.length, 1);
assert.equal(flat(solo.story).at(-1), solo.shotId);

// The route must register the new scene and carry the still, or the plate has
// no background to draw on.
const route = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/app/api/crash/mobile/plate/route.ts"),
  "utf8",
);
assert.match(route, /carryStillFrom/);
assert.match(route, /locationCandidates,/);
assert.match(route, /scenes,/);
assert.match(route, /reuseScene: Boolean\(body.reuseScene\)/);

console.log("check-plate-add-at-end: ok");
