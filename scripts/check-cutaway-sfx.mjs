/** Run: npx tsx scripts/check-cutaway-sfx.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CUTAWAY_ACTIONS,
  CUTAWAY_SFX_MAX_SEC,
  CUTAWAY_SFX_MIN_SEC,
  cutawayActionById,
  cutawaySfxInRange,
  cutawaySfxRangeError,
} from "../src/lib/cutawaySfx.ts";
import { queueOneBeatForAnimate } from "../src/lib/mobileClipQueue.ts";

assert.equal(CUTAWAY_SFX_MIN_SEC, 6);
assert.equal(CUTAWAY_SFX_MAX_SEC, 10);
assert.equal(cutawaySfxInRange(6), true);
assert.equal(cutawaySfxInRange(10), true);
assert.equal(cutawaySfxInRange(5.9), true);
assert.equal(cutawaySfxInRange(5.5), false);
assert.equal(cutawaySfxInRange(10.4), false);
assert.equal(cutawaySfxInRange(3), false);
assert.match(cutawaySfxRangeError(3), /3\.0s/);
assert.ok(cutawayActionById("stand-up"));
assert.ok(cutawayActionById("walk-away"));
assert.ok(cutawayActionById("walk-toward"));
assert.equal(CUTAWAY_ACTIONS.length >= 4, true);

const story = {
  styleId: "skidmarks",
  title: "t",
  logline: "",
  scenes: [
    {
      id: "sc1",
      title: "",
      placeName: "lounge",
      worldThumbKey: "",
      shots: [
        {
          id: "shot_bc",
          title: "BC",
          summary: "",
          staging: "sitting",
          plateFile: "cplate.png",
          beats: [
            {
              id: "beat_cut",
              speaker: "BC",
              text: "stands up from sitting, rises to their feet",
              kind: "cutaway",
              action: "stands up from sitting, rises to their feet",
              voiceFile: "",
            },
          ],
          sfx: [],
        },
      ],
    },
  ],
};
const job = {
  id: "job1",
  styleId: "skidmarks",
  folderName: "PACK",
  prompt: "",
  targetDurationSec: 0,
  speakers: ["BC"],
  shots: [{ shotId: "shot_bc", sceneId: "sc1", plateFile: "cplate.png" }],
  clips: [],
};
const queued = queueOneBeatForAnimate(job, story, "beat_cut");
assert.match(queued.error || "", /6–10s SFX/i);

const editor = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/components/mobile/PlateReviewEditor.tsx"),
  "utf8",
);
assert.match(editor, /add-cutaway/);
assert.match(editor, /CutawayBeatPanel/);
assert.doesNotMatch(editor, /CutawayBeatEditor/);

const panel = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/components/mobile/CutawayBeatPanel.tsx"),
  "utf8",
);
assert.match(panel, /Do not Redo Position/);
assert.match(panel, /cutaway-sfx/);

console.log("check-cutaway-sfx: ok");
