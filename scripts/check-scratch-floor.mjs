/** Run: npx tsx scripts/check-scratch-floor.mjs */
import assert from "node:assert/strict";
import { campaignStagingForId, campaignImageMotionForId } from "../src/lib/mobilePlateLtxCampaign.ts";
import { SCRATCH_FLOOR_LAWS, SCRATCH_JO_BLEED } from "../src/lib/scratchFloor.ts";
import { buildScratchStillSend, padHasJo } from "../src/lib/scratchStillSend.ts";
import { scratchNudeStillLock } from "../src/lib/sirayI2v.ts";
import { isScratchShotTitle } from "../src/lib/mobileScratch.ts";

assert.equal(SCRATCH_FLOOR_LAWS.length, 5);
assert.equal(padHasJo(["LADDER ONE"]), false);
assert.equal(padHasJo(["CRAZY BIG HOLE JO"]), true);

const dress = campaignStagingForId("clothes-dress", "LADDER ONE", "her room");
assert.doesNotMatch(dress, SCRATCH_JO_BLEED);
assert.doesNotMatch(dress, /\bphone\b/i);
assert.match(dress, /black dress/i);

const pants = campaignStagingForId("clothes-underwear", "LADDER ONE", "her room");
assert.doesNotMatch(pants, SCRATCH_JO_BLEED);
assert.doesNotMatch(pants, /\bphone\b/i);

const wide = campaignStagingForId("wide-full", "LADDER ONE", "her room");
assert.doesNotMatch(wide, SCRATCH_JO_BLEED);
assert.doesNotMatch(wide, /\bphone\b/i);

const mcu = campaignStagingForId("mcu-phone", "LADDER ONE", "her room");
assert.match(mcu, /phone/i);

const dressMotion = campaignImageMotionForId({
  id: "clothes-dress",
  styleId: "skidmarks",
  speaker: "LADDER ONE",
  line: "hello",
});
assert.doesNotMatch(dressMotion, SCRATCH_JO_BLEED);

const womanNude = scratchNudeStillLock("Adult woman LADDER ONE, fully nude at her room", [
  "LADDER ONE",
]);
assert.doesNotMatch(womanNude, /penis/i);
assert.doesNotMatch(womanNude, /ken doll/i);

const manNude = scratchNudeStillLock("Adult man MATTY, fully nude at the donga", ["MATTY"]);
assert.match(manNude, /penis/i);

const teeNude = scratchNudeStillLock("Adult TEE, fully nude at the bar");
assert.doesNotMatch(teeNude, /ken doll/i);

const ladderSend = buildScratchStillSend({
  styleId: "skidmarks",
  styleRealism: 60,
  placeName: "her room",
  speakers: ["LADDER ONE"],
  looksByName: {
    "LADDER ONE":
      "She is a beutiful Thai lady, lovely body, black hair brown eyse, she is 57 but she looks like 37",
  },
  placeLook: "patchwork quilt bedroom",
  staging: "Adult LADDER ONE alone at her room. No phone. Everyday clothes.",
  refineFromStill: false,
  joPhone: true,
});
assert.equal(ladderSend.joPhone, false);
assert.match(ladderSend.prompt, /Thai lady/);
assert.match(ladderSend.prompt, /Looks:/);
assert.doesNotMatch(ladderSend.prompt, SCRATCH_JO_BLEED);
assert.ok(ladderSend.layers.some((l) => l.id === "looks"));
assert.ok(ladderSend.layers.every((l) => l.text.trim()));

const joSend = buildScratchStillSend({
  styleId: "skidmarks",
  styleRealism: 60,
  placeName: "the cell",
  speakers: ["CRAZY BIG HOLE JO"],
  looksByName: { "CRAZY BIG HOLE JO": "blonde, phone face" },
  placeLook: "",
  staging: "JO sitting on the bed.",
  refineFromStill: false,
  joPhone: true,
});
assert.equal(joSend.joPhone, true);
assert.match(joSend.prompt, SCRATCH_JO_BLEED);

const joOff = buildScratchStillSend({
  styleId: "skidmarks",
  styleRealism: 60,
  placeName: "the cell",
  speakers: ["CRAZY BIG HOLE JO"],
  looksByName: { "CRAZY BIG HOLE JO": "blonde" },
  placeLook: "",
  staging: "JO sitting on the bed.",
  refineFromStill: false,
  joPhone: false,
});
assert.equal(joOff.joPhone, false);
assert.doesNotMatch(joOff.prompt, SCRATCH_JO_BLEED);
assert.match(joOff.prompt, /empty hands/i);

assert.equal(isScratchShotTitle("Scratch"), true);
assert.equal(isScratchShotTitle("01 Closer MCU + phone"), false);

console.log("check-scratch-floor: ok");
