import assert from "node:assert/strict";
import {
  leftoverHydrateBeat,
  packDialogueSpeaker,
  plateLineBeats,
  plateCastStagingNote,
  speakerMentionedOnPlate,
  speakersAlreadyInPlate,
  shotSpeakersOnCard,
  leftoverHydrateSpeakers,
  dropLeftoverHydrateBeats,
  imageMotionNamesLeftovers,
  keepStoredImageMotion,
  castPopupFaceGrey,
  voiceFileBelongsToSpeaker,
} from "../src/lib/mobilePlateLines.ts";
import {
  isLeftoverPackVoiceFile,
  isMobileSavedVoiceFile,
} from "../src/lib/mobileSavedVoice.ts";

assert.equal(isLeftoverPackVoiceFile("01_05_CRAZY_BIG_HOLE_JO_Not-that.mp3"), true);
assert.equal(isMobileSavedVoiceFile("01_05_CRAZY_BIG_HOLE_JO_Not-that.mp3"), false);
assert.equal(
  isMobileSavedVoiceFile("01_01_CRAZY_BIG_HOLE_JO_her-line_mjx8k2.mp3"),
  true,
);
assert.equal(
  isLeftoverPackVoiceFile("01_01_CRAZY_BIG_HOLE_JO_her-line_mjx8k2.mp3"),
  false,
);

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

const leftoverJoLine = plateLineBeats({
  shotId: "shot_jo",
  title: "CRAZY BIG HOLE JO",
  staging: "CRAZY BIG HOLE JO, sitting on her bed",
  jobSpeakers: ["CRAZY BIG HOLE JO"],
  beats: [
    {
      id: "beat_jo",
      speaker: "CRAZY BIG HOLE JO",
      text: "Not that you care but boyfriend sleeping over",
      voiceFile: "01_05_CRAZY_BIG_HOLE_JO_Not-that.mp3",
    },
  ],
});
assert.equal(leftoverJoLine.length, 1);
assert.equal(leftoverJoLine[0].voiceFile || "", "");
assert.equal(leftoverJoLine[0].text || "", "");

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

const joBeats = [
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
];
const joCard = {
  shotId: "shot_jo",
  title: "CRAZY BIG HOLE JO",
  staging: "CRAZY BIG HOLE JO, sitting on her bed",
  summary: "",
  plateFile: "cplate_jo.png",
  jobSpeakers: ["CRAZY BIG HOLE JO", "Comfy", "Land"],
  beats: joBeats,
};
assert.deepEqual(shotSpeakersOnCard(joCard), ["CRAZY BIG HOLE JO"]);
assert.deepEqual(leftoverHydrateSpeakers("shot_jo", joCard.beats), ["Comfy", "Land"]);
assert.deepEqual(
  dropLeftoverHydrateBeats("shot_jo", joCard.beats).map((b) => b.speaker),
  ["CRAZY BIG HOLE JO"],
);

const crowdMotion =
  'Use the provided start image as the first frame. Only Comfy, Land and CRAZY BIG HOLE JO in frame, no one else appears.';
assert.equal(imageMotionNamesLeftovers(crowdMotion, ["Comfy", "Land"]), true);
assert.equal(keepStoredImageMotion(crowdMotion, ["Comfy", "Land"]), false);
assert.equal(
  keepStoredImageMotion(
    'Use the provided start image as the first frame. CRAZY BIG HOLE JO is prominent, tennis racket in hand.',
    ["Comfy", "Land"],
  ),
  true,
);

const joStill = plateCastStagingNote({
  speakers: ["CRAZY BIG HOLE JO"],
  staging: "CRAZY BIG HOLE JO alone, standing centre-frame, facing camera, mid body.",
});
assert.match(joStill, /mobile phone/i);
assert.match(joStill, /texting/i);
assert.match(joStill, /crazed maniac/i);
assert.match(joStill, /Only CRAZY BIG HOLE JO in frame/);
assert.match(joStill, /only person/i);
assert.doesNotMatch(joStill, /\bComfy\b/);
assert.doesNotMatch(joStill, /\bLand\b/);
assert.doesNotMatch(joStill, /People inhabit the place/);
assert.doesNotMatch(joStill, /Bodies in the room/);

const racketStill = plateCastStagingNote({
  speakers: ["CRAZY BIG HOLE JO"],
  staging: "CRAZY BIG HOLE JO, tennis racket in hand, walking around the room.",
});
assert.match(racketStill, /tennis racket/);
assert.doesNotMatch(racketStill, /mobile phone/);

console.log("check-mobile-plate-lines: ok");
