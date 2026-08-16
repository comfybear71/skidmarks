import assert from "node:assert/strict";
import {
  clearAllStoryShots,
  mergeClipsFromStory,
  queueableStoryBeats,
  queuedSavedClips,
  upsertPendingClip,
} from "../src/lib/mobileClipQueue.ts";
import { leftoverHydrateBeat } from "../src/lib/mobilePlateLines.ts";

assert.equal(leftoverHydrateBeat("shot_jo", "shot_jo_a1"), true);

const leftoverJoStory = {
  styleId: "skidmarks",
  title: "Jo",
  logline: "",
  scenes: [
    {
      id: "sc1",
      placeName: "cell",
      worldThumbKey: "",
      shots: [
        {
          id: "shot_jo",
          title: "CRAZY BIG HOLE JO",
          summary: "",
          staging: "sitting on her bed",
          plateFile: "cplate_jo.png",
          beats: [
            {
              id: "shot_jo_a1",
              speaker: "Comfy",
              text: "leftover",
              voiceFile: "01_01_Comfy_Keep-the-rhythm.mp3",
            },
            {
              id: "beat_jo",
              speaker: "CRAZY BIG HOLE JO",
              text: "Not that you care but boyfriend sleeping over",
              voiceFile: "01_01_CRAZY_BIG_HOLE_JO_Not-that.mp3",
            },
          ],
        },
      ],
    },
  ],
};

const savedStory = {
  ...leftoverJoStory,
  scenes: [
    {
      ...leftoverJoStory.scenes[0],
      shots: [
        {
          ...leftoverJoStory.scenes[0].shots[0],
          beats: [
            leftoverJoStory.scenes[0].shots[0].beats[0],
            {
              id: "beat_jo",
              speaker: "CRAZY BIG HOLE JO",
              text: "sitting on the bed texting",
              voiceFile: "01_01_CRAZY_BIG_HOLE_JO_sitting-texting_mjx8k2.mp3",
            },
          ],
        },
      ],
    },
  ],
};

const job = {
  id: "job1",
  styleId: "skidmarks",
  folderName: "CRAZY BIG HOLE JO 62_906",
  prompt: "",
  targetDurationSec: 0,
  secondsPerShot: 0,
  phase: "review",
  speakers: ["CRAZY BIG HOLE JO"],
  roster: [],
  scenes: [{ id: "sc1", placeName: "cell", worldThumbKey: "" }],
  castCandidates: {},
  locationCandidates: {},
  shots: [{ shotId: "shot_jo", sceneId: "sc1", plateFile: "cplate_jo.png" }],
  clips: [],
  finalVideoFile: "",
  error: "",
  createdAt: "",
  updatedAt: "",
};

assert.equal(
  queueableStoryBeats(leftoverJoStory, job).length,
  0,
  "leftover compiled Jo mp3 must not count as 1 audio queued",
);

const queued = queueableStoryBeats(savedStory, job);
assert.equal(queued.length, 1);
assert.equal(queued[0].beatId, "beat_jo");
assert.match(queued[0].voiceFile, /_mjx8k2\.mp3$/);

const leftoverStory = {
  ...savedStory,
  scenes: [
    {
      ...savedStory.scenes[0],
      shots: [
        savedStory.scenes[0].shots[0],
        {
          id: "shot_2qnv2g8",
          title: "MATTY",
          summary: "",
          staging: "",
          plateFile: "",
          beats: [
            {
              id: "beat_matty",
              speaker: "MATTY",
              text: "Who's dry? Nobody stays dry in my place.",
              voiceFile: "01_02_MATTY_Whos-dry.mp3",
            },
          ],
        },
        {
          id: "shot_land",
          title: "LAND LANDY",
          summary: "",
          staging: "",
          plateFile: "",
          beats: [
            {
              id: "beat_land",
              speaker: "LAND LANDY",
              text: "Is this the special drink service?",
              voiceFile: "01_03_LAND_LANDY_Is-this.mp3",
            },
          ],
        },
      ],
    },
  ],
};
assert.equal(queueableStoryBeats(leftoverStory, job).length, 1);
assert.equal(queueableStoryBeats(leftoverStory, job)[0].speaker, "CRAZY BIG HOLE JO");
assert.equal(mergeClipsFromStory(job, leftoverStory).length, 1);
assert.equal(mergeClipsFromStory(job, leftoverStory)[0].speaker, "CRAZY BIG HOLE JO");

const lockedLeftoverClips = mergeClipsFromStory(
  {
    ...job,
    clips: [
      {
        beatId: "beat_matty",
        shotId: "shot_2qnv2g8",
        sceneId: "sc1",
        clipFile: "",
        clipStatus: "pending",
        error: "",
        speaker: "MATTY",
        line: "Who's dry?",
      },
    ],
  },
  leftoverStory,
);
assert.equal(lockedLeftoverClips.length, 1);
assert.equal(lockedLeftoverClips[0].beatId, "beat_jo");

const wiped = clearAllStoryShots(leftoverStory);
assert.equal(wiped.removed.length, 3);
assert.equal(wiped.story.scenes[0].shots.length, 0);

assert.equal(
  mergeClipsFromStory(job, leftoverJoStory).length,
  0,
  "leftover Jo pack audio must not queue",
);

const emptyQueue = mergeClipsFromStory(job, savedStory);
assert.equal(emptyQueue.length, 1, "Saved Jo line must queue even if job.clips was empty");
assert.equal(emptyQueue[0].clipStatus, "pending");
assert.match(emptyQueue[0].line, /sitting on the bed texting/);
assert.equal(queuedSavedClips(emptyQueue).length, 1);

const afterSave = upsertPendingClip({ ...job, clips: [] }, savedStory, "beat_jo");
assert.equal(afterSave.length, 1);
assert.equal(afterSave[0].clipStatus, "pending");

const alreadyDone = mergeClipsFromStory(
  {
    ...job,
    clips: [{ ...emptyQueue[0], clipStatus: "done", clipFile: "out.mp4" }],
  },
  savedStory,
);
assert.equal(alreadyDone[0].clipStatus, "done");

console.log("check-mobile-clip-queue: ok");
