/** Run: npx tsx scripts/check-style-position-gold.mjs */
import assert from "node:assert/strict";
import { compileScriptedPosition } from "../src/lib/mobilePlateScript.ts";
import { SHOW_STYLE_PRESETS } from "../src/lib/showStylePresets.ts";
import {
  applyStylePositionGold,
  stylePositionGold,
  stylePositionGoldRows,
} from "../src/lib/stylePositionGold.ts";

const ids = SHOW_STYLE_PRESETS.map((p) => p.id);
const rows = stylePositionGoldRows();
assert.deepEqual(
  rows.map((r) => r.styleId),
  ids,
  "every look must have a GOLD positioning row",
);

for (const preset of SHOW_STYLE_PRESETS) {
  const gold = stylePositionGold(preset.id);
  assert.equal(gold.styleId, preset.id);
  assert.equal(gold.label, preset.label);
  assert.ok(gold.forWhat.includes(preset.label.split(" ")[0]));
  assert.match(gold.template, /\{\{name\}\}/);
  assert.match(gold.template, /\{\{place\}\}/);
  assert.doesNotMatch(gold.template, /\[VISUAL\]/);
  assert.doesNotMatch(gold.template, /\[SPEECH\]/);

  const text = applyStylePositionGold(preset.id, {
    name: "BIG SEXY",
    place: "THE DONGA",
  });
  assert.match(text, /BIG SEXY/);
  assert.match(text, /THE DONGA/);
  assert.match(text, /Only BIG SEXY in frame/);
  assert.doesNotMatch(text, /\{\{/);
  assert.doesNotMatch(text, /\[VISUAL\]/);
  assert.doesNotMatch(text, /\[SPEECH\]/);
  assert.doesNotMatch(text, /stylised 3D animated feature/);
  assert.doesNotMatch(text, /rubbery adult cartoon/);
}

assert.equal(
  applyStylePositionGold("skidmarks", { name: "JO", place: "the kitchen" }),
  compileScriptedPosition({ name: "JO", place: "the kitchen" }),
);

const bed = applyStylePositionGold("skidmarks", {
  name: "JO",
  place: "Jo's bedroom",
});
assert.match(bed, /butt on the mattress/);

const sunny = applyStylePositionGold("sunny_banks", {
  name: "Shazza",
  place: "BBQ shelter",
});
assert.match(sunny, /in the scene at BBQ shelter/);
assert.doesNotMatch(sunny, /her lap/);

const mv = applyStylePositionGold("music_video", {
  name: "Artist",
  place: "Performance set",
});
assert.match(mv, /performing at Performance set/);
assert.match(mv, /No crowd/);

console.log("check-style-position-gold: ok");
