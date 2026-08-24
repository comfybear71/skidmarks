/** Run: npx tsx scripts/check-cast-bands.mjs */
import assert from "node:assert/strict";
import { matchCastBand } from "../src/lib/castBandMatch.ts";

const bands = [
  { name: "THE JACK ASH BAND", members: ["JACK", "ASH"] },
  { name: "THE DIRTY DOG LOT", members: ["TEE", "MATTY", "CRAZY BIG HOLE JO TOO"] },
];

assert.equal(matchCastBand(bands, ""), undefined);
assert.equal(matchCastBand(bands, "   "), undefined);
assert.equal(matchCastBand(bands, "THE DIRTY DOG LOT")?.name, "THE DIRTY DOG LOT");
assert.equal(matchCastBand(bands, "the dirty dog lot")?.name, "THE DIRTY DOG LOT");
assert.equal(matchCastBand(bands, "THE JACK ASH BAND")?.name, "THE JACK ASH BAND");
assert.equal(matchCastBand(bands, "no such"), undefined);

const musicPicked = "THE JACK ASH BAND";
const skidPicked = "THE DIRTY DOG LOT";
assert.equal(
  matchCastBand(bands, true ? musicPicked : skidPicked)?.name,
  "THE JACK ASH BAND",
);
assert.equal(
  matchCastBand(bands, false ? musicPicked : skidPicked)?.name,
  "THE DIRTY DOG LOT",
);
assert.equal(matchCastBand(bands, ""), undefined);

console.log("check-cast-bands: ok");
