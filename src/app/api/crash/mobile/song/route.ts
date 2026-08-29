import { NextResponse } from "next/server";
import { readMobileStory } from "@/lib/mobileStoryStore";
import { MOBILE_JOB_READ_MISS, patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { failScratchSongCutRun, runScratchLtxClip } from "@/lib/mobileScratchClip";
import { finishScratchSirayClip, submitScratchSirayClip } from "@/lib/sirayScratchClip";
import {
  finishScratchMinimaxClip,
  isMinimaxScratchClipTask,
  submitScratchMinimaxClip,
} from "@/lib/minimaxScratchClip";
import { parseScratchClipEngine } from "@/lib/sirayI2v";
import {
  MINIMAX_H3_ID,
  parseMinimaxH3Camera,
  parseMinimaxH3Resolution,
  refuseMinimaxH3OverMax,
  snapMinimaxH3DurationSec,
} from "@/lib/minimaxH3";
import { sirayConfigured } from "@/lib/sirayClient";
import { minimaxVideoConfigured } from "@/lib/minimaxVideo";
import { clipOwnsHangPlate, hangDoneClipOnTrack } from "@/lib/stockClipHang";
import { clipFileBasename, stackedClipFiles } from "@/lib/mobilePlateClips";
import { newId } from "@/lib/types";
import {
  clampSongWindow,
  HANG_LENGTH_MAX_SEC,
  nextCutAfter,
  songWindowLabel,
  type ScratchSongCut,
} from "@/lib/scratchSongSlice";
import {
  beatForSongCut,
  findSongCarrierBeatId,
  isMusicVideoSongJob,
  needsDoneClipHang,
  plateIdsWaitingForTrack,
  plateIdsNeedingDoneClipHang,
  doneClipRowsForHang,
  shotIdForSongCut,
  storyShotForSongCut,
  plateSliceWindows,
  clearFalseSpokenLineSongFails,
  clearStuckSongCooks,
  rebuildSongCutsFromDesk,
  songDeskPlateIds,
  songDeskRowSlices,
  skipSongPlateIds,
  syncSongCutsToDesk,
  applyAddPlateOnSong,
  addPlateIsSingingHang,
  withRowSliceAt,
  withoutPlateParkedCuts,
  withoutSongPlateAt,
  withoutSongRowSliceAt,
  withSkippedSongPlate,
} from "@/lib/musicVideoSong";
import { isMobileSavedVoiceFile } from "@/lib/mobileSavedVoice";
import { parkMobileClipFile } from "@/lib/mobileClipPark";
import { isEpisodeClipPlanError } from "@/lib/mobileEpisodeClips";
import { planParkDeskClipTake } from "@/lib/parkDeskClip";
import { copyPlaceStillAsEmptyPlate } from "@/lib/mobilePlateMedia";
import { landEpisodePlateStill } from "@/lib/mobilePlateRebuild";
import { emptyStageFarOutStaging } from "@/lib/emptyStagePlate";
import {
  cutFromPlateTiming,
  hangMissingPlateTimings,
  hangOneClipOnWave,
  hangPlateShotId,
  hangUnhungDoneClips,
  listUnhungDoneClips,
  sliceBoundsForPlate,
  songFromTrackDraft,
} from "@/lib/musicVideoTrack";
import { forgottenTrumpetLtxBlockReason } from "@/lib/forgottenWhoPlays";
import { findStoryShot, isSupportShot } from "@/lib/stockFootage";
import { writeScratchCookProgress } from "@/lib/scratchCookStore";

export const runtime = "nodejs";
export const maxDuration = 900;

/**
 * /m Music video song desk.
 * POST { action, jobId, ... }
 *   assign — park N × 15s on one plate (reuse the same plate later).
 *   remove — drop one parked cut.
 *   remove-plate-parked — drop pending/fail slices on one plate. Plate stays.
 *   unstick — running with no clip → pending (left the screen too long).
 *   unstick-all — clear stuck cooks and sync cuts to the desk list (kills ghost 0/16).
 *   run — one still. LTX waits here. H3 / Siray submit and return pending.
 *   clip-poll — one H3 / Siray tick until the mp4 lands.
 *   stitch — rejected. Finish is ordered unstitched mp4s.
 *   remove-stitch — park a leftover joined mp4 if one exists.
 *   hang-plates — explicit Put stills / Hang only. Not on TRACK open or job GET. Hang done clipFiles on the wave (next gap, known mp4/clip/cut length else 15 — 5s file wins over a 15s cook window). Extra take on the same still goes after the last hung end. Leftover 0.5s is not a hang. Stills with no mp4 stay off — Add those. X'd leftovers stay off until he taps Add or Hang on that take. No leftover job.shots. No cook.
 *   hang-clip — hang one existing mp4 (same still, second take gets its own clock). File first. No cook.
 *   redo-cut — park that clip, leave the still, wait for Send again.
 *   add-plate — leftover mp4 file-first hangs in a gap or at 0
 *     (applyAddPlateOnSong → addPlateFileFirstHang). Singing first hang
 *     (No lips OFF) uses the unused lyric cue so intro clips do not shove
 *     Silver lines off 0:31. No waiting cook on siblings. Still with no mp4 hangs at body.durationSec (slider 5–40). Already hung + extra
 *     mp4 → hang that file in a gap at render length. alreadyHung + no
 *     leftover → another still bar (extraStillHangPlateId) in a gap at
 *     the slider seconds — not on a covered verse pin. Other bars keep
 *     their times. No cook. fileFirst.hung /
 *     alreadyHung live there. No desk rebuild. Does not clamp the TRACK
 *     bar to H3's 15.
 *   set-row-slices — −/+ on a list row; rebuilds the cut times.
 *   skip-plate — take one list row off. Plate card stays.
 *   List edits clear stuck cooks first — a hung LTX must not lock Add forever.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    jobId?: string;
    shotId?: string;
    clipFile?: string;
    cutId?: string;
    count?: number;
    beatId?: string;
    listIndex?: number;
    clipEngine?: string;
    durationSec?: number;
    mute?: boolean;
    emptyFrame?: boolean;
    nobodyInShot?: boolean;
    singing?: boolean;
    support?: boolean;
    endPlateFile?: string;
    resolution?: string;
    h3Camera?: string;
    imageMotion?: string;
  };
  const action = String(body.action || "").trim();
  const jobId = String(body.jobId || "").trim();
  if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

  let job = await readMobileGenJob(jobId);
  if (!job) {
    return NextResponse.json({ error: MOBILE_JOB_READ_MISS }, { status: 404 });
  }
  if (!isMusicVideoSongJob(job)) {
    return NextResponse.json({ error: "Song cuts on /m are Music video only." }, { status: 400 });
  }
  const story = await readMobileStory(job.styleId, job.folderName);

  try {
    if (action === "assign") {
      const song = songFromTrackDraft(job.trackDraft, job.scratchSong);
      if (!song?.fileName) {
        return NextResponse.json({ error: "Drop the song mp3 first." }, { status: 400 });
      }
      const shotId = String(body.shotId || "").trim();
      const shot = job.shots.find((s) => s.shotId === shotId);
      let plateFile = (shot?.plateFile || "").trim();
      if (!shotId) {
        return NextResponse.json({ error: "Need a plate to park 15s slices." }, { status: 400 });
      }
      if (!plateFile || plateFile === "__error__") {
        const copied = await copyPlaceStillAsEmptyPlate({
          job,
          sceneId: shot?.sceneId || "",
        });
        if (!copied) {
          return NextResponse.json(
            { error: "Need the place still first — then Add empty stage." },
            { status: 400 },
          );
        }
        const placeName =
          job.scenes.find((sc) => sc.id === shot?.sceneId)?.placeName ||
          story.scenes.find((sc) => sc.id === shot?.sceneId)?.placeName ||
          "";
        const landed = await landEpisodePlateStill({
          job,
          story,
          shotId,
          fileName: copied,
          staging: emptyStageFarOutStaging(placeName),
        });
        job = landed.job;
        plateFile = copied;
      }
      const extra = plateSliceWindows(song.cuts || [], song.durationSec, Number(body.count));
      if (!extra.length) {
        return NextResponse.json({ error: "Nothing left to park — at the end of the track." }, { status: 400 });
      }
      const cuts: ScratchSongCut[] = [
        ...(song.cuts || []),
        ...extra.map((window) => ({
          id: newId("cut"),
          plateFile,
          shotId,
          startSec: window.startSec,
          durationSec: window.durationSec,
          status: "pending" as const,
        })),
      ];
      const nextWin = nextCutAfter(cuts, song.durationSec);
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: {
          ...song,
          cuts,
          sliceStartSec: nextWin.startSec,
          sliceDurationSec: nextWin.durationSec,
        },
        error: "",
      });
      return NextResponse.json({
        ok: true,
        job: updated,
        added: extra.length,
        label: songWindowLabel(song.durationSec, cuts),
      });
    }

    if (action === "remove-plate-parked") {
      const song = job.scratchSong;
      const shotId = String(body.shotId || "").trim();
      if (!song || !shotId) {
        return NextResponse.json({ error: "Need a plate to drop parked slices from." }, { status: 400 });
      }
      const plateFile = (job.shots.find((s) => s.shotId === shotId)?.plateFile || "").trim();
      const { next, dropped } = withoutPlateParkedCuts(song.cuts || [], shotId, plateFile);
      if (!dropped) {
        return NextResponse.json({ error: "Nothing parked on that plate." }, { status: 400 });
      }
      const nextWin = nextCutAfter(next, song.durationSec);
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: {
          ...song,
          cuts: next,
          sliceStartSec: nextWin.startSec,
          sliceDurationSec: nextWin.durationSec,
        },
        error: "",
      });
      return NextResponse.json({
        ok: true,
        job: updated,
        dropped,
        label: songWindowLabel(song.durationSec, next),
      });
    }

    if (action === "remove") {
      const song = job.scratchSong;
      const cutId = String(body.cutId || "").trim();
      if (!song || !cutId) {
        return NextResponse.json({ error: "Need a cut to remove." }, { status: 400 });
      }
      const cuts = (song.cuts || []).filter((c) => c.id !== cutId);
      const nextWin = nextCutAfter(cuts, song.durationSec);
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: {
          ...song,
          cuts,
          sliceStartSec: nextWin.startSec,
          sliceDurationSec: nextWin.durationSec,
        },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated, label: songWindowLabel(song.durationSec, cuts) });
    }

    if (action === "unstick") {
      const song = job.scratchSong;
      const cutId = String(body.cutId || "").trim();
      if (!song || !cutId) {
        return NextResponse.json({ error: "Need a cut to unstick." }, { status: 400 });
      }
      const cuts = (song.cuts || []).map((c) =>
        c.id === cutId && c.status === "running" && !c.clipFile
          ? { ...c, status: "pending" as const, error: "" }
          : c,
      );
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: { ...song, cuts },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "unstick-all") {
      const song = job.scratchSong;
      if (!song) {
        return NextResponse.json({ error: "No song on this job." }, { status: 400 });
      }
      // Plate clocks already laid the song. Do not rebuild them as 1 × 15s.
      if ((song.plateTimings || []).length) {
        const cuts = clearFalseSpokenLineSongFails(clearStuckSongCooks(song.cuts || []));
        const updated = await patchMobileGenJob(jobId, {
          scratchSong: { ...song, cuts },
          error: "",
          scratchCook: null,
        });
        return NextResponse.json({ ok: true, job: updated });
      }
      const onList = songDeskPlateIds(song);
      const slices = songDeskRowSlices(song, onList);
      const plateFileByShotId: Record<string, string> = {};
      for (const s of job.shots) {
        const f = (s.plateFile || "").trim();
        if (s.shotId && f && f !== "__error__") plateFileByShotId[s.shotId] = f;
      }
      const cuts = syncSongCutsToDesk({
        songPlateIds: onList,
        rowSlices: slices,
        cuts: clearFalseSpokenLineSongFails(song.cuts || []),
        plateFileByShotId,
        songSec: song.durationSec,
        newCutId: () => newId("cut"),
      });
      const nextWin = nextCutAfter(cuts, song.durationSec);
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: {
          ...song,
          cuts,
          songPlateIds: onList,
          rowSlices: slices,
          sliceStartSec: nextWin.startSec,
          sliceDurationSec: nextWin.durationSec,
        },
        error: "",
        scratchCook: null,
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "run") {
      let song = songFromTrackDraft(job.trackDraft, job.scratchSong);
      if (!song?.fileName) {
        return NextResponse.json({ error: "Drop the song mp3 first." }, { status: 400 });
      }
      if (!(song.cuts || []).length && (song.plateTimings || []).length) {
        let hydrated = song.cuts || [];
        for (const timing of song.plateTimings || []) {
          const plateFile =
            (job.shots.find((s) => s.shotId === timing.plateId)?.plateFile || "").trim();
          hydrated = cutFromPlateTiming(hydrated, timing, plateFile, () => newId("cut"));
        }
        song = { ...song, cuts: hydrated };
        job = (await patchMobileGenJob(jobId, { scratchSong: song, error: "" }))!;
      }
      const wantId = String(body.cutId || "").trim();
      const cut =
        (wantId ? (song.cuts || []).find((c) => c.id === wantId) : undefined) ||
        (song.cuts || []).find((c) => c.status !== "done") ||
        (song.cuts || [])[0];
      if (!cut) {
        return NextResponse.json({ error: "Need plate clocks on the song first." }, { status: 400 });
      }
      const found = storyShotForSongCut({
        story,
        jobShots: job.shots,
        cut,
      });
      const hangId = (cut.shotId || "").trim();
      const stillId = hangPlateShotId(hangId) || hangId;
      const jobShot =
        job.shots.find((s) => s.shotId === stillId) ||
        job.shots.find(
          (s) =>
            Boolean((s.plateFile || "").trim()) &&
            (s.plateFile || "").trim() === (cut.plateFile || "").trim(),
        );
      const storyShot = found?.shot;
      const scene = found
        ? story.scenes.find((sc) => sc.id === found.sceneId)
        : undefined;
      const shotId = stillId || (jobShot?.shotId || storyShot?.id || "").trim();
      const sceneId = (jobShot?.sceneId || scene?.id || found?.sceneId || "").trim();
      if (!shotId) {
        return NextResponse.json({ error: "That plate is not on this episode." }, { status: 400 });
      }
      const trumpetBlock = forgottenTrumpetLtxBlockReason({
        job,
        title: storyShot?.title,
        performance: cut.performance,
      });
      if (trumpetBlock) {
        return NextResponse.json({ error: trumpetBlock }, { status: 400 });
      }
      const wantBeat = String(body.beatId || "").trim();
      const borrowed = beatForSongCut({
        story,
        storyShot,
        beatId: wantBeat,
        songFile: song.fileName,
      });
      const beatId =
        (wantBeat && storyShot?.beats.some((b) => b.id === wantBeat) ? wantBeat : "") ||
        borrowed?.id ||
        findSongCarrierBeatId(story, song.fileName, shotId) ||
        storyShot?.beats.find((b) => isMobileSavedVoiceFile(b.voiceFile))?.id ||
        storyShot?.beats[0]?.id ||
        (isMusicVideoSongJob(job) ? wantBeat || song.carrierBeatId || "song-cut" : "") ||
        "";
      if (!beatId) {
        return NextResponse.json({ error: "Lock the episode and draw a plate first." }, { status: 400 });
      }
      try {
        const running: ScratchSongCut[] = (song.cuts || []).map((c) =>
          c.id === cut.id ? { ...c, status: "running", error: "" } : c,
        );
        job = (await patchMobileGenJob(jobId, {
          scratchSong: { ...song, cuts: running },
          error: "",
        }))!;
        const bounds = sliceBoundsForPlate({ song, shotId: hangId || shotId, cut });
        let clipPick: ReturnType<typeof parseScratchClipEngine> = "ltx";
        try {
          clipPick = parseScratchClipEngine(body.clipEngine);
        } catch (e) {
          return NextResponse.json(
            { error: e instanceof Error ? e.message : String(e) },
            { status: 400 },
          );
        }
        if (clipPick === MINIMAX_H3_ID) {
          if (!minimaxVideoConfigured()) {
            return NextResponse.json({ error: "H3 is not on this Studio." }, { status: 400 });
          }
          const asked = Number(body.durationSec ?? bounds.durationSec);
          if (!Number.isFinite(asked) || asked <= 0) {
            return NextResponse.json(
              { error: "Hang the still on the song first." },
              { status: 400 },
            );
          }
          const refuse = refuseMinimaxH3OverMax(asked);
          const durationSec = snapMinimaxH3DurationSec(asked);
          const drawn = await submitScratchMinimaxClip({
            job,
            story,
            shotId: hangId || shotId,
            sceneId,
            beatId,
            durationSec,
            endPlateFile: String(body.endPlateFile || "").trim() || undefined,
            resolution: parseMinimaxH3Resolution(body.resolution),
            camera: parseMinimaxH3Camera(body.h3Camera),
            emptyFrame: body.emptyFrame === true,
            nobodyInShot: body.nobodyInShot === true,
          });
          return NextResponse.json({
            ok: true,
            pending: true,
            job: drawn.job,
            cutId: cut.id,
            backend: "minimax-h3",
            clipEngine: MINIMAX_H3_ID,
            durationSec,
            ...(refuse ? { note: refuse } : {}),
          });
        }
        if (clipPick !== "ltx" && clipPick !== "grok") {
          if (!sirayConfigured()) {
            return NextResponse.json({ error: "Siray is not on this Studio." }, { status: 400 });
          }
          const drawn = await submitScratchSirayClip({
            job,
            story,
            shotId: hangId || shotId,
            sceneId,
            beatId,
            i2v: clipPick,
          });
          return NextResponse.json({
            ok: true,
            pending: true,
            job: drawn.job,
            cutId: cut.id,
            backend: "siray-i2v",
            clipEngine: clipPick,
          });
        }
        const asked = Number(body.durationSec ?? bounds.durationSec);
        const slice = clampSongWindow(
          bounds.startSec,
          asked,
          song.durationSec,
          HANG_LENGTH_MAX_SEC,
        );
        await writeScratchCookProgress(jobId, {
          cutId: cut.id,
          engine: "ltx",
          step: "sending",
          message: "Studio has the Send",
          mute: body.mute === true,
        });
        const updated = await runScratchLtxClip({
          job,
          story,
          shotId: hangId || shotId,
          sceneId,
          beatId,
          plateFile: cut.plateFile,
          sliceStartSec: slice.startSec,
          sliceDurationSec: slice.durationSec,
          cutId: cut.id,
          mute: body.mute === true,
          emptyFrame: body.emptyFrame === true,
          nobodyInShot: body.nobodyInShot === true,
          imageMotion: String(body.imageMotion || "").trim() || undefined,
        });
        return NextResponse.json({
          ok: true,
          job: updated,
          cutId: cut.id,
          label: songWindowLabel(song.durationSec, updated.scratchSong?.cuts || running),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const latest = (await readMobileGenJob(jobId)) || job;
        const failed = await failScratchSongCutRun({
          jobId,
          job: latest,
          cutId: cut.id,
          message: msg,
        });
        return NextResponse.json(
          {
            error: msg,
            job: failed,
          },
          { status: 502 },
        );
      }
    }

    if (action === "clip-poll") {
      const task = job.scratchClip;
      const wantCut = String(body.cutId || "").trim();
      if (!task?.taskId) {
        const wantBeat = String(body.beatId || "").trim();
        const landed = (job.clips || []).find(
          (c) =>
            (!wantBeat || c.beatId === wantBeat) &&
            c.clipFile &&
            c.clipStatus === "done",
        );
        if (landed?.clipFile) {
          const shotId =
            (wantCut
              ? (job.scratchSong?.cuts || []).find((c) => c.id === wantCut)?.shotId || ""
              : "") ||
            String(body.shotId || landed.shotId || "").trim();
          const hung =
            shotId &&
            job.scratchSong &&
            clipOwnsHangPlate(landed.shotId || "", shotId)
              ? hangDoneClipOnTrack({
                  song: job.scratchSong,
                  shotId,
                  plateFile:
                    (
                      job.shots.find((s) => s.shotId === hangPlateShotId(shotId))
                        ?.plateFile || ""
                    ).trim(),
                  clipFile: clipFileBasename(landed.clipFile),
                  durationSec: landed.durationSec,
                  newCutId: () => newId("cut"),
                  ownerShotId: landed.shotId || "",
                })
              : null;
          const recovered = hung
            ? (await patchMobileGenJob(jobId, { scratchSong: hung, error: "" }))!
            : job;
          return NextResponse.json({ ok: true, pending: false, recovered: true, job: recovered });
        }
        return NextResponse.json(
          { error: "No clip in flight — tap Send again. The episode is still there." },
          { status: 400 },
        );
      }
      try {
        const tick = isMinimaxScratchClipTask(task)
          ? await finishScratchMinimaxClip({ job, task })
          : await finishScratchSirayClip({ job, task });
        if (tick.pending) {
          return NextResponse.json({
            ok: true,
            pending: true,
            job: tick.job,
            backend: isMinimaxScratchClipTask(task) ? "minimax-h3" : "siray-i2v",
          });
        }
        const landed = (tick.job.clips || []).find(
          (c) => c.beatId === task.beatId && (c.clipFile || "").trim(),
        );
        const shotId =
          (wantCut
            ? (tick.job.scratchSong?.cuts || []).find((c) => c.id === wantCut)?.shotId || ""
            : "") ||
          String(body.shotId || "").trim() ||
          (task.shotId || "").trim() ||
          (landed?.shotId || "").trim();
        const hung =
          shotId &&
          tick.job.scratchSong &&
          landed?.clipFile &&
          clipOwnsHangPlate(landed.shotId || "", shotId)
            ? hangDoneClipOnTrack({
                song: tick.job.scratchSong,
                shotId,
                plateFile:
                  (
                    tick.job.shots.find((s) => s.shotId === hangPlateShotId(shotId))
                      ?.plateFile || ""
                  ).trim(),
                clipFile: clipFileBasename(landed.clipFile),
                durationSec: landed.durationSec,
                newCutId: () => newId("cut"),
                ownerShotId: landed.shotId || "",
              })
            : null;
        const next = hung
          ? (await patchMobileGenJob(jobId, { scratchSong: hung, error: "" }))!
          : tick.job;
        return NextResponse.json({
          ok: true,
          pending: false,
          job: next,
          backend: isMinimaxScratchClipTask(task) ? "minimax-h3" : "siray-i2v",
        });
      } catch (e) {
        const latest = (await readMobileGenJob(jobId)) || job;
        return NextResponse.json(
          { error: e instanceof Error ? e.message : String(e), job: latest },
          { status: 502 },
        );
      }
    }

    if (action === "stitch") {
      return NextResponse.json(
        {
          error:
            "Stitch is out. Play the finished mp4s in song-clock order. Do not concat.",
        },
        { status: 410 },
      );
    }

    if (action === "hang-plates") {
      const song = songFromTrackDraft(job.trackDraft, job.scratchSong);
      if (!song?.fileName) {
        return NextResponse.json({ error: "Drop the song mp3 first." }, { status: 400 });
      }
      const jobShots = job.shots || [];
      let cuts = (song.cuts || []).map((c) => {
        const shotId = shotIdForSongCut(c, jobShots);
        return shotId && shotId !== (c.shotId || "").trim() ? { ...c, shotId } : c;
      });
      const songNow = { ...song, cuts };
      const extraFiles = listUnhungDoneClips({
        clips: job.clips || [],
        cuts,
        plateTimings: song.plateTimings,
        skipShotIds: song.skipShotIds,
        skipClipFiles: song.skipClipFiles,
      });
      if (!needsDoneClipHang(songNow, jobShots, job.clips || []) && !extraFiles.length) {
        return NextResponse.json({ ok: true, job });
      }
      const needIds = plateIdsNeedingDoneClipHang({
        song: songNow,
        clips: job.clips || [],
        jobShots,
      });
      const rows = doneClipRowsForHang({
        cuts,
        clips: job.clips || [],
        jobShots,
        skipShotIds: song.skipShotIds,
        skipClipFiles: song.skipClipFiles,
      }).filter((row) => needIds.includes(row.shotId));
      const hangCuts = rows.map((row) => ({
        shotId: row.shotId,
        startSec: 0,
        durationSec: row.durationSec,
      }));
      let plateTimings = hangMissingPlateTimings(song.plateTimings, hangCuts, []);
      // File first. Do not run cutFromPlateTiming here — that collapse
      // dropped a hung done clipFile (previous clip 2) when leftover hang
      // wrote the same shotId again.
      const extra = hangUnhungDoneClips({
        plateTimings,
        cuts,
        clips: job.clips || [],
        skipShotIds: song.skipShotIds,
        skipClipFiles: song.skipClipFiles,
        plateFileFor: (id) =>
          (jobShots.find((s) => s.shotId === id)?.plateFile || "").trim(),
        newCutId: () => newId("cut"),
      });
      cuts = extra.cuts;
      plateTimings = extra.plateTimings;
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: { ...song, cuts, plateTimings },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "hang-clip") {
      const song = songFromTrackDraft(job.trackDraft, job.scratchSong);
      if (!song?.fileName) {
        return NextResponse.json({ error: "Drop the song mp3 first." }, { status: 400 });
      }
      const clipFile = clipFileBasename(String(body.clipFile || ""));
      if (!clipFile) {
        return NextResponse.json({ error: "Need a clip file." }, { status: 400 });
      }
      const fromClip = (job.clips || []).find((c) => stackedClipFiles(c).includes(clipFile));
      const fromCut = (song.cuts || []).find((c) => clipFileBasename(c.clipFile || "") === clipFile);
      const shotId = hangPlateShotId(
        String(body.shotId || fromClip?.shotId || fromCut?.shotId || "").trim(),
      );
      if (!shotId) {
        return NextResponse.json({ error: "Need a still for that clip." }, { status: 400 });
      }
      const plateFile =
        (job.shots.find((s) => s.shotId === shotId)?.plateFile || "").trim() ||
        (fromCut?.plateFile || "").trim();
      const hung = hangOneClipOnWave({
        plateTimings: song.plateTimings,
        cuts: song.cuts || [],
        shotId,
        plateFile,
        clipFile,
        durationSec: fromClip?.durationSec ?? fromCut?.durationSec,
        newCutId: () => newId("cut"),
      });
      if (!hung) {
        return NextResponse.json({ error: "Couldn't hang that clip." }, { status: 400 });
      }
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: {
          ...song,
          cuts: hung.cuts,
          plateTimings: hung.plateTimings,
          skipClipFiles: (song.skipClipFiles || []).filter((f) => f !== clipFile),
        },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "add-plate") {
      let song = songFromTrackDraft(job.trackDraft, job.scratchSong);
      const shotId = String(body.shotId || "").trim();
      if (!song?.fileName) {
        return NextResponse.json({ error: "Drop the song mp3 first." }, { status: 400 });
      }
      if (!shotId) {
        return NextResponse.json({ error: "Need a plate to add." }, { status: 400 });
      }
      song = { ...song, cuts: clearStuckSongCooks(song.cuts || []) };
      const shot = job.shots.find((s) => s.shotId === shotId);
      const plateFile = (shot?.plateFile || "").trim();
      if (!plateFile || plateFile === "__error__") {
        const copied = await copyPlaceStillAsEmptyPlate({
          job,
          sceneId: shot?.sceneId || "",
        });
        if (!copied) {
          return NextResponse.json(
            { error: "Need the place still first — then Add empty stage." },
            { status: 400 },
          );
        }
        const placeName =
          job.scenes.find((sc) => sc.id === shot?.sceneId)?.placeName ||
          story.scenes.find((sc) => sc.id === shot?.sceneId)?.placeName ||
          "";
        const landed = await landEpisodePlateStill({
          job,
          story,
          shotId,
          fileName: copied,
          staging: emptyStageFarOutStaging(placeName),
        });
        job = landed.job;
        if (!job) {
          return NextResponse.json({ error: "Couldn't add that still." }, { status: 500 });
        }
      }
      if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
      const livePlate =
        (job.shots.find((s) => s.shotId === shotId)?.plateFile || "").trim();
      const storyShot = findStoryShot(story, shotId);
      const singing = addPlateIsSingingHang({
        mute: body.mute === true,
        emptyFrame: body.emptyFrame === true,
        nobodyInShot: body.nobodyInShot === true,
        support: body.support === true || isSupportShot(storyShot),
      });
      // applyAddPlateOnSong → addPlateFileFirstHang. fileFirst.hung /
      // alreadyHung live there. Empty wave starts at 0 + slider seconds.
      // Singing after a real hang uses lyricCues (0:31 Silver lines),
      // not max(endMs) after intro clips.
      // Other bars keep their times. Keep done clips. Slider duration stays.
      const added = applyAddPlateOnSong({
        shotId,
        plateFile: livePlate,
        plateTimings: song.plateTimings,
        cuts: song.cuts || [],
        clips: job.clips || [],
        skipShotIds: song.skipShotIds,
        skipClipFiles: song.skipClipFiles,
        songPlateIds: song.songPlateIds,
        rowSlices: song.rowSlices,
        songSec: song.durationSec,
        durationSec: body.durationSec,
        singing,
        lyricCues: song.lyricCues || job.trackDraft?.lyricCues,
        newCutId: () => newId("cut"),
      });
      const nextWin = nextCutAfter(added.cuts, song.durationSec);
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: {
          ...song,
          cuts: added.cuts,
          plateTimings: added.plateTimings,
          songPlateIds: added.songPlateIds,
          rowSlices: added.rowSlices,
          skipShotIds: added.skipShotIds,
          sliceStartSec: nextWin.startSec,
          sliceDurationSec: nextWin.durationSec,
        },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "set-row-slices") {
      let song = songFromTrackDraft(job.trackDraft, job.scratchSong);
      if (!song?.fileName) {
        return NextResponse.json({ error: "Drop the song mp3 first." }, { status: 400 });
      }
      song = { ...song, cuts: clearStuckSongCooks(song.cuts || []) };
      if ((song.cuts || []).some((c) => c.status === "done")) {
        return NextResponse.json(
          { error: "Clips already done — leave the times, or take rows off with × and Add again." },
          { status: 400 },
        );
      }
      const onList = songDeskPlateIds(song);
      const rawIndex = body.listIndex;
      const listIndex =
        typeof rawIndex === "number" && Number.isInteger(rawIndex) ? rawIndex : -1;
      if (listIndex < 0 || listIndex >= onList.length) {
        return NextResponse.json({ error: "That row is not on the song list." }, { status: 400 });
      }
      const slices = withRowSliceAt(
        songDeskRowSlices(song, onList),
        listIndex,
        Number(body.count),
      );
      const plateFileByShotId: Record<string, string> = {};
      for (const s of job.shots) {
        const f = (s.plateFile || "").trim();
        if (s.shotId && f && f !== "__error__") plateFileByShotId[s.shotId] = f;
      }
      const cuts = rebuildSongCutsFromDesk({
        songPlateIds: onList,
        rowSlices: slices,
        plateFileByShotId,
        songSec: song.durationSec,
        newCutId: () => newId("cut"),
      });
      const nextWin = nextCutAfter(cuts, song.durationSec);
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: {
          ...song,
          cuts,
          rowSlices: slices,
          sliceStartSec: nextWin.startSec,
          sliceDurationSec: nextWin.durationSec,
        },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "skip-plate") {
      let song = job.scratchSong;
      const shotId = String(body.shotId || "").trim();
      if (!song || !shotId) {
        return NextResponse.json({ error: "Need a plate to leave the song." }, { status: 400 });
      }
      song = { ...song, cuts: clearStuckSongCooks(song.cuts || []) };
      const onList = songDeskPlateIds(song);
      const rawIndex = body.listIndex;
      const listIndex =
        typeof rawIndex === "number" && Number.isInteger(rawIndex)
          ? rawIndex
          : onList.findIndex((id) => id === shotId);
      if (listIndex < 0 || listIndex >= onList.length || onList[listIndex] !== shotId) {
        return NextResponse.json({ error: "That plate is not on the song list." }, { status: 400 });
      }
      const nextIds = withoutSongPlateAt(onList, listIndex);
      const nextSlices = withoutSongRowSliceAt(songDeskRowSlices(song, onList), listIndex);
      const stillOnList = nextIds.includes(shotId);
      const plateFileByShotId: Record<string, string> = {};
      for (const s of job.shots) {
        const f = (s.plateFile || "").trim();
        if (s.shotId && f && f !== "__error__") plateFileByShotId[s.shotId] = f;
      }
      const cuts = syncSongCutsToDesk({
        songPlateIds: nextIds,
        rowSlices: nextSlices,
        cuts: song.cuts || [],
        plateFileByShotId,
        songSec: song.durationSec,
        newCutId: () => newId("cut"),
      });
      const nextWin = nextCutAfter(cuts, song.durationSec);
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: {
          ...song,
          cuts,
          songPlateIds: nextIds,
          rowSlices: nextSlices,
          skipShotIds: stillOnList
            ? skipSongPlateIds(song)
            : withSkippedSongPlate(skipSongPlateIds(song), shotId),
          sliceStartSec: nextWin.startSec,
          sliceDurationSec: nextWin.durationSec,
        },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "redo-cut") {
      const song = job.scratchSong;
      const cutId = String(body.cutId || "").trim();
      if (!song || !cutId) {
        return NextResponse.json({ error: "Need a cut to redo." }, { status: 400 });
      }
      const cut = (song.cuts || []).find((c) => c.id === cutId);
      if (!cut) {
        return NextResponse.json({ error: "That cut is not on the song." }, { status: 400 });
      }
      const plan = planParkDeskClipTake({
        clips: job.clips || [],
        song,
        cutId,
        fileName: cut.clipFile || "",
      });
      if (isEpisodeClipPlanError(plan)) {
        return NextResponse.json({ error: plan.error }, { status: plan.status });
      }
      for (const file of plan.filesToPark) {
        parkMobileClipFile(file);
      }
      const updated = await patchMobileGenJob(jobId, {
        clips: plan.next,
        scratchSong: plan.nextSong || song,
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated, stoppedCook: plan.stoppedCook });
    }

    if (action === "remove-stitch") {
      const song = job.scratchSong;
      const file = (song?.stitchedFile || "").trim();
      if (!song || !file) {
        return NextResponse.json({ error: "No stitch on this song." }, { status: 400 });
      }
      parkMobileClipFile(file);
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: { ...song, stitchedFile: "" },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "set-lyrics") {
      const lyrics = String((body as { lyrics?: string }).lyrics ?? "");
      const updated = await patchMobileGenJob(jobId, { lyrics, error: "" });
      return NextResponse.json({ ok: true, job: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
