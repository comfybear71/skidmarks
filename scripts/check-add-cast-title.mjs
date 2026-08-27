/** Run: npx tsx scripts/check-add-cast-title.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { titleAfterAddCast } from "../src/lib/musicVideoGroupPlate.ts";

// THE BUG: adding someone to a plate renamed the shot to the cast list, so a
// Title: straight from the script, or the SHOT NN convention, was destroyed.
assert.equal(
  titleAfterAddCast({
    current: "SHOT 03 — Dazza",
    previousCast: ["Dazza"],
    nextCast: ["Ranger Bazza", "Shazza", "Dazza"],
  }),
  "SHOT 03 — Dazza",
);
assert.equal(
  titleAfterAddCast({
    current: "Bookings are down",
    previousCast: ["Shazza"],
    nextCast: ["Shazza", "Ranger Bazza"],
  }),
  "Bookings are down",
);
// Removing someone does not rename it either.
assert.equal(
  titleAfterAddCast({
    current: "Be careful of the drop bears",
    previousCast: ["Shazza", "Dazza"],
    nextCast: ["Shazza"],
  }),
  "Be careful of the drop bears",
);

// A title we wrote ourselves stays in step with the cast.
assert.equal(
  titleAfterAddCast({ current: "Dazza", previousCast: ["Dazza"], nextCast: ["Dazza", "Shazza"] }),
  "Dazza, Shazza",
);
assert.equal(
  titleAfterAddCast({
    current: "Ranger Bazza, Shazza",
    previousCast: ["Ranger Bazza", "Shazza"],
    nextCast: ["Ranger Bazza", "Shazza", "Dazza"],
  }),
  "Ranger Bazza, Shazza, Dazza",
);
// Case and duplicates do not stop the match.
assert.equal(
  titleAfterAddCast({ current: "dazza", previousCast: ["Dazza", "Dazza"], nextCast: ["Dazza", "Nan"] }),
  "Dazza, Nan",
);

// An untitled shot gets the cast list, as before.
assert.equal(titleAfterAddCast({ current: "", previousCast: [], nextCast: ["Nan"] }), "Nan");
assert.equal(titleAfterAddCast({ current: "   ", previousCast: [], nextCast: ["Nan"] }), "Nan");
// Nothing to name it with — keep what is there rather than blanking it.
assert.equal(titleAfterAddCast({ current: "Bookings are down", previousCast: [], nextCast: [] }), "Bookings are down");
assert.equal(titleAfterAddCast({ current: "", previousCast: [], nextCast: [] }), "");

// The route must use it — the old clobber must not come back.
const route = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/app/api/crash/mobile/plate/route.ts"),
  "utf8",
);
assert.match(route, /titleAfterAddCast\(\{/);
assert.doesNotMatch(route, /title: cast\.join\(", "\) \|\| sh\.title/);

console.log("check-add-cast-title: ok");
