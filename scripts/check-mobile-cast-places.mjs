import assert from "node:assert/strict";
import {
  MATTY_BAR_ENSEMBLE_SHOTS,
  castGoesToMattyBar,
  castPlaceKindsFor,
  classifyCastPlace,
  classifyCastRoster,
  mattyBarCast,
  requiredCastPlacePlates,
} from "../src/lib/mobileCastPlaces.ts";

assert.equal(classifyCastRoster("CRAZY BIG HOLE JO"), "jo");
assert.equal(classifyCastRoster("JO TOO"), "jo_too");
assert.equal(classifyCastRoster("JO_TOO"), "jo_too");
assert.equal(classifyCastRoster("TEE"), "tee");
assert.equal(classifyCastRoster("BC"), "bc");
assert.equal(classifyCastRoster("LADDER ONE"), "ladder");
assert.equal(classifyCastRoster("BIG SEXY"), "big_sexy");
assert.equal(classifyCastRoster("LAND LADY"), "land_lady");
assert.equal(classifyCastRoster("COMFY"), "comfy");
assert.equal(classifyCastRoster("MATTY"), "matty");

assert.equal(classifyCastPlace("Jo's bedroom (the cell)"), "jo_cell");
assert.equal(classifyCastPlace("Upstairs lounge"), "jo_lounge");
assert.equal(classifyCastPlace("Pool"), "jo_pool");
assert.equal(classifyCastPlace("Front house"), "front_house");
assert.equal(classifyCastPlace("Land lady bedroom"), "ll_bedroom");
assert.equal(classifyCastPlace("The donga"), "donga");
assert.equal(classifyCastPlace("Matty's bar"), "matty_bar");

assert.deepEqual(castPlaceKindsFor("CRAZY BIG HOLE JO"), ["jo_cell"]);
assert.deepEqual(castPlaceKindsFor("TEE"), ["jo_lounge", "jo_pool"]);
assert.deepEqual(castPlaceKindsFor("BC"), ["jo_lounge", "jo_pool"]);
assert.deepEqual(castPlaceKindsFor("LADDER ONE"), ["jo_lounge", "jo_pool"]);
assert.deepEqual(castPlaceKindsFor("JO TOO"), ["jo_lounge", "jo_pool"]);
assert.deepEqual(castPlaceKindsFor("LAND LADY"), ["ll_bedroom", "front_house"]);
assert.deepEqual(castPlaceKindsFor("COMFY"), ["ll_bedroom", "front_house"]);
assert.deepEqual(castPlaceKindsFor("BIG SEXY"), ["donga"]);
assert.deepEqual(castPlaceKindsFor("MATTY"), ["matty_bar"]);
assert.equal(castGoesToMattyBar("jo"), false);
assert.equal(castGoesToMattyBar("tee"), true);
assert.equal(MATTY_BAR_ENSEMBLE_SHOTS, 2);
assert.deepEqual(
  mattyBarCast(["CRAZY BIG HOLE JO", "TEE", "MATTY", "BIG SEXY"]),
  ["TEE", "MATTY", "BIG SEXY"],
);

const scenes = [
  { id: "cell", placeName: "Jo's bedroom (the cell)" },
  { id: "lounge", placeName: "Upstairs lounge" },
  { id: "pool", placeName: "Pool" },
  { id: "front", placeName: "Front house" },
  { id: "llbed", placeName: "Comfy bedroom" },
  { id: "donga", placeName: "The donga" },
  { id: "bar", placeName: "Matty's bar" },
];
const tee = requiredCastPlacePlates(["TEE"], scenes);
assert.deepEqual(
  tee.map((r) => r.kind),
  ["jo_lounge", "jo_pool"],
);
assert.ok(!tee.some((r) => r.kind === "jo_cell"));
const jo = requiredCastPlacePlates(["CRAZY BIG HOLE JO"], scenes);
assert.deepEqual(
  jo.map((r) => r.kind),
  ["jo_cell"],
);

console.log("check-mobile-cast-places: ok");
