import assert from "node:assert/strict";
import {
  castPlaceKindsFor,
  classifyCastPlace,
  classifyCastRoster,
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
assert.deepEqual(castPlaceKindsFor("TEE"), ["jo_lounge", "jo_pool", "matty_bar"]);
assert.deepEqual(castPlaceKindsFor("BC"), ["jo_lounge", "jo_pool", "matty_bar"]);
assert.deepEqual(castPlaceKindsFor("LADDER ONE"), ["jo_lounge", "jo_pool", "matty_bar"]);
assert.deepEqual(castPlaceKindsFor("JO TOO"), ["jo_lounge", "jo_pool", "matty_bar"]);
assert.deepEqual(castPlaceKindsFor("LAND LADY"), ["ll_bedroom", "front_house", "matty_bar"]);
assert.deepEqual(castPlaceKindsFor("COMFY"), ["ll_bedroom", "front_house", "matty_bar"]);
assert.deepEqual(castPlaceKindsFor("BIG SEXY"), ["donga", "matty_bar"]);
assert.deepEqual(castPlaceKindsFor("MATTY"), ["matty_bar"]);

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
  ["jo_lounge", "jo_pool", "matty_bar"],
);
assert.ok(!tee.some((r) => r.kind === "jo_cell"));
const jo = requiredCastPlacePlates(["CRAZY BIG HOLE JO"], scenes);
assert.deepEqual(
  jo.map((r) => r.kind),
  ["jo_cell"],
);

console.log("check-mobile-cast-places: ok");
