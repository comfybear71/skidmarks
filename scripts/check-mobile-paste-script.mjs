import assert from "node:assert/strict";
import {
  episodeTemplateFromJob,
  normalizePlaceKey,
  parseMobilePaste,
  storyHasSpokenLine,
} from "../src/lib/mobilePasteParse.ts";
import {
  keepJobUnitsForStory,
  mergePastedActIntoStory,
} from "../src/lib/mobileAppendAct.ts";
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

const namedCue = parseMobilePaste(
  `EPISODE: Drop Bear
GAG: Turkeys nest in the cart.

--- SHOT 1 ---
Title: The Warning
Place: Caravan park
Cast: Ranger Dan
Camera: wide
Plate: Weathered timber deck. Ranger Bazza holds a megaphone.
Name: Ranger Dan
[Megaphone static screech] "Attention, residents! The Mega-Drop Bear!"

--- SHOT 2 ---
Title: Sign
Place: Ranger office
Cast: None
Camera: tight close-up
Plate: Fresh lettering on a wooden board.
Name: None
[A single, distant, aggressive turkey gobble]
`,
  "sunny_banks",
);
assert.equal(namedCue.story.scenes.length, 2);
assert.equal(namedCue.story.scenes[0].shots[0].beats[0].speaker, "Ranger Bazza");
assert.match(namedCue.story.scenes[0].shots[0].beats[0].text, /Mega-Drop Bear/);
assert.match(namedCue.story.scenes[0].shots[0].staging || "", /Camera: wide/);
assert.equal(namedCue.story.scenes[0].shots[0].sfx?.[0]?.label, "Megaphone static screech");
assert.equal(namedCue.story.scenes[1].shots[0].beats[0].speaker, "");
assert.equal(namedCue.story.scenes[1].shots[0].sfx?.[0]?.label, "A single, distant, aggressive turkey gobble");

const tenB = parseMobilePaste(
  `EPISODE: Split
GAG: Split.

--- SHOT 10 ---
Place: Caravan park
Cast: Dazza, Ranger Dan, Bubbles
Name: Ranger Dan
[Gasp] "Look at it!"

--- SHOT 10B ---
Place: Caravan park
Cast: Caravan Park Resident 1
Name: Caravan Park Resident 1
[Excited chatter] "Look at the teeth!"
`,
  "sunny_banks",
);
assert.equal(tenB.story.scenes[0].shots.length, 2);
assert.equal(tenB.story.scenes[0].shots[0].beats[0].speaker, "Ranger Bazza");
assert.equal(tenB.story.scenes[0].shots[1].beats[0].speaker, "Caravan Park Resident 1");

const act1 = parseMobilePaste(
  `EPISODE: THE GREATEST JOKE IN AUSTRALIA
GAG: Drop bears.

--- SHOT 1 ---
Place: Caravan park
Title: SHOT 01 — Ranger Bazza
RANGER BAZZA
Well here we go.
`,
  "sunny_banks",
);
const act2 = parseMobilePaste(
  `EPISODE: THE GREATEST JOKE IN AUSTRALIA
GAG: Pie bribe.

--- SHOT 12 ---
Place: BBQ shelter
Title: SHOT 12 — Shazza
SHAZZA
Nuggets. I need a favour.

--- SHOT 13 ---
Place: BBQ shelter
Title: SHOT 13 — Nuggets
NUGGETS
Nah. They won't be into it.
`,
  "sunny_banks",
);
const merged = mergePastedActIntoStory({
  existing: act1.story,
  pasted: act2.story,
  jobScenes: [
    { id: act1.story.scenes[0].id, placeName: "Caravan park" },
    { id: "scene_unit9", placeName: "Unit 9" },
    { id: "scene_bbq", placeName: "BBQ shelter" },
  ],
});
assert.equal(merged.scenes.length, 3);
assert.equal(merged.scenes[0].placeName, "Caravan park");
assert.equal(merged.scenes[0].shots.length, 1, "Act I shot stays");
assert.equal(merged.scenes[0].shots[0].id, act1.story.scenes[0].shots[0].id);
assert.equal(merged.scenes[1].placeName, "Unit 9");
assert.equal(merged.scenes[1].shots.length, 0);
assert.equal(merged.scenes[2].id, "scene_bbq");
assert.equal(merged.scenes[2].shots.length, 2);
assert.equal(merged.scenes[2].shots[0].title, "SHOT 12 — Shazza");
const units = keepJobUnitsForStory({
  story: merged,
  shots: [
    {
      shotId: act1.story.scenes[0].shots[0].id,
      sceneId: act1.story.scenes[0].id,
      plateFile: "keep_me.png",
    },
  ],
  clips: [
    {
      beatId: act1.story.scenes[0].shots[0].beats[0].id,
      shotId: act1.story.scenes[0].shots[0].id,
      sceneId: act1.story.scenes[0].id,
      clipFile: "keep_me.mp4",
      clipStatus: "done",
      error: "",
    },
  ],
});
assert.equal(units.shots[0].plateFile, "keep_me.png");
assert.equal(units.clips[0].clipFile, "keep_me.mp4");
assert.equal(units.shots.length, 3);
assert.equal(units.clips.length, 3);
assert.equal(units.shots[1].plateFile, "");
assert.equal(units.clips[1].clipStatus, "pending");

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
