/** Run: npx tsx scripts/check-cloud-story-media.mjs
 * (Node type-stripping cannot follow extensionless TS imports in this file.) */
import assert from "node:assert/strict";
import {
  attachAudioFilenamesToStory,
  attachPlateFilenamesToSceneKit,
  attachPlateFilenamesToStory,
  isHydratedLeftoverBeat,
  storyIsEmptyPlateRecipe,
} from "../src/lib/cloudStoryMedia.ts";
import {
  defaultCrashVoicePrompt,
  speakerVoiceKey,
} from "../src/lib/crashVoicePrompt.ts";

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

const leftoverPlates = ["cplate_matty_bar_crowd.png", "cplate_older.png"];
const leftoverAudio = [
  "01_01_Comfy_Keep-the-rhythm-legend.mp3",
  "01_02_Land_Tip-jar-open.mp3",
];

assert.equal(storyIsEmptyPlateRecipe(emptyRecipe()), true);

const recovered = attachPlateFilenamesToStory(emptyRecipe(), leftoverPlates);
assert.equal(recovered.scenes[0].shots.length, 2);
assert.equal(recovered.scenes[0].shots[0].plateFile, leftoverPlates[0]);
assert.equal(recovered.scenes[0].shots[0].id, "shot_cloud_1");

const recoveredAudio = attachAudioFilenamesToStory(emptyRecipe(), leftoverAudio);
assert.equal(recoveredAudio.scenes[0].shots[0].beats.length, 2);
assert.equal(recoveredAudio.scenes[0].shots[0].beats[0].speaker, "Comfy");
assert.equal(recoveredAudio.scenes[0].shots[0].beats[1].speaker, "Land");

const joCard = story([
  {
    id: "scene_jo",
    title: "Jo's bedroom (the cell)",
    placeName: "Jo's bedroom (the cell)",
    worldThumbKey: "g:place_jo.png",
    shots: [
      {
        id: "shot_jo_new",
        title: "Jo's bedroom (the cell)",
        summary: "",
        plateFile: "",
        beats: [],
        sfx: [],
      },
    ],
  },
]);
assert.equal(storyIsEmptyPlateRecipe(joCard), false);
const joPlates = attachPlateFilenamesToStory(joCard, leftoverPlates, leftoverPlates);
assert.equal(joPlates.scenes[0].shots[0].plateFile, "", "leftover stills must not attach to Jo's unplated card");
const joAudio = attachAudioFilenamesToStory(joCard, leftoverAudio);
assert.equal(
  joAudio.scenes[0].shots[0].beats.length,
  0,
  "leftover Comfy/Land mp3s must not become line editors on an empty Jo card",
);

const joBeat = story([
  {
    id: "scene_jo",
    title: "Jo's bedroom (the cell)",
    placeName: "Jo's bedroom (the cell)",
    worldThumbKey: "",
    shots: [
      {
        id: "shot_jo_new",
        title: "CRAZY BIG HOLE JO",
        summary: "",
        plateFile: "",
        beats: [
          {
            id: "beat_jo",
            speaker: "CRAZY BIG HOLE JO",
            text: "",
            voiceFile: leftoverAudio[0],
          },
        ],
        sfx: [],
      },
    ],
  },
]);
const joVoiced = attachAudioFilenamesToStory(joBeat, leftoverAudio);
assert.equal(joVoiced.scenes[0].shots[0].beats.length, 1);
assert.equal(joVoiced.scenes[0].shots[0].beats[0].speaker, "CRAZY BIG HOLE JO");
assert.equal(
  joVoiced.scenes[0].shots[0].beats[0].voiceFile || "",
  "",
  "Comfy's leftover clip must not play as Jo's voice",
);

const leftoverJoMp3 = "01_05_CRAZY_BIG_HOLE_JO_Not-that.mp3";
const joLeftoverLine = story([
  {
    id: "scene_jo",
    title: "Jo's bedroom (the cell)",
    placeName: "Jo's bedroom (the cell)",
    worldThumbKey: "",
    shots: [
      {
        id: "shot_jo_new",
        title: "CRAZY BIG HOLE JO",
        summary: "",
        plateFile: "",
        beats: [
          {
            id: "beat_jo",
            speaker: "CRAZY BIG HOLE JO",
            text: "Not that you care but boyfriend sleeping over",
            voiceFile: leftoverJoMp3,
          },
        ],
        sfx: [],
      },
    ],
  },
]);
const parkedJo = attachAudioFilenamesToStory(joLeftoverLine, [
  leftoverJoMp3,
  leftoverAudio[0],
]);
assert.equal(parkedJo.scenes[0].shots[0].beats[0].voiceFile || "", "");
assert.equal(parkedJo.scenes[0].shots[0].beats[0].text, "");

