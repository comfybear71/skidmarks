import assert from "node:assert/strict";
import {
  mergeClipsFromStory,
  queueableStoryBeats,
  upsertPendingClip,
} from "../src/lib/mobileClipQueue.ts";
import { leftoverHydrateBeat } from "../src/lib/mobilePlateLines.ts";

assert.equal(leftoverHydrateBeat("shot_jo", "shot_jo_a1"), true);

const story = {
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
              text: "Not that you care",
              voiceFile: "01_01_CRAZY_BIG_HOLE_JO_Not-that.mp3",
            },
          ],
        },
      ],
    },
  ],
};

const queued = queueableStoryBeats(story);
assert.equal(queued.length, 1);
assert.equal(queued[0].beatId, "beat_jo");

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

const emptyQueue = mergeClipsFromStory(job, story);
assert.equal(emptyQueue.length, 1, "saved Jo line must queue even if job.clips was empty");
assert.equal(emptyQueue[0].clipStatus, "pending");
assert.match(emptyQueue[0].line, /Not that you care/);

const afterSave = upsertPendingClip({ ...job, clips: [] }, story, "beat_jo");
assert.equal(afterSave.length, 1);
assert.equal(afterSave[0].clipStatus, "pending");

const alreadyDone = mergeClipsFromStory(
  {
    ...job,
    clips: [{ ...emptyQueue[0], clipStatus: "done", clipFile: "out.mp4" }],
  },
  story,
);
assert.equal(alreadyDone[0].clipStatus, "done");

console.log("check-mobile-clip-queue: ok");
