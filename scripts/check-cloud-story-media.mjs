/** Run: npx tsx scripts/check-cloud-story-media.mjs
 * (Node type-stripping cannot follow extensionless TS imports in this file.) */
import assert from "node:assert/strict";
import {
  attachPlateFilenamesToStory,
  storyIsEmptyPlateRecipe,
} from "../src/lib/cloudStoryMedia.ts";

function bookend() {
  return { title: "", notes: "", sfx: [] };
}

function story(scenes) {
  return {
    styleId: "skidmarks",
    campaignLabel: "test",
    gagNote: "",
    intro: bookend(),
    outro: bookend(),
    scenes,
    updatedAt: "2026-08-16T00:00:00.000Z",
  };
}

function emptyRecipe() {
  return story([
    {
      id: "scene_1",
      title: "Scene 1",
      placeName: "",
      worldThumbKey: "",
      shots: [
        {
          id: "shot_1",
          title: "Shot 1",
          summary: "",
          plateFile: "",
          beats: [{ id: "beat_1", speaker: "", text: "" }],
          sfx: [],
        },
      ],
    },
  ]);
}

const leftover = ["cplate_matty_bar_crowd.png", "cplate_older.png"];

assert.equal(storyIsEmptyPlateRecipe(emptyRecipe()), true);

const recovered = attachPlateFilenamesToStory(emptyRecipe(), leftover);
assert.equal(recovered.scenes[0].shots.length, 2);
assert.equal(recovered.scenes[0].shots[0].plateFile, leftover[0]);
assert.equal(recovered.scenes[0].shots[0].id, "shot_cloud_1");

const clearedPack = story([
  {
    id: "scene_matty",
    title: "MATTY BAR",
    placeName: "MATTY BAR",
    worldThumbKey: "g:place_matty.png",
    shots: [],
  },
]);
assert.equal(storyIsEmptyPlateRecipe(clearedPack), false);
const afterClear = attachPlateFilenamesToStory(clearedPack, leftover);
assert.equal(afterClear.scenes[0].shots.length, 0);

const comfyCard = story([
  {
    id: "scene_matty",
    title: "MATTY BAR",
    placeName: "MATTY BAR",
    worldThumbKey: "g:place_matty.png",
    shots: [
      {
        id: "shot_comfy_new",
        title: "COMFY",
        summary: "COMFY, solo — position, voice, and lip sync only. No one else in frame.",
        staging: "COMFY alone, standing centre-frame, facing camera, mid body.",
        plateFile: "",
        beats: [{ id: "beat_comfy", speaker: "COMFY", text: "" }],
        sfx: [],
      },
    ],
  },
]);
assert.equal(storyIsEmptyPlateRecipe(comfyCard), false);
const hydratedComfy = attachPlateFilenamesToStory(comfyCard, leftover, leftover);
assert.equal(hydratedComfy.scenes[0].shots.length, 1);
assert.equal(hydratedComfy.scenes[0].shots[0].id, "shot_comfy_new");
assert.equal(
  hydratedComfy.scenes[0].shots[0].plateFile,
  "",
  "leftover Blob/kit plates must not attach to an unplated test card",
);
assert.match(hydratedComfy.scenes[0].shots[0].summary, /COMFY, solo/);

const alreadyPlated = story([
  {
    id: "scene_1",
    title: "MATTY BAR",
    placeName: "MATTY BAR",
    worldThumbKey: "",
    shots: [
      {
        id: "shot_keep",
        title: "Kept",
        summary: "kept",
        plateFile: "cplate_mine.png",
        beats: [{ id: "b", speaker: "Jo", text: "oy" }],
        sfx: [],
      },
    ],
  },
]);
const kept = attachPlateFilenamesToStory(alreadyPlated, [
  "cplate_mine.png",
  "cplate_other.png",
]);
assert.equal(kept.scenes[0].shots[0].plateFile, "cplate_mine.png");
assert.equal(kept.scenes[0].shots.length, 1);

const namedSceneEmptyShot = story([
  {
    id: "scene_bar",
    title: "Scene 1",
    placeName: "The Hole",
    worldThumbKey: "",
    shots: [
      {
        id: "shot_empty_add",
        title: "The Hole",
        summary: "",
        plateFile: "",
        beats: [],
        sfx: [],
      },
    ],
  },
]);
assert.equal(storyIsEmptyPlateRecipe(namedSceneEmptyShot), false);
const addToPlate = attachPlateFilenamesToStory(namedSceneEmptyShot, leftover);
assert.equal(addToPlate.scenes[0].shots[0].plateFile, "");
assert.equal(addToPlate.scenes[0].shots[0].id, "shot_empty_add");

console.log("check-cloud-story-media: ok");
