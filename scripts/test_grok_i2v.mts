/**
 * Pure checks for Grok I2V duration + engine tokens.
 * Run: node --experimental-strip-types scripts/test_grok_i2v.mts
 */
import assert from "node:assert/strict";
import {
  GROK_I2V_DEFAULT_SEC,
  GROK_I2V_ID,
  GROK_I2V_MAX_SEC,
  GROK_I2V_MIN_SEC,
  GROK_I2V_SHORT_SECS,
  isGrokClipEngineToken,
  isGrokI2vId,
  isGrokI2vShortSec,
  snapGrokI2vDurationSec,
} from "../src/lib/grokI2v.ts";

assert.equal(isGrokClipEngineToken("grok"), true);
assert.equal(isGrokClipEngineToken("grok-i2v"), true);
assert.equal(isGrokClipEngineToken("xai-i2v"), true);
assert.equal(isGrokClipEngineToken("grok-imagine-video"), true);
assert.equal(isGrokClipEngineToken("ltx"), false);
assert.equal(isGrokClipEngineToken("siray"), false);
assert.equal(isGrokClipEngineToken("seedance-20"), false);
assert.equal(isGrokI2vId("grok"), true);
assert.equal(isGrokI2vId("seedance-20"), false);
assert.equal(GROK_I2V_ID, "grok");
assert.deepEqual([...GROK_I2V_SHORT_SECS], [2, 3, 5]);
assert.equal(isGrokI2vShortSec(2), true);
assert.equal(isGrokI2vShortSec(3), true);
assert.equal(isGrokI2vShortSec(5), true);
assert.equal(isGrokI2vShortSec(10), false);

assert.equal(snapGrokI2vDurationSec(2), 2);
assert.equal(snapGrokI2vDurationSec(3), 3);
assert.equal(snapGrokI2vDurationSec(5), 5);
assert.equal(snapGrokI2vDurationSec(0), GROK_I2V_DEFAULT_SEC);
assert.equal(snapGrokI2vDurationSec(Number.NaN), GROK_I2V_DEFAULT_SEC);
assert.equal(snapGrokI2vDurationSec(0.4), GROK_I2V_MIN_SEC);
assert.equal(snapGrokI2vDurationSec(99), GROK_I2V_MAX_SEC);
assert.equal(snapGrokI2vDurationSec(1.4), 1);
assert.equal(snapGrokI2vDurationSec(1.6), 2);

console.log("grok i2v tokens + duration snap: ok");
