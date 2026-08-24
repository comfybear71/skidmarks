/**
 * Forgotten — who is on the mp3. Stuie marked these 2026-08-24.
 * Jack only on the vocal hits. Horn fades in, actually plays, fades out,
 * then revolves back. Gaps are animation intermissions (concert loop later).
 * There is no saxophone on this mix. Jack's face stays hidden.
 * Lots of Jack slices walk away from camera (silhouette). Some stay sing
 * so body, hands, and high notes still happen.
 * Do not mint a job from this file. Do not generate the concert loop yet.
 */
import { isForgottenSongJob, isJackWalkStartSec } from "./musicVideoGroupPlate";
import type { PlateTiming } from "./musicVideoTrack";
import { secToMs } from "./musicVideoTrack";
import {
  clampSongSliceDuration,
  SCRATCH_SONG_SLICE_MAX_SEC,
  SCRATCH_SONG_SLICE_MIN_SEC,
  type ScratchSong,
  type ScratchSongCut,
} from "./scratchSongWindow";

export type ForgottenWho = "horn" | "jack";
export type ForgottenPerformance = "play" | "sway" | "sing" | "walk";

export type ForgottenWhoCue = {
  who: ForgottenWho;
  startSec: number;
  endSec: number;
  performance: ForgottenPerformance;
};

/** First trumpet broke at ~13s with invented hat text. Split before that. */
const FIRST_TRUMPET_SPLIT_SEC = 12;

/**
 * People on the mix. Overlaps are both clips, not a stitch.
 * Jack sway is not a people cut — those windows are intermissions.
 */
export const FORGOTTEN_WHO_PLAYS: ForgottenWhoCue[] = [
  { who: "horn", startSec: 1, endSec: 23, performance: "play" },
  { who: "jack", startSec: 46, endSec: 117, performance: "sing" },
  { who: "horn", startSec: 110, endSec: 119, performance: "play" },
  { who: "jack", startSec: 126, endSec: 195, performance: "sing" },
  { who: "horn", startSec: 189, endSec: 195, performance: "play" },
  { who: "horn", startSec: 206, endSec: 221, performance: "play" },
  { who: "jack", startSec: 221, endSec: 270, performance: "sing" },
  { who: "horn", startSec: 268, endSec: 270, performance: "play" },
  { who: "horn", startSec: 285, endSec: 291, performance: "play" },
];

export type ForgottenIntermission = { startSec: number; endSec: number; kind: "anim" };

const INTERMISSION_MIN_SEC = 2;

/** Gaps with no Jack vocal and no trumpet — animation inserts later. */
export function forgottenIntermissions(songSec: number): ForgottenIntermission[] {
  const song = Number.isFinite(songSec) && songSec > 0 ? songSec : 291.48;
  const spans = FORGOTTEN_WHO_PLAYS
    .map((c) => ({ start: c.startSec, end: c.endSec }))
    .sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (!last || s.start > last.end) merged.push({ ...s });
    else last.end = Math.max(last.end, s.end);
  }
  const gaps: ForgottenIntermission[] = [];
  let at = 0;
  for (const s of merged) {
    if (s.start - at >= INTERMISSION_MIN_SEC) {
      gaps.push({ startSec: at, endSec: s.start, kind: "anim" });
    }
    at = Math.max(at, s.end);
  }
  if (song - at >= INTERMISSION_MIN_SEC) {
    gaps.push({ startSec: at, endSec: song, kind: "anim" });
  }
  return gaps;
}

export function isSaxTitle(title: string): boolean {
  return /\bsax/i.test(title || "");
}

export function isJackSoloTitle(title: string): boolean {
  const t = (title || "").trim();
  return /^jack ghost$/i.test(t);
}

export function isHornSoloTitle(title: string): boolean {
  const t = (title || "").trim();
  return /^horn$/i.test(t);
}

/** Pad a 2s mark up to the 4s LTX floor, without sliding past the song end. */
export function padWhoPlaysWindow(
  startSec: number,
  endSec: number,
  songSec: number,
): { startSec: number; endSec: number } {
  const song = Number.isFinite(songSec) && songSec > 0 ? songSec : endSec;
  let start = Math.max(0, startSec);
  let end = Math.min(song, Math.max(start + 0.1, endSec));
  const raw = end - start;
  if (raw < SCRATCH_SONG_SLICE_MIN_SEC) {
    const need = SCRATCH_SONG_SLICE_MIN_SEC - raw;
    start = Math.max(0, start - need);
    if (end - start < SCRATCH_SONG_SLICE_MIN_SEC) {
      end = Math.min(song, start + SCRATCH_SONG_SLICE_MIN_SEC);
    }
  }
  return { startSec: start, endSec: end };
}

