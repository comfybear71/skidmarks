import assert from "node:assert/strict";
import {
  leftoverHydrateBeat,
  beatsAfterRemoveLine,
  packDialogueSpeaker,
  plateLineBeats,
  songDeskEditorBeats,
  plateCastStagingNote,
  speakerMentionedOnPlate,
  speakersAlreadyInPlate,
  shotSpeakersOnCard,
  muteMvPadNames,
  muteMvEmptyFrame,
  rosterNamedOnPlate,
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
  storyHasLeftoverPackAudio,
} from "../src/lib/mobileSavedVoice.ts";
import {
  imageMotionUsableForLine,
  looksLikePlatePositionPrompt,
} from "../src/lib/mobileImageMotion.ts";

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
assert.equal(
  storyHasLeftoverPackAudio({
    scenes: [
      {
        shots: [
          {
            beats: [
              { voiceFile: "01_05_CRAZY_BIG_HOLE_JO_Not-that.mp3" },
            ],
          },
        ],
      },
    ],
  }),
  true,
);
assert.equal(
  storyHasLeftoverPackAudio({
    scenes: [
      {
        shots: [
          {
            beats: [
              { voiceFile: "01_01_CRAZY_BIG_HOLE_JO_her-line_mjx8k2.mp3" },
            ],
          },
        ],
      },
    ],
  }),
  false,
);

assert.equal(leftoverHydrateBeat("shot_jo", "shot_jo_a1"), true);

const emptyJo = { id: "beat_jo_empty", speaker: "CRAZY BIG HOLE JO", text: "" };
assert.deepEqual(
  beatsAfterRemoveLine({
    shotId: "shot_jo",
    beats: [
      { id: "beat_sexy", speaker: "BIG SEXY", text: "oi" },
      { id: "beat_land", speaker: "LAND LANDY", text: "wrong" },
    ],
    beatId: "beat_land",
    emptyBeat: emptyJo,
  }),
  {
    beats: [{ id: "beat_sexy", speaker: "BIG SEXY", text: "oi" }],
    keptEmpty: false,
  },
);
assert.deepEqual(
  beatsAfterRemoveLine({
    shotId: "shot_jo",
    beats: [{ id: "beat_sexy", speaker: "BIG SEXY", text: "oi" }],
    beatId: "beat_sexy",
    emptyBeat: emptyJo,
  }),
  { beats: [emptyJo], keptEmpty: true },
);
assert.deepEqual(
  beatsAfterRemoveLine({
    shotId: "shot_jo",
    beats: [
      { id: "beat_sexy", speaker: "BIG SEXY", text: "oi" },
      { id: "shot_jo_a1", speaker: "Comfy", text: "leftover" },
    ],
    beatId: "beat_sexy",
    emptyBeat: emptyJo,
  }),
  { beats: [{ id: "shot_jo_a1", speaker: "Comfy", text: "leftover" }, emptyJo], keptEmpty: true },
);
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
assert.match(joStill, /empty hands/i);
assert.match(joStill, /no phone/i);
assert.match(joStill, /do not invent props/i);
assert.doesNotMatch(joStill, /mobile phone/i);
assert.doesNotMatch(joStill, /crazed maniac/i);
assert.match(joStill, /Only CRAZY BIG HOLE JO in frame/);
assert.match(joStill, /only person/i);
assert.doesNotMatch(joStill, /\bComfy\b/);
assert.doesNotMatch(joStill, /\bLand\b/);
assert.doesNotMatch(joStill, /People inhabit the place/);
assert.doesNotMatch(joStill, /Bodies in the room/);

const joPhoneStill = plateCastStagingNote({
  speakers: ["CRAZY BIG HOLE JO"],
  staging: "CRAZY BIG HOLE JO alone, standing centre-frame, facing camera, mid body.",
  joPhone: true,
});
assert.match(joPhoneStill, /mobile phone/i);
assert.match(joPhoneStill, /crazed maniac/i);
assert.doesNotMatch(joPhoneStill, /do not invent props/i);

const sexyStill = plateCastStagingNote({
  speakers: ["BIG SEXY"],
  staging: "BIG SEXY alone, standing centre-frame, facing camera, mid body.",
});
assert.match(sexyStill, /empty hands/i);
assert.match(sexyStill, /no mug/i);
assert.doesNotMatch(sexyStill, /mobile phone/i);

const racketStill = plateCastStagingNote({
  speakers: ["CRAZY BIG HOLE JO"],
  staging: "CRAZY BIG HOLE JO, tennis racket in hand, walking around the room.",
});
assert.match(racketStill, /tennis racket/);
assert.doesNotMatch(racketStill, /mobile phone/);

const emptyHandsStill = plateCastStagingNote({
  speakers: ["CRAZY BIG HOLE JO"],
  staging: "Sitting on Jo's bed, hands free or resting. Only JO in frame.",
});
assert.doesNotMatch(emptyHandsStill, /mobile phone/);
assert.match(emptyHandsStill, /Empty hands/);

const joPosition =
  "CRAZY BIG HOLE JO alone in Jo's bedroom (the cell). Only CRAZY BIG HOLE JO in frame, no one else appears. Sitting on the bed, holding her mobile phone, texting, staring at the screen like a crazed maniac.";
