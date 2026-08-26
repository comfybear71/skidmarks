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
  scanSunnyEpisodeScript,
  sunnyEpisodeGate,
} from "../src/lib/sunnyEpisodeSpec.ts";
import {
  buildDirectionPdf,
  directionLinesFromStory,
} from "../src/lib/episodeDirectionPdf.ts";

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
assert.match(sunnyCard, /Nothing auto-saves/);
assert.match(sunnyCard, /Not a block/);
assert.doesNotMatch(sunnyCard, /What's the vibe\?/);
assert.doesNotMatch(sunnyRoute, /Add a face first/);
assert.match(sunnyRoute, /sunnyEpisodeGate/);
assert.match(sunnyRoute, /importPastedStory/);
assert.doesNotMatch(sunnyRoute, /mgen_20260824085817084_edp/);
assert.match(zipRoute, /direction\.pdf/);
assert.match(zipRoute, /buildDirectionPdf/);

console.log("check-sunny-episode: ok");
