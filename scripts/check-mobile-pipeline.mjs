import assert from "node:assert/strict";
import {
  MOBILE_STITCH_MOVIES,
  bounceStuckStitch,
  phaseAfterAnimateQueue,
  phaseAfterErrorResume,
} from "../src/lib/mobilePipeline.ts";

assert.equal(MOBILE_STITCH_MOVIES, false);
assert.equal(phaseAfterAnimateQueue(true), "animate");
assert.equal(phaseAfterAnimateQueue(false), "review");
assert.equal(phaseAfterErrorResume(false), "review");
assert.equal(bounceStuckStitch({ phase: "stitch" }), "review");
assert.equal(
  bounceStuckStitch({
    phase: "error",
    error: "No clips generated successfully — nothing to stitch",
  }),
  null,
);
assert.equal(bounceStuckStitch({ phase: "review" }), null);

console.log("check-mobile-pipeline: ok");
