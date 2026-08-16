import assert from "node:assert/strict";
import {
  jobVoiceForSpeaker,
  lineVoiceLabel,
  withJobSpeakerVoice,
} from "../src/lib/mobileJobVoices.ts";

const empty = withJobSpeakerVoice(undefined, "CRAZY BIG HOLE JO", {
  voiceId: "v-sunny",
  voiceName: "Sunny Banks Nan",
});
assert.equal(empty["CRAZY BIG HOLE JO"].voiceId, "v-sunny");
assert.equal(jobVoiceForSpeaker(empty, "Jo")?.voiceName, "Sunny Banks Nan");
assert.equal(jobVoiceForSpeaker(empty, "Comfy"), undefined);

const swapped = withJobSpeakerVoice(empty, "crazy big hole jo", {
  voiceId: "v-sunny-2",
  voiceName: "Sunny Banks Nan",
});
assert.equal(Object.keys(swapped).length, 1);
assert.equal(jobVoiceForSpeaker(swapped, "CRAZY BIG HOLE JO")?.voiceId, "v-sunny-2");

const library = [
  { voiceId: "v-sunny", name: "Sunny Banks Nan" },
  { voiceId: "v-comfy", name: "Comfy Bear" },
];
assert.equal(
  lineVoiceLabel({
    speaker: "CRAZY BIG HOLE JO",
    jobVoices: empty,
    library,
  }),
  "Sunny Banks Nan",
);
assert.equal(
  lineVoiceLabel({
    speaker: "CRAZY BIG HOLE JO",
    assignedVoiceId: "v-sunny",
    library,
  }),
  "Sunny Banks Nan",
);
assert.notEqual(
  lineVoiceLabel({
    speaker: "CRAZY BIG HOLE JO",
    assignedVoiceId: "v-comfy",
    library,
  }),
  "Sunny Banks Nan",
);

console.log("check-mobile-job-voices: ok");
