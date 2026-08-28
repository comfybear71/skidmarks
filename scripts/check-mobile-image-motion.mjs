import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
  buildCutawayMotion,
  isCutawayMotion,
  shortLtxLookLock,
  stripLtxLipSyncLead,
  withLtxLipSyncLead,
  buildScratchPadLtxMotion,
  pickLtxMotionBody,
  pickSongSendMotionBody,
  skipSongLipSyncLead,
  songSendNeedsRecook,
  songStoredMotionUsable,
  looksLikePlatePositionPrompt,
  buildScratchSongLtxMotion,
  buildMuteMvMotionLock,
  composeMuteMvMotion,
  extractMuteMvMotionSlot,
  isSingingDefaultMotion,
  MUTE_MV_SLOT_PLACEHOLDER,
  MUTE_MV_EMPTY_LEAD,
  MUTE_MV_EMPTY_TAIL,
  muteMvMotionLabel,
  muteMvEngineFoldSummary,
  muteMvEngineFoldLines,
  MUTE_MV_LTX_DESK_MAX_SEC,
  resolveMvSendEngine,
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
assert.match(jo, /empty hands stay as the start image, no phone/);
assert.doesNotMatch(jo, /holding her mobile phone/);
assert.doesNotMatch(jo, /keyboard warrior/);
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
assert.match(sent, /empty hands stay as the start image, no phone/);
assert.doesNotMatch(sent, /holding her mobile phone/);
assert.equal(stripLtxLipSyncLead(sent), jo);
assert.equal(withLtxLipSyncLead(sent), sent);

const joPhoneMotion = buildDefaultBeatMotion({
  styleId: "skidmarks",
  speaker: "CRAZY BIG HOLE JO",
  line: "get stuffed",
  lookLock: "sitting on her bed",
  staging: "Holding her mobile phone, texting.",
});
assert.match(joPhoneMotion, /holding her mobile phone/);
assert.match(joPhoneMotion, /keyboard warrior/);
assert.match(joPhoneMotion, /speaks the line as she types/);

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
assert.match(holdJo, /empty hands, no phone/);
assert.match(holdJo, /No dialogue/);
assert.doesNotMatch(holdJo, /holding her mobile phone/);
assert.doesNotMatch(holdJo, /crazed maniac/);

const joOnlyHold = buildDefaultBeatMotion({
  styleId: "skidmarks",
  speaker: "CRAZY BIG HOLE JO",
  line: "",
  shotSpeakers: ["CRAZY BIG HOLE JO"],
});
assert.doesNotMatch(joOnlyHold, /\bComfy\b/);
assert.doesNotMatch(joOnlyHold, /\bLand\b/);
assert.match(joOnlyHold, /Only CRAZY BIG HOLE JO in frame, no one else appears/);
assert.match(joOnlyHold, /empty hands, no phone/);
assert.doesNotMatch(joOnlyHold, /mobile phone/);

assert.equal(
  defaultSoloStaging("CRAZY BIG HOLE JO"),
  "CRAZY BIG HOLE JO alone. Only CRAZY BIG HOLE JO in frame, no one else appears. Standing centre-frame, facing camera, mid body. Empty hands. No phone. No extra objects.",
);
assert.equal(joPhoneStagingExtra(["CRAZY BIG HOLE JO"], "standing centre-frame"), "");
assert.equal(
  joPhoneStagingExtra(["CRAZY BIG HOLE JO"], "standing centre-frame", true).length > 0,
  true,
);
assert.equal(joPhoneStagingExtra(["CRAZY BIG HOLE JO"], "tennis racket in hand", true), "");
assert.equal(directorWantsEmptyHands("hands free or resting"), true);
assert.equal(
  storedMotionFightsEmptyHands(joPhoneMotion, "Empty hands in her lap. No phone."),
  true,
);
assert.equal(storedMotionFightsEmptyHands(joPhoneMotion, "holding her mobile phone"), false);
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

const sentEmpty = ltxSendPrompt(joPhoneMotion, "Empty hands in her lap. No phone.");
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

