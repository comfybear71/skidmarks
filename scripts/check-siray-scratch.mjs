import assert from "node:assert/strict";
import {
  clampSirayI2vDurationSec,
  parseScratchClipEngine,
  SIRAY_I2V_DEFAULT,
  SIRAY_I2V_MODELS,
  sirayI2vSpec,
} from "../src/lib/sirayI2v.ts";

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

console.log("check-siray-scratch: ok");
