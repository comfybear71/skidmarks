/** Run: npx tsx scripts/check-script-go.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  matchScriptGoSpeaker,
  pickScriptGoCamera,
  pickScriptGoEngine,
  planScriptGo,
  revolveChorusBeats,
  scriptGoShortChorusCook,
  scriptGoNeedsWho,
  scriptGoStaging,
  uniqueScriptGoPlaces,
} from "../src/lib/scriptGo.ts";
import { isInstrumentalStaging, skipSongLipSyncLead } from "../src/lib/mobileImageMotion.ts";

assert.equal(matchScriptGoSpeaker("[SOUL REBEL]", ["SOUL REBEL", "CENTRE-LEFT"]), "SOUL REBEL");
assert.equal(matchScriptGoSpeaker("[CENTRE-LEFT]", ["SOUL REBEL", "CENTRE-LEFT"]), "CENTRE-LEFT");
assert.equal(matchScriptGoSpeaker("[SOUL REBEL] [CENTRE-LEFT]", ["SOUL REBEL", "CENTRE-LEFT"]), "SOUL REBEL");
assert.equal(matchScriptGoSpeaker("", ["SOUL REBEL"]), "");

assert.equal(scriptGoShortChorusCook(1).cookSec, 5);
assert.equal(scriptGoShortChorusCook(1).cutToSec, 1);
assert.equal(scriptGoShortChorusCook(3).cookSec, 5);
assert.equal(scriptGoShortChorusCook(14).cutToSec, null);
assert.equal(scriptGoShortChorusCook(14).cookSec, 14);

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
assert.equal(plan[1]?.cameraKey, "mcu");
assert.equal(pickScriptGoCamera(2, "sing"), "tight-cu");
assert.equal(pickScriptGoCamera(1, "sing"), "mcu");
assert.notEqual(pickScriptGoCamera(2, "sing"), "wide");
assert.notEqual(pickScriptGoCamera(4, "sing"), "ots");
const singStaging = scriptGoStaging({
  who: "SOUL REBEL",
  placeName: "shack",
  cameraKey: "mcu",
  kind: "sing",
});
assert.match(singStaging, /SOUL REBEL alone/);
assert.match(singStaging, /Empty hands/);
assert.match(singStaging, /Facing camera, mouth clear/);
assert.match(singStaging, /Same person as the SOUL REBEL still/);
assert.doesNotMatch(singStaging, /CENTRE-LEFT/);
assert.equal(isInstrumentalStaging(singStaging), false);
assert.equal(
  skipSongLipSyncLead({
    speaker: "SOUL REBEL",
    staging: singStaging,
    singing: true,
  }),
  false,
);
assert.equal(scriptGoNeedsWho("0:00–0:27\nintro", ["SOUL REBEL"]), true);

{
  const chorusScript = [
    "0:00–0:10  [SOUL REBEL]",
    "verse line that is long enough",
    "",
    "0:56–0:58  [CENTRE-LEFT]",
    "This easy life",
    "",
    "0:58–1:00  [SOUL REBEL]",
    "This easy life",
    "",
    "1:00–1:03  [CENTRE-LEFT]",
    "I want this easy life",
    "",
    "1:03–1:04  [SOUL REBEL]",
    "This easy life",
    "",
    "1:04–1:07  [CENTRE-LEFT]",
    "I want this easy life",
    "",
    "1:07–1:10  [SOUL REBEL]",
    "This easy life",
    "",
    "1:10–1:16  [CENTRE-LEFT]",
    "I want this easy life",
    "",
    "1:16–1:20  [SOUL REBEL]",
    "This easy life",
    "",
    "1:20–1:36  [SOUL REBEL]",
    "Instrumental break — no singing",
  ].join("\n");
  const chorusPlan = planScriptGo({
    songScript: chorusScript,
    speakers: ["SOUL REBEL", "CENTRE-LEFT"],
    sceneCount: 2,
  });
  assert.equal(
    chorusPlan.length,
    4,
    `revolve should collapse chorus to 2 long takes + verse + break, got ${chorusPlan.length}`,
  );
  const [verse, a, b, brk] = chorusPlan;
  assert.equal(verse?.kind, "sing");
  assert.equal(verse?.who, "SOUL REBEL");
  assert.equal(a?.kind, "sing");
  assert.equal(b?.kind, "sing");
  assert.equal(brk?.kind, "break");
  assert.equal(a?.who, "CENTRE-LEFT", "backup leads the chorus take");
  assert.equal(b?.who, "SOUL REBEL");
  assert.equal(a?.startMs, 56_000);
  assert.equal(a?.endMs, 80_000);
  assert.equal(b?.startMs, 56_000);
  assert.equal(b?.endMs, 80_000);
  assert.match(a?.line || "", /I want this easy life/i);
  assert.match(b?.line || "", /I want this easy life/i);
  assert.ok(
    chorusPlan.filter((i) => i.kind === "sing").every((i) => i.cameraKey === "tight-cu" || i.cameraKey === "mcu"),
  );
  assert.equal(revolveChorusBeats([], ["SOUL REBEL"]).length, 0);
}

{
  const ui = readFileSync(new URL("../src/components/mobile/MusicVideoStart.tsx", import.meta.url), "utf8");
  const run = readFileSync(new URL("../src/lib/scriptGoRun.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../src/app/api/crash/mobile/song/route.ts", import.meta.url), "utf8");
  assert.match(ui, />\s*Go\s*</);
  assert.match(ui, /runScriptGo/);
  assert.match(run, /script-fresh/);
  assert.match(run, /script-blade/);
  assert.match(run, /trimToSec/);
  assert.match(route, /trimToSec/);
  const slice = readFileSync(new URL("../src/lib/scratchSongSlice.ts", import.meta.url), "utf8");
  assert.match(slice, /export function trimClipMp4/);
  assert.match(route, /action === "script-fresh"/);
  assert.match(route, /action === "script-blade"/);
  assert.match(route, /reuseScene: true/);
  assert.doesNotMatch(ui, /Start directing/);
  assert.doesNotMatch(run, /Start directing/);
  assert.doesNotMatch(route, /clearAllStoryShots/);
}

console.log("check-script-go: ok");
