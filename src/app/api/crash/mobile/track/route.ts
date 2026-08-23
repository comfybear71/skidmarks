import { NextResponse } from "next/server";
import { readMobileStory } from "@/lib/mobileStoryStore";
import { patchMobileGenJob, readMobileGenJob } from "@/lib/mobileGenJob";
import {
  cutFromPlateTiming,
  songFromTrackDraft,
  type LyricCue,
  type MusicVideoTrackDraft,
  type PlateTiming,
  type TrackSectionMarker,
} from "@/lib/musicVideoTrack";
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
 *   remove-plate-timing — clear one plate schedule
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
    lyricCues?: LyricCue[];
  };
  const action = String(body.action || "").trim();
  const jobId = String(body.jobId || "").trim();
  if (!jobId) return NextResponse.json({ error: "Need jobId" }, { status: 400 });

  let job = await readMobileGenJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

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
      const shot = job.shots.find((s) => s.shotId === plateId);
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

    if (action === "remove-plate-timing") {
      const song = job.scratchSong;
      if (!song) return NextResponse.json({ ok: true, job });
      const plateId = String(body.plateId || "").trim();
      if (!plateId) return NextResponse.json({ error: "Need plateId" }, { status: 400 });
      const updated = await patchMobileGenJob(jobId, {
        scratchSong: {
          ...song,
          plateTimings: (song.plateTimings || []).filter((p) => p.plateId !== plateId),
          cuts: (song.cuts || []).filter((c) => c.shotId !== plateId),
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
