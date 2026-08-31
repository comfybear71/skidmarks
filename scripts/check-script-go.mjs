/** Run: npx tsx scripts/check-script-go.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  matchScriptGoSpeaker,
  pickScriptGoEngine,
  planScriptGo,
  scriptGoNeedsWho,
  scriptGoStaging,
  uniqueScriptGoPlaces,
} from "../src/lib/scriptGo.ts";

assert.equal(matchScriptGoSpeaker("[SOUL REBEL]", ["SOUL REBEL", "CENTRE-LEFT"]), "SOUL REBEL");
assert.equal(matchScriptGoSpeaker("[CENTRE-LEFT]", ["SOUL REBEL", "CENTRE-LEFT"]), "CENTRE-LEFT");
assert.equal(matchScriptGoSpeaker("[SOUL REBEL] [CENTRE-LEFT]", ["SOUL REBEL", "CENTRE-LEFT"]), "SOUL REBEL");
assert.equal(matchScriptGoSpeaker("", ["SOUL REBEL"]), "");

assert.equal(pickScriptGoEngine({ kind: "sing", startMs: 27000, endMs: 31000 }), "ltx");
assert.equal(pickScriptGoEngine({ kind: "break", startMs: 0, endMs: 27000 }), "ltx", "27s break is over H3 max");
assert.equal(pickScriptGoEngine({ kind: "break", startMs: 0, endMs: 3000 }), "grok", "under H3 min");
assert.equal(pickScriptGoEngine({ kind: "break", startMs: 80000, endMs: 90000 }), "h3");

const places = uniqueScriptGoPlaces([
  { id: "a", placeName: "Tropical Mediterranean beach shack" },
  { id: "b", placeName: "Tropical Mediterranean beach with palm trees" },
  { id: "c", placeName: "Tropical Mediterranean beach shack" },
]);
assert.equal(places.length, 2);

const script = `0:00–0:27  [SOUL REBEL]
Instrumental Intro — no singing

0:27–0:31  [SOUL REBEL]
The sun is shining bright

0:56–1:04  [CENTRE-LEFT]
This easy life, enjoying with my friends`;
const plan = planScriptGo({
  songScript: script,
  speakers: ["SOUL REBEL", "CENTRE-LEFT"],
  sceneCount: 2,
});
assert.equal(plan.length, 3);
assert.equal(plan[0]?.kind, "break");
assert.equal(plan[0]?.who, "SOUL REBEL");
assert.equal(plan[1]?.who, "SOUL REBEL");
assert.equal(plan[2]?.who, "CENTRE-LEFT");
assert.notEqual(plan[0]?.sceneIndex, plan[1]?.sceneIndex, "places rotate");
assert.match(scriptGoStaging({ who: "SOUL REBEL", placeName: "shack", cameraKey: "ots" }), /SOUL REBEL alone/);
assert.match(scriptGoStaging({ who: "SOUL REBEL", placeName: "shack", cameraKey: "ots" }), /Empty hands/);
assert.doesNotMatch(scriptGoStaging({ who: "SOUL REBEL", placeName: "shack", cameraKey: "ots" }), /CENTRE-LEFT/);
assert.equal(scriptGoNeedsWho("0:00–0:27\nintro", ["SOUL REBEL"]), true);

{
  const ui = readFileSync(new URL("../src/components/mobile/MusicVideoStart.tsx", import.meta.url), "utf8");
  const run = readFileSync(new URL("../src/lib/scriptGoRun.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../src/app/api/crash/mobile/song/route.ts", import.meta.url), "utf8");
  assert.match(ui, />\s*Go\s*</);
  assert.match(ui, /runScriptGo/);
  assert.match(run, /script-fresh/);
  assert.match(run, /script-blade/);
  assert.match(route, /action === "script-fresh"/);
  assert.match(route, /action === "script-blade"/);
  assert.match(route, /reuseScene: true/);
  assert.doesNotMatch(ui, /Start directing/);
  assert.doesNotMatch(run, /Start directing/);
  assert.doesNotMatch(route, /clearAllStoryShots/);
}

console.log("check-script-go: ok");
