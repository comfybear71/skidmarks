/** Run: npx tsx scripts/check-mobile-drop-cast.mjs */
import assert from "node:assert/strict";
import {
  castNamesMatch,
  dropSpeakerFromList,
  dropSpeakerFromRecord,
  scrubSpeakerFromStory,
  shotsAfterDroppedSpeaker,
  stripSpeakerWord,
} from "../src/lib/mobileDropCast.ts";

assert.equal(castNamesMatch("STUBALLS", "stuballs"), true);
assert.equal(castNamesMatch("STUBALLS", "CRAZY BIG HOLE JO"), false);
assert.deepEqual(dropSpeakerFromList(["JO", "STUBALLS", "MATTY"], "STUBALLS"), [
  "JO",
  "MATTY",
]);
assert.deepEqual(dropSpeakerFromList(["JO", "MATTY"], "STUBALLS"), ["JO", "MATTY"]);
assert.deepEqual(dropSpeakerFromRecord({ STUBALLS: 1, JO: 2 }, "stuballs"), { JO: 2 });

assert.equal(
  stripSpeakerWord("Only JO and STUBALLS in frame", "STUBALLS"),
  "Only JO and in frame",
);
assert.equal(
  stripSpeakerWord("CRAZY BIG HOLE JO sitting on the bed", "STUBALLS"),
  "CRAZY BIG HOLE JO sitting on the bed",
);

const story = {
  styleId: "skidmarks",
  campaignLabel: "CRAZY BIG HOLE JO",
  gagNote: "STUBALLS at the bar with Matty",
  intro: { title: "in", notes: "featuring STUBALLS", sfx: [] },
  outro: { title: "out", notes: "", sfx: [] },
  scenes: [
    {
      id: "bar",
      title: "Matty's bar",
      placeName: "Matty's bar",
      worldThumbKey: "",
      shots: [
        {
          id: "shot_group",
          title: "MATTY, STUBALLS, TEE",
          summary: "STUBALLS printed on shirts",
          staging: "MATTY and STUBALLS lean at the bar",
          plateFile: "cplate_group.png",
          beats: [
            { id: "beat_matty", speaker: "MATTY", text: "oi", imageMotion: "MATTY says hi" },
            { id: "beat_stub", speaker: "STUBALLS", text: "nope" },
            { id: "beat_tee", speaker: "TEE", text: "yeah" },
          ],
          sfx: [],
        },
        {
          id: "shot_stub_solo",
          title: "STUBALLS",
          summary: "solo",
          staging: "Only STUBALLS in frame",
          plateFile: "",
          beats: [{ id: "beat_solo", speaker: "STUBALLS", text: "" }],
          sfx: [],
        },
      ],
    },
  ],
  updatedAt: "2026-08-21T00:00:00.000Z",
};

const scrubbed = scrubSpeakerFromStory(story, "STUBALLS");
assert.deepEqual(scrubbed.removedShotIds, ["shot_stub_solo"]);
assert.deepEqual(scrubbed.removedBeatIds.sort(), ["beat_solo", "beat_stub"].sort());
const barShots = scrubbed.story.scenes[0].shots;
assert.equal(barShots.length, 1);
assert.equal(barShots[0].id, "shot_group");
assert.ok(!/STUBALLS/i.test(barShots[0].title));
assert.ok(!/STUBALLS/i.test(barShots[0].staging));
assert.ok(!/STUBALLS/i.test(barShots[0].summary));
assert.ok(!/STUBALLS/i.test(scrubbed.story.gagNote));
assert.ok(!barShots[0].beats.some((b) => b.speaker === "STUBALLS"));
assert.ok(barShots[0].beats.some((b) => b.speaker === "MATTY"));
assert.ok(barShots[0].beats.some((b) => b.speaker === "TEE"));
assert.ok(/CRAZY BIG HOLE JO/.test(scrubbed.story.campaignLabel));

assert.deepEqual(
  shotsAfterDroppedSpeaker(
    [
      { shotId: "shot_group", sceneId: "bar", plateFile: "cplate_group.png" },
      { shotId: "shot_stub_solo", sceneId: "bar", plateFile: "" },
    ],
    scrubbed.removedShotIds,
  ).map((s) => s.shotId),
  ["shot_group"],
);

const again = scrubSpeakerFromStory(scrubbed.story, "STUBALLS");
assert.deepEqual(again.removedShotIds, []);
assert.deepEqual(again.removedBeatIds, []);

console.log("check-mobile-drop-cast: ok");
