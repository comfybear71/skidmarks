/** Run: npx tsx scripts/check-scratch-floor.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { campaignStagingForId, campaignImageMotionForId } from "../src/lib/mobilePlateLtxCampaign.ts";
import { SCRATCH_FLOOR_LAWS, SCRATCH_JO_BLEED } from "../src/lib/scratchFloor.ts";
import { buildScratchStillSend, padHasJo } from "../src/lib/scratchStillSend.ts";
import { scratchNudeStillLock } from "../src/lib/sirayI2v.ts";
import { isScratchShotTitle } from "../src/lib/mobileScratch.ts";
import { SCRATCH_DROPDOWN_PRESET_IDS, SCRATCH_PROMPT_BIBLE } from "../src/lib/scratchBench/promptBible.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const scratchPage = readFileSync(join(repoRoot, "src/app/(mobile)/scratch/page.tsx"), "utf8");
assert.doesNotMatch(scratchPage, /JO on her back/);
assert.doesNotMatch(scratchPage, /fillJoMattyBedroom/);
assert.match(scratchPage, /clip-poll/);
assert.match(scratchPage, /layout="strip"/);
assert.match(scratchPage, /Siray confirmed/);
const floorPanel = readFileSync(join(repoRoot, "src/components/scratch/ScratchFloorPanel.tsx"), "utf8");
assert.match(floorPanel, /<details className="scratch-floor">/);
assert.match(floorPanel, /<summary>Studio floor<\/summary>/);
assert.doesNotMatch(floorPanel, /scratch-floor"[^>]*\sopen\b/);

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
assert.match(mcu, /MEDIUM CLOSE-UP/i);
assert.doesNotMatch(mcu, /\bphone\b/i);
assert.doesNotMatch(mcu, SCRATCH_JO_BLEED);

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

const refineSend = buildScratchStillSend({
  styleId: "skidmarks",
  styleRealism: 60,
  placeName: "her room",
  speakers: ["LADDER ONE"],
  looksByName: {
    "LADDER ONE":
      "She is not photorealistic, she is more of a 3d model not photo, not cartoon",
  },
  placeLook: "patchwork quilt bedroom",
  staging: "Same as image 1. Only change: right hand at lips, blowing a kiss. Same topless body.",
  refineFromStill: true,
  joPhone: false,
});
assert.doesNotMatch(refineSend.prompt, /stylised 3D animated feature render/i);
assert.doesNotMatch(refineSend.prompt, /3d model not photo/i);
assert.doesNotMatch(refineSend.prompt, /patchwork quilt bedroom/i);
assert.doesNotMatch(refineSend.prompt, /Image 2/i);
assert.doesNotMatch(refineSend.prompt, /face card/i);
assert.match(refineSend.prompt, /attached image is the only reference/i);
assert.match(refineSend.prompt, /blowing a kiss/i);
assert.equal(refineSend.imageOnlyRefine, true);
assert.ok(refineSend.layers.some((l) => l.id === "refine"));
assert.equal(refineSend.layers.find((l) => l.id === "style"), undefined);
assert.ok(refineSend.layers.some((l) => l.id === "nude"));

const undressRefine = buildScratchStillSend({
  styleId: "skidmarks",
  styleRealism: 60,
  placeName: "her room",
  speakers: ["LADDER ONE"],
  looksByName: { "LADDER ONE": "Thai lady" },
  placeLook: "",
  staging:
    "She is undressing: the cream knit mini-dress is pulled down around her waist, torso bare. Empty hands, no phone.",
  refineFromStill: true,
  joPhone: false,
});
assert.equal(undressRefine.layers.find((l) => l.id === "nude"), undefined);
assert.ok(undressRefine.layers.some((l) => l.id === "undress"));
assert.doesNotMatch(undressRefine.prompt, /Same bare body, skin, and wardrobe as the attached image/);
assert.match(undressRefine.prompt, /attached image is clothed/i);
assert.match(undressRefine.prompt, /undress as written/i);

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
assert.equal(isScratchShotTitle("01 Closer MCU"), false);

const bibleIds = new Set(SCRATCH_PROMPT_BIBLE.flatMap((s) => s.entries.map((e) => e.id)));
for (const id of SCRATCH_DROPDOWN_PRESET_IDS) {
  assert.ok(bibleIds.has(id), `prompt bible missing old dropdown preset: ${id}`);
}

console.log("check-scratch-floor: ok");
