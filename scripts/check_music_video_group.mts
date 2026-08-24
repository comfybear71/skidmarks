/**
 * Check forgotten / group-plate helpers. No generate. No live pack write.
 */
import {
  clampMusicVideoGroup,
  defaultMusicVideoGroupStaging,
  forgottenPlateStaging,
  forgottenResearchDrafts,
  forgottenSoloCamera,
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
assert(/muted trumpet/.test(group), "horn instrument named");
assert(/JACK GHOST empty hands/.test(group), "jack empty hands");
assert(!/phone at/.test(group), "no invented phone");

const after = stagingAfterAddCast({
  styleId: "music_video",
  speakers: ["JACK GHOST", "HORN"],
  placeName: "SALOON",
  previous: "JACK GHOST alone. Only JACK GHOST in frame, no one else appears.",
  soloStaging: (s) => `${s} alone.`,
});
assert(/HORN/.test(after) && /JACK GHOST/.test(after), "add-cast rewrites solo lock");
assert(!/JACK GHOST alone/.test(after), "old alone line must go");

assert(/TIGHT CLOSE-UP/.test(forgottenSoloCamera("JACK GHOST", "Sulfur stream")), "jack is tight CU");
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
