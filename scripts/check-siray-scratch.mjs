import assert from "node:assert/strict";
import {
  buildSirayI2vPrompt,
  clampSirayI2vDurationSec,
  parseScratchClipEngine,
  SIRAY_I2V_DEFAULT,
  SIRAY_I2V_MODELS,
  sirayI2vSpec,
  snapSirayI2vDurationSec,
  scratchWantsNude,
  scratchWantsMaleNude,
  scratchNudeLooksMale,
  scratchNudeStillLock,
  scratchStartImageLock,
  stripSpeechForSirayMotion,
} from "../src/lib/sirayI2v.ts";
import { studioFetchError } from "../src/lib/studioFetchError.ts";

assert.equal(SIRAY_I2V_DEFAULT, "seedance-20");
assert.equal(sirayI2vSpec("seedance-20").model, "bytedance/seedance-2.0-i2v-spicy");
assert.equal(sirayI2vSpec("seedance-25").model, "bytedance/seedance-2.5-i2v-spicy");
assert.equal(sirayI2vSpec("wan-27").model, "alibaba/wan-2.7-i2v-spicy");
assert.equal(sirayI2vSpec("wan-30").model, "alibaba/wan-3.0-i2v-spicy");
assert.equal(sirayI2vSpec("seedance-20").minSec, 4);
assert.equal(sirayI2vSpec("seedance-20").maxSec, 15);
assert.equal(sirayI2vSpec("seedance-25").maxSec, 30);
assert.equal(sirayI2vSpec("wan-27").aspectRatio, undefined);
assert.equal(sirayI2vSpec("wan-30").aspectRatio, "adaptive");
assert.equal(SIRAY_I2V_MODELS.length, 4);

assert.equal(parseScratchClipEngine("ltx"), "ltx");
assert.equal(parseScratchClipEngine("siray"), "seedance-20");
assert.equal(parseScratchClipEngine("siray-spicy"), "seedance-20");
assert.equal(parseScratchClipEngine("siray-i2v"), "seedance-20");
assert.equal(parseScratchClipEngine("seedance-25"), "seedance-25");
assert.equal(parseScratchClipEngine("wan-27"), "wan-27");
assert.equal(parseScratchClipEngine("wan-30"), "wan-30");
assert.throws(() => parseScratchClipEngine("kling"));

assert.equal(clampSirayI2vDurationSec(0), 5);
assert.equal(clampSirayI2vDurationSec(3.2), 4);
assert.equal(clampSirayI2vDurationSec(6.4), 6);
assert.equal(clampSirayI2vDurationSec(40), 15);
assert.equal(clampSirayI2vDurationSec(3, 4, 30), 4);
assert.equal(clampSirayI2vDurationSec(22, 4, 30), 22);
assert.equal(clampSirayI2vDurationSec(40, 2, 30), 30);
assert.equal(clampSirayI2vDurationSec(3, 2, 15), 3);
assert.equal(snapSirayI2vDurationSec(3.2, sirayI2vSpec("seedance-20")), 4);
assert.equal(snapSirayI2vDurationSec(22, sirayI2vSpec("seedance-25")), 22);
assert.equal(snapSirayI2vDurationSec(40, sirayI2vSpec("seedance-25")), 30);

const stripped = stripSpeechForSirayMotion(
  'Use the provided start image as the first frame. TEE says: "I am so incredibly frustrated, I want to scream back!" mouth and head move naturally while speaking, subtle lean.',
);
assert.doesNotMatch(stripped, /says:|speaking|scream back/);
assert.match(stripped, /subtle lean/i);

const motion = buildSirayI2vPrompt({
  speaker: "TEE",
  motion:
    'Use the provided start image as the first frame. TEE says: "I am so incredibly frustrated, I want to scream back!" mouth and head move naturally while speaking.',
  staging: "TEE on the couch.",
  lookLock: "dark hair, black tee",
  styleLock: "stylised 3D feature render",
});
assert.match(motion, /first frame/);
assert.match(motion, /Mouth stays closed/);
assert.match(motion, /dark hair/);
assert.doesNotMatch(motion, /is speaking/);
assert.doesNotMatch(motion, /says:/);
assert.doesNotMatch(motion, /scream back/);
assert.doesNotMatch(motion, /\[VISUAL\]|\[SPEECH\]/);

assert.equal(scratchWantsNude("Adult TEE, fully nude at the bar"), true);
assert.equal(scratchWantsNude("TEE leans on the bar, empty hands"), false);
assert.equal(scratchWantsMaleNude("Adult man TEE, fully nude at the bar"), true);
assert.equal(scratchWantsMaleNude("Adult TEE, fully nude at the bar"), false);
assert.equal(scratchWantsMaleNude("Adult woman TEE, fully nude at the bar"), false);
assert.equal(
  scratchWantsMaleNude("Adult TEE, fully nude at the bar. TEE looks like: Australian man, beard"),
  true,
);
assert.match(scratchNudeStillLock("Adult man TEE, fully nude at the bar"), /adult male body/i);
assert.doesNotMatch(scratchNudeStillLock("Adult TEE, fully nude at the bar"), /ken doll/i);
assert.doesNotMatch(scratchNudeStillLock("Adult woman TEE, fully nude at the bar"), /adult male body/i);
assert.equal(scratchNudeLooksMale("Adult MATTY, fully nude at THE DONGA", ["LADDER ONE", "LAND LANDY", "MATTY"]), true);
assert.match(
  scratchNudeStillLock("Adult MATTY, fully nude at THE DONGA", ["LADDER ONE", "LAND LANDY", "MATTY"]),
  /visible human penis/i,
);
const nudeClip = buildSirayI2vPrompt({
  speaker: "TEE",
  motion: "",
  staging: "Adult TEE, fully nude on the couch.",
  lookLock: "black tee",
});
assert.match(nudeClip, /bare body/);
assert.match(nudeClip, /Do not add clothes/);
assert.doesNotMatch(nudeClip, /wardrobe and body/);
const manClip = buildSirayI2vPrompt({
  speaker: "TEE",
  motion: "",
  staging: "Adult man TEE, fully nude on the couch.",
  lookLock: "beard, black tee",
});
assert.match(manClip, /adult male body/i);
assert.match(manClip, /visible human penis/i);
assert.match(manClip, /two feet on the floor/i);
assert.match(manClip, /Do not redraw as a woman/);

const silentScratch = buildSirayI2vPrompt({
  speaker: "LADDER ONE",
  motion: "She leans forward slowly, skirt hem shifts.",
  staging: "LADDER ONE in her room.",
  lookLock: "black tee from face card",
  styleLock: "stylised 3D feature render",
  imageOnly: true,
});
assert.match(silentScratch, /attached image is the only reference/i);
assert.match(silentScratch, /leans forward slowly/i);
assert.doesNotMatch(silentScratch, /black tee from face card/);
assert.doesNotMatch(silentScratch, /stylised 3D feature render/);

assert.match(
  studioFetchError(new TypeError("Failed to fetch"), "Request failed"),
  /episode is still there/i,
);
assert.doesNotMatch(
  studioFetchError(new TypeError("Failed to fetch"), "Request failed"),
  /Check the signal/i,
);

assert.match(scratchStartImageLock(true), /LOCKED last still/i);
assert.match(scratchStartImageLock(true), /Do not add a person/i);
assert.match(scratchStartImageLock(false), /LOCKED place/i);
assert.doesNotMatch(scratchStartImageLock(false), /last still/i);

console.log("check-siray-scratch: ok");
