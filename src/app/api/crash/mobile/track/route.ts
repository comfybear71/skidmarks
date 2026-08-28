import { NextResponse } from "next/server";
import { readMobileStory } from "@/lib/mobileStoryStore";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import {
  applyForgottenWhoPlays,
  canApplyForgottenWhoPlays,
} from "@/lib/forgottenWhoPlays";
import {
  cutFromPlateTiming,
  hangPlateShotId,
  secToMs,
  songFromTrackDraft,
  swapNeighborPlateTimings,
  withPlateDuration,
  withPlateWindow,
  type LyricCue,
  type MusicVideoTrackDraft,
  type PlateTiming,
  type TrackSectionMarker,
} from "@/lib/musicVideoTrack";
import { isMusicVideoSongJob, removePlateFromSong } from "@/lib/musicVideoSong";
import { parkMobileClipFile } from "@/lib/mobileClipPark";
import { parseStockLook, stockLookIsOn } from "@/lib/stockLook";
import { newId } from "@/lib/types";

export const runtime = "nodejs";

function cleanPeaks(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const peaks = raw
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 1);
  return peaks.length ? peaks : undefined;
}

function cleanMarkers(raw: unknown): TrackSectionMarker[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: TrackSectionMarker[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const id = String(rec.id || "").trim() || newId("marker");
    const label = String(rec.label || "custom").trim() || "custom";
    const startMs = Math.max(0, Math.round(Number(rec.startMs) || 0));
    const endMs = Math.max(startMs + 100, Math.round(Number(rec.endMs) || startMs + 1000));
    out.push({ id, label, startMs, endMs });
  }
  return out.length ? out : undefined;
}

function cleanPlateTimings(raw: unknown): PlateTiming[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: PlateTiming[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const plateId = String(rec.plateId || "").trim();
    if (!plateId) continue;
    const startMs = Math.max(0, Math.round(Number(rec.startMs) || 0));
    const endMs = Math.max(startMs + 100, Math.round(Number(rec.endMs) || startMs + 1000));
    const sortIndex = Math.round(Number(rec.sortIndex) || out.length);
    out.push({ plateId, startMs, endMs, sortIndex });
  }
  return out.length ? out : undefined;
}

/**
 * POST /api/crash/mobile/track
 *   save-draft — pre-lock peaks/markers/timings on job.trackDraft
 *   save-track — post-lock peaks/markers on scratchSong
 *   set-plate-timing — one plate in/out (+ sync cut row when plate exists)
 *   set-plate-duration — 5 / 15 / 25 chips. Followers slide. No cook.
 *   move-plate — swap this still with the earlier or later slot. No cook.
 *   set-who-plays — Forgotten Jack sings + muted trumpet actually plays. Sax stays off.
 *   set-stock-look — free-film theme / colour / type for Support searches
 *   set-plate-timings — persist a drag-handle stretch. Other stills keep their times. No cook.
 *   remove-plate-timing — take one still off the wave and song list. Park clip if any. Never delete. Do not append.
 */
