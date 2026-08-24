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

console.log("check-mobile-plate-script: ok");
