/** Run: npx tsx scripts/check-job-from-cast.mjs */
import assert from "node:assert/strict";
import {
  applyCastSeed,
  canConjureCastFromStyle,
  castSeedFromJob,
} from "../src/lib/mobileJobFromCast.ts";

assert.equal(canConjureCastFromStyle("skidmarks"), true);
assert.equal(canConjureCastFromStyle("sunny_banks"), true);
assert.equal(canConjureCastFromStyle("doc"), true);
assert.equal(canConjureCastFromStyle("photoreal"), true);
assert.equal(canConjureCastFromStyle("music_video"), false);
assert.equal(canConjureCastFromStyle(""), false);

const source = {
  speakers: ["TEE", "MATTY", "CRAZY BIG HOLE JO TOO"],
  castCandidates: {
    TEE: [{ id: "t1", fileName: "face_tee.png", approved: true, prompt: "tee" }],
    MATTY: [{ id: "m1", fileName: "face_matty.png", approved: true, prompt: "matty" }],
    "CRAZY BIG HOLE JO TOO": [
      { id: "j1", fileName: "face_ahd1tlo.png", approved: true, prompt: "jo too" },
    ],
    "CRAZY BIG HOLE JO": [
      { id: "old", fileName: "face_lodvktp.png", approved: true, prompt: "parked" },
    ],
  },
  speakerVoices: { TEE: { voiceId: "v1", voiceName: "Nan" } },
  characterPlates: { TEE: { fileName: "plate_tee.jpg", status: "done" } },
  roster: [{ name: "TEE" }, { name: "STUBALLS" }],
  scenes: [{ id: "scene_bar", placeName: "Dirty Dog Pub", worldThumbKey: "g:pub.png" }],
};

const seed = castSeedFromJob(source);
assert.deepEqual(seed.speakers, ["TEE", "MATTY", "CRAZY BIG HOLE JO TOO"]);
assert.ok(seed.castCandidates.TEE?.[0]?.fileName === "face_tee.png");
assert.equal(seed.castCandidates["CRAZY BIG HOLE JO"], undefined);
assert.equal(seed.speakerVoices.TEE?.voiceId, "v1");
assert.equal(seed.characterPlates.TEE?.fileName, "plate_tee.jpg");
assert.deepEqual(
  seed.roster.map((r) => r.name),
  ["TEE"],
);
assert.equal(seed.scenes[0]?.placeName, "Dirty Dog Pub");

const created = {
  id: "mgen_new",
  styleId: "skidmarks",
  folderName: "MUST_NOT_KEEP",
  prompt: "New episode",
  speakers: [],
  roster: [],
  scenes: [],
  castCandidates: {},
  shots: [{ shotId: "old", sceneId: "x", plateFile: "nope.png" }],
  clips: [{ beatId: "b", shotId: "old", sceneId: "x", clipFile: "x.mp4", clipStatus: "done", error: "" }],
  finalVideoFile: "done.mp4",
  droppedCast: ["STUBALLS"],
};
const next = applyCastSeed(created, seed, [{ id: "scene_fresh", placeName: "Dirty Dog Pub", worldThumbKey: "g:pub.png" }]);
assert.equal(next.folderName, "");
assert.deepEqual(next.shots, []);
assert.deepEqual(next.clips, []);
assert.equal(next.finalVideoFile, "");
assert.deepEqual(next.droppedCast, []);
assert.deepEqual(next.speakers, ["TEE", "MATTY", "CRAZY BIG HOLE JO TOO"]);
assert.equal(next.scenes[0]?.id, "scene_fresh");
assert.equal(next.id, "mgen_new");

console.log("check-job-from-cast: ok");
