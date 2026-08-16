import assert from "node:assert/strict";
import {
  leftoverHydrateBeat,
  packDialogueSpeaker,
  plateLineBeats,
  speakerMentionedOnPlate,
  speakersAlreadyInPlate,
  castPopupFaceGrey,
  voiceFileBelongsToSpeaker,
} from "../src/lib/mobilePlateLines.ts";

assert.equal(leftoverHydrateBeat("shot_jo", "shot_jo_a1"), true);
assert.equal(leftoverHydrateBeat("shot_jo", "beat_jo"), false);
assert.equal(packDialogueSpeaker("01_01_Comfy_Keep-the-rhythm.mp3"), "Comfy");
assert.equal(voiceFileBelongsToSpeaker("01_01_Comfy_Keep-the-rhythm.mp3", "CRAZY BIG HOLE JO"), false);
assert.equal(voiceFileBelongsToSpeaker("01_01_Jo_sitting.mp3", "CRAZY BIG HOLE JO"), true);

assert.equal(
  speakerMentionedOnPlate("Comfy", ["CRAZY BIG HOLE JO", "Comfy"], "CRAZY BIG HOLE JO, sitting on her bed"),
  false,
);
assert.equal(
  speakerMentionedOnPlate("CRAZY BIG HOLE JO", ["CRAZY BIG HOLE JO", "Comfy"], "CRAZY BIG HOLE JO, sitting on her bed"),
  true,
);

const leftover = plateLineBeats({
  shotId: "shot_jo",
  title: "CRAZY BIG HOLE JO",
  staging: "CRAZY BIG HOLE JO, sitting on her bed",
  jobSpeakers: ["CRAZY BIG HOLE JO", "Comfy", "Land"],
  beats: [
    {
      id: "shot_jo_a1",
      speaker: "Comfy",
      voiceFile: "01_01_Comfy_Keep-the-rhythm.mp3",
    },
    {
      id: "shot_jo_a2",
      speaker: "Land",
      voiceFile: "01_02_Land_Tip-jar.mp3",
    },
    { id: "beat_jo", speaker: "CRAZY BIG HOLE JO", voiceFile: "" },
  ],
});
assert.equal(leftover.length, 1);
assert.equal(leftover[0].speaker, "CRAZY BIG HOLE JO");
assert.equal(leftover[0].voiceFile || "", "");

const emptyCard = plateLineBeats({
  shotId: "shot_jo",
  title: "",
  staging: "",
  jobSpeakers: ["CRAZY BIG HOLE JO", "Comfy"],
  beats: [
    {
      id: "shot_jo_a1",
      speaker: "Comfy",
      voiceFile: "01_01_Comfy_Keep-the-rhythm.mp3",
    },
    { id: "beat_jo", speaker: "CRAZY BIG HOLE JO", voiceFile: "" },
  ],
});
assert.equal(emptyCard.length, 1);
assert.equal(emptyCard[0].speaker, "CRAZY BIG HOLE JO");

assert.equal(castPopupFaceGrey(null, "Comfy"), false, "nobody grey until a tap");
assert.equal(castPopupFaceGrey("EE", "Comfy"), true);
assert.equal(castPopupFaceGrey("EE", "EE"), false);

const already = speakersAlreadyInPlate({
  shotId: "shot_empty",
  title: "Jo's bedroom (the cell)",
  staging: "",
  summary: "",
  plateFile: "",
  jobSpeakers: ["EE", "BC", "Comfy", "Matty"],
  beats: [
    {
      id: "shot_empty_a1",
      speaker: "Comfy",
      voiceFile: "01_01_Comfy_Keep-the-rhythm.mp3",
    },
  ],
});
assert.equal(already.length, 0, "leftover Comfy is not already in the plate");

console.log("check-mobile-plate-lines: ok");