const scratchPad = buildScratchPadLtxMotion({
  styleId: "skidmarks",
  speaker: "LADDER ONE",
  line: "[slow][seductive]Are you going to keep staring?",
});
assert.match(scratchPad, /LADDER ONE says:/);
assert.match(scratchPad, /mouth and head move naturally while speaking/);
assert.doesNotMatch(scratchPad, /Do not sit in a chair/);
assert.doesNotMatch(scratchPad, /WIDE full-body framing stays/);
assert.doesNotMatch(scratchPad, /Feet stay planted/);
assert.equal(
  pickLtxMotionBody({ draft: "head nods", stored: "old", defaultBody: "fresh" }),
  "head nods",
);
assert.equal(
  pickLtxMotionBody({ draft: null, stored: "keep this", defaultBody: "fresh" }),
  "keep this",
);

const here = dirname(fileURLToPath(import.meta.url));
assert.match(
  readFileSync(join(here, "../src/components/mobile/PlateReviewEditor.tsx"), "utf8"),
  /readLtxMotionDraft/,
);
const motionSrc = readFileSync(join(here, "../src/lib/mobileImageMotion.ts"), "utf8");
const clipSrc = readFileSync(join(here, "../src/lib/mobileScratchClip.ts"), "utf8");
const pageSrc = readFileSync(join(here, "../src/app/(mobile)/scratch/page.tsx"), "utf8");
assert.equal(motionSrc.includes("scratchLtxMotionNeedsRebuild"), false);
assert.equal(clipSrc.includes("scratchLtxMotionNeedsRebuild"), false);
assert.equal(pageSrc.includes("scratchLtxMotionNeedsRebuild"), false);
assert.equal(motionSrc.includes("medium shot|medium close-up|mcu framing"), false);

const ia2v = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../workflow/LTX_2.3_IA2V_Cloud.json"), "utf8"),
);
assert.equal(ia2v["340:349"].inputs.value, false);

const cutaway = buildCutawayMotion({
  styleId: "skidmarks",
  speaker: "BC",
  action: "stands up from sitting, rises to their feet",
});
assert.match(cutaway, /^Use the provided start image as the first frame\./);
assert.match(cutaway, /stands up from sitting/);
assert.match(cutaway, /No dialogue/);
assert.match(cutaway, /Mouth stays closed/);
assert.doesNotMatch(cutaway, /says:/);
assert.doesNotMatch(cutaway, /perfect lip sync/i);
assert.equal(isCutawayMotion(cutaway), true);
const sentCutaway = ltxSendPrompt(cutaway);
assert.equal(sentCutaway.startsWith(LTX_LIP_SYNC_LEAD), false);
assert.equal(isCutawayMotion(sentCutaway), true);
assert.equal(isCutawayMotion(jo), false);

const nuggetsSolo = buildDefaultBeatMotion({
  styleId: "sunny_banks",
  speaker: "Nuggets",
  line: "Nah, mate. It's plastic.",
  lookLock: "skinny teen, buzz cut, blue and yellow jersey, meat pie",
});
assert.match(nuggetsSolo, /Only Nuggets in frame/);
assert.doesNotMatch(nuggetsSolo, /mouth moves/);
assert.doesNotMatch(nuggetsSolo, /listen(?:s)? in silence/);

