import assert from "node:assert/strict";
import {
  PLATE_QA_MAX_ATTEMPTS,
  appendPlateQaFix,
  parsePlateQaJson,
  plateQaChecks,
} from "../src/lib/mobilePlateQa.ts";

assert.equal(PLATE_QA_MAX_ATTEMPTS, 3);

const jo = plateQaChecks(
  "Medium close-up of JO. Sitting on the bed, butt on the mattress. Facing camera. Empty hands in her lap. No phone. Only JO in frame. No other people.",
);
assert.deepEqual(jo.sort(), ["alone", "emptyHands", "facingCamera", "noPhone", "onBed"].sort());

assert.deepEqual(plateQaChecks("a wide landscape"), []);

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

const next = appendPlateQaFix("Sitting on the bed.", "Butt on the mattress.");
assert.match(next, /Sitting on the bed/);
assert.match(next, /Butt on the mattress/);
assert.equal(appendPlateQaFix(next, "Butt on the mattress."), next);

console.log("check-mobile-plate-qa: ok");
