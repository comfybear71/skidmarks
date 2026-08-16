import assert from "node:assert/strict";
import {
  LTX_LIP_SYNC_LEAD,
  buildDefaultBeatMotion,
  buildGlobalPrompt,
  defaultSoloStaging,
  isJoKeyboardWarrior,
  joPhoneStagingExtra,
  ltxSendPrompt,
  stripLtxLipSyncLead,
  withLtxLipSyncLead,
} from "../src/lib/mobileImageMotion.ts";

assert.match(LTX_LIP_SYNC_LEAD, /dication is perfect/);
assert.equal(isJoKeyboardWarrior("CRAZY BIG HOLE JO"), true);
assert.equal(isJoKeyboardWarrior("Crazy Big Hole Jo Too"), true);
assert.equal(isJoKeyboardWarrior("Comfy"), false);
assert.equal(isJoKeyboardWarrior("Land"), false);

const jo = buildDefaultBeatMotion({
  styleId: "skidmarks",
  speaker: "CRAZY BIG HOLE JO",
  line: "get stuffed",
  lookLock: "sitting on her bed",
});
assert.match(jo, /^Use the provided start image as the first frame\./);
assert.match(jo, /holding her mobile phone/);
assert.match(jo, /texting/);
assert.match(jo, /crazed maniac/);
assert.match(jo, /keyboard warrior/);
assert.match(jo, /speaks the line as she types/);
assert.match(jo, /CRAZY BIG HOLE JO says: "get stuffed"/);
assert.match(jo, /Only CRAZY BIG HOLE JO in frame, no one else appears/);
assert.doesNotMatch(jo, /\bComfy\b/);
assert.doesNotMatch(jo, /\bLand\b/);
assert.doesNotMatch(jo, /Other people/);
assert.doesNotMatch(jo, /\[VISUAL\]/);
assert.doesNotMatch(jo, /\[SPEECH\]/);
assert.doesNotMatch(jo, /rubbery adult cartoon/);
assert.doesNotMatch(jo, /^perfect lip sync/i);

const sent = ltxSendPrompt(jo);
assert.ok(sent.startsWith(LTX_LIP_SYNC_LEAD));
assert.match(sent, /holding her mobile phone/);
assert.equal(stripLtxLipSyncLead(sent), jo);
assert.equal(withLtxLipSyncLead(sent), sent);

const racket = ltxSendPrompt(
  'Use the provided start image as the first frame. CRAZY BIG HOLE JO is prominent, tennis racket in hand, walking around the room. CRAZY BIG HOLE JO says: "get stuffed".',
);
assert.ok(racket.startsWith(LTX_LIP_SYNC_LEAD));
assert.match(racket, /tennis racket in hand/);
assert.doesNotMatch(racket, /\[VISUAL\]/);

const other = buildDefaultBeatMotion({
  styleId: "skidmarks",
  speaker: "Comfy",
  line: "keep the rhythm",
});
assert.match(other, /mouth and head move naturally while speaking, subtle gesture/);
assert.doesNotMatch(other, /keyboard warrior/);
assert.doesNotMatch(other, /holding her phone/);

const sunny = buildDefaultBeatMotion({
  styleId: "sunny_banks",
  speaker: "Shazza",
  line: "finish your breakfast",
  lookLock: "big blonde hair, leopard-print top",
});
assert.match(sunny, /rubbery adult cartoon/);
assert.doesNotMatch(sunny, /holding her phone/);

const holdJo = buildDefaultBeatMotion({
  styleId: "skidmarks",
  speaker: "CRAZY BIG HOLE JO",
  line: "",
});
assert.match(holdJo, /holding her phone|holding her mobile phone/);
assert.match(holdJo, /No dialogue/);
assert.match(holdJo, /crazed maniac/);
assert.match(holdJo, /mobile phone/);

const joOnlyHold = buildDefaultBeatMotion({
  styleId: "skidmarks",
  speaker: "CRAZY BIG HOLE JO",
  line: "",
  shotSpeakers: ["CRAZY BIG HOLE JO"],
});
assert.doesNotMatch(joOnlyHold, /\bComfy\b/);
assert.doesNotMatch(joOnlyHold, /\bLand\b/);
assert.match(joOnlyHold, /Only CRAZY BIG HOLE JO in frame, no one else appears/);
assert.match(joOnlyHold, /mobile phone/);
assert.match(joOnlyHold, /texting/);
assert.match(joOnlyHold, /crazed maniac/);

assert.equal(
  defaultSoloStaging("CRAZY BIG HOLE JO"),
  "CRAZY BIG HOLE JO alone. Only CRAZY BIG HOLE JO in frame, no one else appears. Standing centre-frame, facing camera, mid body. Holding her mobile phone, texting, staring at the screen like a crazed maniac.",
);
assert.equal(joPhoneStagingExtra(["CRAZY BIG HOLE JO"], "standing centre-frame").length > 0, true);
assert.equal(joPhoneStagingExtra(["CRAZY BIG HOLE JO"], "tennis racket in hand"), "");

assert.match(buildGlobalPrompt("skidmarks"), /dication is perfect/);

console.log("check-mobile-image-motion: ok");