/** Split long marks at 30s. First trumpet also splits at 12s. */
export function splitWhoPlaysWindow(
  cue: ForgottenWhoCue,
  songSec: number,
): { startSec: number; endSec: number; performance: ForgottenPerformance; who: ForgottenWho }[] {
  const padded = padWhoPlaysWindow(cue.startSec, cue.endSec, songSec);
  const cuts: { startSec: number; endSec: number }[] = [];
  const extra =
    cue.who === "horn" && cue.startSec <= 1 && cue.endSec >= 23
      ? FIRST_TRUMPET_SPLIT_SEC
      : null;
  let at = padded.startSec;
  const stop = padded.endSec;
  while (at < stop - 0.05) {
    let next = Math.min(stop, at + SCRATCH_SONG_SLICE_MAX_SEC);
    if (extra != null && at < extra && extra < next) next = extra;
    if (next - at < 0.5) break;
    cuts.push({ startSec: at, endSec: next });
    at = next;
  }
  return cuts.map((c) => ({
    ...c,
    who: cue.who,
    performance:
      cue.who === "jack"
        ? isJackWalkStartSec(c.startSec)
          ? "walk"
          : "sing"
        : cue.performance,
  }));
}

export function forgottenWhoPlaysSlices(songSec: number): {
  startSec: number;
  endSec: number;
  durationSec: number;
  who: ForgottenWho;
  performance: ForgottenPerformance;
}[] {
  const song = Number.isFinite(songSec) && songSec > 0 ? songSec : 291.48;
  const out: {
    startSec: number;
    endSec: number;
    durationSec: number;
    who: ForgottenWho;
    performance: ForgottenPerformance;
  }[] = [];
  for (const cue of FORGOTTEN_WHO_PLAYS) {
    for (const slice of splitWhoPlaysWindow(cue, song)) {
      const durationSec = clampSongSliceDuration(slice.endSec - slice.startSec);
      out.push({
        startSec: slice.startSec,
        endSec: slice.startSec + durationSec,
        durationSec,
        who: slice.who,
        performance: slice.performance,
      });
    }
  }
  return out.sort((a, b) => a.startSec - b.startSec || a.who.localeCompare(b.who));
}

export type WhoPlaysShot = { shotId: string; plateFile: string; title: string };

export function pickForgottenWhoPlaysShots(shots: WhoPlaysShot[]): {
  jack: WhoPlaysShot | null;
  horn: WhoPlaysShot | null;
} {
  let jack: WhoPlaysShot | null = null;
  let horn: WhoPlaysShot | null = null;
  for (const sh of shots) {
    if (isSaxTitle(sh.title)) continue;
    if (!jack && isJackSoloTitle(sh.title)) jack = sh;
    if (!horn && isHornSoloTitle(sh.title)) horn = sh;
  }
  return { jack, horn };
}

export function applyForgottenWhoPlays(opts: {
  song: ScratchSong;
  shots: WhoPlaysShot[];
  newCutId: () => string;
}): { cuts: ScratchSongCut[]; plateTimings: PlateTiming[] } | { error: string } {
  const { jack, horn } = pickForgottenWhoPlaysShots(opts.shots);
  if (!jack?.plateFile || jack.plateFile === "__error__") {
    return { error: "Need the JACK GHOST still. Sax stays off this song." };
  }
  if (!horn?.plateFile || horn.plateFile === "__error__") {
    return { error: "Need the HORN still. No saxophone on this mix." };
  }
  const slices = forgottenWhoPlaysSlices(opts.song.durationSec);
  const cuts: ScratchSongCut[] = [];
  const plateTimings: PlateTiming[] = [];
  slices.forEach((slice, i) => {
    const shot = slice.who === "jack" ? jack : horn;
    cuts.push({
      id: opts.newCutId(),
      plateFile: shot.plateFile,
      shotId: shot.shotId,
      startSec: slice.startSec,
      durationSec: slice.durationSec,
      status: "pending",
      error: "",
      performance: slice.performance,
    });
    plateTimings.push({
      plateId: shot.shotId,
      startMs: secToMs(slice.startSec),
      endMs: secToMs(slice.endSec),
      sortIndex: i,
    });
  });
  return { cuts, plateTimings };
}

export function canApplyForgottenWhoPlays(job: {
  songTitle?: string;
  prompt?: string;
  lyrics?: string;
}): boolean {
  return isForgottenSongJob(job);
}
