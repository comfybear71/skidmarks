/** Run: npx tsx scripts/check-mobile-place-labels.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  placeChipLabel,
  placeDetailTitle,
  placeLookWords,
  uniquePlacePickOptions,
} from "../src/lib/mobilePlaceLabels.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tree = readFileSync(join(root, "src/components/mobile/StudioTree.tsx"), "utf8");

assert.equal(placeChipLabel("SALOON"), "SALOON");
assert.equal(
  placeChipLabel(
    "A dark, gritty, abandoned Las Vegas strip at night with zero humans. The iconic neon signs flicker.",
  ),
  "A dark, gritty,…",
);

assert.equal(placeDetailTitle("SALOON"), "SALOON");
assert.ok(
  placeDetailTitle(
    "A dark and gritty abandoned desert highway at night, completely devoid of humans. A rusted diner sign.",
  ).length < 45,
);

const long =
  "A dark, gritty, abandoned Las Vegas strip at night with zero humans. The iconic neon signs flicker.";
assert.equal(placeLookWords(long, ""), long);
assert.equal(placeLookWords("SALOON", ""), "");
assert.equal(placeLookWords("SALOON", "smoky bar interior"), "smoky bar interior");

assert.match(tree, /placeChipLabel\(scene\.placeName\)/);
assert.match(tree, /displayTitle=\{placeDetailTitle/);
assert.match(tree, /lookDetail=\{placeLookWords/);
assert.match(tree, /m-place-look-fold/);
assert.match(tree, /uniquePlacePickOptions/);

{
  const dark = "/api/crash/mobile/location-still?name=Dark%20imag.png";
  const seven = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
    sceneId: `scene_${n}`,
    name: "Dark imag...",
    thumbUrl: dark,
  }));
  const one = uniquePlacePickOptions(seven);
  assert.equal(one.length, 1);
  assert.equal(one[0].sceneId, "scene_1");
  const mixed = uniquePlacePickOptions([
    ...seven,
    { sceneId: "scene_bar", name: "The bar", thumbUrl: "/bar.png" },
    { sceneId: "scene_bar_clone", name: "The bar", thumbUrl: "/bar-other.png" },
  ]);
  assert.equal(mixed.length, 2);
  assert.equal(mixed[1].sceneId, "scene_bar");
}

console.log("mobile place labels ok");
