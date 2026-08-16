import assert from "node:assert/strict";
import {
  defaultShotStaging,
  editorStagingSeed,
  peopleForShotPlate,
  stagingLooksLikeCrowdDump,
} from "../src/lib/mobilePlateStaging.ts";

const dump = "Matty, Bc, Big Sexy, Comfy, Ladder One, Tee, Land Landy · MATTY BAR";
assert.equal(stagingLooksLikeCrowdDump(dump), true);
assert.equal(
  stagingLooksLikeCrowdDump("Matty leans on the fridge. Jo sits on a stool."),
  false,
);

const simple = defaultShotStaging("Matty bar", ["Matty", "Jo", "BC"]);
assert.match(simple, /Matty and Jo/);
assert.match(simple, /two people only/i);
assert.doesNotMatch(simple, /BC/);

assert.deepEqual(
  peopleForShotPlate({
    staging: dump,
    beatSpeakers: ["Matty", "Jo", "BC"],
    roster: ["Matty", "Jo", "BC", "Tee"],
  }),
  ["Matty", "Jo"],
);

assert.deepEqual(
  peopleForShotPlate({
    staging: "Matty leans on the fridge. Jo sits on a stool. Nobody else.",
    beatSpeakers: ["Matty", "Jo", "BC"],
    roster: ["Matty", "Jo", "BC", "Tee"],
  }),
  ["Matty", "Jo"],
);

const seed = editorStagingSeed({
  staging: dump,
  placeName: "Matty bar",
  beatSpeakers: ["Matty"],
});
assert.match(seed, /Matty in Matty bar/);
assert.doesNotMatch(seed, /Big Sexy/);

console.log("check-mobile-plate-staging: ok");