/** Cue rows come off the phone — keep only well-formed, ordered pins. */
function cleanLyricCues(raw: unknown): LyricCue[] {
  if (!Array.isArray(raw)) return [];
  const out: LyricCue[] = [];
  for (const item of raw) {
    const cue = item as { lineIndex?: unknown; atMs?: unknown };
    const lineIndex = Math.round(Number(cue.lineIndex));
    const atMs = Math.round(Number(cue.atMs));
    if (!Number.isFinite(lineIndex) || lineIndex < 0) continue;
    if (!Number.isFinite(atMs) || atMs < 0) continue;
    if (out.some((c) => c.lineIndex === lineIndex)) continue;
    out.push({ lineIndex, atMs });
  }
  return out.sort((a, b) => a.atMs - b.atMs);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    jobId?: string;
    waveformPeaks?: number[];
    sectionMarkers?: TrackSectionMarker[];
    plateTimings?: PlateTiming[];
    plateId?: string;
    startMs?: number;
    endMs?: number;
    sortIndex?: number;
    direction?: string;
    durationSec?: number;
    startSec?: number;
    lyricCues?: LyricCue[];
    stockLook?: unknown;
  };
  const action = String(body.action || "").trim();
  const jobId = String(body.jobId || "").trim();
  if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

  let job = await readMobileGenJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!isMusicVideoSongJob(job)) {
    return NextResponse.json({ error: "TRACK is Music video only." }, { status: 400 });
  }

  try {
    if (action === "save-draft") {
      const draft: MusicVideoTrackDraft = {
        ...(job.trackDraft || {}),
        ...(body.waveformPeaks !== undefined ? { waveformPeaks: cleanPeaks(body.waveformPeaks) } : {}),
        ...(body.sectionMarkers !== undefined
          ? { sectionMarkers: cleanMarkers(body.sectionMarkers) || [] }
          : {}),
        ...(body.plateTimings !== undefined
          ? { plateTimings: cleanPlateTimings(body.plateTimings) || [] }
          : {}),
        ...(body.lyricCues !== undefined ? { lyricCues: cleanLyricCues(body.lyricCues) } : {}),
      };
      const updated = await patchMobileGenJob(jobId, { trackDraft: draft, error: "" });
      return NextResponse.json({ ok: true, job: updated, trackDraft: draft });
    }

    if (action === "save-track") {
      const song = job.scratchSong;
      if (!song?.fileName) {
        return NextResponse.json({ error: "Add the song before you time plates." }, { status: 400 });
      }
      const nextSong = {
        ...song,
        ...(body.waveformPeaks !== undefined ? { waveformPeaks: cleanPeaks(body.waveformPeaks) } : {}),
        ...(body.sectionMarkers !== undefined
          ? { sectionMarkers: cleanMarkers(body.sectionMarkers) || [] }
          : {}),
        ...(body.lyricCues !== undefined ? { lyricCues: cleanLyricCues(body.lyricCues) } : {}),
      };
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: nextSong,
        trackDraft: null,
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "set-lyric-cues") {
      const cues = cleanLyricCues(body.lyricCues);
      const song = job.scratchSong;
      // Pre-lock the song has no row yet — park the cues on the draft, same
      // as peaks and markers, and let the mp3 attach merge them.
      const updated = song?.fileName
        ? await patchMobileGenJob(jobId, {
            scratchSong: { ...song, lyricCues: cues },
            error: "",
          })
        : await patchMobileGenJob(jobId, {
            trackDraft: { ...(job.trackDraft || {}), lyricCues: cues },
            error: "",
          });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "drop-song") {
      // Park it, never delete it: the mp3 stays in Blob, the desk just stops
      // pointing at it, so dropping a song can never lose the file.
      const draft = { ...(job.trackDraft || {}) };
      delete draft.songFile;
      delete draft.songDurationSec;
      delete draft.waveformPeaks;
      const song = job.scratchSong;
      // Song-only attach (no spoken beat) — clear the pointer. A carrier
      // beat is a Saved line; this desk never unhooks that.
      const parkPointer = Boolean((song?.fileName || "").trim() && !(song?.carrierBeatId || "").trim());
      const updated = await patchMobileGenJob(jobId, {
        trackDraft: draft,
        ...(parkPointer && song ? { scratchSong: { ...song, fileName: "" } } : {}),
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "set-plate-timing") {
      const song = songFromTrackDraft(job.trackDraft, job.scratchSong);
      if (!song?.fileName) {
        return NextResponse.json({ error: "Add the song before you time plates." }, { status: 400 });
      }
      const plateId = String(body.plateId || "").trim();
      if (!plateId) return NextResponse.json({ error: "Need plateId" }, { status: 400 });
      const startMs = Math.max(0, Math.round(Number(body.startMs) || 0));
      const endMs = Math.max(startMs + 100, Math.round(Number(body.endMs) || startMs + 15000));
      const sortIndex = Math.round(Number(body.sortIndex) ?? (song.plateTimings || []).length);
      const timing: PlateTiming = { plateId, startMs, endMs, sortIndex };
      const plateTimings = [
        ...(song.plateTimings || []).filter((p) => p.plateId !== plateId),
        timing,
      ];
      const shot = job.shots.find((s) => s.shotId === hangPlateShotId(plateId));
      const plateFile = (shot?.plateFile || "").trim();
      let cuts = song.cuts || [];
      if (plateFile && plateFile !== "__error__") {
        cuts = cutFromPlateTiming(cuts, timing, plateFile, () => newId("cut"));
      }
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: { ...song, plateTimings, cuts },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated, timing });
    }

    if (action === "set-plate-duration") {
      const song = songFromTrackDraft(job.trackDraft, job.scratchSong);
      if (!song?.fileName) {
        return NextResponse.json({ error: "Add the song before you time plates." }, { status: 400 });
      }
      const plateId = String(body.plateId || "").trim();
      if (!plateId) return NextResponse.json({ error: "Need plateId" }, { status: 400 });
      const songMs = secToMs(song.durationSec);
      const durationMs = secToMs(Number(body.durationSec));
      const askedStart = Number(body.startSec);
      const plateTimings =
        Number.isFinite(askedStart) && askedStart >= 0
          ? withPlateWindow(song.plateTimings, plateId, secToMs(askedStart), durationMs, songMs)
          : withPlateDuration(song.plateTimings, plateId, durationMs, songMs);
      if (!plateTimings) {
        return NextResponse.json({ error: "Put that still on the song first." }, { status: 400 });
      }
      let cuts = song.cuts || [];
      for (const timing of plateTimings) {
        const plateFile = (job.shots.find((s) => s.shotId === hangPlateShotId(timing.plateId))?.plateFile || "").trim();
        if (!plateFile || plateFile === "__error__") continue;
        cuts = cutFromPlateTiming(cuts, timing, plateFile, () => newId("cut"));
      }
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: { ...song, plateTimings, cuts },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "move-plate") {
      const song = songFromTrackDraft(job.trackDraft, job.scratchSong);
      if (!song?.fileName) {
        return NextResponse.json({ error: "Add the song before you time plates." }, { status: 400 });
      }
      const plateId = String(body.plateId || "").trim();
      if (!plateId) return NextResponse.json({ error: "Need plateId" }, { status: 400 });
      const direction = body.direction === "later" ? 1 : body.direction === "earlier" ? -1 : 0;
      if (!direction) {
        return NextResponse.json({ error: "Need earlier or later." }, { status: 400 });
      }
      const plateTimings = swapNeighborPlateTimings(song.plateTimings || [], plateId, direction);
      if (!plateTimings) {
        return NextResponse.json(
          { error: "That plate is already at the end of the song." },
          { status: 400 },
        );
      }
      let cuts = song.cuts || [];
      for (const timing of plateTimings) {
        const plateFile = (job.shots.find((s) => s.shotId === hangPlateShotId(timing.plateId))?.plateFile || "").trim();
        if (!plateFile || plateFile === "__error__") continue;
        cuts = cutFromPlateTiming(cuts, timing, plateFile, () => newId("cut"));
      }
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: { ...song, plateTimings, cuts },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "set-who-plays") {
      const song = job.scratchSong;
      if (!song?.fileName) {
        return NextResponse.json({ error: "Add the song before you time plates." }, { status: 400 });
      }
      if (!canApplyForgottenWhoPlays(job)) {
        return NextResponse.json({ error: "Who-plays is Forgotten only." }, { status: 400 });
      }
      const story = await readMobileStory(job.styleId, job.folderName);
      const shots = (story.scenes || []).flatMap((sc) =>
        (sc.shots || []).map((sh) => ({
          shotId: sh.id,
          plateFile: (sh.plateFile || job.shots.find((s) => s.shotId === sh.id)?.plateFile || "").trim(),
          title: (sh.title || "").trim(),
        })),
      );
      const laid = applyForgottenWhoPlays({
        song,
        shots,
        newCutId: () => newId("cut"),
      });
      if ("error" in laid) {
        return NextResponse.json({ error: laid.error }, { status: 400 });
      }
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: {
          ...song,
          plateTimings: laid.plateTimings,
          cuts: laid.cuts,
        },
        error: "",
      });
      return NextResponse.json({
        ok: true,
        job: updated,
        added: laid.cuts.length,
      });
    }

    if (action === "set-stock-look") {
      const look = parseStockLook(body.stockLook);
      const updated = await patchMobileGenJob(jobId, {
        stockLook: stockLookIsOn(look) ? look : null,
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated, stockLook: look });
    }

    if (action === "set-plate-timings") {
      const song = songFromTrackDraft(job.trackDraft, job.scratchSong);
      if (!song?.fileName) {
        return NextResponse.json({ error: "Add the song before you time plates." }, { status: 400 });
      }
      const plateTimings = cleanPlateTimings(body.plateTimings);
      if (!plateTimings) {
        return NextResponse.json({ error: "Need plate timings." }, { status: 400 });
      }
      let cuts = song.cuts || [];
      for (const timing of plateTimings) {
        const plateFile = (job.shots.find((s) => s.shotId === hangPlateShotId(timing.plateId))?.plateFile || "").trim();
        if (!plateFile || plateFile === "__error__") continue;
        cuts = cutFromPlateTiming(cuts, timing, plateFile, () => newId("cut"));
      }
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: { ...song, plateTimings, cuts },
        error: "",
      });
      return NextResponse.json({ ok: true, job: updated });
    }

    if (action === "remove-plate-timing") {
      const song = songFromTrackDraft(job.trackDraft, job.scratchSong);
      if (!song) return NextResponse.json({ ok: true, job });
      const plateId = String(body.plateId || "").trim();
      if (!plateId) return NextResponse.json({ error: "Need plateId" }, { status: 400 });
      const next = removePlateFromSong({
        plateId,
        plateTimings: song.plateTimings,
        cuts: song.cuts,
        songPlateIds: song.songPlateIds,
        rowSlices: song.rowSlices,
        skipShotIds: song.skipShotIds,
        jobShots: job.shots,
      });
      for (const file of next.parkedClipFiles) parkMobileClipFile(file);
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: {
          ...song,
          plateTimings: next.plateTimings,
          cuts: next.cuts,
          songPlateIds: next.songPlateIds,
          rowSlices: next.rowSlices,
          skipShotIds: next.skipShotIds,
        },
        error: "",
      });
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
