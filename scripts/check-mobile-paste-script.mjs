import assert from "node:assert/strict";
import {
  episodeTemplateFromJob,
  normalizePlaceKey,
  parseMobilePaste,
  storyHasSpokenLine,
} from "../src/lib/mobilePasteScript.ts";
import { clampLtxDurationSec, LTX_MAX_DURATION_SEC } from "../src/lib/ltxDuration.ts";
import { isAssistKind } from "../src/lib/mobileAssist.ts";

const job = {
  prompt: "CRAZY BIG HOLE JO",
  speakers: ["MATTY", "JO"],
  scenes: [{ placeName: "Matty bar" }, { placeName: "Front of the houses" }],
};

const template = episodeTemplateFromJob(job);
assert.match(template, /^EPISODE: CRAZY BIG HOLE JO/m);
assert.match(template, /Place: Matty bar/);
assert.match(template, /Place: Front of the houses/);
assert.throws(
  () => parseMobilePaste(template, "skidmarks"),
  /spoken line/i,
);

const filled = `EPISODE: Crazy Big Hole Jo
GAG: Jo falls in.

--- SHOT 1 ---
Place: Matty bar
Title: Matty waves her in
Action: Tire tracks on the lawn.
MATTY
You coming in or what?
JO
I fell in a hole.

--- SHOT 2 ---
Place: Matty bar
Title: Another round
MATTY
Sit down before you fall in again.
`;

const shotDoc = parseMobilePaste(filled, "skidmarks");
assert.equal(shotDoc.story.scenes.length, 1);
assert.equal(shotDoc.story.scenes[0].placeName, "Matty bar");
assert.equal(shotDoc.story.scenes[0].shots.length, 2);
assert.equal(shotDoc.story.scenes[0].shots[0].beats.length, 2);
assert.equal(shotDoc.story.scenes[0].shots[1].beats[0].text, "Sit down before you fall in again.");
assert.equal(storyHasSpokenLine(shotDoc.story), true);

const json = parseMobilePaste(
  JSON.stringify({
    title: "Crazy Big Hole Jo",
    scenes: [
      {
        place: "Front of the houses",
        shots: [
          {
            title: "The hole",
            beats: [{ speaker: "JO", line: "That hole was bigger than the street." }],
          },
        ],
      },
    ],
  }),
  "skidmarks",
);
assert.equal(json.story.scenes[0].placeName, "Front of the houses");
assert.equal(json.story.scenes[0].shots[0].beats[0].speaker, "Jo");

assert.equal(normalizePlaceKey("INT. MATTY BAR - DAY"), "matty bar");
assert.equal(normalizePlaceKey("Matty bar"), "matty bar");

assert.equal(clampLtxDurationSec(1), 2);
assert.equal(clampLtxDurationSec(12), 12);
assert.equal(clampLtxDurationSec(40), LTX_MAX_DURATION_SEC);
assert.equal(isAssistKind("episode"), true);
assert.equal(isAssistKind("screenplay"), false);

console.log("check-mobile-paste-script: ok");
