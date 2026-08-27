/**
 * Check forgotten / group-plate helpers. No generate. No live pack write.
 */
import {
  clampMusicVideoGroup,
  defaultMusicVideoGroupStaging,
  forgottenPlateStaging,
  forgottenResearchDrafts,
  forgottenSoloCamera,
  musicVideoSoloCamera,
  isForgottenSongJob,
  FORGOTTEN_PROMPT,
  MUSIC_VIDEO_GROUP_MAX,
  MUSIC_VIDEO_NO_CEL,
  namedInstrumentFor,
  stagingAfterAddCast,
  uniqueCastNames,
} from "../src/lib/musicVideoGroupPlate.ts";
import { buildScratchStillSend } from "../src/lib/scratchStillSend.ts";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

assert(MUSIC_VIDEO_GROUP_MAX === 3, "group max is 3");
assert(
  clampMusicVideoGroup(["JACK GHOST", "HORN", "SAXOPHONE", "DRUMMER", "GUITAR"]).join("|") ===
    "JACK GHOST|HORN|SAXOPHONE",
  "clamp drops the 4th and 5th",
);
assert(uniqueCastNames(["HORN", "horn", ""]).join("|") === "HORN", "unique names");
assert(namedInstrumentFor("HORN") === "muted trumpet at the lips", "horn is the muted trumpet");
assert(namedInstrumentFor("JACK GHOST") === "", "jack has no invented prop");
assert(isForgottenSongJob({ songTitle: "FORGOTTEN" }), "title forgotten");
assert(isForgottenSongJob({ songTitle: "FOGOTTEN" }), "typo fogotten");
assert(!isForgottenSongJob({ songTitle: "BLOWING UP CLAUDE" }), "not claude");

const drafts = forgottenResearchDrafts(
  ["JACK GHOST", "SAXOPHONE", "DRUMMER", "GUITAR", "HORN"],
  "Sulfur stream",
);
assert(drafts.length === 4, `expected 4 extras, got ${drafts.length}`);
assert(
  drafts.every((d) => d.speakers.length >= 2 && d.speakers.length <= 3),
  "extras are 2–3 people",
);
assert(
  !drafts.some((d) => d.speakers.includes("DRUMMER") && d.speakers.includes("GUITAR")),
  "no five-person / full-band plate",
);
assert(
  drafts.some((d) => d.budget === "EXPENSIVE_TAKE" && d.speakers.length === 3),
  "one dear three-shot",
);

const group = defaultMusicVideoGroupStaging(["JACK GHOST", "HORN"], "Sulfur stream", "static two-shot");
assert(/Only JACK GHOST and HORN in frame/.test(group), group);
assert(/HORN empty hands/.test(group), "default staging does not invent a horn");
assert(/JACK GHOST empty hands/.test(group), "empty hands");
assert(!/muted trumpet/.test(group), "instruments stay off unless this job named them");
assert(!/phone at/.test(group), "no invented phone");
const named = defaultMusicVideoGroupStaging(
  ["JACK GHOST", "HORN"],
  "Sulfur stream",
  "static two-shot",
  { nameInstruments: true },
);
assert(/muted trumpet/.test(named), "this job can still name the muted trumpet");

const after = stagingAfterAddCast({
  styleId: "music_video",
  speakers: ["JACK GHOST", "HORN"],
  placeName: "SALOON",
  previous: "JACK GHOST alone. Only JACK GHOST in frame, no one else appears.",
  soloStaging: (s) => `${s} alone.`,
});
assert(/HORN/.test(after) && /JACK GHOST/.test(after), "add-cast rewrites solo lock");
assert(!/JACK GHOST alone/.test(after), "old alone line must go");

const shazzaOnEmpty = stagingAfterAddCast({
  styleId: "sunny_banks",
  speakers: ["Shazza"],
  placeName: "Caravan park",
  previous:
    "Far out, wide empty Caravan park. Empty stage. No people. No musicians. No faces. Establishing shot.",
  soloStaging: (s) => `${s} alone. Only ${s} in frame, no one else appears.`,
});
assert(/Shazza alone/.test(shazzaOnEmpty), "empty-stage text must not stay when Shazza is added");
assert(!/No people/.test(shazzaOnEmpty), "No people lock must go when a person is on the card");
assert(!/Empty stage/.test(shazzaOnEmpty), "Empty stage lock must go when a person is on the card");

assert(/WIDE full-body/.test(forgottenSoloCamera("JACK GHOST", "Sulfur stream")), "jack is wide — face stays hidden");
assert(/blood crimson/.test(forgottenSoloCamera("JACK GHOST", "Sulfur stream")), "forgotten keeps the grade");
assert(
  !/blood crimson/.test(musicVideoSoloCamera("JACK GHOST", "Sulfur stream")),
  "next song does not get Forgotten grade",
);
assert(
  /MEDIUM SHOT/.test(musicVideoSoloCamera("Babe", "studio")),
  "a new singer is medium — not a leftover camera",
);
assert(
  /Babe empty hands/.test(musicVideoSoloCamera("Babe", "studio")),
  "a new singer has empty hands",
);
assert(/over the shoulder/i.test(forgottenSoloCamera("HORN", "Sulfur stream")), "horn is OTS");
assert(/Sitting/.test(forgottenSoloCamera("DRUMMER", "Sulfur stream")), "drummer sits");
assert(
  /OVER THE SHOULDER/.test(forgottenPlateStaging("JACK GHOST + HORN", ["JACK GHOST", "HORN"], "Sulfur stream")),
  "jack+horn is OTS two-shot",
);
assert(
  /WIDE three-shot/.test(
    forgottenPlateStaging("JACK GHOST + HORN + SAXOPHONE", ["JACK GHOST", "HORN", "SAXOPHONE"], "Sulfur stream"),
  ),
  "three is wide",
);

const mvSend = buildScratchStillSend({
  styleId: "music_video",
  styleRealism: 100,
  placeName: "Sulfur stream",
  speakers: ["JACK GHOST"],
  looksByName: { "JACK GHOST": "noir silhouette fedora" },
  placeLook: "sulfur stream",
  staging: forgottenSoloCamera("JACK GHOST", "Sulfur stream"),
  refineFromStill: false,
  joPhone: false,
});
assert(/Live-action photograph/.test(mvSend.prompt), "anti-cel on music video send");
assert(/No cel shading/.test(mvSend.prompt), "no cel on send");
assert(/No cel shading/.test(MUSIC_VIDEO_NO_CEL), "lock text");
assert(!/Little Red/.test(FORGOTTEN_PROMPT), "forgotten prompt does not name Little Red");
assert(!/HYBRID/.test(FORGOTTEN_PROMPT), "forgotten prompt does not name HYBRID");

console.log("check_music_video_group: ok");
