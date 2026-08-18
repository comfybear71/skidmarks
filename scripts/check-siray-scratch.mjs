import assert from "node:assert/strict";
import {
  clampSirayI2vDurationSec,
  SIRAY_SEEDANCE_20_I2V_SPICY,
  SIRAY_SEEDANCE_I2V_MAX_SEC,
  SIRAY_SEEDANCE_I2V_MIN_SEC,
  SIRAY_SEEDREAM_45_REF2I_SPICY,
} from "../src/lib/sirayClient.ts";
import { buildSirayScratchPrompt } from "../src/lib/sirayScratchPlate.ts";
import { buildSirayI2vPrompt } from "../src/lib/sirayScratchClip.ts";

assert.equal(SIRAY_SEEDREAM_45_REF2I_SPICY, "bytedance/seedream-4.5-ref2i-spicy");
assert.equal(SIRAY_SEEDANCE_20_I2V_SPICY, "bytedance/seedance-2.0-i2v-spicy");
assert.equal(SIRAY_SEEDANCE_I2V_MIN_SEC, 4);
assert.equal(SIRAY_SEEDANCE_I2V_MAX_SEC, 15);
assert.equal(clampSirayI2vDurationSec(0), 5);
assert.equal(clampSirayI2vDurationSec(3.2), 4);
assert.equal(clampSirayI2vDurationSec(6.4), 6);
assert.equal(clampSirayI2vDurationSec(40), 15);

const still = buildSirayScratchPrompt({
  styleId: "skidmarks",
  styleRealism: 70,
  placeName: "Matty's bar",
  speakers: ["BIG SEXY"],
  looks: "BIG SEXY looks like: tall, shaved.",
  placeLook: "sticky carpet",
  staging: "BIG SEXY leans on the bar, empty hands.",
});
assert.match(still, /Image 1 is the LOCKED place/);
assert.match(still, /Image 2 is BIG SEXY/);
assert.match(still, /leans on the bar/);
assert.doesNotMatch(still, /\[VISUAL\]|\[SPEECH\]/);

const duo = buildSirayScratchPrompt({
  styleId: "skidmarks",
  styleRealism: 70,
  placeName: "Matty's bar",
  speakers: ["BIG SEXY", "MATTY"],
  looks: "",
  placeLook: "",
  staging: "",
});
assert.match(duo, /Images 2–3 are BIG SEXY, MATTY/);
assert.match(duo, /Exactly 2 people/);

const motion = buildSirayI2vPrompt({
  speaker: "TEE",
  line: "I am so incredibly frustrated, I want to scream back!",
  motion: 'Use the provided start image as the first frame. TEE says: "I am so incredibly frustrated, I want to scream back!"',
  staging: "TEE on the couch.",
});
assert.match(motion, /first frame/);
assert.match(motion, /TEE is speaking/);
assert.match(motion, /scream back/);
assert.doesNotMatch(motion, /\[VISUAL\]|\[SPEECH\]/);

console.log("check-siray-scratch: ok");
