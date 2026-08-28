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
  MINIMAX_H3_OVER_MAX_NOTE,
  refuseMinimaxH3OverMax,
  snapMinimaxH3DurationSec,
  clampMinimaxH3HangSec,
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
assert.equal(snapMinimaxH3DurationSec(7), 7);
assert.equal(snapMinimaxH3DurationSec(9), 9);
assert.equal(snapMinimaxH3DurationSec(10), 10);
assert.equal(snapMinimaxH3DurationSec(15), 15);
assert.equal(clampMinimaxH3HangSec(7).durationSec, 7);
assert.equal(clampMinimaxH3HangSec(7).note, "");
assert.equal(clampMinimaxH3HangSec(9).durationSec, 9);
assert.equal(clampMinimaxH3HangSec(10).durationSec, 10);
assert.equal(clampMinimaxH3HangSec(25).durationSec, 15);
assert.match(clampMinimaxH3HangSec(25).note, /H3 max 15/);
assert.equal(snapMinimaxH3DurationSec(0), MINIMAX_H3_DEFAULT_SEC);
assert.equal(snapMinimaxH3DurationSec(Number.NaN), MINIMAX_H3_DEFAULT_SEC);
assert.equal(snapMinimaxH3DurationSec(2), MINIMAX_H3_MIN_SEC);
assert.equal(snapMinimaxH3DurationSec(3), MINIMAX_H3_MIN_SEC);
assert.equal(snapMinimaxH3DurationSec(99), MINIMAX_H3_MAX_SEC);

assert.equal(refuseMinimaxH3OverMax(5), null);
assert.equal(refuseMinimaxH3OverMax(15), null);
assert.equal(refuseMinimaxH3OverMax(4), null);
assert.equal(refuseMinimaxH3OverMax(25), MINIMAX_H3_OVER_MAX_NOTE);
assert.equal(refuseMinimaxH3OverMax(25.1), MINIMAX_H3_OVER_MAX_NOTE);
assert.equal(MINIMAX_H3_OVER_MAX_NOTE, "H3 max 15 — cooking 15");
assert.equal(clampMinimaxH3HangSec(40).durationSec, 15);
assert.equal(clampMinimaxH3HangSec(40).note, MINIMAX_H3_OVER_MAX_NOTE);

console.log("minimax h3 tokens + duration snap: ok");
