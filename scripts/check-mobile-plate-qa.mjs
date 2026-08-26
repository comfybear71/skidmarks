import assert from "node:assert/strict";
import {
  PLATE_QA_MAX_ATTEMPTS,
  appendPlateQaFix,
  compileScriptedPosition,
  parsePlateQaJson,
  plateQaChecks,
  plateQaStopRetry,
} from "../src/lib/mobilePlateQa.ts";

assert.equal(PLATE_QA_MAX_ATTEMPTS, 3);

const jo = plateQaChecks(
  "Medium close-up of JO. Sitting on the bed, butt on the mattress. Facing camera. Empty hands in her lap. No phone. Only JO in frame. No other people.",
);
assert.deepEqual(
  jo.sort(),
  ["alone", "anatomy", "emptyHands", "facingCamera", "noPhone", "noText", "onBed"].sort(),
);

assert.deepEqual(plateQaChecks("a wide landscape").sort(), ["anatomy", "noText"].sort());
assert.ok(plateQaChecks("three at the bar", { people: 3 }).includes("peopleCount"));
assert.ok(plateQaChecks("solo", { people: 1 }).includes("alone"));
assert.ok(!plateQaChecks("three at the bar", { people: 3 }).includes("alone"));
assert.ok(
  plateQaChecks(
    "Medium close-up of JO. Sitting on the bed. Facing camera. Empty hands. Only JO in frame.",
    { identity: true },
  ).includes("sameFace"),
);

const scripted = compileScriptedPosition({
  name: "CRAZY BIG HOLE JO",
  place: "Jo's bedroom (the cell)",
});
assert.match(scripted, /butt on the mattress/);
assert.match(scripted, /Empty hands/);
assert.match(scripted, /Only CRAZY BIG HOLE JO in frame/);
assert.doesNotMatch(scripted, /mobile phone/);

const fail = parsePlateQaJson(
  '{"onBed":false,"alone":true,"emptyHands":true,"noPhone":true,"facingCamera":true,"fails":["onBed"],"fix":"Butt on the mattress."}',
  jo,
);
assert.equal(fail.ok, false);
assert.deepEqual(fail.fails, ["onBed"]);
assert.match(fail.fix, /mattress/i);

const pass = parsePlateQaJson(
  '{"onBed":true,"alone":true,"emptyHands":true,"noPhone":true,"facingCamera":true,"fails":[],"fix":""}',
  jo,
);
assert.equal(pass.ok, true);

const faceFail = parsePlateQaJson('{"sameFace":false,"fails":["sameFace"],"fix":"Same face as JO."}', [
  "sameFace",
]);
assert.equal(faceFail.ok, false);
assert.deepEqual(faceFail.fails, ["sameFace"]);

const next = appendPlateQaFix("Sitting on the bed.", "Butt on the mattress.");
assert.match(next, /Sitting on the bed/);
assert.match(next, /Butt on the mattress/);
assert.equal(appendPlateQaFix(next, "Butt on the mattress."), next);

assert.equal(plateQaStopRetry(["noText"], 3), true);
assert.equal(plateQaStopRetry(["noText"], 1), false);
assert.equal(plateQaStopRetry(["anatomy"], 3), false);
assert.equal(plateQaStopRetry(["noText", "anatomy"], 3), false);
assert.equal(plateQaStopRetry([], 3), false);

console.log("check-mobile-plate-qa: ok");
