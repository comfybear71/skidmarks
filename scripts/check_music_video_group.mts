/**
 * Check forgotten / group-plate helpers. No generate. No live pack write.
 */
import {
  clampMusicVideoGroup,
  defaultMusicVideoGroupStaging,
  forgottenResearchDrafts,
  isForgottenSongJob,
  MUSIC_VIDEO_GROUP_MAX,
  namedInstrumentFor,
  stagingAfterAddCast,
  uniqueCastNames,
} from "../src/lib/musicVideoGroupPlate.ts";

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

console.log("check_music_video_group: ok");
