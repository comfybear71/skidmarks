import assert from "node:assert/strict";
import {
  clearAllStoryShots,
  findStoryShotBeat,
  mergeClipsFromStory,
  nextClipToAnimate,
  parkOtherPendingClips,
  previousDoneClipOnShot,
  queueableStoryBeats,
  queueOneBeatForAnimate,
  queuedSavedClips,
  upsertPendingClip,
} from "../src/lib/mobileClipQueue.ts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
{
  const holdQueued = queueableStoryBeats(
    {
      ...leftoverJoStory,
      scenes: [
        {
          ...leftoverJoStory.scenes[0],
          shots: [
            {
              id: "shot_hold",
              title: "Smoke",
              summary: "",
              staging: "",
              plateFile: "cplate_smoke.png",
              beats: [
                {
                  id: "beat_hold",
                  speaker: "",
                  text: "",
                  voiceFile: "beat_hold.mp3",
                  kind: "hold",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      ...job,
      shots: [{ shotId: "shot_hold", sceneId: "sc1", plateFile: "cplate_smoke.png" }],
    },
  );
  assert.equal(holdQueued.length, 1);
  assert.equal(holdQueued[0].line, "");
}
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

const keepFirst = upsertPendingClip(
  {
    ...job,
    clips: [
      {
        beatId: "beat_jo",
        shotId: "shot_jo",
        sceneId: "sc1",
        clipFile: "first.mp4",
        priorClipFiles: [],
        clipStatus: "done",
        error: "",
        speaker: "CRAZY BIG HOLE JO",
        line: "sitting on the bed texting",
        voiceFile: "01_01_CRAZY_BIG_HOLE_JO_sitting-texting_mjx8k2.mp3",
      },
    ],
  },
  savedStory,
  "beat_jo",
);
assert.equal(keepFirst[0].clipFile, "first.mp4", "Save / Generate again must not wipe the first mp4");
assert.equal(keepFirst[0].clipStatus, "pending");

assert.equal(
  upsertPendingClip({ ...job, clips: [] }, leftoverJoStory, "beat_jo").length,
  0,
  "Save must not queue leftover compiled Jo mp3",
);

const keptPending = mergeClipsFromStory(
  {
    ...job,
    clips: [
      {
        beatId: "beat_jo",
        shotId: "shot_jo",
        sceneId: "sc1",
        clipFile: "",
        clipStatus: "pending",
        error: "",
        speaker: "CRAZY BIG HOLE JO",
        line: "sitting on the bed texting",
        voiceFile: "01_01_CRAZY_BIG_HOLE_JO_sitting-texting_mjx8k2.mp3",
      },
    ],
  },
  leftoverJoStory,
);
assert.equal(keptPending.length, 1, "Generate must not drop a Saved take if hydrate still shows leftover pack");
assert.equal(keptPending[0].clipStatus, "pending");

const savedMp3 = "01_01_LADDER_ONE_her-line_mjx8k2.mp3";
const hydratedScratchStory = {
  ...savedStory,
  scenes: [
    {
      ...savedStory.scenes[0],
      shots: [
        {
          id: "scr1",
          title: "Scratch",
          summary: "",
          staging: "",
          plateFile: "p.png",
          beats: [{ id: "b1", speaker: "LADDER ONE", text: "Hi", voiceFile: "" }],
        },
      ],
    },
  ],
};
const scratchClipJob = {
  ...job,
  speakers: ["LADDER ONE"],
  shots: [{ shotId: "scr1", sceneId: "sc1", plateFile: "p.png" }],
  clips: [
    {
      beatId: "b1",
      shotId: "scr1",
      sceneId: "sc1",
      clipFile: "",
      clipStatus: "pending",
      error: "",
      speaker: "LADDER ONE",
      line: "Hi",
      voiceFile: savedMp3,
    },
  ],
};
assert.equal(
  mergeClipsFromStory(scratchClipJob, hydratedScratchStory).find((c) => c.beatId === "b1")?.voiceFile,
  savedMp3,
  "hydrated story must not wipe the Saved mp3 on the clip row",
);

const alreadyDone = mergeClipsFromStory(
  {
    ...job,
    clips: [{ ...emptyQueue[0], clipStatus: "done", clipFile: "out.mp4" }],
  },
  savedStory,
);
assert.equal(alreadyDone[0].clipStatus, "done");

const a1 = {
  beatId: "a1",
  shotId: "shot_jo",
  clipStatus: "done",
  clipFile: "a1.mp4",
};
const a2 = {
  beatId: "a2",
  shotId: "shot_jo",
  clipStatus: "pending",
  clipFile: "",
};
const b1 = {
  beatId: "b1",
  shotId: "shot_other",
  clipStatus: "pending",
  clipFile: "",
};

assert.equal(nextClipToAnimate([a1, a2]).beatId, "a2");
assert.equal(previousDoneClipOnShot([a1, a2], a2)?.beatId, "a1");
assert.equal(
  previousDoneClipOnShot([a1, a2], a2)?.clipFile,
  "a1.mp4",
  "chunk 2 must chain from chunk 1's mp4",
);

const waiting = [
  { ...a1, clipStatus: "running", clipFile: "" },
  a2,
];
assert.equal(nextClipToAnimate(waiting), null, "do not start chunk 2 while chunk 1 is still rendering");

const firstPending = [
  { ...a1, clipStatus: "pending", clipFile: "" },
  a2,
];
assert.equal(nextClipToAnimate(firstPending)?.beatId, "a1");

const parallelOtherShot = [
  { ...a1, clipStatus: "running", clipFile: "" },
  a2,
  b1,
];
assert.equal(
  nextClipToAnimate(parallelOtherShot)?.beatId,
  "b1",
  "a different shot can still start while this rant is rendering",
);
assert.equal(previousDoneClipOnShot([a1, b1], b1), null, "other shot uses its own plate");

const afterError = [
  { ...a1, clipStatus: "error", clipFile: "" },
  a2,
];
assert.equal(nextClipToAnimate(afterError)?.beatId, "a2");
assert.equal(
  previousDoneClipOnShot(afterError, a2),
  null,
  "failed chunk has no last frame — next clip falls back to the plate",
);

const three = [
  a1,
  { beatId: "a2done", shotId: "shot_jo", clipStatus: "done", clipFile: "a2.mp4" },
  { beatId: "a3", shotId: "shot_jo", clipStatus: "pending", clipFile: "" },
];
assert.equal(previousDoneClipOnShot(three, three[2])?.clipFile, "a2.mp4");

const twoClipJob = {
  ...job,
  clips: [
    {
      beatId: "beat_jo",
      shotId: "shot_jo",
      sceneId: "sc1",
      clipFile: "jo.mp4",
      clipStatus: "done",
      error: "",
      speaker: "CRAZY BIG HOLE JO",
      line: "hi",
      voiceFile: "01_01_CRAZY_BIG_HOLE_JO_sitting-texting_mjx8k2.mp3",
    },
    {
      beatId: "beat_other",
      shotId: "shot_x",
      sceneId: "sc1",
      clipFile: "x.mp4",
      clipStatus: "done",
      error: "",
      speaker: "X",
      line: "yo",
      voiceFile: "01_02_X_yo_abc12.mp3",
    },
  ],
};
const oneBeat = queueOneBeatForAnimate(twoClipJob, savedStory, "beat_jo");
assert.equal(oneBeat.error, undefined);
assert.equal(oneBeat.clips.find((c) => c.beatId === "beat_jo")?.clipStatus, "pending");
assert.equal(
  oneBeat.clips.find((c) => c.beatId === "beat_other")?.clipStatus,
  "done",
  "Generate on one line must not re-queue every Saved mp3",
);

const leftoverOne = queueOneBeatForAnimate(job, leftoverJoStory, "shot_jo_a1");
assert.match(leftoverOne.error || "", /Save the spoken line/);

const twoLineStory = {
  ...savedStory,
  scenes: [
    {
      ...savedStory.scenes[0],
      shots: [
        {
          ...savedStory.scenes[0].shots[0],
          beats: [
            leftoverJoStory.scenes[0].shots[0].beats[0],
            savedStory.scenes[0].shots[0].beats[1],
            {
              id: "beat_nuggets",
              speaker: "Nuggets",
              text: "See. That's them saying no. I think.",
              voiceFile: "01_02_Nuggets_see-thats_abc12xyz.mp3",
            },
          ],
        },
      ],
    },
  ],
};
const twoLineJob = {
  ...job,
  speakers: ["CRAZY BIG HOLE JO", "Nuggets"],
  clips: [],
};
const saveOneLine = upsertPendingClip(twoLineJob, twoLineStory, "beat_nuggets");
assert.equal(saveOneLine.length, 1, "Save must not mint a pending row for every other Saved mp3");
assert.equal(saveOneLine[0].beatId, "beat_nuggets");

const generateOneFromEmpty = queueOneBeatForAnimate(twoLineJob, twoLineStory, "beat_nuggets");
assert.equal(generateOneFromEmpty.error, undefined);
assert.equal(
  generateOneFromEmpty.clips.filter((c) => c.clipStatus === "pending").map((c) => c.beatId).join(),
  "beat_nuggets",
  "Generate on Nuggets must not queue Jo's Saved line too",
);
assert.equal(
  nextClipToAnimate(generateOneFromEmpty.clips)?.beatId,
  "beat_nuggets",
);

const bothPendingJob = {
  ...twoLineJob,
  clips: [
    {
      beatId: "beat_jo",
      shotId: "shot_jo",
      sceneId: "sc1",
      clipFile: "",
      clipStatus: "pending",
      error: "",
      speaker: "CRAZY BIG HOLE JO",
      line: "sitting on the bed texting",
      voiceFile: "01_01_CRAZY_BIG_HOLE_JO_sitting-texting_mjx8k2.mp3",
    },
    {
      beatId: "beat_nuggets",
      shotId: "shot_jo",
      sceneId: "sc1",
      clipFile: "",
      clipStatus: "pending",
      error: "",
      speaker: "Nuggets",
      line: "See. That's them saying no. I think.",
      voiceFile: "01_02_Nuggets_see-thats_abc12xyz.mp3",
    },
  ],
};
const generateOneFromPanel = queueOneBeatForAnimate(bothPendingJob, twoLineStory, "beat_nuggets");
assert.equal(
  generateOneFromPanel.clips.filter((c) => c.clipStatus === "pending").map((c) => c.beatId).join(),
  "beat_nuggets",
  "Generate on one line must park the other pending lines in that panel",
);
assert.equal(
  generateOneFromPanel.clips.some((c) => c.beatId === "beat_jo" && c.clipStatus === "pending"),
  false,
);

const requeuedTake = parkOtherPendingClips(
  [
    {
      beatId: "beat_jo",
      shotId: "shot_jo",
      sceneId: "sc1",
      clipFile: "jo.mp4",
      clipStatus: "pending",
      error: "",
      speaker: "CRAZY BIG HOLE JO",
      line: "hi",
    },
    {
      beatId: "beat_nuggets",
      shotId: "shot_jo",
      sceneId: "sc1",
      clipFile: "",
      clipStatus: "pending",
      error: "",
      speaker: "Nuggets",
      line: "See.",
    },
  ],
  "beat_nuggets",
);
assert.equal(requeuedTake.find((c) => c.beatId === "beat_jo")?.clipStatus, "done");
assert.equal(requeuedTake.find((c) => c.beatId === "beat_jo")?.clipFile, "jo.mp4");
assert.equal(requeuedTake.find((c) => c.beatId === "beat_nuggets")?.clipStatus, "pending");

const dupSceneStory = {
  styleId: "sunny_banks",
  title: "dup",
  logline: "",
  scenes: [
    {
      id: "scene_zam0tq9",
      placeName: "Near Site Laundry",
      worldThumbKey: "",
      shots: [
        {
          id: "shot_other",
          title: "Other",
          summary: "",
          staging: "",
          plateFile: "a.png",
          beats: [{ id: "beat_other", speaker: "Dazza", text: "nah", voiceFile: "a.mp3" }],
        },
      ],
    },
    {
      id: "scene_zam0tq9",
      placeName: "Outside Site Laundry",
      worldThumbKey: "",
      shots: [
        {
          id: "shot_m4p8il7",
          title: "The Aliens Realise",
          summary: "",
          staging: "",
          plateFile: "b.png",
          beats: [
            {
              id: "beat_feh57t0",
              speaker: "The Unit 4s",
              text: "Observation",
              voiceFile: "b.mp3",
            },
          ],
        },
      ],
    },
  ],
};
const firstCopy = dupSceneStory.scenes.find((sc) => sc.id === "scene_zam0tq9");
assert.equal(firstCopy?.shots.some((sh) => sh.id === "shot_m4p8il7"), false);
const home = findStoryShotBeat(dupSceneStory, {
  shotId: "shot_m4p8il7",
  beatId: "beat_feh57t0",
});
assert.equal(home?.shot.title, "The Aliens Realise");
assert.equal(home?.beat.speaker, "The Unit 4s");
assert.equal(findStoryShotBeat(dupSceneStory, { shotId: "shot_m4p8il7", beatId: "nope" }), null);

const stepSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/app/api/crash/mobile/step/route.ts"),
  "utf8",
);
assert.match(stepSrc, /findStoryShotBeat/);
assert.doesNotMatch(
  stepSrc,
  /story\.scenes\.find\(\(sc\) => sc\.id === next\.sceneId\)/,
  "Animate must not take the first place with that id",
);

console.log("check-mobile-clip-queue: ok");
