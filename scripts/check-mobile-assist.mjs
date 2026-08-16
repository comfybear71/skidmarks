import assert from "node:assert/strict";
import { ASSIST_CONSENT_LOCK } from "../src/lib/mobileAssistConsent.ts";
import {
  ASSIST_CRITERIA_LOCK,
  ASSIST_KINDS,
  assistMaxTokens,
  assistSystem,
  imageMotionAssistHint,
  isAssistKind,
  platePositionAssistHint,
} from "../src/lib/mobileAssist.ts";
import { LTX_LIP_SYNC_LEAD } from "../src/lib/mobileImageMotion.ts";

assert.match(ASSIST_CONSENT_LOCK, /into it/i);
assert.match(ASSIST_CONSENT_LOCK, /rape/i);
assert.match(ASSIST_CONSENT_LOCK, /pinning/i);
assert.match(ASSIST_CONSENT_LOCK, /holding someone down/i);

assert.match(ASSIST_CRITERIA_LOCK, /into it/i);
assert.match(ASSIST_CRITERIA_LOCK, /rape/i);
assert.match(ASSIST_CRITERIA_LOCK, /\[VISUAL\]/);
assert.match(ASSIST_CRITERIA_LOCK, /\[SPEECH\]/);
assert.match(ASSIST_CRITERIA_LOCK, /keyboard warrior/i);
assert.match(ASSIST_CRITERIA_LOCK, /crazed maniac/i);
assert.match(ASSIST_CRITERIA_LOCK, /tennis racket/i);
assert.match(ASSIST_CRITERIA_LOCK, /Use the provided start image as the first frame/);
assert.ok(ASSIST_CRITERIA_LOCK.includes(LTX_LIP_SYNC_LEAD));
assert.match(ASSIST_CRITERIA_LOCK, /turnaround sheet/i);
assert.match(ASSIST_CRITERIA_LOCK, /vibe line/i);

assert.equal(isAssistKind("image_motion"), true);
assert.equal(assistMaxTokens("image_motion"), 700);
assert.equal(assistMaxTokens("episode"), 4000);

for (const kind of ASSIST_KINDS) {
  const sys = assistSystem("skidmarks", kind);
  assert.match(sys, /into it/i);
  assert.match(sys, /rape/i);
  assert.match(sys, /pinning/i);
  assert.match(sys, /holding someone down/i);
  assert.match(sys, /keyboard warrior/i);
  assert.match(sys, /crazed maniac/i);
  assert.match(sys, /\[VISUAL\]/);
  assert.match(sys, /\[SPEECH\]/);
  assert.match(sys, /Use the provided start image as the first frame/);
  assert.ok(sys.includes(LTX_LIP_SYNC_LEAD));
  assert.match(sys, /Reply with the contents of the one box/);
  assert.match(sys, /stylised 3D/);
}

const sunny = assistSystem("sunny_banks", "image_motion");
assert.match(sunny, /rubbery adult cel cartoon/);
assert.match(sunny, /Do not write the locked lip-sync lead/);

const hint = platePositionAssistHint({
  people: ["Crazy Jo"],
  placeName: "Jo's bedroom (the cell)",
  placeLook: "high-set Darwin house, cot, flywire",
  looks: [{ name: "Crazy Jo", look: "wild Territory woman" }],
});
assert.match(hint, /Crazy Jo/);
assert.match(hint, /Jo's bedroom/);
assert.match(hint, /wild Territory woman/);
assert.match(hint, /this room/i);
assert.match(hint, /phone/i);

const comfyPlate = platePositionAssistHint({
  people: ["Comfy"],
  placeName: "the bar",
  placeLook: "",
  looks: [],
});
assert.doesNotMatch(comfyPlate, /keyboard warrior/i);

const motionHint = imageMotionAssistHint({
  speaker: "CRAZY BIG HOLE JO",
  line: "get stuffed",
  lookLock: "sitting on her bed",
  shotSpeakers: ["CRAZY BIG HOLE JO"],
});
assert.match(motionHint, /CRAZY BIG HOLE JO/);
assert.match(motionHint, /get stuffed/);
assert.match(motionHint, /lip-sync lead/i);

console.log("check-mobile-assist: ok");
