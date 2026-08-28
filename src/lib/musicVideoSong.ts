/**
 * /m Music video song desk — plate runs of 15s, reuse a plate later.
 * Clock math lives in scratchSongWindow (phone-safe).
 */
import type { CrashStoryDoc, CrashStoryShot } from "./crashStoryTypes";
import {
  formatSongClock,
  remainingSongWindows,
  SCRATCH_SONG_SLICE_DEFAULT_SEC,
  type ScratchSongCut,
} from "./scratchSongWindow";

export type SongCutTally = {
  total: number;
  parked: number;
  cooking: number;
  done: number;
  error: number;
};

export function tallySongCuts(cuts: Pick<ScratchSongCut, "status">[] = []): SongCutTally {
  const tally: SongCutTally = { total: cuts.length, parked: 0, cooking: 0, done: 0, error: 0 };
  for (const cut of cuts) {
    if (cut.status === "done") tally.done += 1;
    else if (cut.status === "running") tally.cooking += 1;
    else if (cut.status === "error") tally.error += 1;
    else tally.parked += 1;
  }
  return tally;
}

export function cutsForPlate(
  cuts: ScratchSongCut[] | undefined,
  shotId: string,
  plateFile?: string,
): ScratchSongCut[] {
  const id = (shotId || "").trim();
  const file = (plateFile || "").trim();
  return (cuts || []).filter((c) => {
    if (id && c.shotId === id) return true;
    if (!c.shotId && file && c.plateFile === file) return true;
    return false;
  });
}

/**
 * Hung LTX left status=running with no clip — that used to lock Add forever.
 * Clear those before list edits so the desk stays usable.
 */
export function clearStuckSongCooks<T extends ScratchSongCut>(cuts: T[] = []): T[] {
  return cuts.map((c) =>
    c.status === "running" && !(c.clipFile || "").trim()
      ? { ...c, status: "pending" as const, error: "" }
      : c,
  );
}

export function hasStuckSongCook(cuts: Pick<ScratchSongCut, "status" | "clipFile">[] = []): boolean {
  return cuts.some((c) => c.status === "running" && !(c.clipFile || "").trim());
}

/** How many 15s slices the desk list says it has (rowSlices sum). */
export function expectedDeskCutCount(rowSlices: number[]): number {
  return rowSlices.reduce((sum, n) => sum + clampPlateSliceCount(n), 0);
}

/**
 * Desk says 1 × 15s but an old park left 16 cuts → cook runs 0/16 forever.
 * Rebuild cuts to match the list; keep finished clips that still line up.
 */
/**
 * Keep the cut list in desk order with sequential clocks.
 * Rematch finished mp4s only when shotId + startSec + duration still match —
 * never leave a scrambled array just because the length looked right.
 */
export function syncSongCutsToDesk(opts: {
  songPlateIds: string[];
  rowSlices: number[];
  cuts: ScratchSongCut[];
  plateFileByShotId: Record<string, string>;
  songSec: number;
  newCutId: () => string;
}): ScratchSongCut[] {
  const cleared = clearStuckSongCooks(opts.cuts);
  const rebuilt = rebuildSongCutsFromDesk({
    songPlateIds: opts.songPlateIds,
    rowSlices: opts.rowSlices,
    plateFileByShotId: opts.plateFileByShotId,
    songSec: opts.songSec,
    newCutId: opts.newCutId,
  });
  const doneByKey = new Map<string, ScratchSongCut>();
  for (const c of cleared) {
    if (c.status !== "done" || !(c.clipFile || "").trim()) continue;
    doneByKey.set(`${(c.shotId || "").trim()}|${c.startSec}|${c.durationSec}`, c);
  }
  return rebuilt.map((c) => {
    const prev = doneByKey.get(`${(c.shotId || "").trim()}|${c.startSec}|${c.durationSec}`);
    if (!prev) return c;
    return {
      ...c,
      id: prev.id,
      status: "done" as const,
      clipFile: prev.clipFile,
      error: "",
    };
  });
}

/** True when the cuts array is not desk-order / sequential clocks. */
export function songCutsOrderBroken(
  cuts: ScratchSongCut[],
  songPlateIds: string[],
  rowSlices: number[],
): boolean {
  const expected = expectedDeskCutCount(rowSlices);
  if (cuts.length !== expected) return true;
  let cursor = 0;
  for (let i = 0; i < songPlateIds.length; i++) {
    const n = clampPlateSliceCount(rowSlices[i] ?? MUSIC_VIDEO_SLICE_DEFAULT);
    const shotId = (songPlateIds[i] || "").trim();
    for (let k = 0; k < n; k++) {
      const c = cuts[cursor++];
      if (!c) return true;
      if ((c.shotId || "").trim() !== shotId) return true;
    }
  }
  for (let i = 1; i < cuts.length; i++) {
    const prev = cuts[i - 1]!;
    const cur = cuts[i]!;
    const prevEnd = (Number(prev.startSec) || 0) + (Number(prev.durationSec) || 0);
    if ((Number(cur.startSec) || 0) + 0.05 < prevEnd) return true;
  }
  return false;
}