assert.equal(looksLikePlatePositionPrompt(joPosition), true);
assert.equal(looksLikePlatePositionPrompt("Jason just left for work, I don't care."), false);
assert.equal(imageMotionUsableForLine(joPosition, "Jason just left for work."), false);
assert.equal(
  imageMotionUsableForLine(
    'Use the provided start image as the first frame. CRAZY BIG HOLE JO says: "Jason just left for work."',
    "Jason just left for work.",
  ),
  true,
);

const phoneGold =
  'Use the provided start image as the first frame. CRAZY BIG HOLE JO is prominent, holding her mobile phone, texting, staring at the screen like a crazed maniac, keyboard warrior. CRAZY BIG HOLE JO says: "I\'ll be moving out as soon as I can."';
assert.equal(
  imageMotionUsableForLine(phoneGold, "I'll be moving out as soon as I can."),
  true,
);
assert.equal(
  imageMotionUsableForLine(
    phoneGold,
    "I'll be moving out as soon as I can.",
    "Empty hands in her lap. No phone. Only JO in frame.",
  ),
  false,
);

assert.deepEqual(
  rosterNamedOnPlate(
    ["Dazza", "Ranger Bazza", "Nuggets", "Nan"],
    "Cast: Residents, Dazza, Ranger Bazza, Nuggets. Camera: residents crowd the tank, including Nuggets.",
  ),
  ["Dazza", "Ranger Bazza", "Nuggets"],
);
assert.deepEqual(rosterNamedOnPlate(["Nan"], "The tenant waits by the banana crate."), []);

const campGathers = {
  shotId: "shot_camp",
  title: "The Camp Gathers",
  staging:
    "Cast: Caravan Park Residents, Dazza, Ranger Bazza, Nuggets. Camera: High angle. Plate: Thongs slapping on gravel.",
  summary: "",
  plateFile: "",
  jobSpeakers: ["Ranger Bazza", "Dazza", "Nuggets", "Shazza", "Nan"],
  beats: [{ id: "beat_res", speaker: "Caravan Park Resident 1", voiceFile: "" }],
};
assert.deepEqual(shotSpeakersOnCard(campGathers).sort(), [
  "Dazza",
  "Nuggets",
  "Ranger Bazza",
]);

const victory = {
  shotId: "shot_drinks",
  title: "Victory Drinks",
  staging: "Camera: Unit 4 alien trailer while Nuggets munches a burger.",
  summary: "",
  plateFile: "",
  jobSpeakers: ["Shazza", "Nuggets", "The Unit 4s", "Dazza", "Nan"],
  beats: [{ id: "beat_shaz", speaker: "Shazza", voiceFile: "" }],
};
assert.ok(shotSpeakersOnCard(victory).includes("Shazza"));

const turkeys = {
  shotId: "shot_turk",
  title: "Turkey Influx",
  staging: "Cast: Bush Turkeys. Plate: Flapping wings.",
  summary: "",
  plateFile: "",
  jobSpeakers: ["Dazza", "Ranger Bazza"],
  beats: [{ id: "beat_t", speaker: "Bush Turkeys", voiceFile: "" }],
};
assert.deepEqual(shotSpeakersOnCard(turkeys), []);

assert.deepEqual(
  muteMvPadNames({
    roster: ["JACK GHOST"],
    staging: "car from behind on the road toward the city",
  }),
  [],
  "car Position does not put JACK on the pad",
);
assert.deepEqual(
  muteMvPadNames({
    roster: ["JACK GHOST"],
    staging: "JACK GHOST three-quarter at the road",
  }),
  ["JACK GHOST"],
);
assert.deepEqual(
  muteMvPadNames({
    roster: ["JACK GHOST"],
    staging: "",
  }),
  [],
  "title-only / empty Position is not on the pad",
);
assert.equal(
  muteMvEmptyFrame({ footageRole: "support", padNames: ["JACK GHOST"] }),
  true,
  "Support is B-roll — no person lock",
);
assert.equal(
  muteMvEmptyFrame({ nobodyInShot: true, padNames: ["JACK GHOST"] }),
  true,
  "Nobody tap drops the name even on HERO",
);
assert.equal(
  muteMvEmptyFrame({
    footageRole: "hero",
    staging: "car from behind on the road toward the city",
    padNames: [],
  }),
  true,
  "HERO car still with nobody in Position is empty",
);
assert.equal(
  muteMvEmptyFrame({ footageRole: "hero", staging: "", padNames: [] }),
  false,
  "empty Position on a titled JACK plate stays unknown — do not guess",
);
assert.equal(
  muteMvEmptyFrame({
    footageRole: "hero",
    staging: "JACK GHOST three-quarter at the road",
    padNames: ["JACK GHOST"],
  }),
  false,
);
const jackRows = [
  { id: "beat_jack", speaker: "JACK GHOST" },
  { id: "beat_jack_mute", speaker: "JACK GHOST" },
];
assert.deepEqual(songDeskEditorBeats(jackRows, true), [jackRows[0]]);
assert.equal(songDeskEditorBeats(jackRows, false).length, 2);
assert.deepEqual(songDeskEditorBeats([], true), []);

console.log("check-mobile-plate-lines: ok");