const savedTake = "01_01_CRAZY_BIG_HOLE_JO_sitting-texting_mjx8k2.mp3";
const joSaved = story([
  {
    id: "scene_jo",
    title: "Jo's bedroom (the cell)",
    placeName: "Jo's bedroom (the cell)",
    worldThumbKey: "",
    shots: [
      {
        id: "shot_jo_new",
        title: "CRAZY BIG HOLE JO",
        summary: "",
        plateFile: "",
        beats: [
          {
            id: "beat_jo",
            speaker: "CRAZY BIG HOLE JO",
            text: "sitting on the bed texting",
            voiceFile: savedTake,
          },
        ],
        sfx: [],
      },
    ],
  },
]);
const keptSaved = attachAudioFilenamesToStory(joSaved, [leftoverJoMp3, leftoverAudio[0]]);
assert.equal(
  keptSaved.scenes[0].shots[0].beats[0].voiceFile,
  savedTake,
  "hydrate must not steal leftover Jo pack mp3 onto a Saved take",
);
const bazzaTake = "03_01_Ranger_Bazza_Safety-isn't-a-right-folks-its-a-pre_mtaj6vqs.mp3";
const bazzaCard = story([
  {
    id: "scene_park",
    title: "Caravan Park",
    placeName: "Caravan Park",
    worldThumbKey: "",
    shots: [
      {
        id: "shot_twilight",
        title: "Twilight Profits",
        summary: "",
        plateFile: "cplate.png",
        beats: [
          {
            id: "beat_odn47p2",
            speaker: "Ranger Bazza",
            text: "Safety isn't a right",
            voiceFile: bazzaTake,
          },
        ],
        sfx: [],
      },
    ],
  },
]);
const keptBazza = attachAudioFilenamesToStory(bazzaCard, [bazzaTake]);
assert.equal(
  keptBazza.scenes[0].shots[0].beats[0].voiceFile,
  bazzaTake,
  "hydrate must keep a stamped Ranger_Bazza Save (parser only sees Ranger)",
);
assert.equal(keptSaved.scenes[0].shots[0].beats[0].text, "sitting on the bed texting");

const invented = story([
  {
    id: "scene_jo",
    title: "Jo's bedroom (the cell)",
    placeName: "Jo's bedroom (the cell)",
    worldThumbKey: "",
    shots: [
      {
        id: "shot_jo_new",
        title: "Jo's bedroom (the cell)",
        summary: "",
        plateFile: "",
        beats: [
          {
            id: "shot_jo_new_a1",
            speaker: "Comfy",
            text: "Keep the rhythm legend",
            voiceFile: leftoverAudio[0],
          },
          {
            id: "shot_jo_new_a2",
            speaker: "Land",
            text: "Tip jar open",
            voiceFile: leftoverAudio[1],
          },
        ],
        sfx: [],
      },
    ],
  },
]);
assert.equal(isHydratedLeftoverBeat("shot_jo_new", invented.scenes[0].shots[0].beats[0]), true);
const stripped = attachAudioFilenamesToStory(invented, leftoverAudio);
assert.equal(stripped.scenes[0].shots[0].beats.length, 0);

const emptyKit = {
  sceneId: "kit",
  sceneTitle: "",
  styleId: "skidmarks",
  arseholeKey: "",
  castKeys: [],
  castSlotCount: 3,
  worldKeys: [],
  placeSlotCount: 5,
  activePlaceIndex: 0,
  plateFiles: [],
  plateSlotCount: 9,
};
const joKit = attachPlateFilenamesToSceneKit(emptyKit, joCard, leftoverPlates);
assert.equal((joKit?.plateFiles || []).length, 0, "leftover Blob plates must not fill a Jo pack kit");
const stubKit = attachPlateFilenamesToSceneKit(emptyKit, emptyRecipe(), leftoverPlates);
assert.deepEqual(stubKit?.plateFiles, leftoverPlates);

assert.equal(speakerVoiceKey("CRAZY BIG HOLE JO"), "jo");
assert.match(defaultCrashVoicePrompt("CRAZY BIG HOLE JO"), /female/i);
assert.match(defaultCrashVoicePrompt("Comfy"), /male/i);

console.log("check-cloud-story-media: ok");
