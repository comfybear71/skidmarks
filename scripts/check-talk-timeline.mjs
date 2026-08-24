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
import {
  TALK_CLIP_PX_PER_SEC,
  talkClipClock,
  talkClipDeskFrom,
  talkClipWidthPx,
  talkNextShotTitle,
  talkSceneBands,
  talkSceneColor,
} from "../src/lib/talkClipTimeline.ts";

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
            { id: "b3", speaker: "LAND LANDY", text: "", voiceFile: "land.mp3" },
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

const titledEmpty = talkTimelineFrom({
  story: {
    ...story,
    scenes: [
      {
        id: "scene_lounge",
        title: "Upstairs lounge",
        placeName: "Upstairs lounge",
        worldThumbKey: "",
        shots: [
          {
            id: "shot_05",
            title: "SHOT 05 — MATTY",
            summary: "",
            plateFile: "",
            beats: [{ id: "b6", speaker: "MATTY", text: "" }],
            sfx: [],
          },
        ],
      },
    ],
  },
  plated: [{ shotId: "shot_05", sceneId: "scene_lounge", plateFile: "" }],
});
assert.equal(titledEmpty[0]?.shotId, "shot_05", "titled empty slot still sits on the talking desk");
assert.equal(titledEmpty[0]?.episodeNo, 5);

const desk = talkClipDeskFrom({
  story,
  plated,
  clips: [
    {
      beatId: "b3",
      shotId: "shot_01",
      sceneId: "scene_lounge",
      clipFile: "act1_shot01.mp4",
      clipStatus: "done",
      error: "",
      durationSec: 8,
    },
    {
      beatId: "b5",
      shotId: "shot_02",
      sceneId: "scene_lounge",
      clipFile: "act1_shot02.mp4",
      clipStatus: "done",
      error: "",
      durationSec: 4,
    },
    {
      beatId: "b2",
      shotId: "shot_04",
      sceneId: "scene_bar",
      clipFile: "act1_shot04.mp4",
      clipStatus: "done",
      error: "",
      durationSec: 5,
    },
    {
      beatId: "b1",
      shotId: "shot_old_bar",
      sceneId: "scene_bar",
      clipFile: "leftover.mp4",
      clipStatus: "done",
      error: "",
      durationSec: 12,
    },
  ],
});
assert.deepEqual(
  desk.cells.map((c) => c.shotId),
  ["shot_01", "shot_02", "shot_04", "shot_old_bar"],
  "SHOT 01–04 lead; leftover untitled plates only join when they have a take",
);
assert.equal(desk.cells[0].plateFile, "phone.png", "each clip keeps its own still");
assert.equal(desk.cells[1].plateFile, "two.png");
assert.equal(desk.cells[3].plateFile, "old_bar.png");
assert.ok(!desk.cells.some((c) => c.shotId === "shot_loose"), "untitled still with no take stays off");
assert.notEqual(desk.cells[0].plateFile, desk.cells[1].plateFile);
assert.equal(desk.cells[0].widthPx, talkClipWidthPx(8));
assert.equal(desk.cells[1].widthPx, talkClipWidthPx(4));
assert.ok(desk.cells[0].widthPx > desk.cells[1].widthPx, "longer take is a wider box");
assert.equal(desk.cells[0].widthPx, 8 * TALK_CLIP_PX_PER_SEC);
assert.equal(talkSceneColor("scene_lounge"), talkSceneColor("scene_lounge"));
assert.notEqual(talkSceneColor("scene_lounge"), talkSceneColor("scene_bar"));
assert.equal(desk.cells[0].sceneColor, desk.cells[1].sceneColor, "same scene, same colour");
assert.notEqual(desk.cells[0].sceneColor, desk.cells[2].sceneColor, "bar is a different colour");
const bands = talkSceneBands(desk.cells);
assert.equal(bands.length, 2);
assert.equal(bands[0].widthPx, desk.cells[0].widthPx + desk.cells[1].widthPx);
assert.equal(talkClipClock(8), "8s");
assert.equal(talkNextShotTitle(desk.cells, "MATTY"), "SHOT 05 — MATTY");
assert.equal(talkNextShotTitle([], "TEE"), "SHOT 01 — TEE");

const plateOnly = talkClipDeskFrom({
  story,
  plated: [{ shotId: "shot_01", sceneId: "scene_lounge", plateFile: "phone.png" }],
  clips: [],
});
const plateOnlyLead = plateOnly.cells.find((c) => c.shotId === "shot_01");
assert.ok(plateOnlyLead, "titled plate with no take still sits on the desk");
assert.equal(plateOnlyLead.clipFile, "");
assert.equal(plateOnlyLead.plateFile, "phone.png");
assert.equal(plateOnlyLead.voiceFile, "land.mp3", "plate-only keeps the saved line");
assert.ok(plateOnly.cells.every((c) => !c.clipFile), "no takes still allowed");
assert.ok(!plateOnly.cells.some((c) => c.shotId === "shot_old_bar"), "untitled leftover without a take stays off");

const talkCss = css.slice(css.indexOf("/* Talking episode strip"));
const editor = readFileSync(join(root, "src/components/mobile/PlateReviewEditor.tsx"), "utf8");
assert.match(talkUi, /Talking timeline/);
assert.match(talkUi, /Tap a box to play it/);
assert.match(talkUi, /Change audio/);
assert.match(talkUi, /Add audio/);
assert.match(talkUi, /Redo clip/);
assert.match(talkUi, /Add video/);
assert.match(talkUi, /Remove video/);
assert.match(talkUi, /\+ Add clip/);
assert.match(talkUi, /Send this/);
assert.match(talkUi, /Remove slot/);
assert.match(talkUi, /audioSrc && !clipSrc/);
assert.doesNotMatch(talkUi, /Drop the mp3|Start the video|WaveformCanvas|m-talk-tools-video|scrollIntoView|revealPlates/);
assert.match(talkCss, /\.m-talk-desk-scroll\s*\{[^}]*overflow-x:\s*auto/s);
assert.match(talkCss, /\.m-talk-desk-inner\s*\{[^}]*min-width:\s*max-content/s);
assert.match(talkCss, /\.m-talk-film-cell\s*\{[^}]*flex:\s*0 0 auto/s);
assert.match(talkCss, /\.m-talk-film-video[\s\S]*object-fit:\s*contain/);
assert.match(talkCss, /\.m-talk-tray-toggle/);
assert.match(tree, /isMusicVideoSongJob\(job\) \? \(/);
assert.match(tree, /<TalkTimeline/);
assert.match(tree, /onJobChange=\{onJobChange\}/);
assert.match(tree, /<TalkTimeline[\s\S]*?onJobChange=\{onJobChange\}\s*\/>/);
assert.doesNotMatch(tree, /<TalkTimeline[\s\S]*?onOpenPlate=/);
assert.match(tree, /Hide stills/);
assert.match(tree, /<MusicVideoTrack/);
assert.match(editor, /isMusicVideoSongJob\(job\) && plateClipRail\.clips\.length/);
assert.doesNotMatch(song, /jobShowsMusicTrack/);
assert.match(trackRoute, /Music video only/);

console.log("check-talk-timeline: ok");
