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
  songCutIsMuteAction,
  songCutUsesSpokenLine,
  syncSongCutsToDesk,
  applyAddPlateOnSong,
  addPlateIsSingingHang,
  deskRowSongSpan,
  addPlateHangDurationSec,
  songCutsOrderBroken,
  expectedDeskCutCount,
  needsDoneClipHang,
  needsTrackHang,
  plateIdsNeedingDoneClipHang,
  plateIdsWaitingForTrack,
  removePlateFromSong,
  storyShotForSongCut,
} from "../src/lib/musicVideoSong.ts";
import { readHangLengthDraft, writeHangLengthDraft } from "../src/lib/hangLengthDraft.ts";
import {
  extraStillHangPlateId,
  extraTakeHangPlateId,
  hangMissingPlateTimings,
} from "../src/lib/musicVideoTrack.ts";
import {
  gatherClipsForStillsRail,
  keepClipsAfterUnhang,
  songCookAppendsNewClip,
  withSongCookPendingClip,
} from "../src/lib/mobilePlateClips.ts";
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
const songLib = readFileSync(join(here, "../src/lib/musicVideoSong.ts"), "utf8");

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
assert.match(clip, /Song Send uses the LTX box when he kept words/);
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
assert.match(songUi, /deskRowSongSpan/, "song list clock uses hung plateTimings when cuts are empty");
assert.doesNotMatch(
  songUi,
  /const spanObj = plateCutSpan\(mine\)/,
  "list must not hide No lips hangs that have plateTimings but no cut",
);
assert.match(songUi, /shortPlateLabel/);
assert.match(songUi, /deskRowAllDone/);
assert.match(songRoute, /Still with no mp4 hangs at body\.durationSec \(slider 5–40\)/);
assert.match(songRoute, /leftover mp4 file-first hangs in a gap or at 0/);
assert.match(songUi, /runOneCut/);
assert.doesNotMatch(songUi, /Send next/);
assert.doesNotMatch(songUi, /Music video — song cuts/);
assert.match(songUi, /Song list/);
assert.match(songUi, /label="Free look"/, "Free look sits under Song list on music video");
assert.match(
  songUi,
  /const \[freeLookOpen, setFreeLookOpen\] = useState\(false\)/,
  "Free look starts collapsed",
);
assert.match(songUi, /set-stock-look/, "Free look still saves through the track action");
assert.ok(
  songUi.indexOf('label="Song list"') < songUi.indexOf('label="Free look"'),
  "Free look is under the Song list fold",
);
assert.doesNotMatch(
  editor,
  /label="Free look"/,
  "Free look is not on the plate row / stills editor",
);
assert.match(songUi, /Stop send/);
assert.match(songUi, /redo-cut/);
assert.doesNotMatch(songUi, /visibilitychange/);
assert.doesNotMatch(songUi, /cookPendingSongCuts/);
assert.doesNotMatch(songUi, /Generate cuts/);
assert.doesNotMatch(songUi, /m-song-cut-chip/);
const songCss = readFileSync(join(here, "../src/app/(mobile)/m/mobile.css"), "utf8");
assert.match(songCss, /\.m-swipe-drop-action/);
assert.match(songCss, /\.scratch-song-cut\.is-done \.scratch-song-cut-meta/);
assert.doesNotMatch(songUi, /m-song-progress/);
assert.match(songUi, /m-song-plate-line/);
assert.match(songUi, /--row-progress/);
assert.doesNotMatch(songUi, /Cooking/);
assert.doesNotMatch(songUi, /cooking \$\{/);
assert.match(songUi, /Sending…/);
assert.doesNotMatch(songUi, /SongCookAlertBanner/);
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
assert.equal(songCutIsMuteAction({ mute: true }), true);
assert.equal(songCutIsMuteAction({ styleId: "music_video", beatKind: "cutaway" }), true);
assert.equal(songCutIsMuteAction({ styleId: "music_video" }), false);
assert.equal(songCutIsMuteAction({ styleId: "skidmarks", beatKind: "cutaway" }), false);
assert.match(clip, /writeSilentMp3/, "mute action uses silence, not the song");
assert.match(clip, /muteAction/, "No lips send skips the song mp3");
assert.match(clip, /Never the song mix/);
assert.match(songRoute, /mute: body.mute === true/);
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
{
  // Previous clip 2 at 0:15 / 5s must survive Add leftover (rebuilt 15s slices).
  const keptCar = syncSongCutsToDesk({
    songPlateIds: ["jack1", "car", "jack"],
    rowSlices: [1, 1, 1],
    cuts: [
      {
        id: "c1",
        status: "done",
        clipFile: "01_jack.mp4",
        plateFile: "1.png",
        shotId: "jack1",
        startSec: 0,
        durationSec: 15,
      },
      {
        id: "c2",
        status: "done",
        clipFile: "02_car.mp4",
        plateFile: "2.png",
        shotId: "car",
        startSec: 15,
        durationSec: 5,
      },
      {
        id: "c3",
        status: "done",
        clipFile: "03_stand.mp4",
        plateFile: "3.png",
        shotId: "jack",
        startSec: 20,
        durationSec: 5,
      },
    ],
    plateFileByShotId: { jack1: "1.png", car: "2.png", jack: "3.png" },
    songSec: 180,
    newCutId: () => "n",
  });
  assert.ok(
    keptCar.some((c) => c.clipFile === "02_car.mp4"),
    "Add must not drop the 0:15 car clipFile",
  );
}
assert.match(songUi, /songCutsOrderBroken/);
assert.match(songUi, /Fixed cut order/);
assert.match(songUi, /Plate clocks are the song/);
assert.match(songRoute, /Do not rebuild them as 1 × 15s/);
assert.match(songRoute, /syncSongCutsToDesk/);
assert.match(songRoute, /Keep done clips/);
assert.match(songRoute, /action === "redo-cut"/);
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
assert.deepEqual(
  plateIdsWaitingForTrack({
    song: {
      plateTimings: [{ plateId: "jack", startMs: 0, endMs: 500, sortIndex: 0 }],
      songPlateIds: ["jack"],
    },
    jobShots: [{ shotId: "jack", plateFile: "jack.png" }],
  }),
  ["jack"],
  "0.5s leftover is not a hang — Add can still put a still on",
);
assert.deepEqual(
  plateIdsNeedingDoneClipHang({
    song: {
      plateTimings: [
        { plateId: "plate_1", startMs: 0, endMs: 500 },
        { plateId: "plate_8", startMs: 0, endMs: 500 },
      ],
      cuts: [
        { shotId: "plate_1", clipFile: "01.mp4", status: "done", durationSec: 0.5 },
        { shotId: "plate_8", clipFile: "08.mp4", status: "done", durationSec: 0 },
      ],
      skipShotIds: [],
    },
    clips: [{ shotId: "plate_9", clipFile: "09.mp4", clipStatus: "done", durationSec: 15 }],
    jobShots: [
      { shotId: "plate_1", plateFile: "1.png" },
      { shotId: "off_still", plateFile: "off.png" },
      { shotId: "plate_8", plateFile: "8.png" },
      { shotId: "plate_9", plateFile: "9.png" },
    ],
  }),
  ["plate_1", "plate_8", "plate_9"],
  "done clips without a real hang, in plate order — off stills stay off",
);
assert.equal(
  needsDoneClipHang(
    {
      plateTimings: [{ plateId: "plate_1", startMs: 0, endMs: 15000 }],
      cuts: [{ shotId: "plate_1", clipFile: "01.mp4", status: "done", durationSec: 15 }],
    },
    [{ shotId: "plate_1", plateFile: "1.png" }],
    [{ shotId: "plate_1", clipFile: "01.mp4", clipStatus: "done", durationSec: 15 }],
  ),
  false,
  "already hung clip does not need Add",
);
assert.equal(
  needsDoneClipHang(
    { plateTimings: [], cuts: [], skipShotIds: ["gone"] },
    [{ shotId: "gone", plateFile: "g.png" }],
    [{ shotId: "gone", clipFile: "gone.mp4", clipStatus: "done", durationSec: 15 }],
  ),
  false,
  "Off song skip stays off",
);
assert.equal(
  needsDoneClipHang(
    {
      plateTimings: [
        { plateId: "jack1", startMs: 0, endMs: 15000, sortIndex: 0 },
        { plateId: "car", startMs: 15000, endMs: 20000, sortIndex: 1 },
        { plateId: "jack", startMs: 20000, endMs: 25000, sortIndex: 2 },
      ],
      cuts: [
        { shotId: "jack1", clipFile: "01_jack.mp4", status: "done", durationSec: 15 },
        { shotId: "car", clipFile: "02_car.mp4", status: "done", durationSec: 5 },
        { shotId: "jack", clipFile: "03_stand.mp4", status: "done", durationSec: 5 },
      ],
    },
    [
      { shotId: "jack1", plateFile: "1.png" },
      { shotId: "car", plateFile: "2.png" },
      { shotId: "jack", plateFile: "3.png" },
    ],
    [
      { shotId: "jack1", clipFile: "01_jack.mp4", clipStatus: "done", durationSec: 15 },
      { shotId: "car", clipFile: "02_car.mp4", clipStatus: "done", durationSec: 5 },
      { shotId: "jack", clipFile: "03_stand.mp4", clipStatus: "done", durationSec: 5 },
      { shotId: "jack", clipFile: "04_crouch.mp4", clipStatus: "done", durationSec: 5 },
    ],
  ),
  true,
  "TRACK 3 bars + leftover clip 4 still needs Hang — not a new plate",
);
assert.match(
  songRoute,
  /Not on TRACK open or job GET/,
  "hang-plates stays explicit — leftover / X'd files stay off until Add or Hang",
);
assert.match(
  songRoute,
  /5s file wins over a 15s cook window/,
  "explicit hang uses the 5s car, not a invented 15s end bar",
);
assert.match(
  readFileSync(join(here, "../src/lib/musicVideoSong.ts"), "utf8"),
  /listUnhungDoneClips/,
  "leftover same-still take is a hang, not a new plate",
);
assert.match(songRoute, /needsDoneClipHang/);
assert.match(
  songRoute.slice(songRoute.indexOf('action === "hang-plates"')),
  /hangMissingPlateTimings\(song\.plateTimings, hangCuts, \[\]\)/,
);
{
  const off = removePlateFromSong({
    plateId: "jack",
    plateTimings: [
      { plateId: "jack", startMs: 0, endMs: 15000, sortIndex: 0 },
      { plateId: "invisible", startMs: 15000, endMs: 26500, sortIndex: 1 },
    ],
    cuts: [
      {
        id: "cut_jack",
        shotId: "jack",
        plateFile: "jack.png",
        startSec: 0,
        durationSec: 15,
        status: "done",
        clipFile: "01_JACK_GHOST.mp4",
      },
      {
        id: "cut_im",
        shotId: "invisible",
        plateFile: "im.png",
        startSec: 15,
        durationSec: 11.5,
        status: "pending",
      },
    ],
    songPlateIds: ["jack", "invisible"],
    rowSlices: [1, 1],
    jobShots: [
      { shotId: "jack", plateFile: "jack.png" },
      { shotId: "invisible", plateFile: "im.png" },
    ],
  });
  assert.deepEqual(
    off.plateTimings.map((t) => t.plateId),
    ["invisible"],
    "Off song takes that still off the wave",
  );
  assert.equal(off.plateTimings[0]?.startMs, 15000, "other stills keep their times");
  assert.equal(off.plateTimings[0]?.endMs, 26500, "do not compact the hole");
  assert.deepEqual(off.songPlateIds, ["invisible"]);
  assert.deepEqual(off.skipShotIds, ["jack"]);
  assert.deepEqual(off.keptClipFiles, ["01_JACK_GHOST.mp4"]);
  assert.equal(off.keptCuts.length, 1);
  assert.equal(off.cuts.length, 1);
  assert.equal(off.cuts[0]?.shotId, "invisible");
  const waiting = plateIdsWaitingForTrack({
    song: {
      plateTimings: off.plateTimings,
      songPlateIds: [...off.songPlateIds, "jack"],
      skipShotIds: off.skipShotIds,
      cuts: off.cuts,
    },
    jobShots: [
      { shotId: "jack", plateFile: "jack.png" },
      { shotId: "invisible", plateFile: "im.png" },
    ],
  });
  const hungBack = hangMissingPlateTimings(off.plateTimings, off.cuts, waiting);
  assert.equal(
    hungBack.some((t) => t.plateId === "jack"),
    false,
    "Off song must not append a 15s row at the end",
  );
  assert.equal(hungBack[0]?.startMs, 15000, "other clocks stay");
  assert.equal(
    needsTrackHang(
      {
        plateTimings: off.plateTimings,
        songPlateIds: [...off.songPlateIds, "jack"],
        skipShotIds: off.skipShotIds,
        cuts: [
          ...off.cuts,
          { shotId: "jack", plateFile: "jack.png" },
        ],
      },
      [
        { shotId: "jack", plateFile: "jack.png" },
        { shotId: "invisible", plateFile: "im.png" },
      ],
    ),
    false,
    "skipShotIds stops the auto hang from appending a 15s row",
  );
}
{
  const nameless = removePlateFromSong({
    plateId: "jack",
    plateTimings: [{ plateId: "jack", startMs: 0, endMs: 15000, sortIndex: 0 }],
    cuts: [
      {
        id: "cut_file",
        plateFile: "jack.png",
        startSec: 0,
        durationSec: 15,
        clipFile: "jack.mp4",
      },
    ],
    jobShots: [{ shotId: "jack", plateFile: "jack.png" }],
  });
  assert.equal(nameless.cuts.length, 0, "cut with empty shotId still leaves when the file matches");
  assert.deepEqual(nameless.keptClipFiles, ["jack.mp4"]);
  assert.deepEqual(nameless.songPlateIds, []);
}
{
  const extraId = extraTakeHangPlateId("car", "04_Gothic_town.mp4");
  const offExtra = removePlateFromSong({
    plateId: extraId,
    plateTimings: [
      { plateId: "jack", startMs: 0, endMs: 15000, sortIndex: 0 },
      { plateId: "car", startMs: 15000, endMs: 20000, sortIndex: 1 },
      { plateId: "jack2", startMs: 20000, endMs: 25000, sortIndex: 2 },
      { plateId: extraId, startMs: 25000, endMs: 40000, sortIndex: 3 },
    ],
    cuts: [
      {
        id: "c1",
        shotId: "jack",
        plateFile: "jack.png",
        startSec: 0,
        durationSec: 16,
        status: "done",
        clipFile: "01_Jack.mp4",
      },
      {
        id: "c2",
        shotId: "car",
        plateFile: "car.png",
        startSec: 15,
        durationSec: 4,
        status: "done",
        clipFile: "02_City.mp4",
      },
      {
        id: "c3",
        shotId: "jack2",
        plateFile: "jack2.png",
        startSec: 20,
        durationSec: 4,
        status: "done",
        clipFile: "03_Look.mp4",
      },
      {
        id: "c4",
        shotId: extraId,
        plateFile: "car.png",
        startSec: 25,
        durationSec: 4,
        status: "done",
        clipFile: "04_Gothic_town.mp4",
      },
    ],
    songPlateIds: ["jack", "car", "jack2"],
    jobShots: [
      { shotId: "jack", plateFile: "jack.png" },
      { shotId: "car", plateFile: "car.png" },
      { shotId: "jack2", plateFile: "jack2.png" },
    ],
  });
  assert.deepEqual(
    offExtra.plateTimings.map((t) => t.plateId),
    ["jack", "car", "jack2"],
    "TRACK X / Off song takes only that bar off",
  );
  assert.deepEqual(offExtra.keptClipFiles, ["04_Gothic_town.mp4"]);
  assert.equal(offExtra.cuts.length, 3);
  assert.equal(
    offExtra.cuts.some((c) => c.clipFile === "04_Gothic_town.mp4"),
    false,
  );
  const clips = keepClipsAfterUnhang({
    clips: [
      { beatId: "b1", shotId: "jack", sceneId: "s", clipFile: "01_Jack.mp4", clipStatus: "done", error: "" },
      { beatId: "b2", shotId: "car", sceneId: "s", clipFile: "02_City.mp4", clipStatus: "done", error: "" },
      { beatId: "b3", shotId: "jack2", sceneId: "s", clipFile: "03_Look.mp4", clipStatus: "done", error: "" },
      { beatId: "b4", shotId: "car", sceneId: "s", clipFile: "04_Gothic_town.mp4", clipStatus: "done", error: "" },
    ],
    removedCuts: offExtra.keptCuts,
  });
  assert.deepEqual(
    clips.map((c) => c.clipFile),
    ["01_Jack.mp4", "02_City.mp4", "03_Look.mp4", "04_Gothic_town.mp4"],
    "unhang keeps the mp4 on job.clips",
  );
  const rail = gatherClipsForStillsRail(
    {
      clips,
      shots: [
        { shotId: "jack", sceneId: "s" },
        { shotId: "car", sceneId: "s" },
        { shotId: "jack2", sceneId: "s" },
      ],
      scratchSong: { cuts: offExtra.cuts, plateTimings: offExtra.plateTimings },
    },
    [{ shotId: "jack" }, { shotId: "car" }, { shotId: "jack2" }],
  );
  assert.equal(rail.length, 4, "CLIPS rail stays at 4 after Off song");
  assert.ok(rail.some((c) => c.clipFile === "04_Gothic_town.mp4"));
}
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
  assert.match(block, /applyAddPlateOnSong/, "Add hangs an existing mp4 — does not cook");
  assert.match(block, /addPlateFileFirstHang/, "Add file-first hangs leftover");
  assert.match(block, /fileFirst\.hung/);
  assert.match(block, /alreadyHung/, "hung still with no leftover must not mint WAITING 4");
  assert.doesNotMatch(block, /syncSongCutsToDesk/, "Add must not rebuild the desk as WAITING 15s");
  assert.match(block, /job\.clips/, "Add reads leftover rendered mp4s, not only waiting cuts");
  assert.match(block, /durationSec: body\.durationSec/, "add-plate hangs the slider seconds");
  assert.match(block, /lyricCues/, "singing Add reads lyric pins");
  assert.match(block, /addPlateIsSingingHang/, "No lips OFF is the singing hang");
  assert.doesNotMatch(block, /rebuildSongCutsFromDesk/);
  assert.doesNotMatch(block, /cookDurationFromHungBar/, "Add must not cook from the hung bar");
  assert.doesNotMatch(block, /MINIMAX_H3_MAX_SEC/, "Add must not clamp TRACK to H3 15");
}
{
  let n = 0;
  const added = applyAddPlateOnSong({
    shotId: "jack3",
    plateFile: "jack.png",
    plateTimings: [
      { plateId: "jack1", startMs: 0, endMs: 15000, sortIndex: 0 },
      { plateId: "car", startMs: 15000, endMs: 20000, sortIndex: 1 },
      { plateId: "jack3", startMs: 20000, endMs: 25000, sortIndex: 2 },
    ],
    cuts: [
      {
        id: "c1",
        shotId: "jack1",
        plateFile: "1.png",
        startSec: 0,
        durationSec: 15,
        clipFile: "01_Jack.mp4",
        status: "done",
      },
      {
        id: "c2",
        shotId: "car",
        plateFile: "car.png",
        startSec: 15,
        durationSec: 5,
        clipFile: "02_Car.mp4",
        status: "done",
      },
      {
        id: "c3",
        shotId: "jack3",
        plateFile: "jack.png",
        startSec: 20,
        durationSec: 5,
        clipFile: "03_Jack.mp4",
        status: "done",
      },
    ],
    clips: [
      { shotId: "jack1", clipFile: "01_Jack.mp4", clipStatus: "done", durationSec: 15 },
      { shotId: "car", clipFile: "02_Car.mp4", clipStatus: "done", durationSec: 5 },
      {
        shotId: "jack3",
        clipFile: "04_Jack_stand.mp4",
        priorClipFiles: ["03_Jack.mp4"],
        clipStatus: "done",
        durationSec: 8,
      },
    ],
    skipShotIds: ["car~6ir"],
    songPlateIds: ["jack1", "car", "jack3"],
    rowSlices: [1, 1, 1],
    songSec: 180,
    newCutId: () => `cut_add_${++n}`,
  });
  assert.equal(added.hung, true, "Open→Add hangs leftover mp4");
  assert.equal(added.cuts.find((c) => c.shotId === "car")?.clipFile, "02_Car.mp4");
  assert.equal(added.cuts.find((c) => c.shotId === "car")?.startSec, 15);
  assert.equal(added.cuts.find((c) => c.shotId === "car")?.durationSec, 5);
  assert.equal(added.cuts.find((c) => c.clipFile === "01_Jack.mp4")?.status, "done");
  assert.equal(added.cuts.find((c) => c.clipFile === "03_Jack.mp4")?.status, "done");
  const leftover = added.cuts.find((c) => c.clipFile === "04_Jack_stand.mp4");
  assert.equal(leftover?.status, "done");
  assert.equal(leftover?.startSec, 25);
  assert.equal(leftover?.durationSec, 8);
  assert.equal(
    leftover?.shotId,
    extraTakeHangPlateId("jack3", "04_Jack_stand.mp4"),
  );
  assert.equal(
    added.cuts.filter((c) => c.status === "pending").length,
    0,
    "no WAITING cook",
  );
  assert.equal(added.plateTimings.length, 4);
  assert.equal(added.plateTimings[3]?.startMs, 25000);
  assert.equal(added.plateTimings[3]?.endMs, 33000);
  assert.deepEqual(
    added.plateTimings.slice(0, 3).map((t) => [t.plateId, t.startMs, t.endMs]),
    [
      ["jack1", 0, 15000],
      ["car", 15000, 20000],
      ["jack3", 20000, 25000],
    ],
  );
}
{
  let n = 0;
  const firstLeftover = applyAddPlateOnSong({
    shotId: "jack",
    plateFile: "jack.png",
    plateTimings: [
      { plateId: "car", startMs: 0, endMs: 5000, sortIndex: 0 },
    ],
    cuts: [
      {
        id: "car1",
        shotId: "car",
        plateFile: "car.png",
        startSec: 0,
        durationSec: 5,
        clipFile: "02_Car.mp4",
        status: "done",
      },
    ],
    clips: [
      { shotId: "car", clipFile: "02_Car.mp4", clipStatus: "done", durationSec: 5 },
      { shotId: "jack", clipFile: "03_Jack.mp4", clipStatus: "done", durationSec: 8 },
    ],
    skipShotIds: ["car~6ir"],
    songPlateIds: ["car"],
    rowSlices: [1],
    songSec: 180,
    newCutId: () => `cut_first_${++n}`,
  });
  assert.equal(firstLeftover.hung, true, "Add with leftover mp4 hangs it");
  const hungJack = firstLeftover.cuts.find((c) => c.clipFile === "03_Jack.mp4");
  assert.equal(hungJack?.status, "done");
  assert.equal(hungJack?.startSec, 5);
  assert.equal(hungJack?.durationSec, 8);
  assert.equal(firstLeftover.cuts.find((c) => c.clipFile === "02_Car.mp4")?.status, "done");
  assert.equal(
    firstLeftover.cuts.filter((c) => c.status === "pending").length,
    0,
    "leftover Add writes plateTiming + cut — no waiting cook",
  );
  assert.equal(firstLeftover.plateTimings.length, 2);
  assert.equal(firstLeftover.plateTimings[0]?.plateId, "car");
  assert.equal(firstLeftover.plateTimings[1]?.plateId, "jack");
  assert.equal(firstLeftover.plateTimings[1]?.startMs, 5000);
  assert.equal(firstLeftover.plateTimings[1]?.endMs, 13000);
  assert.ok(firstLeftover.songPlateIds.includes("jack"));
}
{
  const noLeftover = applyAddPlateOnSong({
    shotId: "jack3",
    plateFile: "jack.png",
    plateTimings: [
      { plateId: "car", startMs: 0, endMs: 5000, sortIndex: 0 },
      { plateId: "jack3", startMs: 5000, endMs: 10000, sortIndex: 1 },
    ],
    cuts: [
      {
        id: "car1",
        shotId: "car",
        plateFile: "car.png",
        startSec: 0,
        durationSec: 5,
        clipFile: "02_Car.mp4",
        status: "done",
      },
      {
        id: "j1",
        shotId: "jack3",
        plateFile: "jack.png",
        startSec: 5,
        durationSec: 5,
        clipFile: "03_Jack.mp4",
        status: "done",
      },
    ],
    clips: [
      { shotId: "car", clipFile: "02_Car.mp4", clipStatus: "done", durationSec: 5 },
      { shotId: "jack3", clipFile: "03_Jack.mp4", clipStatus: "done", durationSec: 5 },
    ],
    songPlateIds: ["car", "jack3"],
    rowSlices: [1, 1],
    songSec: 180,
    newCutId: () => "cut_noop",
  });
  assert.equal(noLeftover.hung, false, "already hung + no leftover — no cook");
  assert.equal(noLeftover.plateTimings.length, 3, "second bar after last end");
  assert.equal(noLeftover.plateTimings[1]?.plateId, "jack3");
  assert.equal(
    noLeftover.plateTimings[2]?.plateId,
    extraStillHangPlateId("jack3", [
      { plateId: "car" },
      { plateId: "jack3" },
    ]),
  );
  assert.equal(noLeftover.plateTimings[2]?.startMs, 10000);
  assert.equal(noLeftover.plateTimings[2]?.endMs, 25000);
  const hang2Id = extraStillHangPlateId("jack3", [
    { plateId: "car" },
    { plateId: "jack3" },
  ]);
  assert.equal(noLeftover.cuts.length, 3, "second hang gets its own empty cut");
  assert.equal(noLeftover.cuts.find((c) => c.clipFile === "02_Car.mp4")?.status, "done");
  assert.equal(noLeftover.cuts.find((c) => c.clipFile === "03_Jack.mp4")?.clipFile, "03_Jack.mp4");
  const hang2Cut = noLeftover.cuts.find((c) => c.shotId === hang2Id);
  assert.equal(hang2Cut?.shotId, hang2Id);
  assert.equal((hang2Cut?.clipFile || "").trim(), "", "hang 2 stays empty — not clip 1");
  assert.equal(
    noLeftover.cuts.filter((c) => c.shotId === "jack3" && c.status === "pending").length,
    0,
    "alreadyHung Add does not mint a WAITING cook on hang 1",
  );
}
{
  const stillOnly = applyAddPlateOnSong({
    shotId: "empty",
    plateFile: "empty.png",
    plateTimings: [
      { plateId: "car", startMs: 0, endMs: 5000, sortIndex: 0 },
    ],
    cuts: [
      {
        id: "car1",
        shotId: "car",
        plateFile: "car.png",
        startSec: 0,
        durationSec: 5,
        clipFile: "02_Car.mp4",
        status: "done",
      },
    ],
    clips: [{ shotId: "car", clipFile: "02_Car.mp4", clipStatus: "done", durationSec: 5 }],
    songPlateIds: ["car"],
    rowSlices: [1],
    songSec: 180,
    newCutId: () => "cut_still",
  });
  assert.equal(stillOnly.hung, false);
  assert.equal(stillOnly.plateTimings.length, 2, "no mp4 — still hangs after last end");
  assert.equal(stillOnly.plateTimings[1]?.plateId, "empty");
  assert.equal(stillOnly.plateTimings[1]?.startMs, 5000);
  assert.equal(stillOnly.plateTimings[1]?.endMs, 20000);
  assert.equal(stillOnly.cuts.find((c) => c.clipFile === "02_Car.mp4")?.status, "done");
  assert.equal(
    stillOnly.cuts.filter((c) => c.status === "pending").length,
    0,
    "still-only Add does not mint a WAITING cook",
  );
  const stillAgain = applyAddPlateOnSong({
    shotId: "empty",
    plateFile: "empty.png",
    plateTimings: stillOnly.plateTimings,
    cuts: stillOnly.cuts,
    clips: [{ shotId: "car", clipFile: "02_Car.mp4", clipStatus: "done", durationSec: 5 }],
    songPlateIds: stillOnly.songPlateIds,
    rowSlices: stillOnly.rowSlices,
    songSec: 180,
    newCutId: () => "cut_still_2",
  });
  assert.equal(stillAgain.hung, false, "second Add of the same still does not cook");
  assert.equal(stillAgain.plateTimings.length, 3, "alreadyHung still gets another TRACK bar");
  assert.equal(stillAgain.plateTimings[2]?.plateId, extraStillHangPlateId("empty", stillOnly.plateTimings));
  assert.equal(stillAgain.plateTimings[2]?.startMs, 20000);
  assert.equal(stillAgain.plateTimings[2]?.endMs, 35000);
  const empty2 = extraStillHangPlateId("empty", stillOnly.plateTimings);
  assert.equal(stillAgain.cuts.find((c) => c.shotId === empty2)?.shotId, empty2);
  assert.equal(
    (stillAgain.cuts.find((c) => c.shotId === empty2)?.clipFile || "").trim(),
    "",
    "second still hang has no clipFile",
  );
  assert.equal(
    stillAgain.cuts.find((c) => c.clipFile === "02_Car.mp4")?.status,
    "done",
    "second still Add does not steal the car clip",
  );
}
{
  writeHangLengthDraft("job_add", "jack_ghost", 20);
  assert.equal(readHangLengthDraft("job_add", "jack_ghost"), 20, "Add reads the box that says 20");
  assert.equal(addPlateHangDurationSec(20), 20, "slider 20 hangs 20");
  assert.equal(addPlateHangDurationSec(40), 40, "slider 40 hangs 40");
  assert.equal(addPlateHangDurationSec(undefined), 15, "missing slider still defaults 15");
  assert.equal(addPlateHangDurationSec(50), 40, "Add cap is hang 40, not H3 15");
  const slider20 = applyAddPlateOnSong({
    shotId: "jack_ghost",
    plateFile: "jack.png",
    plateTimings: [{ plateId: "car", startMs: 0, endMs: 5000, sortIndex: 0 }],
    cuts: [
      {
        id: "car1",
        shotId: "car",
        plateFile: "car.png",
        startSec: 0,
        durationSec: 5,
        clipFile: "02_Car.mp4",
        status: "done",
      },
    ],
    clips: [{ shotId: "car", clipFile: "02_Car.mp4", clipStatus: "done", durationSec: 5 }],
    songPlateIds: ["car"],
    rowSlices: [1],
    songSec: 180,
    durationSec: 20,
    newCutId: () => "cut_20",
  });
  assert.equal(slider20.plateTimings[1]?.plateId, "jack_ghost");
  assert.equal(slider20.plateTimings[1]?.startMs, 5000);
  assert.equal(slider20.plateTimings[1]?.endMs, 25000, "Add hangs the slider 20s — not 15");
  assert.equal(
    slider20.cuts.filter((c) => c.status === "pending").length,
    0,
    "slider Add does not cook",
  );
}
{
  assert.equal(addPlateIsSingingHang({}), true, "No lips OFF is singing");
  assert.equal(addPlateIsSingingHang({ mute: true }), false);
  assert.equal(addPlateIsSingingHang({ support: true }), false);
  const sung = applyAddPlateOnSong({
    shotId: "jack_ghost",
    plateFile: "jack.png",
    plateTimings: [{ plateId: "intro", startMs: 0, endMs: 30000, sortIndex: 0 }],
    cuts: [],
    clips: [],
    songPlateIds: ["intro"],
    rowSlices: [1],
    songSec: 320,
    durationSec: 20,
    singing: true,
    lyricCues: [
      { lineIndex: 0, atMs: 31000 },
      { lineIndex: 1, atMs: 81000 },
    ],
    newCutId: () => "cut_lyric",
  });
  assert.equal(sung.plateTimings[0]?.startMs, 0, "intro stays at 0");
  assert.equal(sung.plateTimings[0]?.endMs, 30000, "intro is not shoved");
  assert.equal(sung.plateTimings[1]?.plateId, "jack_ghost");
  assert.equal(sung.plateTimings[1]?.startMs, 31000, "Jack hangs at Silver 0:31, not after 0:30");
  assert.equal(sung.plateTimings[1]?.endMs, 51000, "slider 20s on the lyric pin");
  assert.equal(
    sung.cuts.filter((c) => c.status === "pending").length,
    0,
    "lyric Add does not cook",
  );
  const afterLastWouldBeWheels = applyAddPlateOnSong({
    shotId: "jack",
    plateFile: "jack.png",
    singing: true,
    lyricCues: [
      { lineIndex: 0, atMs: 31000 },
      { lineIndex: 1, atMs: 81000 },
    ],
    plateTimings: [
      { plateId: "intro", startMs: 0, endMs: 30000, sortIndex: 0 },
      { plateId: "clip20", startMs: 30000, endMs: 50000, sortIndex: 1 },
      { plateId: "more", startMs: 50000, endMs: 81000, sortIndex: 2 },
    ],
    cuts: [],
    clips: [],
    songPlateIds: ["intro", "clip20", "more"],
    rowSlices: [1, 1, 1],
    songSec: 180,
    durationSec: 15,
    newCutId: () => "cut_silver",
  });
  const jackBar = afterLastWouldBeWheels.plateTimings.find((t) => t.plateId === "jack");
  assert.equal(jackBar?.startMs, 31000, "30s at the start must not shove Jack to wheels 1:21");
  assert.equal(afterLastWouldBeWheels.plateTimings[0]?.startMs, 0);
  assert.equal(afterLastWouldBeWheels.plateTimings[0]?.endMs, 30000, "intro stays");
  assert.equal(afterLastWouldBeWheels.plateTimings[2]?.startMs, 50000);
  assert.equal(afterLastWouldBeWheels.plateTimings[2]?.endMs, 81000);
  const introOnFront = applyAddPlateOnSong({
    shotId: "intro2",
    plateFile: "car.png",
    singing: false,
    lyricCues: [
      { lineIndex: 0, atMs: 31000 },
      { lineIndex: 1, atMs: 81000 },
    ],
    plateTimings: [{ plateId: "jack", startMs: 31000, endMs: 46000, sortIndex: 0 }],
    cuts: [],
    clips: [],
    songPlateIds: ["jack"],
    rowSlices: [1],
    songSec: 180,
    durationSec: 30,
    newCutId: () => "cut_front",
  });
  assert.equal(introOnFront.plateTimings.find((t) => t.plateId === "jack")?.startMs, 31000);
  assert.equal(introOnFront.plateTimings.find((t) => t.plateId === "jack")?.endMs, 46000);
  assert.equal(introOnFront.plateTimings.find((t) => t.plateId === "intro2")?.startMs, 0);
  assert.equal(introOnFront.plateTimings.find((t) => t.plateId === "intro2")?.endMs, 30000);
  const jackAgain = applyAddPlateOnSong({
    shotId: "jack",
    plateFile: "jack.png",
    singing: true,
    lyricCues: [
      { lineIndex: 0, atMs: 31000 },
      { lineIndex: 1, atMs: 81000 },
    ],
    plateTimings: afterLastWouldBeWheels.plateTimings,
    cuts: [
      {
        id: "m1",
        shotId: "more",
        plateFile: "c.png",
        startSec: 50,
        durationSec: 31,
        clipFile: "03_More.mp4",
        status: "done",
      },
    ],
    clips: [{ shotId: "more", clipFile: "03_More.mp4", clipStatus: "done", durationSec: 31 }],
    songPlateIds: ["intro", "clip20", "more", "jack"],
    rowSlices: [1, 1, 1, 1],
    songSec: 180,
    durationSec: 15,
    newCutId: () => "cut_jack2",
  });
  const jack2Id = extraStillHangPlateId("jack", afterLastWouldBeWheels.plateTimings);
  const jack2Bar = jackAgain.plateTimings.find((t) => t.plateId === jack2Id);
  assert.equal(jack2Bar?.startMs, 81000, "second singing hang uses the next unused lyric pin");
  assert.equal(
    jackAgain.cuts.find((c) => c.clipFile === "03_More.mp4")?.clipFile,
    "03_More.mp4",
    "second singing hang must not steal another bar's mp4",
  );
  assert.equal((jackAgain.cuts.find((c) => c.shotId === jack2Id)?.clipFile || "").trim(), "");
  assert.match(
    songRoute,
    /hangId \|\| shotId/,
    "Send cooks the hang id, not the first still match",
  );
  assert.match(songRoute, /sliceBoundsForPlate\(\{ song, shotId: hangId/);
  const muteStill = applyAddPlateOnSong({
    shotId: "road",
    plateFile: "road.png",
    singing: false,
    lyricCues: [
      { lineIndex: 0, atMs: 31000 },
      { lineIndex: 1, atMs: 81000 },
    ],
    plateTimings: [
      { plateId: "intro", startMs: 0, endMs: 30000, sortIndex: 0 },
      { plateId: "jack", startMs: 31000, endMs: 46000, sortIndex: 1 },
    ],
    cuts: [],
    clips: [],
    songPlateIds: ["intro", "jack"],
    rowSlices: [1, 1],
    songSec: 180,
    durationSec: 8,
    newCutId: () => "cut_mute",
  });
  assert.equal(muteStill.plateTimings.find((t) => t.plateId === "road")?.startMs, 46000);
  assert.equal(muteStill.plateTimings.find((t) => t.plateId === "road")?.endMs, 54000);
  assert.equal(muteStill.plateTimings.find((t) => t.plateId === "jack")?.startMs, 31000);
  assert.equal(
    muteStill.cuts.filter((c) => c.status === "pending").length,
    0,
    "No lips still Add does not mint a WAITING cook",
  );
  const muteList = deskRowSongSpan({
    cuts: [],
    shotId: "road",
    plateTimings: muteStill.plateTimings,
  });
  assert.equal(muteList?.startSec, 46, "No lips hang shows the song clock with no cut");
  assert.equal(muteList?.endSec, 54);
  assert.equal(
    formatSongSpan(muteList.startSec, muteList.endSec),
    "0:46.0–0:54.0",
  );
  assert.equal(
    deskRowSongSpan({
      cuts: [],
      shotId: "ghost",
      plateTimings: [{ plateId: "ghost", startMs: 0, endMs: 500, sortIndex: 0 }],
    }),
    null,
    "leftover 0.5s is not a time signature",
  );
  assert.equal(
    deskRowSongSpan({
      cuts: [{ startSec: 0, durationSec: 15 }],
      shotId: "road",
      plateTimings: [{ plateId: "road", startMs: 46000, endMs: 54000, sortIndex: 0 }],
    })?.startSec,
    0,
    "real cut clock wins over plateTimings",
  );
  assert.match(
    songLib,
    /const durMs = secToMs\(addPlateHangDurationSec\(opts\.durationSec\)\)/,
    "still-only Add writes the slider clock",
  );
  assert.doesNotMatch(
    songLib,
    /const durMs = secToMs\(SCRATCH_SONG_SLICE_DEFAULT_SEC\)/,
    "Add must not snap stills to 15 when the slider is 20",
  );
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
{
  const start = editor.indexOf("async function addPlateToSong");
  const end = editor.indexOf("\n  const songReady", start);
  const fn = start >= 0 && end > start ? editor.slice(start, end) : "";
  assert.match(fn, /action: "add-plate"/, "plate-row Add next to LTX posts add-plate");
  assert.match(fn, /durationSec: readHangLengthDraft/, "plate-row Add sends the slider seconds");
  assert.doesNotMatch(fn, /action: "run"/, "plate-row Add must not queue a cook");
  assert.doesNotMatch(fn, /generate/, "plate-row Add must not generate");
  assert.doesNotMatch(fn, /cookDurationFromHungBar/, "Add is not a cook");
  assert.doesNotMatch(fn, /MINIMAX_H3_MAX_SEC/, "Add must not clamp to H3 15");
}
assert.match(editor, /onAddToSong=\{\s*songReady && openShotId\s*\? \(\) => void addPlateToSong\(openShotId\)/);
assert.doesNotMatch(editor, /Tap Add\. It goes on the song list/);
assert.doesNotMatch(editor, /Position this plate/);
assert.doesNotMatch(editor, /Song slices are under/);
assert.doesNotMatch(songUi, /Singer plates sing/);
assert.doesNotMatch(songUi, /Tap a plate\. Tap Add/);
assert.doesNotMatch(songUi, /scratch-song-mp3/);
assert.doesNotMatch(songUi, /Song · \{song\.fileName\}/);
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

{
  const first = {
    beatId: "beat_aai6zao",
    clipFile: "03_JACK_GHOST_GIVE_ME_SOMETHING.mp4",
    clipStatus: "done",
  };
  assert.equal(
    songCookAppendsNewClip({
      beatId: "beat_aai6zao",
      clips: [first],
    }),
    true,
    "fourth cook of the first plate must not reuse clip 1's row",
  );
  assert.equal(
    songCookAppendsNewClip({
      beatId: "beat_aai6zao",
      clips: [{ beatId: "beat_aai6zao", clipFile: "", clipStatus: "pending" }],
    }),
    false,
    "first cook on a beat still writes that row",
  );
  assert.equal(
    songCookAppendsNewClip({
      cutClipFile: "03_JACK_GHOST_GIVE_ME_SOMETHING.mp4",
      beatId: "beat_other",
      clips: [],
    }),
    true,
    "a cut that already has a file appends",
  );
  const started = withSongCookPendingClip({
    clips: [first],
    beatId: "beat_aai6zao",
    hangId: "shot_espv62u~still2",
    sceneId: "scene_1",
    speaker: "JACK GHOST",
    line: "",
    voiceFile: "",
    imageMotion: "next",
    newBeatId: () => "cut:take_4",
  });
  assert.equal(started.cookBeatId, "cut:take_4");
  assert.equal(started.clips.length, 2);
  assert.equal(started.clips[0]?.clipFile, "03_JACK_GHOST_GIVE_ME_SOMETHING.mp4");
  assert.equal(started.clips[0]?.clipStatus, "done");
  assert.equal(started.clips[1]?.beatId, "cut:take_4");
  assert.equal(started.clips[1]?.shotId, "shot_espv62u~still2");
  assert.equal(started.clips[1]?.clipFile, "");
}
assert.match(
  clip,
  /songCookAppendsNewClip/,
  "LTX Send uses the append lock so clip 1 stays",
);

console.log("check-music-video-song: ok");