/** Pending / fail / stuck cook — not a finished clip. Plate stays. */
export function droppablePlateCuts(
  cuts: Pick<ScratchSongCut, "id" | "status" | "clipFile">[],
): typeof cuts {
  return cuts.filter((c) => {
    if (c.status === "done") return false;
    if (c.status === "running" && (c.clipFile || "").trim()) return false;
    return true;
  });
}

export function withoutPlateParkedCuts(
  cuts: ScratchSongCut[],
  shotId: string,
  plateFile?: string,
): { next: ScratchSongCut[]; dropped: number } {
  const dropIds = new Set(
    droppablePlateCuts(cutsForPlate(cuts, shotId, plateFile)).map((c) => c.id),
  );
  return {
    next: cuts.filter((c) => !dropIds.has(c.id)),
    dropped: dropIds.size,
  };
}

export function skipSongPlateIds(song?: { skipShotIds?: string[] } | null): string[] {
  return [...new Set((song?.skipShotIds || []).map((id) => id.trim()).filter(Boolean))];
}

export function withSkippedSongPlate(skip: string[], shotId: string): string[] {
  const id = shotId.trim();
  if (!id || skip.includes(id)) return skip;
  return [...skip, id];
}

export function withoutSkippedSongPlate(skip: string[], shotId: string): string[] {
  const id = shotId.trim();
  return skip.filter((s) => s !== id);
}

/** Song list = plates you Add, in order. Same plate can appear more than once. */
export function songDeskPlateIds(song?: {
  songPlateIds?: string[];
  cuts?: { shotId?: string }[];
} | null): string[] {
  if (song && song.songPlateIds !== undefined) {
    return song.songPlateIds.map((id) => id.trim()).filter(Boolean);
  }
  return [...new Set((song?.cuts || []).map((c) => (c.shotId || "").trim()).filter(Boolean))];
}

/** N × 15s per list row — pads/truncates to match songPlateIds. */
export function songDeskRowSlices(
  song: { rowSlices?: number[] } | null | undefined,
  deskIds: string[],
): number[] {
  const raw = song?.rowSlices || [];
  return deskIds.map((_, i) => clampPlateSliceCount(raw[i] ?? MUSIC_VIDEO_SLICE_DEFAULT));
}

export function withSongPlate(ids: string[], shotId: string): string[] {
  const id = shotId.trim();
  if (!id) return ids;
  return [...ids, id];
}

export function withSongRowSlice(slices: number[], count = MUSIC_VIDEO_SLICE_DEFAULT): number[] {
  return [...slices, clampPlateSliceCount(count)];
}

/** Take one list row off (by index). Same plate later in the list stays. */
export function withoutSongPlateAt(ids: string[], index: number): string[] {
  if (!Number.isInteger(index) || index < 0 || index >= ids.length) return ids;
  return ids.filter((_, i) => i !== index);
}

export function withoutSongRowSliceAt(slices: number[], index: number): number[] {
  if (!Number.isInteger(index) || index < 0 || index >= slices.length) return slices;
  return slices.filter((_, i) => i !== index);
}

export function withRowSliceAt(slices: number[], index: number, count: number): number[] {
  if (!Number.isInteger(index) || index < 0 || index >= slices.length) return slices;
  return slices.map((n, i) => (i === index ? clampPlateSliceCount(count) : n));
}

/**
 * Build pending cuts from the desk list. −/+ changes rowSlices → rebuild.
 * One list row with N × 15s becomes N cuts in order.
 */
export function rebuildSongCutsFromDesk(opts: {
  songPlateIds: string[];
  rowSlices: number[];
  plateFileByShotId: Record<string, string>;
  songSec: number;
  newCutId: () => string;
}): ScratchSongCut[] {
  const cuts: ScratchSongCut[] = [];
  const used: Pick<ScratchSongCut, "durationSec">[] = [];
  for (let i = 0; i < opts.songPlateIds.length; i++) {
    const shotId = opts.songPlateIds[i];
    const n = clampPlateSliceCount(opts.rowSlices[i] ?? MUSIC_VIDEO_SLICE_DEFAULT);
    const plateFile = (opts.plateFileByShotId[shotId] || "").trim();
    const windows = plateSliceWindows(used, opts.songSec, n);
    for (const window of windows) {
      cuts.push({
        id: opts.newCutId(),
        plateFile,
        shotId,
        startSec: window.startSec,
        durationSec: window.durationSec,
        status: "pending",
      });
      used.push(window);
    }
  }
  return cuts;
}

