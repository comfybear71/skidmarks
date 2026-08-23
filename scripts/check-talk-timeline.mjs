/** Run: npx tsx scripts/check-talk-timeline.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  eventsForShot,
  talkPlateWidthPx,
  talkShotNumber,
  talkTagKind,
  talkTimelineFrom,
  templateTagsFrom,
  TALK_PLATE_MIN_PX,
} from "../src/lib/talkTimeline.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const tree = readFileSync(join(root, "src/components/mobile/StudioTree.tsx"), "utf8");
const talkUi = readFileSync(join(root, "src/components/mobile/TalkTimeline.tsx"), "utf8");
const css = readFileSync(join(root, "src/app/(mobile)/m/mobile.css"), "utf8");
const song = readFileSync(join(root, "src/lib/musicVideoSong.ts"), "utf8");
const trackRoute = readFileSync(join(root, "src/app/api/crash/mobile/track/route.ts"), "utf8");

assert.equal(talkShotNumber("SHOT 01 — OTS + phone"), 1);
assert.equal(talkShotNumber("SHOT_04 — bar"), 4);
assert.equal(talkShotNumber("LAND LANDY, CRAZY BIG HOLE JO TOO"), null);
assert.equal(talkTagKind("laughs"), null);
assert.equal(talkTagKind("DIAL")?.kind, "dial");
assert.equal(talkTagKind("VISUAL_ACTION")?.kind, "visual");

const tags = templateTagsFrom(
  `[DIAL] JO TOO\n[SFX]\n[VISUAL_ACTION] oversized phone\n[MUSIC]\n[laughs] no\n[BUDGET_TIER] CHEAP_TAKE`,
);
assert.deepEqual(
  tags.map((t) => t.kind),
  ["dial", "sfx", "visual", "music", "budget"],
);

const story = {
  styleId: "skidmarks",
  campaignLabel: "test",
  gagNote: "",
  intro: { title: "", notes: "", sfx: [] },
  outro: { title: "", notes: "", sfx: [] },
  scenes: [
    {
      id: "scene_bar",
      title: "MATTY BAR — NIGHT",
      placeName: "MATTY BAR",
      worldThumbKey: "",
      shots: [
        {
          id: "shot_old_bar",
          title: "MATTY",
          summary: "solo",
          plateFile: "old_bar.png",
          beats: [{ id: "b1", speaker: "MATTY", text: "pint" }],
          sfx: [],
        },
        {
          id: "shot_04",
          title: "SHOT 04 — bar",
          summary: "[CUTAWAY] bar flash\n[MUSIC]\n[BUDGET_TIER] CHEAP_TAKE",
          plateFile: "bar.png",
          beats: [{ id: "b2", speaker: "MATTY", text: "" }],
          sfx: [],
        },
      ],
    },
    {
      id: "scene_lounge",
      title: "Upstairs lounge",
      placeName: "Upstairs lounge",
      worldThumbKey: "",
      shots: [
        {
          id: "shot_01",
          title: "SHOT 01 — OTS + phone",
          summary: "[DIAL] JO TOO\n[VISUAL_ACTION] oversized phone\n[MUSIC]",
          plateFile: "phone.png",
          beats: [
            { id: "b3", speaker: "LAND LANDY", text: "" },
            { id: "b4", speaker: "CRAZY BIG HOLE JO TOO", text: "" },
          ],
          sfx: [],
        },
        {
          id: "shot_02",
          title: "SHOT 02 — two-shot",
          summary: "[DIAL] JO TOO leaning in\n[VISUAL_ACTION] two-shot",
          plateFile: "two.png",
          beats: [{ id: "b5", speaker: "CRAZY BIG HOLE JO TOO", text: "" }],
          sfx: [],
        },
        {
          id: "shot_empty",
          title: "SHOT 99 empty",
          summary: "",
          plateFile: "",
          beats: [],
          sfx: [],
        },
      ],
    },
  ],
};

const plated = [
  { shotId: "shot_old_bar", sceneId: "scene_bar", plateFile: "old_bar.png" },
  { shotId: "shot_04", sceneId: "scene_bar", plateFile: "bar.png" },
  { shotId: "shot_02", sceneId: "scene_lounge", plateFile: "two.png" },
  { shotId: "shot_01", sceneId: "scene_lounge", plateFile: "phone.png" },
  { shotId: "shot_loose", sceneId: "scene_x", plateFile: "loose.png" },
];

const rows = talkTimelineFrom({ story, plated });
assert.deepEqual(
  rows.map((r) => r.shotId),
  ["shot_01", "shot_02", "shot_04", "shot_old_bar", "shot_loose"],
  "SHOT 01–04 lead; pack leftovers follow in story order",
);
assert.equal(rows[0].episodeNo, 1);
assert.equal(rows[2].placeName, "MATTY BAR");
assert.ok(
  eventsForShot(story.scenes[1].shots[0]).some((e) => e.kind === "visual" && /phone/i.test(e.detail)),
);
assert.ok(eventsForShot(story.scenes[0].shots[1]).some((e) => e.kind === "cutaway"));
assert.ok(talkPlateWidthPx(1, 0) >= TALK_PLATE_MIN_PX);

const fromStoryOnly = talkTimelineFrom({
  story,
  plated: [{ shotId: "shot_01", sceneId: "scene_lounge", plateFile: "" }],
});
assert.equal(fromStoryOnly[0].plateFile, "phone.png", "story still lands when the job row is empty");

const talkCss = css.slice(css.indexOf("/* Talking episode strip"));
assert.match(talkUi, /Talking timeline/);
assert.match(talkUi, /Swipe sideways/);
assert.doesNotMatch(talkUi, /Drop the mp3|Start the video|WaveformCanvas/);
assert.match(talkCss, /\.m-talk-scroll\s*\{[^}]*overflow-x:\s*auto/s);
assert.match(talkCss, /\.m-talk-thumb\s*\{[^}]*object-fit:\s*contain/s);
assert.match(talkCss, /\.m-talk-inner\s*\{[^}]*display:\s*flex/s);
assert.match(talkCss, /\.m-talk-cell\s*\{[^}]*flex:\s*0 0 auto/s);
assert.match(talkCss, /\.m-talk-inner\s*\{[^}]*min-width:\s*max-content/s);
assert.match(tree, /isMusicVideoSongJob\(job\) \? \(/);
assert.match(tree, /<TalkTimeline/);
assert.match(tree, /<MusicVideoTrack/);
assert.doesNotMatch(song, /jobShowsMusicTrack/);
assert.match(trackRoute, /Music video only/);

console.log("check-talk-timeline: ok");
