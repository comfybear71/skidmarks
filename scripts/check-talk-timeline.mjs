/** Run: npx tsx scripts/check-talk-timeline.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  eventsForShot,
  talkFilmChrome,
  talkFilmTagText,
  talkPlateWidthPx,
  talkShotNumber,
  talkTagKind,
  talkTimelineFrom,
  templateTagsFrom,
  TALK_PLATE_MIN_PX,
} from "../src/lib/talkTimeline.ts";
import {
  TALK_CLIP_PX_PER_SEC,
  talkActNFromEvents,
  talkActScriptsFrom,
  talkAssignActNs,
  talkClipClock,
  talkClipDeskFrom,
  talkClipWidthPx,
  talkNextShotTitle,
  talkSceneBands,
  talkSceneColor,
  talkSkidmarksActsFrom,
} from "../src/lib/talkClipTimeline.ts";
import { skidmarksBlankFromJob, skidmarksTemplateFromJob } from "../src/lib/scriptBlueprint.ts";
import { buildAiWriterBrief } from "../src/lib/cursorAiWriterTemplate.ts";

const filledPlan = skidmarksTemplateFromJob({
  speakers: ["MATTY", "CRAZY BIG HOLE JO TOO"],
  scenes: [{ placeName: "Upstairs lounge" }, { placeName: "Matty bar — night" }],
  folderName: "CRAZY_BIG_HOLE_JO",
});
assert.match(filledPlan, /THE STORY SPINE/);
assert.match(filledPlan, /GETS SMASHED/);
assert.match(filledPlan, /MASTER EPISODE CONSTRUCTION TEMPLATE/);
assert.match(filledPlan, /\* \[CAST_MAIN\]: MATTY, CRAZY BIG HOLE JO TOO/);
assert.match(filledPlan, /\* \[ENV_SETS\]: Upstairs lounge, Matty bar — night/);
assert.match(filledPlan, /\* \[EP_TITLE\]: CRAZY_BIG_HOLE_JO/);
assert.match(filledPlan, /\* \[GENRE_STYLE\]: PURE_3D/);
assert.match(filledPlan, /FORMAT EXAMPLE — Skidmarks talking stills/);
assert.match(filledPlan, /CrackWhore Darryl sits at the bar/);
assert.doesNotMatch(filledPlan, /Little Red Riding Hood/);
assert.doesNotMatch(filledPlan, /The Wolf/);
assert.doesNotMatch(filledPlan, /fairy tale/);
assert.doesNotMatch(filledPlan, /cartoon eyes widening/);
assert.doesNotMatch(filledPlan, /LTX simulation triggers/);
assert.doesNotMatch(filledPlan, /handheld-style shaky cam/);
assert.doesNotMatch(filledPlan, /Choose: CARTOON/);
assert.doesNotMatch(filledPlan, /Shots 1–3: THREE lines/);
const blankOnly = filledPlan.slice(0, filledPlan.indexOf("FORMAT EXAMPLE —"));
assert.match(blankOnly, /\* \[CAST_MAIN\]: MATTY, CRAZY BIG HOLE JO TOO/);
assert.doesNotMatch(blankOnly, /Big Bad Wolf/);
const filledBlank = skidmarksBlankFromJob({
  speakers: ["MATTY", "CRAZY BIG HOLE JO TOO"],
  scenes: [{ placeName: "Upstairs lounge" }, { placeName: "Matty bar — night" }],
  folderName: "CRAZY_BIG_HOLE_JO",
});
assert.match(filledBlank, /MASTER EPISODE CONSTRUCTION TEMPLATE/);
assert.match(filledBlank, /\* \[CAST_MAIN\]: MATTY, CRAZY BIG HOLE JO TOO/);
assert.match(filledBlank, /\* \[ACT\]: I — He shows up/);
assert.match(filledBlank, /\* \[ACT\]: IX — The end state/);
assert.match(filledBlank, /## <ACT_I>/);
assert.match(filledBlank, /## <ACT_IX>/);
assert.match(filledBlank, /\* \[SFX\]:/);
assert.match(filledBlank, /\* \[DIAL\]:/);
assert.match(filledBlank, /\* \[CAST\]:/);
assert.doesNotMatch(filledBlank, /Little Red Riding Hood/);
assert.doesNotMatch(filledBlank, /SHOW VOICE/);

const skidBrief = buildAiWriterBrief("skidmarks", {
  cast: [{ name: "MATTY", brief: "" }],
  places: ["Upstairs lounge"],
});
assert.match(skidBrief, /THE STORY SPINE/);
assert.match(skidBrief, /\* \[CAST_MAIN\]: MATTY/);
assert.match(skidBrief, /FORMAT EXAMPLE — Skidmarks talking stills/);
assert.doesNotMatch(skidBrief, /Little Red Riding Hood/);
assert.doesNotMatch(skidBrief, /cartoon eyes widening/);
assert.doesNotMatch(skidBrief, /Shot 4: punch/);

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
assert.equal(talkTagKind("ACT")?.kind, "act");
assert.equal(talkTagKind("CAST")?.kind, "cast");
assert.equal(talkTagKind("SFX")?.kind, "sfx");

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
          summary: "[ACT] II — Gets worse\n[CUTAWAY] bar flash\n[MUSIC]\n[BUDGET_TIER] CHEAP_TAKE",
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
          summary: "[ACT] I — He shows up\n[DIAL] JO TOO\n[VISUAL_ACTION] oversized phone\n[MUSIC]",
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
          summary: "[ACT] I — He shows up\n[DIAL] JO TOO leaning in\n[VISUAL_ACTION] two-shot",
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
  ["shot_old_bar", "shot_04", "shot_01", "shot_02", "shot_loose"],
  "scene → shot order; SHOT 01 in the title does not jump the plate to the front",
);
assert.equal(rows[2].episodeNo, 1);
assert.equal(rows[1].placeName, "MATTY BAR");
assert.ok(
  eventsForShot(story.scenes[1].shots[0]).some((e) => e.kind === "visual" && /phone/i.test(e.detail)),
);
assert.ok(eventsForShot(story.scenes[0].shots[1]).some((e) => e.kind === "cutaway"));
assert.ok(talkPlateWidthPx(1, 0) >= TALK_PLATE_MIN_PX);

const filmChrome = talkFilmChrome([
  { id: "a", kind: "act", tag: "ACT", detail: "I — He shows up" },
  { id: "v", kind: "visual", tag: "VISUAL", detail: "Comfy strolls" },
  { id: "s", kind: "sfx", tag: "SFX", detail: "Crunching gravel" },
  { id: "m", kind: "music", tag: "MUSIC", detail: "Acoustic guitar" },
  { id: "d", kind: "dial", tag: "DIAL", detail: "COMFY: oi" },
]);
assert.equal(filmChrome.act?.detail, "I — He shows up");
assert.deepEqual(
  filmChrome.sfx.map((e) => e.kind),
  ["sfx"],
);
assert.deepEqual(
  filmChrome.notes.map((e) => e.kind),
  ["visual", "music", "dial"],
);
assert.equal(talkFilmTagText(filmChrome.act), "[ACT] I — He shows up");
assert.deepEqual(talkFilmChrome([]), { act: null, sfx: [], notes: [] });

const fromStoryOnly = talkTimelineFrom({
  story,
  plated: [{ shotId: "shot_01", sceneId: "scene_lounge", plateFile: "" }],
});
const storyOnlyPhone = fromStoryOnly.find((r) => r.shotId === "shot_01");
assert.equal(storyOnlyPhone?.plateFile, "phone.png", "story still lands when the job row is empty");

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
  ["shot_old_bar", "shot_04", "shot_01", "shot_02"],
  "desk follows story order; leftover untitled plates only join when they have a take",
);
const loungeLead = desk.cells.find((c) => c.shotId === "shot_01");
assert.ok(
  loungeLead?.events.some((e) => e.kind === "dial" || e.kind === "visual" || e.kind === "music"),
  "template [ ] tags from the shot land on the talking cell",
);
assert.equal(desk.cells[0].plateFile, "old_bar.png", "each clip keeps its own still");
assert.equal(desk.cells[1].plateFile, "bar.png");
assert.equal(desk.cells[2].plateFile, "phone.png");
assert.ok(!desk.cells.some((c) => c.shotId === "shot_loose"), "untitled still with no take stays off");
assert.notEqual(desk.cells[0].plateFile, desk.cells[2].plateFile);
assert.equal(desk.cells[2].widthPx, talkClipWidthPx(8));
assert.equal(desk.cells[3].widthPx, talkClipWidthPx(4));
assert.ok(desk.cells[2].widthPx > desk.cells[3].widthPx, "longer take is a wider box");
assert.equal(desk.cells[2].widthPx, 8 * TALK_CLIP_PX_PER_SEC);
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
assert.equal(
  talkNextShotTitle(
    [
      { title: "SHOT 01 — Ranger Bazza" },
      { title: "SHOT 02 — Dazza" },
      { title: "Caravan park" },
      { title: "Empty stage" },
      { title: "Support" },
      { title: "Wide" },
      { title: "Cutaway" },
      { title: "Park dusk" },
      { title: "Trailer" },
      { title: "Heat haze" },
    ],
    "Shazza",
  ),
  "SHOT 11 — Shazza",
  "a 10-clip desk must not reuse SHOT 03",
);

// Stuie's manual Act I — THE GREATEST JOKE IN AUSTRALIA.
// Eight cards, thirteen lines. SHOT 11 is card 8, not card 2.
function jokeShot(id, title, file, beats) {
  return {
    id,
    title,
    summary: "",
    plateFile: file,
    beats: beats.map(([beatId, speaker, text]) => ({ id: beatId, speaker, text })),
    sfx: [],
  };
}
const jokeAct1Shots = [
  jokeShot("shot_01", "SHOT 01 — Ranger Bazza", "bazza.png", [
    ["b01a", "Ranger Bazza", "Well here we go another day at Sunnybank's Caravan Park."],
    ["b01b", "Ranger Bazza", "I wonder what adventures will happen today."],
  ]),
  jokeShot("shot_02", "SHOT 02 — Shazza", "shazza.png", [
    ["b02a", "Shazza", "Ranger Bazza, ya flaming Gumboot?"],
    ["b02b", "Shazza", "We need to do something about raising revenue at the park."],
  ]),
  jokeShot("shot_03", "Ranger Bazza, Shazza", "two.png", [
    ["b03a", "Ranger Bazza", "I have no idea shazza let's ask Daza."],
    ["b03b", "Shazza", "Hey Daza, get over here got something to ask you"],
  ]),
  jokeShot("shot_04", "Dazza", "dazza.png", [
    ["b04a", "Dazza", "Hold your horses. Yeah, no worries. I'm coming"],
  ]),
  jokeShot("shot_05", "Caravan park", "park.png", [
    ["b05a", "Shazza", "We're after a new ideas dazza."],
  ]),
  jokeShot("shot_06", "SHOT 06", "ots.png", [
    ["b06a", "Dazza", "Yeah, I've got one word for you shazza. Drop Bears!"],
  ]),
  jokeShot("shot_07", "SHOT 07", "phone.png", [["b07a", "Ranger Bazza", ""]]),
  jokeShot("shot_08", "SHOT 11 — Shazza", "close.png", [
    ["b08a", "Shazza", "Yeah naaah, that's a great idea dazza, you're a genius!"],
    ["b08b", "Shazza", "Australia's best Joke, and I know exactly what to do."],
    ["b08c", "Shazza", "Let's go Daza I need a hand."],
  ]),
];
const jokeStory = {
  ...story,
  styleId: "sunny_banks",
  campaignLabel: "THE GREATEST JOKE IN AUSTRALIA",
  scenes: [
    {
      id: "scene_park",
      title: "Caravan park",
      placeName: "Caravan park",
      worldThumbKey: "",
      shots: jokeAct1Shots,
    },
  ],
};
const jokeDesk = talkClipDeskFrom({
  story: jokeStory,
  plated: [...jokeAct1Shots]
    .reverse()
    .map((sh) => ({ shotId: sh.id, sceneId: "scene_park", plateFile: sh.plateFile })),
  clips: jokeAct1Shots.flatMap((sh) =>
    sh.beats.map((b, i) => ({
      beatId: b.id,
      shotId: sh.id,
      sceneId: "scene_park",
      clipFile: `${sh.id}_${b.id}.mp4`,
      clipStatus: "done",
      error: "",
      durationSec: 4 + i,
    })),
  ),
});
assert.equal(jokeDesk.cells.length, 13, "Act I is eight cards / thirteen lines");
assert.deepEqual(
  jokeDesk.cells.map((c) => c.shotId),
  [
    "shot_01",
    "shot_01",
    "shot_02",
    "shot_02",
    "shot_03",
    "shot_03",
    "shot_04",
    "shot_05",
    "shot_06",
    "shot_07",
    "shot_08",
    "shot_08",
    "shot_08",
  ],
  "Greatest Joke Act I stays in the order it was built — SHOT 11 does not jump to the front",
);
assert.deepEqual(
  jokeDesk.cells.map((c) => c.title),
  [
    "SHOT 01 — Ranger Bazza",
    "SHOT 01 — Ranger Bazza",
    "SHOT 02 — Shazza",
    "SHOT 02 — Shazza",
    "Ranger Bazza, Shazza",
    "Ranger Bazza, Shazza",
    "Dazza",
    "Caravan park",
    "SHOT 06",
    "SHOT 07",
    "SHOT 11 — Shazza",
    "SHOT 11 — Shazza",
    "SHOT 11 — Shazza",
  ],
);
assert.equal(jokeDesk.cells[0].speaker, "Ranger Bazza");
assert.equal(jokeDesk.cells[2].speaker, "Shazza");
assert.equal(jokeDesk.cells[10].title, "SHOT 11 — Shazza");
const actScripts = talkActScriptsFrom(desk.cells);
assert.equal(actScripts.length, 2);
assert.equal(actScripts[0].roman, "I");
assert.equal(actScripts[1].roman, "II");
assert.match(actScripts[0].script, /SHOT 01/);
assert.match(actScripts[1].script, /SHOT 04|MATTY BAR|bar/i);
const skidActs = talkSkidmarksActsFrom(desk.cells);
assert.equal(skidActs.length, 9);
assert.deepEqual(
  skidActs.map((a) => a.roman),
  ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"],
);
assert.equal(skidActs[0].title, "He shows up");
assert.equal(skidActs[8].title, "The end state");
assert.equal(skidActs[0].lineCount, 2, "Act I is the two [ACT] I clips, not the whole lounge place");
assert.ok(skidActs[1].lineCount >= 1, "Act II holds the [ACT] II bar clip");
assert.match(skidActs[0].script, /SHOT 01/);
assert.match(skidActs[1].script, /SHOT 04|MATTY BAR|bar/i);
assert.equal(skidActs[8].lineCount, 0);
assert.equal(talkSkidmarksActsFrom([]).length, 9);
assert.deepEqual(
  talkAssignActNs([
    { events: [{ id: "a1", kind: "act", tag: "ACT", detail: "I — He shows up" }], title: "SHOT 01" },
    { events: [{ id: "a2", kind: "act", tag: "ACT", detail: "I — He shows up" }], title: "SHOT 02" },
    { events: [{ id: "a3", kind: "act", tag: "ACT", detail: "II — Gets worse" }], title: "SHOT 03 — same street" },
  ]),
  [1, 1, 2],
  "same place can be Act I then Act II",
);
assert.equal(talkActNFromEvents([{ id: "x", kind: "act", tag: "ACT", detail: "IX — The end state" }]), 9);

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
assert.match(talkUi, /Act \{act\.roman\}/);
assert.match(talkUi, /talkSkidmarksActsFrom/);
assert.match(talkUi, /visibleCells/);
assert.match(talkUi, /m-talk-act-count/);
assert.match(talkUi, /only that act is on the strip/);
assert.doesNotMatch(talkUi, /live pack on this stage/);
assert.doesNotMatch(talkUi, /m-talk-act-panel/);
assert.match(talkUi, /skidmarksBlankFromJob/);
assert.match(talkUi, /Copy blank template/);
assert.match(talkUi, /m-talk-copy-icon/);
assert.match(talkUi, /House rules/);
assert.match(talkUi, /Blank <span className="m-mv-lyr-caret">/);
assert.match(talkUi, /m-talk-doc-chips/);
assert.match(talkUi, /m-talk-doc-fold/);
assert.doesNotMatch(talkUi, /EPISODE_CONSTRUCTION_EXAMPLE/);
assert.doesNotMatch(talkUi, /Little Red Riding Hood/);
assert.match(talkUi, /m-talk-film-head/);
assert.match(talkUi, /m-talk-film-title/);
assert.match(talkUi, /TalkClipTray key=\{selected\.key\}/);
assert.doesNotMatch(
  talkUi,
  /chrome\.act \?\s*\(\s*<TalkFilmTag/,
  "act tag must not hide the shot title — CLIP bar and the box have to name the same plate",
);
assert.match(talkUi, /m-talk-film-stage/);
assert.match(talkUi, /m-talk-film-sfx/);
assert.match(talkUi, /m-talk-film-notes/);
assert.match(talkUi, /talkFilmChrome/);
assert.doesNotMatch(talkUi, /m-talk-film-tags/);
assert.match(talkCss, /\.m-talk-film-head/);
assert.match(talkCss, /\.m-talk-film-stage/);
assert.match(talkCss, /\.m-talk-film-sfx/);
assert.match(talkCss, /\.m-talk-film-notes/);
assert.match(talkCss, /\.m-talk-tag/);
assert.match(talkUi, /styleId === "skidmarks"/);
assert.match(talkCss, /\.m-talk-template-link/);
assert.match(talkCss, /\.m-talk-doc-chips/);
assert.match(talkCss, /\.m-talk-doc-fold/);
assert.match(talkCss, /\.m-talk-act-panel/);
assert.match(talkCss, /\.m-talk-act-script/);
assert.match(talkCss, /\.m-talk-copy-icon/);
assert.match(talkCss, /\.m-talk-act-script\s*\{[^}]*width:\s*100%/s);
assert.doesNotMatch(talkCss, /minmax\(14rem,\s*1fr\)/);
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
assert.doesNotMatch(tree, /Hide stills|m-talk-stills-toggle/);
assert.match(tree, /<MusicVideoTrack/);
assert.match(editor, /label="Stills"/);
assert.match(editor, /stillsStripOpen/);
assert.match(editor, /plateClipRail\.clips/);
assert.doesNotMatch(song, /jobShowsMusicTrack/);
assert.match(trackRoute, /Music video only/);

console.log("check-talk-timeline: ok");
