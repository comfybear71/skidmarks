/** Run: npx tsx scripts/check-music-video-song.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clampPlateSliceCount,
  isMusicVideoSongJob,
  musicVideoCreditLine,
  MUSIC_VIDEO_SLICE_DEFAULT,
  plateSliceWindows,
  songCookAlert,
  songCookNote,
  songCutTallyLine,
  tallySongCuts,
  withoutPlateParkedCuts,
  withSkippedSongPlate,
  withoutSkippedSongPlate,
  songDeskPlateIds,
  songOrdinal,
  formatSongSpan,
  deskPlateClocks,
  withSongPlate,
  withoutSongPlateAt,
  songDeskRowSlices,
  withSongRowSlice,
  rebuildSongCutsFromDesk,
  cutsForDeskRow,
  deskRowAllDone,
  orderSongCutsTimeline,
  shortPlateLabel,
  beatForSongCut,
  clearFalseSpokenLineSongFails,
  clearStuckSongCooks,
  hasStuckSongCook,
  isMissingScratchSpokenLine,
  MISSING_SCRATCH_SPOKEN_LINE,
  muteSongBeatStub,
  songCutUsesSpokenLine,
  syncSongCutsToDesk,
  songCutsOrderBroken,
  expectedDeskCutCount,
  needsTrackHang,
  plateIdsWaitingForTrack,
  storyShotForSongCut,
} from "../src/lib/musicVideoSong.ts";
import { emptyStageFarOutStaging } from "../src/lib/emptyStagePlate.ts";
import { isInstrumentalStaging, buildScratchSongLtxMotion } from "../src/lib/mobileImageMotion.ts";
import { songCookStorageKey } from "../src/lib/songCutCook.ts";

const here = dirname(fileURLToPath(import.meta.url));
const tree = readFileSync(join(here, "../src/components/mobile/StudioTree.tsx"), "utf8");
const mPage = readFileSync(join(here, "../src/app/(mobile)/m/page.tsx"), "utf8");
const jobIdRoute = readFileSync(join(here, "../src/app/api/crash/mobile/job/[id]/route.ts"), "utf8");
const jobCreate = readFileSync(join(here, "../src/app/api/crash/mobile/job/route.ts"), "utf8");
const songUi = readFileSync(join(here, "../src/components/mobile/MusicVideoSongCuts.tsx"), "utf8");
const songRoute = readFileSync(join(here, "../src/app/api/crash/mobile/song/route.ts"), "utf8");
const scratchPage = readFileSync(join(here, "../src/app/(mobile)/scratch/page.tsx"), "utf8");
const scratchRoute = readFileSync(join(here, "../src/app/api/crash/mobile/scratch/route.ts"), "utf8");
const attach = readFileSync(join(here, "../src/lib/scratchSongAttach.ts"), "utf8");
const clip = readFileSync(join(here, "../src/lib/mobileScratchClip.ts"), "utf8");
const editor = readFileSync(join(here, "../src/components/mobile/PlateReviewEditor.tsx"), "utf8");

assert.equal(isMusicVideoSongJob({ styleId: "music_video" }), true);
assert.equal(isMusicVideoSongJob({ styleId: "skidmarks" }), false);
assert.equal(musicVideoCreditLine({ artist: "Jack Ghost", songTitle: "Take Me Down" }), "Jack Ghost — Take Me Down");
assert.equal(musicVideoCreditLine({ artist: "Jack Ghost" }), "Jack Ghost");
assert.equal(clampPlateSliceCount(4), 4);
assert.equal(clampPlateSliceCount(99), 16);
assert.equal(MUSIC_VIDEO_SLICE_DEFAULT, 1);
const parked = plateSliceWindows([], 180, 4);
assert.equal(parked.length, 4);
assert.equal(parked[0].durationSec, 15);
assert.equal(parked[3].startSec, 45);
const more = plateSliceWindows(parked, 180, 2);
assert.equal(more[0].startSec, 60);
assert.deepEqual(tallySongCuts([{ status: "done" }, { status: "running" }, { status: "pending" }]), {
  total: 3,
  parked: 1,
  cooking: 1,
  done: 1,
  error: 0,
});
assert.match(songCutTallyLine({ total: 3, parked: 1, cooking: 1, done: 1, error: 0 }), /1\/3 done/);
assert.match(songCutTallyLine({ total: 3, parked: 1, cooking: 1, done: 1, error: 0 }), /working/);
assert.match(songCutTallyLine({ total: 3, parked: 1, cooking: 1, done: 1, error: 0 }), /waiting/);
assert.doesNotMatch(songCutTallyLine({ total: 3, parked: 1, cooking: 1, done: 1, error: 0 }), /cooking|parked/);

{
  const sixOfEight = [
    { id: "1", status: "done", error: "", clipFile: "a.mp4" },
    { id: "2", status: "done", error: "", clipFile: "b.mp4" },
    { id: "3", status: "done", error: "", clipFile: "c.mp4" },
    { id: "4", status: "done", error: "", clipFile: "d.mp4" },
    { id: "5", status: "done", error: "", clipFile: "e.mp4" },
    { id: "6", status: "done", error: "", clipFile: "f.mp4" },
    { id: "7", status: "error", error: "Cloud job timed out after 1200s", clipFile: "" },
    { id: "8", status: "running", error: "", clipFile: "" },
  ];
  const whileOthersCook = songCookAlert(sixOfEight, { cooking: true });
  assert.equal(whileOthersCook.kind, "failed");
  assert.match(whileOthersCook.title, /That clip failed/);
  assert.match(whileOthersCook.title, /others still going/);
  assert.match(whileOthersCook.detail, /timed out after 1200s/);
  assert.match(whileOthersCook.short, /1 fail/);
  assert.doesNotMatch(songCookNote(whileOthersCook), /it keeps going/i);
  const afterCook = songCookAlert(
    sixOfEight.map((c) => (c.id === "8" ? { ...c, status: "done", clipFile: "h.mp4" } : c)),
    { cooking: false },
  );
  assert.equal(afterCook.kind, "failed");
  assert.match(afterCook.title, /cook stopped/);
  assert.doesNotMatch(songCookNote(afterCook), /it keeps going/i);
  const happyCook = songCookAlert(
    [
      { id: "1", status: "done", error: "", clipFile: "a.mp4" },
      { id: "2", status: "running", error: "", clipFile: "" },
    ],
    { cooking: true },
  );
  assert.equal(happyCook.kind, "cooking");
  assert.match(songCookNote(happyCook), /it keeps going/);
  const orphan = songCookAlert(
    [{ id: "2", status: "running", error: "", clipFile: "" }],
    { cooking: false },
  );
  assert.equal(orphan.kind, "stuck");
  assert.doesNotMatch(songCookNote(orphan), /it keeps going/i);
}

const kept = withoutPlateParkedCuts(
  [
    { id: "a", plateFile: "p.png", shotId: "s1", startSec: 0, durationSec: 15, status: "done", clipFile: "a.mp4" },
    { id: "b", plateFile: "p.png", shotId: "s1", startSec: 15, durationSec: 15, status: "pending" },
    { id: "c", plateFile: "q.png", shotId: "s2", startSec: 30, durationSec: 15, status: "pending" },
  ],
  "s1",
  "p.png",
);
assert.equal(kept.dropped, 1);
assert.deepEqual(kept.next.map((c) => c.id), ["a", "c"]);

assert.deepEqual(withSkippedSongPlate(["a"], "b"), ["a", "b"]);
assert.deepEqual(withoutSkippedSongPlate(["a", "b"], "a"), ["b"]);
assert.deepEqual(songDeskPlateIds({ cuts: [{ shotId: "a" }] }), ["a"]);
assert.deepEqual(songDeskPlateIds({ songPlateIds: [], cuts: [{ shotId: "a" }] }), []);
assert.deepEqual(songDeskPlateIds({ songPlateIds: ["a", "b", "a"] }), ["a", "b", "a"]);
assert.deepEqual(withSongPlate(["a"], "b"), ["a", "b"]);
assert.deepEqual(withSongPlate(["a"], "a"), ["a", "a"]);
assert.deepEqual(withoutSongPlateAt(["a", "b", "a"], 0), ["b", "a"]);
assert.deepEqual(withoutSongPlateAt(["a", "b", "a"], 2), ["a", "b"]);
assert.deepEqual(songDeskRowSlices({ rowSlices: [2] }, ["a", "b"]), [2, 1]);
assert.deepEqual(withSongRowSlice([1, 1]), [1, 1, 1]);
const rebuilt = rebuildSongCutsFromDesk({
  songPlateIds: ["jack", "stage", "jack"],
  rowSlices: [1, 1, 2],
  plateFileByShotId: { jack: "j.png", stage: "s.png" },
  songSec: 180,
  newCutId: () => "cut",
});
assert.equal(rebuilt.length, 4);
assert.equal(rebuilt[0].startSec, 0);
assert.equal(rebuilt[3].startSec, 45);
assert.equal(cutsForDeskRow(rebuilt, [1, 1, 2], 2).length, 2);
assert.equal(deskRowAllDone([{ status: "done", clipFile: "a.mp4" }]), true);
assert.equal(deskRowAllDone([{ status: "pending" }]), false);
assert.match(shortPlateLabel(null, "x", 1), /Plate 1/);
assert.equal(songOrdinal(1), "1st");
assert.equal(songOrdinal(2), "2nd");
assert.equal(songOrdinal(3), "3rd");
assert.equal(formatSongSpan(0, 15), "0:00.0–0:15.0");
assert.equal(formatSongSpan(15, 30), "0:15.0–0:30.0");
const clocks = deskPlateClocks(["a", "b"], [], {}, 180, [1, 1]);
assert.equal(formatSongSpan(clocks[0].startSec, clocks[0].endSec), "0:00.0–0:15.0");
assert.equal(formatSongSpan(clocks[1].startSec, clocks[1].endSec), "0:15.0–0:30.0");
const jackAgain = deskPlateClocks(["jack", "stage", "jack"], rebuilt, {}, 180, [1, 1, 2]);
assert.equal(formatSongSpan(jackAgain[0].startSec, jackAgain[0].endSec), "0:00.0–0:15.0");
assert.equal(formatSongSpan(jackAgain[2].startSec, jackAgain[2].endSec), "0:30.0–1:00.0");
assert.equal(jackAgain[2].slices, 2);

assert.match(songRoute, /remove-plate-parked/);
assert.match(songRoute, /skip-plate/);
assert.match(songRoute, /set-row-slices/);
assert.match(songRoute, /rebuildSongCutsFromDesk/);
assert.match(songRoute, /listIndex/);
assert.match(songRoute, /withoutSongPlateAt/);
assert.match(songUi, /hidePlateFromSong/);
assert.match(songUi, /Leave song/);
assert.match(songUi, /setRowSlices/);
assert.match(songUi, /Take this plate off the song/);
assert.match(emptyStageFarOutStaging("A dark stage"), /Far out/);
assert.match(emptyStageFarOutStaging("A dark stage"), /No people/);
assert.match(songRoute, /copyPlaceStillAsEmptyPlate/);
assert.match(songRoute, /Need the place still first/);
assert.match(tree, /Add empty stage/);
assert.match(tree, /songPlates/);
assert.match(songUi, /songDeskPlateIds/);
assert.match(songUi, /m-song-plate-x-inline/);
assert.match(songUi, /m-song-plate-line/);
assert.match(songUi, /m-song-line-meta/);
assert.match(songRoute, /remove-stitch/);
assert.doesNotMatch(songUi, /Drop stitch/);
assert.doesNotMatch(songUi, /Stitch song/);
assert.doesNotMatch(songUi, /Drop parked/);
assert.doesNotMatch(songUi, /"PARKED"/);
assert.match(songUi, /SwipeDropRow/);
assert.doesNotMatch(
  songUi,
  /\? "DONE"/,
  "Finished cuts use green text — do not show a DONE chip",
);

assert.equal(isInstrumentalStaging("on stage playing saxophone"), true);
assert.equal(isInstrumentalStaging("Facing camera, mouth clear"), false);
// Bible "clear silhouette against the place" must NOT flip singer prompts —
// that was the bleed that hit lit singers and other characters.
assert.equal(isInstrumentalStaging("Full-body shot, clear silhouette against the place"), false);
const sax = buildScratchSongLtxMotion({
  styleId: "music_video",
  speaker: "Frank",
  staging: "on stage playing saxophone",
});
assert.match(sax, /instrument/i);
assert.doesNotMatch(sax, /singing, lip-sync/);
const sing = buildScratchSongLtxMotion({
  styleId: "music_video",
  speaker: "Frank",
  staging: "Facing camera, mouth clear",
  lookLock: "wide-brim black hat, teal shirt, short beard",
});
assert.match(sing, /singing, lip-sync/);
assert.doesNotMatch(sing, /only as much mouth as the start image already shows/);
assert.doesNotMatch(sing, /Do not brighten or reveal the face/);
assert.doesNotMatch(sing, /If the start image is a silhouette/);
assert.match(sing, /Same face, same hair, same hat, same clothes/);
assert.match(sing, /Do not invent or change letters/);
assert.match(sing, /No readable text or signage/);
assert.match(sing, /wide-brim black hat/);
const fullBodyBible = buildScratchSongLtxMotion({
  styleId: "music_video",
  speaker: "Frank",
  staging: "Full-body shot of Frank at the stage. Head to feet visible, natural stance, clear silhouette against the place.",
  lookLock: "wide-brim black hat, teal shirt, short beard",
});
assert.match(fullBodyBible, /singing, lip-sync/);
assert.doesNotMatch(fullBodyBible, /Do not brighten or reveal the face/);
assert.doesNotMatch(fullBodyBible, /only as much mouth/);
assert.match(sax, /Same face, same hair, same hat, same clothes/);
assert.doesNotMatch(sax, /Do not brighten or reveal the face/);
assert.match(clip, /Song slices must rebuild the identity lock/);
assert.match(clip, /who is actually on this plate/);
assert.match(clip, /skipSongLipSyncLead/);
assert.doesNotMatch(clip, /isSilhouetteStaging/);
assert.match(songRoute, /sliceBoundsForPlate/);
{
  const shuffled = [
    { id: "b", startSec: 30, clipFile: "b.mp4", status: "done" },
    { id: "a", startSec: 0, clipFile: "a.mp4", status: "done" },
    { id: "c", startSec: 15, clipFile: "c.mp4", status: "done" },
  ];
  assert.deepEqual(
    orderSongCutsTimeline(shuffled).map((c) => c.id),
    ["a", "c", "b"],
  );
}

assert.equal(songCookStorageKey("abc"), "skidmarks.songCook.abc");
assert.match(scratchPage, /cookPendingSongCuts/);
assert.match(scratchPage, /visibilitychange/);
assert.match(scratchRoute, /song-cut-unstick/);
assert.match(songRoute, /action === "assign"/);
assert.match(songRoute, /Finish is ordered unstitched mp4s/);
assert.doesNotMatch(songUi, /You pick/);
assert.doesNotMatch(songUi, /Set 1 × 15s or 4 × 15s/);
assert.match(songUi, /songOrdinal/);
assert.match(songUi, /\{n\} × 15s/);
assert.match(songUi, /shortPlateLabel/);
assert.match(songUi, /deskRowAllDone/);
assert.match(songRoute, /put a plate on the list at 1 × 15s/);
assert.match(songUi, /runOneCut/);
assert.match(songUi, /Send next/);
assert.match(songUi, /Stop send/);
assert.match(songUi, /redo-cut/);
assert.doesNotMatch(songUi, /visibilitychange/);
assert.doesNotMatch(songUi, /cookPendingSongCuts/);
assert.doesNotMatch(songUi, /Generate cuts/);
assert.doesNotMatch(songUi, /m-song-cut-chip/);
const songCss = readFileSync(join(here, "../src/app/(mobile)/m/mobile.css"), "utf8");
assert.match(songCss, /\.m-swipe-drop-action/);
assert.match(songCss, /\.scratch-song-cut\.is-done \.scratch-song-cut-meta/);
assert.match(songUi, /m-song-progress/);
assert.match(songUi, /m-song-plate-line/);
assert.match(songUi, /--row-progress/);
assert.doesNotMatch(songUi, /Cooking/);
assert.doesNotMatch(songUi, /cooking \$\{/);
assert.match(songUi, /Sending…/);
assert.match(songUi, /SongCookAlertBanner/);
assert.match(songUi, /askSongCookNotifyPermission/);
assert.match(songUi, /is-error/);
assert.match(songUi, /unstick-all/);
assert.match(songUi, /stopStuckCook/);
const trackUi = readFileSync(join(here, "../src/components/mobile/MusicVideoTrack.tsx"), "utf8");
const alertUi = readFileSync(join(here, "../src/components/mobile/SongCookAlertBanner.tsx"), "utf8");
const cookLib = readFileSync(join(here, "../src/lib/songCutCook.ts"), "utf8");
assert.match(trackUi, /SongCookAlertBanner/);
assert.match(alertUi, /role="alert"/);
assert.match(alertUi, /m-song-cook-alert/);
assert.match(songCss, /\.m-song-cook-alert/);
assert.match(cookLib, /notifySongCookProblem/);
assert.match(cookLib, /pushCookStatus/);
assert.doesNotMatch(cookLib, /You can leave — it keeps going\./);
assert.match(songRoute, /unstick-all/);
assert.match(songRoute, /clearStuckSongCooks/);
assert.match(songRoute, /clearFalseSpokenLineSongFails/);
assert.match(songRoute, /beatForSongCut/);
assert.match(songRoute, /failScratchSongCutRun/);
assert.doesNotMatch(songRoute, /Wait for cooking/);
assert.equal(
  hasStuckSongCook([{ status: "running", clipFile: "" }, { status: "pending", clipFile: "" }]),
  true,
);
assert.deepEqual(
  clearStuckSongCooks([
    { id: "a", status: "running", clipFile: "", plateFile: "p.png", startSec: 0, durationSec: 15 },
    { id: "b", status: "done", clipFile: "b.mp4", plateFile: "p.png", startSec: 15, durationSec: 15 },
  ]).map((c) => c.status),
  ["pending", "done"],
);
assert.equal(songCutUsesSpokenLine({ styleId: "skidmarks" }), true);
assert.equal(songCutUsesSpokenLine({ styleId: "music_video" }), false);
assert.equal(songCutUsesSpokenLine({ styleId: "skidmarks", cutId: "cut_1" }), false);
assert.equal(isMissingScratchSpokenLine(MISSING_SCRATCH_SPOKEN_LINE), true);
assert.equal(isMissingScratchSpokenLine("Cloud job timed out after 1200s"), false);
{
  const cleared = clearFalseSpokenLineSongFails([
    {
      id: "6",
      status: "error",
      error: MISSING_SCRATCH_SPOKEN_LINE,
      clipFile: "",
    },
    { id: "1", status: "done", error: "", clipFile: "a.mp4" },
    { id: "7", status: "error", error: "Cloud job timed out after 1200s", clipFile: "" },
  ]);
  assert.equal(cleared[0].status, "pending");
  assert.equal(cleared[0].error, "");
  assert.equal(cleared[1].status, "done");
  assert.equal(cleared[2].status, "error");
  const afterClear = songCookAlert(cleared, { cooking: false });
  assert.equal(afterClear.kind, "failed");
  assert.match(afterClear.detail, /timed out after 1200s/);
}
{
  const jackBeat = {
    id: "beat_jack",
    speaker: "JACK GHOST",
    text: "",
    voiceFile: "01_01_JACK_GHOST_dropped-line_mtcmz9iy.mp3",
  };
  const mutePlate = {
    id: "shot_six",
    title: "Idle",
    plateFile: "idle.png",
    beats: [{ id: "beat_six", speaker: "JACK GHOST", text: "" }],
  };
  const story = {
    scenes: [
      {
        id: "scene_1",
        shots: [
          { id: "shot_one", title: "JACK GHOST", plateFile: "jack.png", beats: [jackBeat] },
          mutePlate,
        ],
      },
    ],
  };
  const borrowed = beatForSongCut({
    story,
    storyShot: mutePlate,
    beatId: "beat_jack",
    songFile: jackBeat.voiceFile,
  });
  assert.equal(borrowed?.id, "beat_jack");
  assert.equal(borrowed?.voiceFile, jackBeat.voiceFile);
  const bySong = beatForSongCut({
    story,
    storyShot: mutePlate,
    beatId: "",
    songFile: jackBeat.voiceFile,
  });
  assert.equal(bySong?.id, "beat_jack");
  const stub = muteSongBeatStub({
    cutId: "cut_6",
    songFile: jackBeat.voiceFile,
  });
  assert.equal(stub.id, "cut_6");
  assert.equal(stub.text, "");
  assert.equal(stub.voiceFile, jackBeat.voiceFile);
}
assert.equal(expectedDeskCutCount([1]), 1);
assert.equal(expectedDeskCutCount([4, 2]), 6);
{
  const ghosts = Array.from({ length: 16 }, (_, i) => ({
    id: `g${i}`,
    status: i === 0 ? "running" : "pending",
    clipFile: "",
    plateFile: "p.png",
    shotId: "s1",
    startSec: i * 15,
    durationSec: 15,
  }));
  const synced = syncSongCutsToDesk({
    songPlateIds: ["s1"],
    rowSlices: [1],
    cuts: ghosts,
    plateFileByShotId: { s1: "p.png" },
    songSec: 267,
    newCutId: () => "only",
  });
  assert.equal(synced.length, 1);
  assert.equal(synced[0].status, "pending");
  assert.equal(synced[0].startSec, 0);
}
{
  // Add a plate must keep finished greens — not rebuild everything pending.
  const doneCuts = [
    {
      id: "a",
      status: "done",
      clipFile: "clip_a.mp4",
      plateFile: "p1.png",
      shotId: "s1",
      startSec: 0,
      durationSec: 15,
    },
    {
      id: "b",
      status: "done",
      clipFile: "clip_b.mp4",
      plateFile: "p2.png",
      shotId: "s2",
      startSec: 15,
      durationSec: 15,
    },
  ];
  const afterAdd = syncSongCutsToDesk({
    songPlateIds: ["s1", "s2", "s3"],
    rowSlices: [1, 1, 1],
    cuts: doneCuts,
    plateFileByShotId: { s1: "p1.png", s2: "p2.png", s3: "p3.png" },
    songSec: 267,
    newCutId: () => "new",
  });
  assert.equal(afterAdd.length, 3);
  assert.equal(afterAdd[0].status, "done");
  assert.equal(afterAdd[0].clipFile, "clip_a.mp4");
  assert.equal(afterAdd[0].id, "a");
  assert.equal(afterAdd[1].status, "done");
  assert.equal(afterAdd[1].clipFile, "clip_b.mp4");
  assert.equal(afterAdd[2].status, "pending");
  assert.equal(afterAdd[2].shotId, "s3");
}
{
  // Scrambled array with correct clocks must reorder to desk — keep greens.
  const scrambled = [
    {
      id: "b",
      status: "done",
      clipFile: "b.mp4",
      plateFile: "p2.png",
      shotId: "s2",
      startSec: 15,
      durationSec: 15,
    },
    {
      id: "a",
      status: "done",
      clipFile: "a.mp4",
      plateFile: "p1.png",
      shotId: "s1",
      startSec: 0,
      durationSec: 15,
    },
  ];
  assert.equal(songCutsOrderBroken(scrambled, ["s1", "s2"], [1, 1]), true);
  const fixed = syncSongCutsToDesk({
    songPlateIds: ["s1", "s2"],
    rowSlices: [1, 1],
    cuts: scrambled,
    plateFileByShotId: { s1: "p1.png", s2: "p2.png" },
    songSec: 267,
    newCutId: () => "x",
  });
  assert.deepEqual(
    fixed.map((c) => c.shotId),
    ["s1", "s2"],
  );
  assert.equal(fixed[0].clipFile, "a.mp4");
  assert.equal(fixed[0].status, "done");
  assert.equal(fixed[1].clipFile, "b.mp4");
  assert.equal(fixed[1].status, "done");
  assert.equal(songCutsOrderBroken(fixed, ["s1", "s2"], [1, 1]), false);
}
assert.match(songUi, /songCutsOrderBroken/);
assert.match(songUi, /Fixed cut order/);
assert.match(songUi, /Plate clocks are the song/);
assert.match(songRoute, /Do not rebuild them as 1 × 15s/);
assert.match(songRoute, /syncSongCutsToDesk/);
assert.match(songRoute, /Keep done clips/);
assert.match(songRoute, /action === "redo-cut"/);
assert.match(songRoute, /planParkDeskClipTake/);
assert.doesNotMatch(songRoute, /Stop send first\./);
assert.match(songRoute, /action === "hang-plates"/);
assert.match(songRoute, /action === "add-plate"/);
assert.match(songRoute, /storyShotForSongCut/);
assert.equal(
  needsTrackHang({
    cuts: [
      { shotId: "a", plateFile: "a.png" },
      { shotId: "b", plateFile: "b.png" },
    ],
    plateTimings: [{ plateId: "a" }],
  }),
  true,
);
assert.equal(
  needsTrackHang({
    cuts: [{ shotId: "a", plateFile: "a.png" }],
    plateTimings: [{ plateId: "a" }],
  }),
  false,
);
assert.equal(
  needsTrackHang(
    { cuts: [{ plateFile: "jack.png" }], plateTimings: [] },
    [{ shotId: "shot_jack", plateFile: "jack.png" }],
  ),
  true,
);
assert.deepEqual(
  plateIdsWaitingForTrack({
    song: { plateTimings: [{ plateId: "shot_2uhu0p1" }], songPlateIds: [] },
    jobShots: [
      { shotId: "shot_2uhu0p1", plateFile: "a.png" },
      { shotId: "shot_hat", plateFile: "b.png" },
    ],
  }),
  [],
  "leftover job.shots rows stay off the wave",
);
assert.deepEqual(
  plateIdsWaitingForTrack({
    song: {
      plateTimings: [{ plateId: "jack" }],
      songPlateIds: ["jack", "invisible"],
    },
    jobShots: [
      { shotId: "jack", plateFile: "jack.png" },
      { shotId: "invisible", plateFile: "im.png" },
      { shotId: "shot_2uhuOp1", plateFile: "leftover.png" },
      { shotId: "shot_2x5gyfo", plateFile: "" },
    ],
  }),
  ["invisible"],
);
assert.deepEqual(
  plateIdsWaitingForTrack({
    song: { plateTimings: [], songPlateIds: ["shot_ghost"] },
    jobShots: [{ shotId: "shot_ghost", plateFile: "" }],
  }),
  [],
  "empty leftover ids are not hung",
);
assert.doesNotMatch(
  readFileSync(join(here, "../src/lib/musicVideoSong.ts"), "utf8"),
  /for \(const s of opts\.jobShots/,
  "do not hang every job.shots row",
);
{
  const found = storyShotForSongCut({
    story: {
      scenes: [
        {
          id: "scene_1",
          shots: [{ id: "story_shot", plateFile: "jack.png", title: "JACK GHOST" }],
        },
      ],
    },
    jobShots: [{ shotId: "cut_shot", plateFile: "jack.png" }],
    cut: { shotId: "cut_shot", plateFile: "jack.png" },
  });
  assert.equal(found?.shot.id, "story_shot");
}
{
  const addPlateBlock = songRoute.slice(songRoute.indexOf('action === "add-plate"'));
  const nextAction = addPlateBlock.search(/\n\s+if \(action === "/);
  const block = nextAction >= 0 ? addPlateBlock.slice(0, nextAction) : addPlateBlock.slice(0, 1200);
  assert.match(block, /syncSongCutsToDesk/);
  assert.match(block, /hangMissingPlateTimings/, "Add hangs the still on the wave clock");
  assert.doesNotMatch(block, /rebuildSongCutsFromDesk/);
}
{
  const skipBlock = songRoute.slice(songRoute.indexOf('action === "skip-plate"'));
  const nextAction = skipBlock.search(/\n\s+if \(action === "/);
  const block = nextAction >= 0 ? skipBlock.slice(0, nextAction) : skipBlock.slice(0, 1200);
  assert.match(block, /syncSongCutsToDesk/);
  assert.doesNotMatch(block, /rebuildSongCutsFromDesk/);
}
assert.match(songUi, /expectedDeskCutCount/);
assert.match(songUi, /Fixed cut order so the list matches the song clock/);
assert.match(songCss, /\.m-song-progress/);
assert.match(songCss, /\.m-song-plate-line/);
assert.match(editor, /m-song-plate-tally/);
assert.match(tree, /MusicVideoSongCuts/);
assert.match(tree, /isMusicVideoSongJob/);
assert.match(tree, /Edit vibe/);
assert.match(tree, /\{vibeBusy \? "Saving…" : "Save"\}/);
assert.match(tree, /Cancel/);
assert.doesNotMatch(tree, /Keep vibe/);
assert.doesNotMatch(tree, /Leave it/);
assert.match(tree, /method: "PATCH"/);
assert.match(mPage, /placeholder="Artist"/);
assert.match(mPage, /placeholder="Song"/);
assert.match(jobIdRoute, /export async function PATCH/);
assert.match(jobCreate, /artist: body.artist/);
assert.doesNotMatch(tree, /from "fs"/);
assert.match(attach, /styleId === "music_video"/);
assert.match(clip, /skipLipSyncLead/);
assert.match(editor, /songDesk=\{styleId === "music_video"\}/);
assert.match(editor, /action: "add-plate"/);
assert.match(editor, /\{songAdding \? "Adding…" : "Add"\}/);
assert.doesNotMatch(songUi, /Put back/);
assert.match(songRoute, /add-plate/);
assert.doesNotMatch(songUi, /parkPlate/);
assert.match(editor, /addPlateToSong/);
assert.doesNotMatch(editor, /Tap Add\. It goes on the song list/);
assert.doesNotMatch(editor, /Position this plate/);
assert.doesNotMatch(editor, /Song slices are under/);
assert.doesNotMatch(songUi, /Singer plates sing/);
assert.doesNotMatch(songUi, /Tap a plate\. Tap Add/);
assert.match(songUi, /scratch-song-mp3/);
assert.match(songUi, /Song · \{song\.fileName\}/);
assert.match(songCss, /\.scratch-song-mp3/);
assert.match(songCss, /\.m-song-progress-fill/);
assert.match(songUi, /setRowSlices\(row\.listIndex, n - 1\)/);
assert.match(songUi, /setRowSlices\(row\.listIndex, n \+ 1\)/);
assert.match(songUi, /\n\s+−\n/);
assert.match(songUi, /\n\s+\+\n/);
assert.doesNotMatch(songUi, /Drop parked/);
assert.doesNotMatch(songUi, /ol className="scratch-song-cuts"/);
assert.match(songUi, /cutsOpen/, "song cuts fold away");
assert.match(songUi, /<DeskFold/, "song cuts use the same desk fold");
assert.match(editor, /label="Stills"/, "stills strip folds on every style");
assert.match(editor, /label="Clips"/, "clips rail folds on every style");
assert.match(editor, /Download clips zip/, "clips fold can zip the episode");
assert.doesNotMatch(
  editor,
  /isMusicVideoSongJob\(job\) && plateClipRail/,
  "clips fold is not music-video only",
);

console.log("check-music-video-song: ok");
