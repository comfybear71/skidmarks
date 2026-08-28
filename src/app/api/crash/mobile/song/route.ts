import { NextResponse } from "next/server";
import { readMobileStory } from "@/lib/mobileStoryStore";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import { failScratchSongCutRun, runScratchLtxClip } from "@/lib/mobileScratchClip";
import { newId } from "@/lib/types";
import { nextCutAfter, songWindowLabel, type ScratchSongCut } from "@/lib/scratchSongSlice";
import {
  findSongCarrierBeatId,
  isMusicVideoSongJob,
  needsTrackHang,
  plateIdsWaitingForTrack,
  shotIdForSongCut,
  storyShotForSongCut,
  plateSliceWindows,
  clearStuckSongCooks,
  rebuildSongCutsFromDesk,
  songDeskPlateIds,
  songDeskRowSlices,
  skipSongPlateIds,
  syncSongCutsToDesk,
  withRowSliceAt,
  withSongPlate,
  withSongRowSlice,
  withoutPlateParkedCuts,
  withoutSongPlateAt,
  withoutSongRowSliceAt,
  withSkippedSongPlate,
  withoutSkippedSongPlate,
} from "@/lib/musicVideoSong";
import { isMobileSavedVoiceFile } from "@/lib/mobileSavedVoice";
import { parkMobileClipFile } from "@/lib/mobileClipPark";
import { copyPlaceStillAsEmptyPlate } from "@/lib/mobilePlateMedia";
import { landEpisodePlateStill } from "@/lib/mobilePlateRebuild";
import { emptyStageFarOutStaging } from "@/lib/emptyStagePlate";
import { cutFromPlateTiming, hangMissingPlateTimings, sliceBoundsForPlate } from "@/lib/musicVideoTrack";
import { forgottenTrumpetLtxBlockReason } from "@/lib/forgottenWhoPlays";

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
 *   run — one LTX slice. Client polls the job if the phone drops.
 *   stitch — rejected. Finish is ordered unstitched mp4s.
 *   remove-stitch — park a leftover joined mp4 if one exists.
 *   hang-plates — write missing plateTimings for song-list / cut stills. No leftover job.shots. No cook.
 *   redo-cut — park that clip, leave the still, wait for Send again.
 *   add-plate — put a plate on the list at 1 × 15s (same plate again = another row).
 *   set-row-slices — −/+ on a list row; rebuilds the cut times.
 *   skip-plate — take one list row off. Plate card stays.
 *   List edits clear stuck cooks first — a hung LTX must not lock Add forever.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    jobId?: string;
    shotId?: string;
    cutId?: string;
    count?: number;
    beatId?: string;
    listIndex?: number;
  };
  const action = String(body.action || "").trim();
  const jobId = String(body.jobId || "").trim();
  if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

  let job = await readMobileGenJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!isMusicVideoSongJob(job)) {
    return NextResponse.json({ error: "Song cuts on /m are Music video only." }, { status: 400 });
  }
  const story = await readMobileStory(job.styleId, job.folderName);

  try {
    if (action === "assign") {
      const song = job.scratchSong;
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
        const cuts = clearStuckSongCooks(song.cuts || []);
        const updated = await patchMobileGenJob(jobId, {
          scratchSong: { ...song, cuts },
          error: "",
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
          songPlateIds: onList,
          rowSlices: slices,
          sliceStartSec: nextWin.startSec,
          sliceDurationSec: nextWin.durationSec,
        },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "run") {
      let song = job.scratchSong;
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
      const storyShot = found?.shot;
      const scene = found
        ? story.scenes.find((sc) => sc.id === found.sceneId)
        : undefined;
      const shotId = (storyShot?.id || "").trim();
      if (!scene || !storyShot || !shotId) {
        return NextResponse.json({ error: "That plate is not on this episode." }, { status: 400 });
      }
      const trumpetBlock = forgottenTrumpetLtxBlockReason({
        job,
        title: storyShot.title,
        performance: cut.performance,
      });
      if (trumpetBlock) {
        return NextResponse.json({ error: trumpetBlock }, { status: 400 });
      }
      const wantBeat = String(body.beatId || "").trim();
      const beatId =
        (wantBeat && storyShot.beats.some((b) => b.id === wantBeat) ? wantBeat : "") ||
        findSongCarrierBeatId(story, song.fileName, shotId) ||
        storyShot.beats.find((b) => isMobileSavedVoiceFile(b.voiceFile))?.id ||
        storyShot.beats[0]?.id ||
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
        const updated = await runScratchLtxClip({
          job,
          story,
          shotId,
          sceneId: scene.id,
          beatId,
          plateFile: cut.plateFile,
          ...(() => {
            const bounds = sliceBoundsForPlate({ song, shotId, cut });
            return {
              sliceStartSec: bounds.startSec,
              sliceDurationSec: bounds.durationSec,
            };
          })(),
          cutId: cut.id,
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
      const song = job.scratchSong;
      if (!song?.fileName) {
        return NextResponse.json({ error: "Drop the song mp3 first." }, { status: 400 });
      }
      const jobShots = job.shots || [];
      const cuts = (song.cuts || []).map((c) => {
        const shotId = shotIdForSongCut(c, jobShots);
        return shotId && shotId !== (c.shotId || "").trim() ? { ...c, shotId } : c;
      });
      if (!needsTrackHang({ ...song, cuts }, jobShots)) {
        return NextResponse.json({ ok: true, job });
      }
      const extraIds = plateIdsWaitingForTrack({ song: { ...song, cuts }, jobShots });
      const hangCuts = cuts.filter((c) =>
        extraIds.includes(shotIdForSongCut(c, jobShots)),
      );
      const plateTimings = hangMissingPlateTimings(song.plateTimings, hangCuts, extraIds);
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: { ...song, cuts, plateTimings },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "add-plate") {
      let song = job.scratchSong;
      const shotId = String(body.shotId || "").trim();
      if (!song || !shotId) {
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
      }
      if (!job) {
        return NextResponse.json({ error: "Need a plate to add." }, { status: 400 });
      }
      const jobShots = job.shots || [];
      const onList = songDeskPlateIds(song);
      const slices = withSongRowSlice(songDeskRowSlices(song, onList));
      const nextIds = withSongPlate(onList, shotId);
      const plateFileByShotId: Record<string, string> = {};
      for (const s of jobShots) {
        const f = (s.plateFile || "").trim();
        if (s.shotId && f && f !== "__error__") plateFileByShotId[s.shotId] = f;
      }
      // Keep done clips — rebuild alone wiped greens when adding a plate.
      const cuts = syncSongCutsToDesk({
        songPlateIds: nextIds,
        rowSlices: slices,
        cuts: song.cuts || [],
        plateFileByShotId,
        songSec: song.durationSec,
        newCutId: () => newId("cut"),
      });
      const nextWin = nextCutAfter(cuts, song.durationSec);
      const extraIds = plateIdsWaitingForTrack({
        song: { ...song, cuts, songPlateIds: nextIds },
        jobShots,
      });
      const hangCuts = cuts.filter((c) =>
        extraIds.includes(shotIdForSongCut(c, jobShots)),
      );
      const plateTimings = hangMissingPlateTimings(song.plateTimings, hangCuts, extraIds);
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: {
          ...song,
          cuts,
          plateTimings,
          songPlateIds: nextIds,
          rowSlices: slices,
          skipShotIds: withoutSkippedSongPlate(skipSongPlateIds(song), shotId),
          sliceStartSec: nextWin.startSec,
          sliceDurationSec: nextWin.durationSec,
        },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "set-row-slices") {
      let song = job.scratchSong;
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
      if (cut.status === "running") {
        return NextResponse.json({ error: "Stop send first." }, { status: 409 });
      }
      const file = (cut.clipFile || "").trim();
      if (file) parkMobileClipFile(file);
      const cuts = (song.cuts || []).map((c) =>
        c.id === cutId
          ? { ...c, status: "pending" as const, clipFile: "", error: "" }
          : c,
      );
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: { ...song, cuts },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
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
