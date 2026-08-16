import assert from "node:assert/strict";
import {
  pickLibraryVoiceFromPool,
  voiceNamesMatch,
} from "../src/lib/voiceNameMatch.ts";
import {
  defaultCrashVoicePrompt,
  speakerVoiceKey,
} from "../src/lib/crashVoicePrompt.ts";

assert.equal(speakerVoiceKey("Crazy Big Hole Jo Too"), "jo");
assert.equal(speakerVoiceKey("Jo"), "jo");
assert.equal(speakerVoiceKey("Bin Bag Barry"), "barry");
assert.match(defaultCrashVoicePrompt("Crazy Big Hole Jo Too"), /female/i);
assert.match(defaultCrashVoicePrompt("Comfy Bear"), /male/i);

assert.equal(voiceNamesMatch("Jo", "Crazy Big Hole Jo Too"), true);
assert.equal(voiceNamesMatch("Crazy Big Hole Jo Too", "Jo Skidmarks"), true);
assert.equal(voiceNamesMatch("Comfy", "Comfy Bear"), true);

const library = [
  { voiceId: "v-jo", name: "Jo Skidmarks", gender: "female" },
  { voiceId: "v-comfy", name: "Comfy Bear", gender: "male" },
  { voiceId: "v-bc", name: "BC", gender: "male" },
  { voiceId: "pNInz6obpgDQGcFmaJgB", name: "Adam", category: "premade", gender: "male" },
];

const pick = (speaker, taken = []) =>
  pickLibraryVoiceFromPool({
    speaker,
    library,
    taken,
    showLabel: "skidmarks",
    otherLabels: ["sunny banks"],
    wantedSex: /\bfemale voice\b/i.test(defaultCrashVoicePrompt(speaker))
      ? "female"
      : "male",
  });

assert.equal(pick("Crazy Big Hole Jo Too"), "v-jo");
assert.equal(pick("Comfy Bear", ["v-jo"]), "v-comfy");
assert.equal(pick("BC", ["v-jo", "v-comfy"]), "v-bc");
assert.notEqual(pick("Someone New"), "pNInz6obpgDQGcFmaJgB");

console.log("check-mobile-voice-pick: ok");
