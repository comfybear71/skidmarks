/** Run: npx tsx scripts/check-sunny-episode.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMobilePaste } from "../src/lib/mobilePasteParse.ts";
import {
  SUNNY_EPISODE_BLANK,
  canonicalSunnyName,
  isSunnyExtraName,
  matchSunnyPlace,
  matchSunnyPlaceLoose,
  scanSunnyEpisodeScript,
  sunnyEpisodeGate,
  sunnyGuestLooksFromScript,
  splitSunnyCastField,
  applySunnyScriptCastToStory,
  planSunnyShot,
  planSunnyEpisodeShots,
} from "../src/lib/sunnyEpisodeSpec.ts";
import {
  autoPickSunnyTakes,
  generateSunnyGuestFace,
  isSunnySeriesLockJob,
  missingSunnyShelfFaces,
  missingSunnyShelfPlaces,
  pickSunnySeriesFace,
} from "../src/lib/sunnyEpisodeSeed.ts";
import {
  buildDirectionPdf,
  directionLinesFromStory,
} from "../src/lib/episodeDirectionPdf.ts";
import { sunnyAutoKeepsFailedProof } from "../src/lib/sunnyEpisodeCook.ts";

const here = dirname(fileURLToPath(import.meta.url));
const mPage = readFileSync(join(here, "../src/app/(mobile)/m/page.tsx"), "utf8");
const sunnyCard = readFileSync(
  join(here, "../src/components/mobile/SunnyEpisodeStart.tsx"),
  "utf8",
);
const sunnyRoute = readFileSync(
  join(here, "../src/app/api/crash/mobile/sunny-episode/route.ts"),
  "utf8",
);
const zipRoute = readFileSync(
  join(here, "../src/app/api/crash/mobile/clips/zip/route.ts"),
  "utf8",
);

assert.equal(canonicalSunnyName("Ranger Dan"), "Ranger Bazza");
assert.equal(canonicalSunnyName("Dan"), "Ranger Bazza");
assert.equal(canonicalSunnyName("Bubbles"), "Bubbles");
assert.equal(canonicalSunnyName("Bubbles (Cosmic Sludge Creature)"), "Bubbles");
assert.equal(canonicalSunnyName("The Foam Monster (Gazza and Shazza in disguise)"), "The Foam Monster");
assert.equal(isSunnyExtraName("Caravan Park Resident 1"), true);
assert.equal(isSunnyExtraName("Bush Turkeys"), true);
assert.equal(isSunnyExtraName("Discarded Manuals"), true);
assert.equal(isSunnyExtraName("The Foam Monster"), true);
assert.equal(isSunnyExtraName("The Laundry Monster"), true);
assert.equal(isSunnyExtraName("The Laundry Monster (Shazza and Nan in disguise)"), true);
assert.equal(isSunnyExtraName("Bubbles"), false);
assert.equal(isSunnyExtraName("Gazza"), false);

const okScript = `EPISODE: Whistle Sale
GAG: Dan sells a whistle.

--- SHOT 1 ---
Title: The pitch
Place: Caravan park
Cast: Ranger Dan
Camera: wide
Plate: Weathered timber deck. Ranger Bazza holds a megaphone. Empty hands except the megaphone.
Name: Ranger Dan
[megaphone] "Attention, residents!"
`;

const shelf = [{ name: "Caravan park" }, { name: "Ranger office" }];
const ok = sunnyEpisodeGate({ brief: "Dan sells a whistle.", script: okScript, shelfPlaces: shelf });
assert.equal(ok.ok, true);
assert.deepEqual(ok.scan.speakers, ["Ranger Bazza"]);
assert.equal(ok.scan.guests.length, 0);

const parsed = parseMobilePaste(okScript, "sunny_banks");
assert.equal(parsed.story.scenes[0].shots[0].beats[0].speaker, "Ranger Bazza");
assert.equal(parsed.story.scenes[0].shots[0].sfx?.[0]?.label, "megaphone");
const pdfLines = directionLinesFromStory(parsed.story);
assert.match(pdfLines.join("\n"), /\[megaphone\]/);
assert.match(pdfLines.join("\n"), /Ranger Bazza:/);
const pdf = buildDirectionPdf(pdfLines);
assert.ok(pdf.toString("latin1").includes("%PDF"));
assert.ok(pdf.toString("latin1").includes("Ranger Bazza"));

const dropBear = `EPISODE: 2 - Drop Bear Dilemma
GAG: Ranger Dan tries to demonstrate his high-frequency marsupial repellent.

--- SHOT 1 ---
Title: The Warning
Place: Caravan Park Main Deck
Cast: Ranger Dan, Caravan Park Residents
Camera: Wide shot tracking Dan
Plate: Weathered timber deck.
Name: Ranger Dan
[Megaphone static screech] "Attention, residents!"

--- SHOT 8 ---
Title: Bubbles Appears
Place: Inside the Metal Cage
Cast: Bubbles
Name: Bubbles
[Gurgling liquid noises]

--- SHOT 10 ---
Title: The Mob Gathers
Place: Scrub Line Edge
Cast: Caravan Park Residents, Dazza, Ranger Dan, Bubbles
Name: Caravan Park Resident 1
[Excited chatter] "Look at the glowing purple teeth on it!"
`;

const dropGate = sunnyEpisodeGate({
  brief: "Turkeys nest in the golf cart.",
  script: dropBear,
  shelfPlaces: shelf,
});
assert.equal(dropGate.ok, true);
assert.ok(dropGate.scan.guests.includes("Bubbles"));
assert.ok(!dropGate.scan.guests.includes("Caravan Park Residents"));
assert.ok(!dropGate.scan.guests.includes("Caravan Park Resident 1"));
assert.ok(!dropGate.scan.speakers.includes("Ranger Dan"));
assert.ok(dropGate.scan.speakers.includes("Ranger Bazza"));
assert.ok(dropGate.scan.unknownPlaces.includes("Caravan Park Main Deck"));
assert.equal(dropGate.scan.overcastShots.length, 0);

const splitMob = `EPISODE: Split
GAG: Split the mob.

--- SHOT 10 ---
Place: Caravan park
Cast: Dazza, Ranger Dan, Bubbles
Name: Ranger Dan
[Gasp] "Look at it!"

--- SHOT 10B ---
Place: Caravan park
Cast: Caravan Park Resident 1
Name: Caravan Park Resident 1
[Excited chatter] "Look at the glowing purple teeth on it!"
`;
const splitGate = sunnyEpisodeGate({
  brief: "Split the mob.",
  script: splitMob,
  shelfPlaces: shelf,
});
assert.equal(splitGate.ok, true);
assert.equal(splitGate.scan.overcastShots.length, 0);
assert.ok(!splitGate.scan.guests.includes("Caravan Park Resident 1"));

const groupScript = `EPISODE: Group
GAG: Crew pile in.

--- SHOT 17 ---
Place: Caravan park
Cast: Dazza, Shazza, Nan, Unit 4s
Name: Dazza
[Tap] "Alright."

--- SHOT 35 ---
Place: Caravan park
Cast: Unit 4s, Dazza, Shazza, Nan, Nuggets
Name: Shazza
[Can] "Not a bad evening."
`;
const groupGate = sunnyEpisodeGate({
  brief: "Crew pile in.",
  script: groupScript,
  shelfPlaces: shelf,
});
assert.equal(groupGate.ok, true);
assert.ok(groupGate.scan.overcastShots.length >= 2);

const laundryScript = `EPISODE: Costume
GAG: Fake bear.

--- SHOT 22 ---
Place: Caravan park
Cast: The Laundry Monster (Shazza and Nan in disguise)
Name: The Laundry Monster
[Thump]
`;
const laundryGate = sunnyEpisodeGate({
  brief: "Fake bear.",
  script: laundryScript,
  shelfPlaces: shelf,
});
assert.equal(laundryGate.ok, true);
assert.ok(!laundryGate.scan.guests.includes("The Laundry Monster"));
assert.ok(!laundryGate.scan.speakers.includes("The Laundry Monster"));
assert.ok(laundryGate.scan.speakers.includes("Shazza"));
assert.ok(laundryGate.scan.speakers.includes("Nan"));
assert.deepEqual(splitSunnyCastField("Bubbles (Sludge Monster)"), ["Bubbles"]);
assert.deepEqual(splitSunnyCastField("The Laundry Monster (Shazza and Nan in disguise)"), [
  "The Laundry Monster",
  "Shazza",
  "Nan",
]);

const campParsed = parseMobilePaste(
  `EPISODE: Camp
GAG: Crowd.

--- SHOT 10 ---
Title: The Camp Gathers
Place: Caravan park
Cast: Caravan Park Residents, Dazza, Ranger Bazza, Nuggets
Camera: High angle including Nuggets.
Plate: Thongs slapping on gravel.
Name: Caravan Park Resident 1
[Excited chatter] "Look at the glowing purple teeth on it!"
`,
  "sunny_banks",
);
const campShot = campParsed.story.scenes[0].shots[0];
assert.match(campShot.staging || "", /Cast:.*Dazza/);
assert.ok((campShot.castNames || []).includes("Dazza"));
assert.ok((campShot.castNames || []).includes("Ranger Bazza"));
assert.equal(campShot.beats[0].speaker, "Caravan Park Resident 1");

const bubblesHold = parseMobilePaste(
  `EPISODE: Cage
GAG: Goo.

--- SHOT 1 ---
Title: Hello
Place: Caravan park
Cast: Dazza
Name: Dazza
[tap] "Hi"

--- SHOT 8 ---
Title: Bubbles is Trapped
Place: Caravan park
Cast: Bubbles (Sludge Monster)
Plate: Purple goo.
Name: Bubbles
[Gurgling liquid noises]
`,
  "sunny_banks",
);
const bubbleShot = bubblesHold.story.scenes[0].shots.find((s) => s.title === "Bubbles is Trapped");
assert.equal(bubbleShot?.beats[0].speaker, "Bubbles");

const patched = applySunnyScriptCastToStory(
  {
    styleId: "sunny_banks",
    campaignLabel: "",
    gagNote: "",
    intro: { title: "", notes: "", sfx: [] },
    outro: { title: "", notes: "", sfx: [] },
    scenes: [
      {
        id: "sc1",
        title: "Water Tank District",
        placeName: "Water Tank District",
        worldThumbKey: "",
        shots: [
          {
            id: "s10",
            title: "The Camp Gathers",
            summary: "",
            staging: "Camera: High angle. Plate: Thongs.",
            plateFile: "",
            beats: [{ id: "b", speaker: "Caravan Park Resident 1", text: "Look!" }],
            sfx: [],
          },
        ],
      },
    ],
    updatedAt: "",
  },
  `--- SHOT 10 ---
Title: The Camp Gathers
Cast: Caravan Park Residents, Dazza, Ranger Bazza, Nuggets
Name: Caravan Park Resident 1
`,
);
assert.match(patched.scenes[0].shots[0].staging || "", /^Cast:.*Dazza/);
assert.ok((patched.scenes[0].shots[0].castNames || []).includes("Nuggets"));

const campPlan = planSunnyShot(
  `Title: The Camp Gathers
Place: Water Tank District
Cast: Caravan Park Residents, Dazza, Ranger Bazza, Nuggets
Name: Caravan Park Resident 1
`,
  "SHOT 10",
);
assert.equal(campPlan.plan, "composite");
assert.deepEqual(campPlan.onCard, ["Dazza", "Ranger Bazza", "Nuggets"]);
assert.equal(campPlan.blockers.length, 0);

const turkeyPlan = planSunnyShot(
  `Title: Turkey Influx
Place: Around Bazza’s Golf Cart
Cast: Bush Turkeys
Name: Bush Turkeys
`,
  "SHOT 27",
);
assert.equal(turkeyPlan.plan, "hang-place");
assert.deepEqual(turkeyPlan.onCard, []);

const laundryPlan = planSunnyShot(
  `Title: The Fake Alpha Appears
Place: Edge of the Clearing
Cast: The Laundry Monster (Shazza and Nan in disguise)
Name: The Laundry Monster
`,
  "SHOT 22",
);
assert.equal(laundryPlan.plan, "composite");
assert.ok(laundryPlan.onCard.includes("Shazza"));
assert.ok(laundryPlan.onCard.includes("Nan"));

const blockedScript = `EPISODE: Broken
GAG: No place.

--- SHOT 1 ---
Title: Oops
Cast: Dazza
Name: Dazza
[tap] "Hi"

--- SHOT 2 ---
Title: Ok
Place: Caravan park
Cast: Dazza
Name: Dazza
[tap] "Bye"
`;
const blockedGate = sunnyEpisodeGate({
  brief: "No place.",
  script: blockedScript,
  shelfPlaces: shelf,
});
assert.equal(blockedGate.ok, false);
assert.match(blockedGate.error, /no plate plan/i);
assert.equal(planSunnyEpisodeShots(blockedScript)[0].plan, "blocked");
assert.ok(dropGate.scan.compositeCount >= 2);
assert.equal(typeof dropGate.scan.hangPlaceCount, "number");
assert.deepEqual(dropGate.scan.blockedShots, []);

const scan = scanSunnyEpisodeScript(dropBear);
assert.equal(scan.title, "2 - Drop Bear Dilemma");
assert.ok(scan.places.includes("Inside the Metal Cage"));

assert.match(SUNNY_EPISODE_BLANK, /--- SHOT 1 ---/);
assert.match(SUNNY_EPISODE_BLANK, /Name:/);

assert.match(mPage, /What's the vibe\?/);
assert.match(mPage, /Start directing/);
assert.match(mPage, /SunnyEpisodeStart/);
assert.match(mPage, /sunny-episode/);
assert.match(sunnyCard, /Make this episode/);
assert.match(sunnyCard, /WAIT\. Making the episode/);
assert.match(sunnyCard, /Won't start yet/);
assert.match(sunnyCard, /Gag and script stay/);
assert.match(sunnyCard, /No Pick this one/);
assert.match(sunnyCard, /New names get drawn/);
assert.match(sunnyCard, /shots have a/);
assert.match(sunnyCard, /hang the place still/);
assert.match(readFileSync(join(here, "../src/lib/sunnyEpisodeSpec.ts"), "utf8"), /planSunnyShot/);
assert.match(readFileSync(join(here, "../src/lib/sunnyEpisodeSpec.ts"), "utf8"), /blockedShots/);
assert.doesNotMatch(sunnyCard, /What's the vibe\?/);
assert.doesNotMatch(sunnyCard, /Nothing auto-saves/);
assert.doesNotMatch(sunnyCard, /Not a block/);
assert.doesNotMatch(sunnyCard, /Make fails red/);
assert.doesNotMatch(sunnyRoute, /Add a face first/);
assert.match(sunnyRoute, /sunnyEpisodeGate/);
assert.match(sunnyRoute, /findSunnyReusableFaces/);
assert.match(sunnyRoute, /sunnyAuto: true/);
assert.match(sunnyRoute, /importPastedStory/);
assert.doesNotMatch(sunnyRoute, /mgen_20260824085817084_edp/);
assert.match(readFileSync(join(here, "../src/lib/sunnyEpisodeSeed.ts"), "utf8"), /pickSunnySeriesFace/);
assert.doesNotMatch(
  readFileSync(join(here, "../src/lib/sunnyEpisodeSeed.ts"), "utf8"),
  /if \(!missing\.length\) return fromShelf/,
);
assert.match(readFileSync(join(here, "../src/app/api/crash/mobile/step/route.ts"), "utf8"), /runSunnyAutoStep/);
assert.equal(
  sunnyAutoKeepsFailedProof({
    plateFile: "cplate_20260826193102083_g13.png",
    qaOk: false,
  }),
  true,
);
assert.equal(sunnyAutoKeepsFailedProof({ plateFile: "", qaOk: false }), false);
assert.equal(sunnyAutoKeepsFailedProof({ plateFile: "__error__", qaOk: false }), false);
assert.match(
  readFileSync(join(here, "../src/lib/sunnyEpisodeCook.ts"), "utf8"),
  /sunnyAutoKeepsFailedProof/,
);
assert.match(readFileSync(join(here, "../src/app/(mobile)/m/page.tsx"), "utf8"), /WAIT\. Cooking the episode/);

const shelfLoose = [
  { name: "Caravan park", thumbKey: "g:place_park.png" },
  { name: "Ranger office", thumbKey: "g:place_office.png" },
];
assert.equal(matchSunnyPlace("Caravan Park Main Deck", shelfLoose), null);
assert.equal(matchSunnyPlaceLoose("Caravan Park Main Deck", shelfLoose)?.name, "Caravan park");
assert.deepEqual(missingSunnyShelfPlaces(["Caravan Park Main Deck"], shelfLoose), []);
assert.deepEqual(missingSunnyShelfPlaces(["Inside the Metal Cage"], shelfLoose), [
  "Inside the Metal Cage",
]);
assert.deepEqual(missingSunnyShelfFaces(["Bubbles"], {}), ["Bubbles"]);
assert.equal(
  sunnyGuestLooksFromScript('Name: Bubbles (Cosmic Sludge Creature)')["Bubbles"],
  "Cosmic Sludge Creature",
);
assert.doesNotMatch(sunnyRoute, /sunnyShelfFailMessage/);

const picked = autoPickSunnyTakes({
  styleId: "sunny_banks",
  castCandidates: {
    Dazza: [
      { id: "plate", fileName: "plate_dazza.png", approved: false },
      { id: "face", fileName: "thumb_dazza.png", approved: false },
    ],
  },
  locationCandidates: {
    scene1: [{ id: "p1", fileName: "place_1.png", approved: false }],
  },
});
assert.equal(picked.changed, true);
assert.equal(picked.castCandidates.Dazza.find((c) => c.approved)?.fileName, "thumb_dazza.png");
assert.equal(picked.locationCandidates.scene1[0].approved, true);
await assert.rejects(
  () =>
    generateSunnyGuestFace(
      {
        id: "mgen_test",
        styleId: "sunny_banks",
        folderName: "",
        styleRealism: 25,
      },
      "Dazza",
      "",
    ),
  /Won't invent Dazza/,
);
assert.match(zipRoute, /direction\.pdf/);
assert.match(zipRoute, /buildDirectionPdf/);

assert.equal(
  isSunnySeriesLockJob({ prompt: "EP02 DROP BEAR DILEMMA - SUNNY BANKS", folderName: "" }),
  true,
);
assert.equal(
  isSunnySeriesLockJob({
    folderName: "2 - Drop Bear Dilemma 91_kc3",
    prompt: "Ranger Dan tries to demonstrate his device",
  }),
  false,
);
assert.equal(
  pickSunnySeriesFace({
    name: "Dazza",
    shelf: { name: "Dazza", fileName: "thumb_1786096652402.png", look: "old shelf" },
    jobFaces: [
      { fileName: "thumb_1786096652402.png", look: "old shelf", seriesLock: false },
      { fileName: "face_ujnrc38.png", look: "a front on of this character", seriesLock: true },
    ],
  })?.fileName,
  "face_ujnrc38.png",
);
assert.equal(
  pickSunnySeriesFace({
    name: "Dazza",
    shelf: { name: "Dazza", fileName: "thumb_1786096652402.png", look: "old shelf" },
    jobFaces: [{ fileName: "thumb_1786096652402.png", look: "old shelf", seriesLock: false }],
  })?.fileName,
  "thumb_1786096652402.png",
);

console.log("check-sunny-episode: ok");
