/** Run: npx tsx scripts/check-five-style-process.mjs */
import assert from "node:assert/strict";
import { buildCrashGenLook } from "../src/lib/crashGenLook.ts";
import { characterPlateLayout } from "../src/lib/characterPlatePrompt.ts";
import { assistSystem } from "../src/lib/mobileAssist.ts";
import { episodeTemplateFromJob } from "../src/lib/mobilePasteParse.ts";
import { cursorPromptExampleForStyle } from "../src/lib/cursorAiWriterTemplate.ts";
import { defaultEpisodeRecipe } from "../src/lib/episodeRecipe.ts";
import { forgottenSoloCamera, musicVideoSoloCamera } from "../src/lib/musicVideoGroupPlate.ts";
import { canConjureCastFromStyle } from "../src/lib/mobileJobFromCast.ts";
import {
  canReuseCastForNewEpisode,
  FIVE_SHIP_STYLE_IDS,
  productionShowLabel,
  styleEpisodeAssistRules,
  styleStartRoster,
  styleUsesSongTrack,
} from "../src/lib/styleEpisodeProcess.ts";

assert.deepEqual([...FIVE_SHIP_STYLE_IDS], [
  "skidmarks",
  "sunny_banks",
  "doc",
  "music_video",
  "photoreal",
]);

assert.equal(styleUsesSongTrack("music_video"), true);
assert.equal(styleUsesSongTrack("skidmarks"), false);
assert.equal(canReuseCastForNewEpisode("sunny_banks"), true);
assert.equal(canReuseCastForNewEpisode("doc"), true);
assert.equal(canReuseCastForNewEpisode("photoreal"), true);
assert.equal(canConjureCastFromStyle("music_video"), false);
assert.equal(canConjureCastFromStyle("skidmarks"), true);

assert.equal(productionShowLabel("doc"), "Documentary");
assert.equal(productionShowLabel("photoreal"), "Photoreal");
assert.equal(productionShowLabel("sunny_banks"), "Sunny Banks");

const sunnySeed = styleStartRoster("sunny_banks");
assert.ok(sunnySeed.speakers.includes("Dazza"));
assert.ok(sunnySeed.speakers.includes("Nan"));
assert.equal(sunnySeed.speakers.length, 6);
assert.ok(sunnySeed.placeNames.includes("Caravan park"));

const skidSeed = styleStartRoster("skidmarks");
assert.deepEqual(skidSeed.speakers, []);
assert.ok(skidSeed.placeNames.includes("Dirty Dog Pub"));

const mvSeed = styleStartRoster("music_video");
assert.deepEqual(mvSeed.speakers, []);
assert.deepEqual(mvSeed.placeNames, []);

const skidLook = buildCrashGenLook("skidmarks", 25);
assert.match(skidLook, /stylised 3D/);
assert.doesNotMatch(skidLook, /sun-bleached Aussie palette/);
assert.doesNotMatch(skidLook, /rubbery adult cartoon/);

const docLook = buildCrashGenLook("doc", 20);
assert.match(docLook, /documentary interview/);
assert.doesNotMatch(docLook, /sun-bleached Aussie palette/);

const photoLook = buildCrashGenLook("photoreal", 10);
assert.match(photoLook, /photorealistic cinematic/);
assert.doesNotMatch(photoLook, /rubbery adult cartoon/);

const sunnyLook = buildCrashGenLook("sunny_banks", 25);
assert.match(sunnyLook, /rubbery adult cartoon/);
assert.doesNotMatch(sunnyLook, /stylised 3D animated feature render/);

const sheet = characterPlateLayout({
  styleId: "photoreal",
  name: "Sam",
  lookLock: "photorealistic cinematic still",
  styleRealism: 20,
});
assert.match(sheet, /WAIST-UP/);
assert.doesNotMatch(sheet, /FULL-BODY/);

const skidAssist = styleEpisodeAssistRules("skidmarks");
assert.match(skidAssist, /MASTER EPISODE CONSTRUCTION/);
assert.doesNotMatch(skidAssist, /exactly four/);

const sunnyAssist = styleEpisodeAssistRules("sunny_banks");
assert.match(sunnyAssist, /exactly four/);
assert.doesNotMatch(sunnyAssist, /nine ACTS/);

const docAssist = styleEpisodeAssistRules("doc");
assert.match(docAssist, /Hook → Witness → Turn → Sting/);
assert.doesNotMatch(docAssist, /Nan ONLY/);

assert.match(assistSystem("sunny_banks", "episode"), /exactly four/);
assert.match(assistSystem("skidmarks", "episode"), /MASTER EPISODE CONSTRUCTION/);
assert.doesNotMatch(assistSystem("doc", "episode"), /Laundry meltdown/);

const skidBlank = episodeTemplateFromJob({
  prompt: "The prick arrives",
  speakers: ["Darryl"],
  scenes: [{ placeName: "Dirty Dog Pub" }],
  styleId: "skidmarks",
});
assert.match(skidBlank, /CAST_MAIN/);
assert.match(skidBlank, /ACT_I|ACT I|<ACT_/i);

const sunnyBlank = episodeTemplateFromJob({
  prompt: "Drop bear",
  speakers: ["Dazza", "Nan"],
  scenes: [
    { placeName: "Caravan park" },
    { placeName: "Ranger office" },
    { placeName: "BBQ shelter" },
    { placeName: "Nan's site" },
  ],
  styleId: "sunny_banks",
});
assert.match(sunnyBlank, /SHOT 4/);
assert.match(sunnyBlank, /Nan button/);
assert.match(sunnyBlank, /Place: Nan's site/);

assert.doesNotMatch(cursorPromptExampleForStyle("doc"), /Nuggets shrinks/);
assert.doesNotMatch(cursorPromptExampleForStyle("photoreal"), /Nuggets shrinks/);
assert.match(cursorPromptExampleForStyle("doc"), /Hook/);
assert.match(cursorPromptExampleForStyle("sunny_banks"), /Nuggets/);

assert.equal(defaultEpisodeRecipe("doc").targetMinutes, 22);
assert.equal(defaultEpisodeRecipe("photoreal").targetMinutes, 22);
assert.equal(defaultEpisodeRecipe("music_video").targetMinutes, 7);

const cam = musicVideoSoloCamera("JACK GHOST", "the stage");
assert.match(cam, /WIDE full-body|wide/i);
assert.doesNotMatch(cam, /blood crimson/);
assert.match(forgottenSoloCamera("JACK GHOST", "the stage"), /blood crimson/);

console.log("check-five-style-process: ok");