const nuggetsAlien = buildDefaultBeatMotion({
  styleId: "sunny_banks",
  speaker: "Nuggets",
  line: "Nah, mate. It's plastic.",
  lookLock: "skinny teen, buzz cut, blue and yellow jersey, meat pie",
  shotSpeakers: ["Nuggets", "Alien 1"],
});
assert.match(nuggetsAlien, /Only Nuggets and Alien 1 in frame/);
assert.match(nuggetsAlien, /Only Nuggets' mouth moves/);
assert.match(nuggetsAlien, /Alien 1 listens in silence, mouth closed/);
assert.doesNotMatch(nuggetsAlien, /All mouths stay closed/);
assert.doesNotMatch(nuggetsAlien, /Other people/);

const oldTwoHander = ltxSendPrompt(
  'Use the provided start image as the first frame. Nuggets is prominent, mouth and head move naturally while speaking. Only Nuggets in frame, no one else appears. Nuggets says: "Nah, mate. It\'s plastic."',
  "",
  { speaker: "Nuggets", shotSpeakers: ["Nuggets", "Alien 1"] },
);
assert.match(oldTwoHander, /Only Nuggets' mouth moves/);
assert.match(oldTwoHander, /Alien 1 listens in silence, mouth closed/);

const unit4s = buildDefaultBeatMotion({
  styleId: "sunny_banks",
  speaker: "Nuggets",
  line: "righty o, I'll ask them? They'll look like idiots Shazza,",
  lookLock: "a front on off this character",
  shotSpeakers: ["Nuggets", "The Unit 4s"],
  staging: "Nuggets looking at the pie. The Unit 4s just arriving behind him, two purple figures, not dressed yet. BBQ shelter.",
});
assert.doesNotMatch(unit4s, /front on/i);
assert.match(unit4s, /Nuggets is prominent/);
assert.match(unit4s, /Only Nuggets and The Unit 4s in frame/);
assert.match(unit4s, /Only Nuggets' mouth moves/);
assert.match(unit4s, /The Unit 4s listen in silence, mouths closed/);
assert.doesNotMatch(unit4s, /The Unit 4s listens/);
assert.equal(
  storedMotionReinventsLook(
    'Use the provided start image as the first frame. Nuggets, a front on off this character is prominent, mouth and head move naturally while speaking.',
  ),
  true,
);

const jackStandUp =
  "Use the provided start image as the first frame. JACK GHOST, Male singer in deep noir shadow, face mostly silhouetted under a wide-brimmed black fedora and dark suit is prominent, empty hands, no phone. He stands up from the crouch, rising from elbows on knees to standing, same fedora, same dark suit, same silhouette as the start image. Face stays hidden in the hat shadow. Do not light the eyes or cheeks. Do not reveal a face. The vintage car already in the start image speeds off down the road toward the distant gothic city. Same car. No new vehicles. Only JACK GHOST in frame, no one else appears. Props and background stay exactly as the start image, nothing new enters frame. No new objects. No readable text or signage. Background stays as the start image. No dialogue. Mouth stays closed. Not singing. Not lip-sync. Camera holds, no cuts. Same person and objects as the start image. No new people enter the frame.";
assert.equal(
  looksLikePlatePositionPrompt(jackStandUp),
  true,
  "gold Only NAME in frame looks like Position — song Send must still keep the box",
);
assert.equal(songStoredMotionUsable(jackStandUp, []), true);
assert.equal(songStoredMotionUsable(jackStandUp, ["Comfy"]), true);
assert.equal(songStoredMotionUsable(`${jackStandUp} Comfy walks in`, ["Comfy"]), false);
const jackSinging = buildScratchSongLtxMotion({
  styleId: "music_video",
  speaker: "JACK GHOST",
  lookLock: "Male singer in deep noir shadow",
  startSec: 0,
});
assert.match(jackSinging, /Cyan mouth line moves/);
const sendBody = pickSongSendMotionBody({
  stored: jackStandUp,
  storedUsable: songStoredMotionUsable(jackStandUp, []),
  singing: true,
  singingDefault: jackSinging,
  speakingDefault: "talk",
});
assert.match(sendBody, /stands up from the crouch/);
assert.match(sendBody, /vintage car already in the start image speeds off/);
assert.doesNotMatch(sendBody, /Cyan mouth line moves/);
assert.equal(
  pickSongSendMotionBody({
    stored: "",
    storedUsable: false,
    singing: true,
    singingDefault: jackSinging,
    speakingDefault: "talk",
  }),
  jackSinging,
);
assert.equal(
  songSendNeedsRecook({
    existingClipFile: "01_JACK_GHOST_GIVE_ME_SOMETHING.mp4",
    lastSent: jackSinging,
    nextSent: sendBody,
  }),
  true,
  "changed box + old singing mp4 must recook",
);
assert.equal(
  songSendNeedsRecook({
    existingClipFile: "01_JACK_GHOST_GIVE_ME_SOMETHING.mp4",
    lastSent: sendBody,
    nextSent: sendBody,
  }),
  false,
  "same words + file already hung = do not recook",
);
assert.equal(
  songSendNeedsRecook({
    existingClipFile: "",
    lastSent: "",
    nextSent: sendBody,
  }),
  true,
);

const muteLock = buildMuteMvMotionLock({
  styleId: "music_video",
  speaker: "JACK GHOST",
  lookLock: "Male singer in deep noir shadow",
});
assert.match(muteLock.lead, /Use the provided start image as the first frame/);
assert.match(muteLock.lead, /JACK GHOST/);
assert.match(muteLock.lead, /empty hands, no phone/);
assert.match(muteLock.tail, /Mouth stays closed/);
assert.match(muteLock.tail, /Not singing/);
assert.match(muteLock.tail, /nothing new enters frame/);
assert.equal(MUTE_MV_SLOT_PLACEHOLDER, "stand up, car drives off");
const composed = composeMuteMvMotion(muteLock, "stand up, car drives off");
assert.match(composed, /stand up, car drives off/);
assert.match(composed, /Mouth stays closed/);
assert.equal(extractMuteMvMotionSlot(composed, muteLock), "stand up, car drives off");
assert.equal(extractMuteMvMotionSlot(jackSinging, muteLock), "");
assert.equal(isSingingDefaultMotion(jackSinging), true);
assert.equal(isSingingDefaultMotion(composed), false);
const kept = extractMuteMvMotionSlot(jackStandUp, muteLock);
assert.match(kept, /stands up from the crouch/);
assert.match(kept, /vintage car already in the start image speeds off/);
assert.doesNotMatch(kept, /Mouth stays closed/);

assert.equal(muteMvMotionLabel("h3"), "H3 Image motion", "H3 titles the hole H3");
assert.equal(muteMvMotionLabel("ltx"), "LTX Image motion", "LTX titles the hole LTX");
assert.equal(MUTE_MV_LTX_DESK_MAX_SEC, 30, "desk fold says 30s LTX, not the 180 safety ceiling");
assert.equal(
  muteMvEngineFoldSummary("h3"),
  "H3 · 4–15s · first frame · one move",
  "H3 fold stays a one-liner until he taps",
);
assert.equal(
  muteMvEngineFoldSummary("ltx"),
  "LTX · up to 30s · talking/sing ok · 5s ok",
  "LTX fold is the matching one-liner",
);
const h3Fold = muteMvEngineFoldLines("h3");
assert.equal(h3Fold.length, 5, "H3 tap opens the five desk facts");
assert.match(h3Fold[0], /4–15s/);
assert.match(h3Fold[0], /No 25s/);
assert.match(h3Fold[0], /Use LTX for 25/);
assert.match(h3Fold[1], /first frame/);
assert.match(h3Fold[1], /No last-frame picker on this desk/);
assert.match(h3Fold[2], /hold \/ push \/ track \/ pedestal/);
assert.match(h3Fold[2], /write it in \[ \]/);
assert.match(h3Fold[3], /No song into H3/);
assert.match(h3Fold[3], /mouths shut/);
assert.match(h3Fold[4], /Cowboy Bebop/);
assert.doesNotMatch(h3Fold.join(" "), /Fal Quality|last-frame picker on this desk is/i);
const ltxFold = muteMvEngineFoldLines("ltx");
assert.equal(ltxFold.length, 1, "LTX fold stays a matching one-liner");
assert.match(ltxFold[0], /up to 30s/);
assert.match(ltxFold[0], /Talking or singing/);
assert.match(ltxFold[0], /5s is fine/);
assert.match(motionSrc, /export function muteMvEngineFoldSummary/, "fold copy lives next to the hole title helper");
assert.match(motionSrc, /export function muteMvEngineFoldLines/);
assert.equal(
  resolveMvSendEngine({ jobId: "job", picked: "h3" }),
  "h3",
  "a live H3 tap wins the hole title",
);
assert.equal(
  resolveMvSendEngine({ jobId: "job", picked: "ltx" }),
  "ltx",
  "LTX tap stays LTX when nothing is stored",
);
assert.match(motionSrc, /export function muteMvMotionLabel/, "title helper is the one hole label");
assert.match(motionSrc, /export function writeMvClipEngine/, "plate LTX / H3 store is session only");
assert.match(motionSrc, /export function readMvClipEngine/);
assert.match(motionSrc, /export function readMvMuteAction/, "No lips is session only");
assert.match(motionSrc, /export function readMvNobodyInShot/, "Nobody in this shot is session + shot tag");
assert.match(motionSrc, /emptyFrame/);
assert.match(clipSrc, /emptyFrame/);
assert.match(clipSrc, /muteMvEmptyFrame/);
assert.doesNotMatch(motionSrc, /job\.scratchSong/, "engine pick is not written onto the job");
assert.equal(
  skipSongLipSyncLead({ speaker: "FRANK", singing: true, mute: true }),
  true,
  "No lips never prepends perfect lip sync",
);
assert.doesNotMatch(
  pickSongSendMotionBody({
    stored: jackSinging,
    storedUsable: true,
    singing: true,
    singingDefault: jackSinging,
    speakingDefault: "talk",
    mute: true,
    muteDefault: composeMuteMvMotion(muteLock, "walks away from camera"),
  }),
  /Cyan mouth line/,
  "No lips must not send the singing default",
);
assert.match(
  pickSongSendMotionBody({
    stored: jackSinging,
    storedUsable: true,
    singing: true,
    singingDefault: jackSinging,
    speakingDefault: "talk",
    mute: true,
    muteDefault: composeMuteMvMotion(muteLock, "walks away from camera"),
  }),
  /walks away from camera/,
);

const emptyLock = buildMuteMvMotionLock({
  styleId: "music_video",
  speaker: "JACK GHOST",
  lookLock: "Male singer in deep noir shadow",
  emptyFrame: true,
});
assert.equal(emptyLock.lead, MUTE_MV_EMPTY_LEAD);
assert.match(emptyLock.tail, /Empty road as the start image/);
assert.match(emptyLock.tail, /Mouth N\/A/);
assert.match(emptyLock.tail, /No new people enter the frame/);
assert.doesNotMatch(emptyLock.lead, /JACK GHOST/);
assert.doesNotMatch(emptyLock.tail, /JACK GHOST/);
assert.doesNotMatch(emptyLock.lead, /is prominent/);
assert.doesNotMatch(emptyLock.tail, /is prominent/);
assert.doesNotMatch(emptyLock.tail, /Only JACK GHOST in frame/);
assert.doesNotMatch(emptyLock.lead + emptyLock.tail, /walks away from camera/i);
assert.doesNotMatch(emptyLock.lead + emptyLock.tail, /lip-sync lead|perfect lip sync|Cyan mouth/i);
const carSlot = "car speeds off toward the city";
const emptyComposed = composeMuteMvMotion(emptyLock, carSlot);
assert.match(emptyComposed, /car speeds off toward the city/);
assert.doesNotMatch(emptyComposed, /JACK GHOST/);
assert.doesNotMatch(emptyComposed, /is prominent/);
assert.equal(extractMuteMvMotionSlot(emptyComposed, emptyLock), carSlot);
assert.match(
  extractMuteMvMotionSlot(jackStandUp, emptyLock),
  /vintage car already in the start image speeds off/,
);
assert.doesNotMatch(extractMuteMvMotionSlot(jackStandUp, emptyLock), /JACK GHOST is prominent/);
const emptySent = ensureGoldFrameLocks(emptyComposed);
assert.doesNotMatch(emptySent, /Same person and objects/);
assert.match(emptySent, /Same objects as the start image/);
assert.doesNotMatch(
  pickSongSendMotionBody({
    stored: jackStandUp,
    storedUsable: true,
    singing: true,
    singingDefault: jackSinging,
    speakingDefault: "talk",
    mute: true,
    muteDefault: emptyComposed,
    emptyFrame: true,
  }),
  /JACK GHOST/,
  "empty-frame Send must not keep a stored JACK lock",
);
assert.match(
  pickSongSendMotionBody({
    stored: jackStandUp,
    storedUsable: true,
    singing: true,
    singingDefault: jackSinging,
    speakingDefault: "talk",
    mute: true,
    muteDefault: emptyComposed,
    emptyFrame: true,
  }),
  /car speeds off toward the city/,
);

console.log("check-mobile-image-motion: ok");