/** Cuts that belong to one desk row (by running rowSlices order). */
export function cutsForDeskRow(
  cuts: ScratchSongCut[],
  rowSlices: number[],
  rowIndex: number,
): ScratchSongCut[] {
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= rowSlices.length) return [];
  let start = 0;
  for (let i = 0; i < rowIndex; i++) {
    start += clampPlateSliceCount(rowSlices[i] ?? MUSIC_VIDEO_SLICE_DEFAULT);
  }
  const n = clampPlateSliceCount(rowSlices[rowIndex] ?? MUSIC_VIDEO_SLICE_DEFAULT);
  return cuts.slice(start, start + n);
}

export function deskRowAllDone(cuts: Pick<ScratchSongCut, "status" | "clipFile">[]): boolean {
  return Boolean(cuts.length) && cuts.every((c) => c.status === "done" && (c.clipFile || "").trim());
}

/**
 * Stitch / playback order = song clock, not whatever order the cuts array
 * ended up in after cooks or list edits. Same startSec keeps array order.
 */
export function orderSongCutsTimeline<T extends Pick<ScratchSongCut, "startSec">>(
  cuts: T[],
): T[] {
  return cuts
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const as = Number(a.c.startSec) || 0;
      const bs = Number(b.c.startSec) || 0;
      if (as !== bs) return as - bs;
      return a.i - b.i;
    })
    .map(({ c }) => c);
}

export function shortPlateLabel(
  story: CrashStoryDoc | null | undefined,
  shotId: string,
  fallbackIndex: number,
): string {
  const full = plateLabel(story, shotId, fallbackIndex);
  const line = full.split(/\n/)[0]?.trim() || full.trim();
  if (line.length <= 42) return line;
  return `${line.slice(0, 41)}…`;
}

export function shotIdForSongCut(
  cut: { shotId?: string; plateFile?: string },
  jobShots: { shotId: string; plateFile?: string }[] = [],
): string {
  const id = (cut.shotId || "").trim();
  if (id) return id;
  const file = (cut.plateFile || "").trim();
  if (!file) return "";
  return (
    jobShots.find((s) => (s.plateFile || "").trim() === file)?.shotId || ""
  ).trim();
}

/** Shot ids that have a still but no TRACK clock. */
export function plateIdsWaitingForTrack(opts: {
  song?: {
    cuts?: { shotId?: string; plateFile?: string }[];
    plateTimings?: { plateId?: string }[];
    songPlateIds?: string[];
  } | null;
  jobShots?: { shotId: string; plateFile?: string }[];
}): string[] {
  const have = new Set(
    (opts.song?.plateTimings || []).map((t) => (t.plateId || "").trim()).filter(Boolean),
  );
  const want: string[] = [];
  const push = (id: string) => {
    const clean = id.trim();
    if (!clean || have.has(clean) || want.includes(clean)) return;
    want.push(clean);
  };
  for (const c of opts.song?.cuts || []) {
    push(shotIdForSongCut(c, opts.jobShots || []));
  }
  for (const id of opts.song?.songPlateIds || []) push(id);
  for (const s of opts.jobShots || []) {
    const file = (s.plateFile || "").trim();
    if (!file || file === "__error__") continue;
    push(s.shotId);
  }
  return want;
}

/** TRACK wave is plateTimings. Waiting stills with no clock are off the rail. */
export function needsTrackHang(
  song?: {
    cuts?: { shotId?: string; plateFile?: string }[];
    plateTimings?: { plateId?: string }[];
    songPlateIds?: string[];
  } | null,
  jobShots?: { shotId: string; plateFile?: string }[],
): boolean {
  return plateIdsWaitingForTrack({ song, jobShots }).length > 0;
}

/**
 * Run used to look up the cut's shotId only. A still on the song list
 * (job.shots + plateFile) then said "not on this episode" when story_json
 * used a different id for the same file.
 */
