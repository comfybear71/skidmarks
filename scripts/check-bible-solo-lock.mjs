/** Run: npx tsx scripts/check-bible-solo-lock.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SCRATCH_PROMPT_BIBLE,
  applyBibleTokens,
  stripBibleSoloLock,
} from "../src/lib/scratchBench/promptBible.ts";
import { plateCastStagingNote } from "../src/lib/mobilePlateLines.ts";

const byId = new Map();
for (const s of SCRATCH_PROMPT_BIBLE) for (const e of s.entries) byId.set(e.id, e);

// Every chip on the /m dropdown opens with a solo lock. That is correct for
// Scratch (one character by design) and wrong on a group plate.
const DROPDOWN = ["mcu-phone", "wide-full", "tight-face", "over-shoulder", "walk-in", "raining", "beer-cig", "pie"];
const isSolo = (t) => /alone at|no one else appears/i.test(t);
for (const id of DROPDOWN) {
  assert.ok(byId.has(id), `${id} should be a real chip`);
  assert.ok(isSolo(byId.get(id).template), `${id} still carries the solo lock`);
}

// Stripped, the alone-ness is gone and the shot is intact.
for (const id of DROPDOWN) {
  const out = stripBibleSoloLock(byId.get(id).template);
  assert.doesNotMatch(out, /alone at/i, id);
  assert.doesNotMatch(out, /no one else appears/i, id);
  assert.doesNotMatch(out, /Only \{\{name\}\}\./, id);
  assert.doesNotMatch(out, /Do not invent a second person/i, id);
  // The reason you tapped the chip survives.
  assert.match(out, /Same face as the face card/i, id);
  assert.ok(out.length > 40, id);
}
// The camera / pose / prop words specifically survive.
assert.match(stripBibleSoloLock(byId.get("over-shoulder").template), /Three-quarter back/i);
assert.match(stripBibleSoloLock(byId.get("tight-face").template), /TIGHT CLOSE-UP/);
assert.match(stripBibleSoloLock(byId.get("raining").template), /heavy rain/i);
assert.match(stripBibleSoloLock(byId.get("beer-cig").template), /stubbie of beer/i);
// Tokens still render.
assert.match(
  applyBibleTokens(stripBibleSoloLock(byId.get("raining").template), { name: "Dazza", place: "Caravan park" }),
  /Caravan park/,
);

// The contradiction is gone from the plate prompt on a group card.
const chip = applyBibleTokens(stripBibleSoloLock(byId.get("over-shoulder").template), {
  name: "Dazza",
  place: "Caravan park",
});
const note = plateCastStagingNote({
  speakers: ["Shazza", "Ranger Bazza", "Dazza"],
  staging: chip,
  styleId: "sunny_banks",
});
assert.match(note, /Exactly 3 people in frame/);
assert.doesNotMatch(note, /alone at/i);
assert.doesNotMatch(note, /no one else appears\. MEDIUM/i);

// Solo plates keep the lock — nothing changes on Scratch or a one-hander.
const soloNote = plateCastStagingNote({
  speakers: ["Dazza"],
  staging: applyBibleTokens(byId.get("over-shoulder").template, { name: "Dazza", place: "Caravan park" }),
  styleId: "sunny_banks",
});
assert.match(soloNote, /no one else appears/i);

// Only strip when the pad really is a group.
const editor = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/components/mobile/PlateReviewEditor.tsx"),
  "utf8",
);
assert.match(editor, /crowd && padCast\.length > 1\s*\?\s*stripBibleSoloLock/);

console.log("check-bible-solo-lock: ok");
