import assert from "node:assert/strict";
import {
  LTX_LIP_SYNC_LEAD,
  buildDefaultBeatMotion,
  buildGlobalPrompt,
  defaultSoloStaging,
  directorWantsEmptyHands,
  isJoKeyboardWarrior,
  joPhoneStagingExtra,
  withScratchEmptyHands,
  ensureGoldFrameLocks,
  storedMotionFightsEmptyHands,
  storedMotionReinventsLook,
  ltxSendPrompt,
  shortLtxLookLock,
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
assert.match(jo, /Nobody mentioned in the spoken line appears on screen/);
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
assert.match(racket, /nothing new enters frame/);
assert.match(racket, /No new people enter the frame/);
assert.match(racket, /Nobody mentioned in the spoken line appears on screen/);
assert.doesNotMatch(racket, /\[VISUAL\]/);

const shortCustom = ensureGoldFrameLocks(
  'Use the provided start image as the first frame. JO is prominent, mouth and head move naturally while speaking. Empty hands stay in her lap, no phone. Only JO in frame. JO says: "I\'ll be moving out as soon as I can." Camera holds.',
);
assert.match(shortCustom, /Empty hands stay in her lap/);
assert.match(shortCustom, /nothing new enters frame/);
assert.match(shortCustom, /No new people enter the frame/);
assert.match(shortCustom, /Nobody mentioned in the spoken line appears on screen/);
assert.match(shortCustom, /No readable text or signage/);
assert.equal(ensureGoldFrameLocks(shortCustom), shortCustom);

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
assert.equal(directorWantsEmptyHands("hands free or resting"), true);
assert.equal(
  storedMotionFightsEmptyHands(jo, "Empty hands in her lap. No phone."),
  true,
);
assert.equal(storedMotionFightsEmptyHands(jo, "holding her mobile phone"), false);
assert.equal(joPhoneStagingExtra(["CRAZY BIG HOLE JO"], "sitting on the bed, hands free or resting"), "");
assert.equal(directorWantsEmptyHands("arms down at her sides, no phone"), true);
assert.equal(directorWantsEmptyHands("hands at her sides"), true);
assert.match(withScratchEmptyHands("JO on the bed staring at MATTY"), /no phone/i);
assert.match(withScratchEmptyHands("JO on the bed staring at MATTY"), /arms down at her sides/i);
assert.equal(withScratchEmptyHands("holding her mobile phone"), "holding her mobile phone");
assert.equal(joPhoneStagingExtra(["CRAZY BIG HOLE JO TOO"], withScratchEmptyHands("sitting on the bed")), "");

const emptyJo = buildDefaultBeatMotion({
  styleId: "skidmarks",
  speaker: "CRAZY BIG HOLE JO",
  line: "get stuffed",
  staging: "Empty hands in her lap. No phone. Only JO in frame.",
});
assert.match(emptyJo, /empty hands|no phone/i);
assert.doesNotMatch(emptyJo, /holding her mobile phone/);
assert.doesNotMatch(emptyJo, /keyboard warrior/);

const sentEmpty = ltxSendPrompt(jo, "Empty hands in her lap. No phone.");
assert.doesNotMatch(sentEmpty, /holding her mobile phone/);
assert.match(sentEmpty, /empty hands|no phone/i);

assert.match(buildGlobalPrompt("skidmarks"), /dication is perfect/);

const bigSexyBio =
  "BIG AUSSIE MALE, BIT OF A POT BELLY, loves a beer, barrack for collingwood magpies, not a cartoon and not a photo a 3D model, brown greyish hair and not a beard but stubbly, longer hair and bit unkept, a bit older and slightly more beer belly, loves a smoke";
const shortLook = shortLtxLookLock(bigSexyBio);
assert.match(shortLook, /POT BELLY|pot belly|brown greyish hair|stubbly/i);
assert.doesNotMatch(shortLook, /loves a beer/i);
assert.doesNotMatch(shortLook, /barrack/i);
assert.doesNotMatch(shortLook, /3d model/i);
assert.ok(shortLook.length <= 120);

const sexyMotion = buildDefaultBeatMotion({
  styleId: "skidmarks",
  speaker: "BIG SEXY",
  line: "come on you magpies",
  lookLock: bigSexyBio,
});
assert.match(sexyMotion, /^Use the provided start image as the first frame\./);
assert.match(sexyMotion, /BIG SEXY says: "come on you magpies"/);
assert.doesNotMatch(sexyMotion, /loves a beer/i);
assert.doesNotMatch(sexyMotion, /barrack for collingwood/i);
assert.doesNotMatch(sexyMotion, /not a cartoon and not a photo/i);
assert.match(sexyMotion, /BIT OF A POT BELLY|pot belly/i);

const joLook =
  "same person just a little bit younger and she is cleaner, with untrustworthy smile";
assert.doesNotMatch(shortLtxLookLock(joLook), /younger|cleaner|same person/i);
const joAgeMotion = buildDefaultBeatMotion({
  styleId: "skidmarks",
  speaker: "CRAZY BIG HOLE JO",
  line: "I'll be moving out as soon as I can.",
  lookLock: joLook,
  staging: "Empty hands in her lap. No phone.",
});
assert.doesNotMatch(joAgeMotion, /younger|she is cleaner|same person just/i);
assert.equal(
  storedMotionReinventsLook(
    'Use the provided start image as the first frame. CRAZY BIG HOLE JO, same person just a little bit younger and she is cleaner, with untrustworthy smile is prominent.',
  ),
  true,
);

console.log("check-mobile-image-motion: ok");