export function storyShotForSongCut(opts: {
  story: CrashStoryDoc | null | undefined;
  jobShots: { shotId: string; plateFile?: string }[];
  cut: { shotId?: string; plateFile?: string };
}): { sceneId: string; shot: CrashStoryShot } | null {
  const story = opts.story;
  if (!story?.scenes?.length) return null;
  const cutShotId = (opts.cut.shotId || "").trim();
  const jobFile = (
    opts.jobShots.find((s) => s.shotId === cutShotId)?.plateFile || ""
  ).trim();
  const files = [(opts.cut.plateFile || "").trim(), jobFile].filter(Boolean);
  for (const scene of story.scenes) {
    const shot = scene.shots.find((sh) => sh.id === cutShotId);
    if (shot) return { sceneId: scene.id, shot };
  }
  for (const file of files) {
    for (const scene of story.scenes) {
      const shot = scene.shots.find((sh) => (sh.plateFile || "").trim() === file);
      if (shot) return { sceneId: scene.id, shot };
    }
  }
  return null;
}

export function songOrdinal(n: number): string {
  const i = Math.max(1, Math.floor(Number(n) || 1));
  const mod100 = i % 100;
  const mod10 = i % 10;
  if (mod100 >= 11 && mod100 <= 13) return `${i}th`;
  if (mod10 === 1) return `${i}st`;
  if (mod10 === 2) return `${i}nd`;
  if (mod10 === 3) return `${i}rd`;
  return `${i}th`;
}

export function plateCutSpan(
  cuts: Pick<ScratchSongCut, "startSec" | "durationSec">[],
): { startSec: number; endSec: number } | null {
  if (!cuts.length) return null;
  let start = Infinity;
  let end = -Infinity;
  for (const c of cuts) {
    const a = Number(c.startSec) || 0;
    const b = a + (Number(c.durationSec) || 0);
    if (a < start) start = a;
    if (b > end) end = b;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { startSec: start, endSec: end };
}

export function formatSongSpan(startSec: number, endSec: number): string {
  return `${formatSongClock(startSec)}–${formatSongClock(endSec)}`;
}

export type DeskPlateClock = {
  startSec: number;
  endSec: number;
  parked: boolean;
  slices: number;
};

/** Clocks from real desk cuts (rowSlices order), falling back to a preview. */
export function deskPlateClocks(
  deskShotIds: string[],
  cuts: ScratchSongCut[],
  counts: Record<string, number>,
  songSec: number,
  rowSlices?: number[],
): DeskPlateClock[] {
  const slices =
    rowSlices && rowSlices.length === deskShotIds.length
      ? rowSlices.map((n) => clampPlateSliceCount(n))
      : deskShotIds.map((_, i) =>
          clampPlateSliceCount(counts[String(i)] ?? MUSIC_VIDEO_SLICE_DEFAULT),
        );
  const used: Pick<ScratchSongCut, "durationSec">[] = [...cuts];
  const out: DeskPlateClock[] = [];
  for (let i = 0; i < deskShotIds.length; i++) {
    const mine = cutsForDeskRow(cuts, slices, i);
    const span = plateCutSpan(mine);
    if (span) {
      out.push({ ...span, parked: true, slices: mine.length || slices[i] });
      continue;
    }
    const windows = plateSliceWindows(used, songSec, slices[i]);
    if (!windows.length) {
      out.push({ startSec: 0, endSec: 0, parked: false, slices: slices[i] });
      continue;
    }
    const startSec = windows[0].startSec;
    const last = windows[windows.length - 1];
    out.push({
      startSec,
      endSec: last.startSec + last.durationSec,
      parked: false,
      slices: slices[i],
    });
    used.push(...windows);
  }
  return out;
}

export function withoutSongPlate(ids: string[], shotId: string): string[] {
  const id = shotId.trim();
  return ids.filter((s) => s !== id);
}

export function songCutTallyLine(tally: SongCutTally): string {
  if (!tally.total) return "no slices yet";
  const bits = [`${tally.done}/${tally.total} done`];
  if (tally.cooking) bits.push(`${tally.cooking} working`);
  if (tally.parked) bits.push(`${tally.parked} waiting`);
  if (tally.error) bits.push(`${tally.error} fail`);
  return bits.join(" · ");
}

export type SongCookAlertKind = "ok" | "cooking" | "failed" | "stuck";

export type SongCookAlert = {
  kind: SongCookAlertKind;
  title: string;
  detail: string;
  /** Stable id so we only ping once per fail set. */
  fingerprint: string;
  short: string;
};

/** Cuts that already failed — never hide these behind “it keeps going”. */
export function failedSongCuts<T extends Pick<ScratchSongCut, "status">>(cuts: T[] = []): T[] {
  return cuts.filter((c) => c.status === "error");
}

/**
 * What the phone should shout about this cook.
 * Fail always wins. “You can leave — it keeps going” is only when this
 * phone is still driving and nothing has failed.
 */
export function songCookAlert(
  cuts: Pick<ScratchSongCut, "id" | "status" | "error" | "clipFile">[] = [],
  opts?: { cooking?: boolean },
): SongCookAlert {
  const cooking = Boolean(opts?.cooking);
  const tally = tallySongCuts(cuts);
  const short = songCutTallyLine(tally);
  const failed = cuts
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.status === "error");
  const stillGoing = tally.parked + tally.cooking > 0;

  if (failed.length) {
    const first = failed[0]!;
    const n = first.i + 1;
    const err = (first.c.error || "").trim() || "That clip failed.";
    const extra = failed.length > 1 ? ` (+${failed.length - 1} more)` : "";
    return {
      kind: "failed",
      title: stillGoing
        ? `Clip ${n} failed — others still going`
        : `Clip ${n} failed — cook stopped`,
      detail: `${err}${extra}`,
      fingerprint: failed.map(({ c }) => `${c.id}:${(c.error || "").trim()}`).join("|"),
      short,
    };
  }

  if (hasStuckSongCook(cuts) && !cooking) {
    return {
      kind: "stuck",
      title: "A clip is stuck",
      detail:
        "It sat too long with no file. Tap Stop, then Generate again — don't Start directing.",
      fingerprint:
        cuts
          .filter((c) => c.status === "running" && !(c.clipFile || "").trim())
          .map((c) => (c.id || "").trim())
          .filter(Boolean)
          .join("|") || "stuck",
      short,
    };
  }

  if (cooking) {
    return {
      kind: "cooking",
      title: tally.total
        ? `Still on a clip (${tally.done}/${tally.total})`
        : "Still on a clip",
      detail: "You can leave — it keeps going.",
      fingerprint: "cooking",
      short,
    };
  }

  return { kind: "ok", title: "", detail: "", fingerprint: "", short };
}

