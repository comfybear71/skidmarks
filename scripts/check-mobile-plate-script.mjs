/** Run: npx tsx scripts/check-mobile-plate-script.mjs */
import assert from "node:assert/strict";
import {
  cameraLineFromVisual,
  castNamedInVisual,
  compileConstructionStillPosition,
  compileScriptedPosition,
  isStaleSoloConstruction,
  isTalkingMcuDefault,
  resolvePlateStaging,
  speakersForConstructionStill,
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

const roster = [
  "LADDER ONE",
  "BIG SEXY",
  "LAND LANDY",
  "TEE",
  "BC",
  "COMFY",
  "MATTY",
  "CRAZY BIG HOLE JO TOO",
];
assert.deepEqual(
  castNamedInVisual(
    "Tee is sunbathing near the edge. Jo Too walks by and knocks Tee’s sunglasses.",
    roster,
  ).sort(),
  ["CRAZY BIG HOLE JO TOO", "TEE"].sort(),
);
assert.deepEqual(
  speakersForConstructionStill({
    speaker: "Crazy Big Hole Jo Too",
    speakers: ["Crazy Big Hole Jo Too"],
    visual: "Tee is sunbathing near the edge. Jo Too walks by.",
    roster,
  }),
  ["Crazy Big Hole Jo Too", "TEE"],
);
const soloWalk = compileConstructionStillPosition({
  visual: "Tee is sunbathing near the edge. Jo Too walks by.",
  place: "By the pool",
  speakers: ["Crazy Big Hole Jo Too"],
});
assert.match(soloWalk, /Only Crazy Big Hole Jo Too in frame/);
assert.equal(isStaleSoloConstruction(soloWalk, ["Crazy Big Hole Jo Too", "TEE"]), true);
assert.equal(
  resolvePlateStaging({
    existingStaging: soloWalk,
    summary: "[VISUAL_ACTION] Tee is sunbathing near the edge. Jo Too walks by.",
    speaker: "Crazy Big Hole Jo Too",
    speakers: ["Crazy Big Hole Jo Too"],
    roster,
    place: "By the pool",
  }),
  compileConstructionStillPosition({
    visual: "Tee is sunbathing near the edge. Jo Too walks by.",
    place: "By the pool",
    speakers: ["Crazy Big Hole Jo Too", "TEE"],
  }),
);
assert.match(
  compileConstructionStillPosition({
    visual: "Big Sexy tears the belt off Jo Too's waist.",
    place: "2nd house",
    speakers: ["BIG SEXY", "CRAZY BIG HOLE JO TOO"],
  }),
  /nearest camera, others reacting/,
);

console.log("check-mobile-plate-script: ok");
