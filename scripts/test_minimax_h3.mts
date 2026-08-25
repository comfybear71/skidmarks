/**
 * Pure checks for MiniMax H3 duration + engine tokens.
 * Run: node --experimental-strip-types scripts/test_minimax_h3.mts
 */
import assert from "node:assert/strict";
import {
  MINIMAX_H3_DEFAULT_SEC,
  MINIMAX_H3_ID,
  MINIMAX_H3_MAX_SEC,
  MINIMAX_H3_MIN_SEC,
  MINIMAX_H3_SHORT_SECS,
  isMinimaxH3ClipEngineToken,
  isMinimaxH3Id,
  isMinimaxH3ShortSec,
  snapMinimaxH3DurationSec,
} from "../src/lib/minimaxH3.ts";

assert.equal(isMinimaxH3ClipEngineToken("h3"), true);
assert.equal(isMinimaxH3ClipEngineToken("minimax"), true);
assert.equal(isMinimaxH3ClipEngineToken("minimax-h3"), true);
assert.equal(isMinimaxH3ClipEngineToken("hailuo-h3"), true);
assert.equal(isMinimaxH3ClipEngineToken("h3-i2v"), true);
assert.equal(isMinimaxH3ClipEngineToken("ltx"), false);
assert.equal(isMinimaxH3ClipEngineToken("grok"), false);
assert.equal(isMinimaxH3ClipEngineToken("siray"), false);
assert.equal(isMinimaxH3Id("h3"), true);
assert.equal(isMinimaxH3Id("grok"), false);
assert.equal(MINIMAX_H3_ID, "h3");
assert.deepEqual([...MINIMAX_H3_SHORT_SECS], [5, 8, 15]);
assert.equal(isMinimaxH3ShortSec(5), true);
assert.equal(isMinimaxH3ShortSec(8), true);
assert.equal(isMinimaxH3ShortSec(15), true);
assert.equal(isMinimaxH3ShortSec(2), false);
assert.equal(isMinimaxH3ShortSec(3), false);

assert.equal(snapMinimaxH3DurationSec(5), 5);
assert.equal(snapMinimaxH3DurationSec(8), 8);
assert.equal(snapMinimaxH3DurationSec(15), 15);
assert.equal(snapMinimaxH3DurationSec(0), MINIMAX_H3_DEFAULT_SEC);
assert.equal(snapMinimaxH3DurationSec(Number.NaN), MINIMAX_H3_DEFAULT_SEC);
assert.equal(snapMinimaxH3DurationSec(2), MINIMAX_H3_MIN_SEC);
assert.equal(snapMinimaxH3DurationSec(3), MINIMAX_H3_MIN_SEC);
assert.equal(snapMinimaxH3DurationSec(99), MINIMAX_H3_MAX_SEC);

console.log("minimax h3 tokens + duration snap: ok");
