/** Run: npx tsx scripts/check-plate-text-hygiene.mjs */
import assert from "node:assert/strict";
import { stagingAfterAddCast } from "../src/lib/musicVideoGroupPlate.ts";
import { emptyStageFarOutStaging, isEmptyStageStaging } from "../src/lib/emptyStagePlate.ts";
import { defaultSoloStaging } from "../src/lib/mobileImageMotion.ts";
import { buildDirectionPdf, directionLinesFromStory } from "../src/lib/episodeDirectionPdf.ts";

// --- "Add empty plate", then add a person ----------------------------------
const empty = emptyStageFarOutStaging("Caravan park");
assert.match(empty, /No people/);
assert.equal(isEmptyStageStaging(empty), true);
assert.equal(isEmptyStageStaging("Shazza leans on the rail, arms folded."), false);
assert.equal(isEmptyStageStaging(""), false);

// THE BUG: the empty-stage line survived, so a shot with Dazza on the card
// still told the model "No people. No musicians. No faces."
const afterDazza = stagingAfterAddCast({
  styleId: "sunny_banks",
  speakers: ["Dazza"],
  placeName: "Caravan park",
  previous: empty,
  soloStaging: defaultSoloStaging,
});
assert.doesNotMatch(afterDazza, /No people/);
assert.doesNotMatch(afterDazza, /Empty stage/);
assert.match(afterDazza, /Dazza/);

// A real director's position is still never overwritten.
const directed = "Dazza leans on the rail, beer can in his hand.";
assert.equal(
  stagingAfterAddCast({
    styleId: "sunny_banks",
    speakers: ["Dazza"],
    placeName: "Caravan park",
    previous: directed,
    soloStaging: defaultSoloStaging,
  }),
  directed,
);

// Group staging is unchanged.
assert.match(
  stagingAfterAddCast({
    styleId: "sunny_banks",
    speakers: ["Dazza", "Shazza"],
    placeName: "Caravan park",
    previous: empty,
    soloStaging: defaultSoloStaging,
  }),
  /Exactly 2 people/,
);

// --- the direction sheet ---------------------------------------------------
// A phone types curly quotes. The sheet is Helvetica with no embedded font, so
// they used to vanish: "Sunnybank’s" printed as "Sunnybank   s".
const curlyApostrophe = "’";
const emDash = "—";
const ellipsis = "…";
const story = {
  styleId: "sunny_banks",
  campaignLabel: "EP02 - DROP BEARS DILEMMA",
  gagNote: "THE GREATEST JOKE IN AUSTRALIA",
  intro: { title: "", notes: "", sfx: [] },
  outro: { title: "", notes: "", sfx: [] },
  updatedAt: "",
  scenes: [
    {
      id: "s1",
      title: "Caravan park",
      placeName: "Caravan park",
      worldThumbKey: "",
      shots: [
        {
          id: "sh1",
          title: "Another beautiful day",
          summary: "",
          staging: `Sunrise ${emDash} soft pink wash${ellipsis}`,
          plateFile: "",
          beats: [
            {
              id: "b1",
              speaker: "Ranger Bazza",
              text: `Another day at Sunnybank${curlyApostrophe}s Caravan Park.`,
            },
            {
              id: "b2",
              speaker: "Ranger Bazza",
              text: `Let${curlyApostrophe}s go and catch up with Shazza.`,
            },
          ],
          sfx: [{ id: "x", label: "magpie", notes: "" }],
        },
      ],
    },
  ],
};
const pdf = buildDirectionPdf(directionLinesFromStory(story)).toString("latin1");
assert.ok(pdf.includes("%PDF"));
assert.ok(pdf.includes("Sunnybank's Caravan Park"), "curly apostrophe folds to '");
assert.ok(pdf.includes("Let's go"), "curly apostrophe folds to '");
assert.ok(pdf.includes("Sunrise - soft pink wash..."), "em dash and ellipsis fold to ASCII");

// Nothing unrepresentable reaches the stream.
const stream = pdf.split("stream")[1] || "";
const bad = [...stream].filter((ch) => {
  const code = ch.charCodeAt(0);
  if (code === 10 || code === 13 || code === 9) return false;
  return code < 32 || code > 126;
});
assert.equal(bad.length, 0, "no unrepresentable bytes in the PDF text stream");

console.log("check-plate-text-hygiene: ok");
