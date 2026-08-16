import assert from "node:assert/strict";
import {
  characterPlateFilename,
  characterPlateLayout,
} from "../src/lib/characterPlatePrompt.ts";

assert.equal(characterPlateFilename("Baby", ".jpg"), "plate_baby.jpg");
assert.equal(characterPlateFilename("Crazy Jo", ".png"), "plate_crazy_jo.png");
assert.equal(characterPlateFilename("  CHLOE  ", ".png"), "plate_chloe.png");

const skid = characterPlateLayout({
  styleId: "skidmarks",
  name: "Baby",
  look: "bald lad with a pie",
  lookLock: "stylised 3D animated feature render",
  styleRealism: 60,
});
assert.match(skid, /CHARACTER PLATE of Baby/);
assert.match(skid, /WAIST-UP/);
assert.match(skid, /identity lock/i);
assert.doesNotMatch(skid, /rubbery adult cartoon/i);
assert.doesNotMatch(skid, /FULL-BODY/);

const sunny = characterPlateLayout({
  styleId: "sunny_banks",
  name: "Nanna",
  look: "cricket bat and tea",
  lookLock: "rubbery adult cartoon, thick black outlines, flat cel colour",
  styleRealism: 20,
});
assert.match(sunny, /FULL-BODY/);
assert.match(sunny, /rubbery adult cartoon/);
assert.doesNotMatch(sunny, /stylised 3D animated feature/);

console.log("check-character-plates: ok");
