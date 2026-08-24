import assert from "node:assert/strict";
import {
  episodeTemplateFromJob,
  normalizePlaceKey,
  parseMobilePaste,
  storyHasSpokenLine,
} from "../src/lib/mobilePasteParse.ts";
import {
  clampLtxDurationSec,
  ltxFollowsMp3DurationSec,
  LTX_LIPSYNC_MIN_SEC,
  LTX_MAX_DURATION_SEC,
} from "../src/lib/ltxDuration.ts";
import { isAssistKind } from "../src/lib/mobileAssist.ts";

const job = {
  prompt: "CRAZY BIG HOLE JO",
  speakers: ["MATTY", "JO"],
  scenes: [{ placeName: "Matty bar" }, { placeName: "Front of the houses" }],
};

const template = episodeTemplateFromJob(job);
assert.match(template, /^EPISODE: CRAZY BIG HOLE JO/m);
const skidBlank = episodeTemplateFromJob({ ...job, styleId: "skidmarks" });
assert.match(skidBlank, /CAST_MAIN|ACT_/i);
const mv = episodeTemplateFromJob({
  ...job,
  artist: "Jack Ghost",
  songTitle: "Take Me Down",
});
assert.match(mv, /Jack Ghost — Take Me Down/);
assert.match(mv, /Artist: Jack Ghost/);
assert.match(mv, /Song: Take Me Down/);
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
Plate: Matty leans on the fridge. Jo sits on a stool. Not a lineup.
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
assert.match(shotDoc.story.scenes[0].shots[0].staging || "", /fridge/);
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

const construction = `## MASTER EPISODE CONSTRUCTION TEMPLATE
## [EPISODE_METADATA]
* [EP_TITLE]: The Mouth of the Hole
## [EPISODE_TIMELINE]## <ACT_I>
* [ACT]: I — He shows up
* [ENV]: Front of the houses
## <SHOT_01>
* [BUDGET_TIER]: CHEAP_TAKE
* [VISUAL_ACTION]: Comfy strolls down the gravel.
* [SFX]: Crunching gravel.
## <SHOT_02>
* [CAST]: COMFY, CRAZY BIG HOLE JO TOO
* [VISUAL_ACTION]: Jo Too leans out of a window.
* [DIAL]: CRAZY BIG HOLE JO TOO: "Comfy, hey comfy, i wanna talk to you about your wife LandLady..."
## <ACT_III>
* [ACT]: III — Keeps proving it
* [ENV]: By the pool
## <SHOT_01>
* [VISUAL_ACTION]: Tee is sunbathing. Jo knocks the sunglasses in.
* CRAZY BIG HOLE JO TOO: "Go dive for 'em, looks like you need the exercise."
## <ACT_IV>
* [ACT]: IV — Gets a beat down
* [ENV]: MATTY BAR
## <SHOT_01>
* [VISUAL_ACTION]: Comfy corners Jo Too.
* [DIAL]: LADDER ONE: "Hey! Watch it, man!"
CRAZY BIG HOLE JO TOO: "Keep moving, box boy, before I dump your milk!"
`;

const built = parseMobilePaste(construction, "skidmarks", "CRAZY BIG HOLE");
assert.equal(built.title, "The Mouth of the Hole");
assert.equal(built.story.scenes.length, 3);
assert.equal(
  built.story.scenes.map((s) => s.placeName).join(" | "),
  "Front of the houses | By the pool | MATTY BAR",
);
assert.equal(built.story.scenes[0].shots.length, 2);
assert.equal(built.story.scenes[0].shots[0].title, "SHOT 01 — He shows up");
assert.equal(built.story.scenes[0].shots[1].beats[0].speaker, "Crazy Big Hole Jo Too");
assert.match(built.story.scenes[0].shots[1].beats[0].text, /LandLady/);
assert.equal(built.story.scenes[1].shots[0].beats[0].text, "Go dive for 'em, looks like you need the exercise.");
assert.equal(built.story.scenes[2].shots[0].beats.length, 2);
assert.equal(built.story.scenes[2].shots[0].beats[0].speaker, "Ladder One");
assert.equal(built.story.scenes[2].shots[0].beats[1].speaker, "Crazy Big Hole Jo Too");
assert.match(built.story.scenes[0].shots[0].summary, /\[BUDGET_TIER\] CHEAP_TAKE/);
assert.match(built.story.scenes[0].shots[1].summary, /\[VISUAL_ACTION\]/);
assert.match(built.story.scenes[0].shots[1].staging || "", /window/);
assert.equal(storyHasSpokenLine(built.story), true);

assert.equal(normalizePlaceKey("INT. MATTY BAR - DAY"), "matty bar");
assert.equal(normalizePlaceKey("Matty bar"), "matty bar");

assert.equal(clampLtxDurationSec(1), 2);
assert.equal(clampLtxDurationSec(12), 12);
assert.equal(clampLtxDurationSec(400), LTX_MAX_DURATION_SEC);
assert.equal(ltxFollowsMp3DurationSec(1), LTX_LIPSYNC_MIN_SEC);
assert.equal(ltxFollowsMp3DurationSec(12), 13);
assert.equal(isAssistKind("episode"), true);
assert.equal(isAssistKind("screenplay"), false);

console.log("check-mobile-paste-script: ok");
