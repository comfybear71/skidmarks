/** Run: npx tsx scripts/check-mobile-plate-script.mjs */
import assert from "node:assert/strict";
import {
  cameraLineFromVisual,
  compileConstructionStillPosition,
  compileScriptedPosition,
  isTalkingMcuDefault,
  resolvePlateStaging,
  visualActionFromSummary,
} from "../src/lib/mobilePlateScript.ts";
import { defaultSoloStaging } from "../src/lib/mobileImageMotion.ts";
import { plateIdentityPoseLine } from "../src/lib/plateCast.ts";
import { plateCastStagingNote } from "../src/lib/mobilePlateLines.ts";

const mcu = compileScriptedPosition({ name: "COMFY", place: "Front of the houses" });
assert.equal(isTalkingMcuDefault(mcu), true);
assert.equal(
  visualActionFromSummary(
    "[ACT] I — He shows up\n[VISUAL_ACTION] Comfy strolls down the gravel pavement.\n[SFX] crunch",
  ),
  "Comfy strolls down the gravel pavement.",
);

const walk = compileConstructionStillPosition({
  visual: "Comfy strolls down the gravel pavement. Hands deep in pockets.",
  place: "Front of the houses",
  speakers: ["COMFY"],
});
assert.match(walk, /Walking toward camera/);
assert.match(walk, /Only COMFY in frame/);
assert.equal(isTalkingMcuDefault(walk), false);

const group = compileConstructionStillPosition({
  visual: "The entire crew surrounds him in a tight circle.",
  place: "Front of the houses",
  speakers: ["COMFY", "LADDER ONE", "TEE"],
});
assert.match(group, /WIDE full-body/);
assert.match(group, /Exactly 3 people/);

const tight = cameraLineFromVisual(
  "The camera frame completely freezes on an extreme close-up of Jo Too's swollen, black-and-blue eye staring out in regret.",
  1,
);
assert.match(tight, /TIGHT CLOSE-UP/);
assert.equal(
  cameraLineFromVisual("CrackWhore Darryl sits at the bar, facing camera, mouth clear, empty hands.", 1),
  "",
);
assert.equal(
  cameraLineFromVisual(
    "Wide establishing shot. Red walks from screen-left to center-frame. Camera is completely static.",
    1,
  ),
  "",
);

const cheapTalk = compileConstructionStillPosition({
  visual: "CrackWhore Darryl sits at the bar, facing camera, mouth clear, empty hands.",
  place: "Dirty Dog Pub",
  speakers: ["CRACKWHORE DARRYL"],
  cheap: true,
});
assert.equal(isTalkingMcuDefault(cheapTalk), true);
assert.doesNotMatch(cheapTalk, /not a sitting talking-head/);
assert.doesNotMatch(cheapTalk, /cartoon/);

const wolfWords = compileConstructionStillPosition({
  visual:
    "Dynamic LTX motion pass. The Wolf leaps. cartoon eyes widening. LTX simulation triggers.",
  place: "Grandma Bedroom",
  speakers: ["RED"],
});
assert.equal(isTalkingMcuDefault(wolfWords), true);
assert.doesNotMatch(wolfWords, /cartoon eyes/);
assert.doesNotMatch(wolfWords, /LTX simulation/);

assert.equal(
  resolvePlateStaging({
    stagingIn: mcu,
    existingStaging: mcu,
    summary: "[VISUAL_ACTION] Comfy strolls down the gravel pavement.",
    speaker: "COMFY",
    place: "Front of the houses",
  }),
  compileConstructionStillPosition({
    visual: "Comfy strolls down the gravel pavement.",
    place: "Front of the houses",
    speakers: ["COMFY"],
  }),
);

const human = "MEDIUM SHOT. Leaning on the donga wall. Only JO in frame.";
assert.equal(
  resolvePlateStaging({
    stagingIn: human,
    existingStaging: mcu,
    summary: "[VISUAL_ACTION] ignored because human typed Position",
    speaker: "JO",
    place: "THE DONGA",
  }),
  human,
);

assert.match(
  resolvePlateStaging({
    speaker: "COMFY",
    place: "Front of the houses",
  }),
  /Medium close-up of COMFY/,
);

const rawVisual = "Comfy strolls down the gravel pavement.";
const compiledWalk = compileConstructionStillPosition({
  visual: rawVisual,
  place: "Front of the houses",
  speakers: ["COMFY"],
});
assert.equal(
  resolvePlateStaging({
    existingStaging: rawVisual,
    summary: `[VISUAL_ACTION] ${rawVisual}`,
    speaker: "COMFY",
    place: "Front of the houses",
  }),
  compiledWalk,
);
assert.match(compiledWalk, /Walking toward camera/);

assert.equal(
  resolvePlateStaging({
    stagingIn: mcu,
    existingStaging: mcu,
    summary:
      "[BUDGET_TIER] CHEAP_TAKE\n[VISUAL_ACTION] Comfy strolls down the gravel pavement.",
    speaker: "COMFY",
    place: "Front of the houses",
  }),
  mcu,
);

assert.equal(
  resolvePlateStaging({
    summary:
      "[BUDGET_TIER] CHEAP_TAKE\n[VISUAL_ACTION] CrackWhore Darryl sits at the bar, facing camera.",
    speaker: "CRACKWHORE DARRYL",
    place: "Dirty Dog Pub",
  }),
  compileScriptedPosition({ name: "CRACKWHORE DARRYL", place: "Dirty Dog Pub" }),
);

const leftoverAmitabha =
  "AMITABHA alone. Only AMITABHA in frame, no one else appears. Standing centre-frame, facing camera, mid body. Empty hands. No phone. No extra objects.";
assert.equal(
  resolvePlateStaging({
    stagingIn: leftoverAmitabha,
    existingStaging: leftoverAmitabha,
    speaker: "AMITABHA",
    place: "Temple",
  }),
  defaultSoloStaging("AMITABHA"),
);
assert.doesNotMatch(
  resolvePlateStaging({
    stagingIn: leftoverAmitabha,
    speaker: "AMITABHA",
    place: "Temple",
  }),
  /Standing centre-frame/,
);
assert.match(plateIdentityPoseLine(leftoverAmitabha), /Keep the EXACT body pose/);
assert.doesNotMatch(plateIdentityPoseLine(leftoverAmitabha), /unless the tweak names a pose/);
assert.match(
  plateIdentityPoseLine("AMITABHA sitting on the lotus."),
  /Use the pose, crop, clothes/,
);
const amitabhaNote = plateCastStagingNote({
  speakers: ["AMITABHA"],
  staging: leftoverAmitabha,
});
assert.doesNotMatch(amitabhaNote, /Standing centre-frame/);
assert.match(amitabhaNote, /keep that still's pose/);

console.log("check-mobile-plate-script: ok");