export function songCookNote(alert: SongCookAlert): string {
  if (alert.kind === "ok") return "";
  if (alert.kind === "cooking") return `${alert.title}. ${alert.detail}`;
  return [alert.title, alert.detail].filter(Boolean).join(" — ");
}

export const MUSIC_VIDEO_SLICE_DEFAULT = 1;
export const MUSIC_VIDEO_SLICE_MAX = 16;

export function isMusicVideoSongJob(job: { styleId?: string }): boolean {
  return job.styleId === "music_video";
}

/** The one channel every music video belongs to — shown as the Vibe title,
 * with the band/song credit line underneath (musicVideoCreditLine). */
export const MUSIC_VIDEO_SHOW_NAME = "SKIDS_MUSIC_TV";

export function musicVideoCreditLine(job: { artist?: string; songTitle?: string }): string {
  const artist = (job.artist || "").trim();
  const song = (job.songTitle || "").trim();
  if (artist && song) return `${artist} — ${song}`;
  return artist || song;
}

export function clampPlateSliceCount(n: number): number {
  if (!Number.isFinite(n)) return MUSIC_VIDEO_SLICE_DEFAULT;
  return Math.max(1, Math.min(MUSIC_VIDEO_SLICE_MAX, Math.floor(n)));
}

export function plateSliceWindows(
  cuts: { durationSec: number }[],
  songSec: number,
  count: number,
): { startSec: number; durationSec: number }[] {
  return remainingSongWindows(cuts, songSec, clampPlateSliceCount(count));
}

export function findSongCarrierBeatId(
  story: CrashStoryDoc | null | undefined,
  songFile?: string,
  preferShotId?: string,
): string {
  const file = (songFile || "").trim();
  const shots = (story?.scenes || []).flatMap((sc) => sc.shots);
  const prefer = preferShotId
    ? shots.find((sh) => sh.id === preferShotId)
    : undefined;
  const pool = prefer ? [prefer, ...shots.filter((sh) => sh.id !== prefer.id)] : shots;
  if (file) {
    for (const sh of pool) {
      const hit = sh.beats.find((b) => (b.voiceFile || "").trim() === file);
      if (hit) return hit.id;
    }
  }
  return pool[0]?.beats[0]?.id || "";
}

export function plateLabel(
  story: CrashStoryDoc | null | undefined,
  shotId: string,
  fallbackIndex: number,
): string {
  for (const scene of story?.scenes || []) {
    const i = scene.shots.findIndex((sh) => sh.id === shotId);
    if (i >= 0) {
      const title = (scene.shots[i]?.title || "").trim();
      return title || `Plate ${i + 1}`;
    }
  }
  return `Plate ${fallbackIndex}`;
}

export { SCRATCH_SONG_SLICE_DEFAULT_SEC };
