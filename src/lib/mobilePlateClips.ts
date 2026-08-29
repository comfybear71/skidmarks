import path from "path";
import type { MobileClipUnit } from "./mobileGenJob";
import { mobileMediaFolder } from "./mobileJobFolder";
import {
  clipHangTiming,
  formatTrackClock,
  hangPlateShotId,
  isRealPlateHang,
  msToSec,
  resolvePlateTimings,
  sortPlateTimings,
  type PlateTiming,
} from "./musicVideoTrack";

export function mobileClipSrc(
  job: { id: string; styleId: string; folderName: string },
  clipFile: string,
): string {
  const fileName = path.basename(clipFile.split(/[\\/]/).pop() || clipFile);
  const folderName = mobileMediaFolder(job);
  return (
    `/api/crash/mobile/clip?styleId=${encodeURIComponent(job.styleId)}` +
    `&folderName=${encodeURIComponent(folderName)}` +
    `&fileName=${encodeURIComponent(fileName)}`
  );
}

/** Pack-style stem: letters and numbers only, underscores between words. */
export function humanMediaSlug(text: string): string {
  return (text || "")
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

/** Human clip name — `01_Babe_Spit_Roast.mp4`. Order first, then who, then song. */
export function humanOrderedClipName(opts: {
  index: number;
  speaker: string;
  title?: string;
}): string {
  const n = String(Math.max(1, Math.floor(Number(opts.index) || 1))).padStart(2, "0");
  const who = humanMediaSlug(opts.speaker) || "clip";
  const title = humanMediaSlug(opts.title || "");
  return title ? `${n}_${who}_${title}.mp4` : `${n}_${who}.mp4`;
}

/** Every mp4 already on job.clips or song cuts — do not reuse these names. */
export function takenClipFileNames(opts: {
  clips?: Array<{ clipFile?: string; priorClipFiles?: string[] }>;
  cuts?: Array<{ clipFile?: string }>;
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const take = (raw?: string) => {
    const file = clipFileBasename(raw || "");
    if (!file || seen.has(file)) return;
    seen.add(file);
    out.push(file);
  };
  for (const clip of opts.clips || []) {
    for (const file of stackedClipFiles({
      clipFile: clip.clipFile || "",
      priorClipFiles: clip.priorClipFiles,
    })) {
      take(file);
    }
  }
  for (const cut of opts.cuts || []) take(cut.clipFile);
  return out;
}

/**
 * Next `NN_Who_Title.mp4` that is not already on disk / CLIPS.
 * Counting done cuts and adding one reused 05_ after a recook parked clip 4
 * — the new video overwrote clip 5 and then sat in clip 4's slot.
 */
export function nextHumanClipName(opts: {
  speaker: string;
  title?: string;
  taken: string[];
}): string {
  const used = new Set(opts.taken.map((f) => clipFileBasename(f)).filter(Boolean));
  let max = 0;
  for (const file of used) {
    const m = /^(\d+)_/.exec(file);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const start = Math.max(max, used.size) + 1;
  for (let n = 0; n < 10_000; n++) {
    const name = humanOrderedClipName({
      index: start + n,
      speaker: opts.speaker,
      title: opts.title,
    });
    if (!used.has(name)) return name;
  }
  return humanOrderedClipName({ index: start, speaker: opts.speaker, title: opts.title });
}

/** Unique mp4s on the rail — CLIPS count must match thumbs. */
export function uniqueClipFileCount(
  clips: Array<{ clipFile?: string; priorClipFiles?: string[] }>,
): number {
  return takenClipFileNames({ clips }).length;
}

/** Always the mp4 basename — never a /tmp absolute path (those die across Vercel invokes). */
export function clipFileBasename(clipFile: string): string {
  const raw = (clipFile || "").trim();
  if (!raw) return "";
  return path.basename(raw.split(/[\\/]/).pop() || raw);
}

/** Playable mp4s for one clip row — older takes first, newest last. */
export function stackedClipFiles(
  clip: Pick<MobileClipUnit, "clipFile" | "priorClipFiles">,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...(clip.priorClipFiles || []), clip.clipFile || ""]) {
    const file = clipFileBasename(raw);
    if (!file || seen.has(file)) continue;
    seen.add(file);
    out.push(file);
  }
  return out;
}

type ClipClockSong = {
  cuts?: { shotId?: string; clipFile?: string; durationSec?: number }[];
  plateTimings?: PlateTiming[];
} | null;

type ClipTakeClockOpts = {
  fileName: string;
  shotId?: string;
  durationSec?: number;
  songCuts?: { clipFile?: string; shotId?: string; durationSec?: number }[];
  plateTimings?: PlateTiming[];
};

function positiveClipSec(n: unknown): number | null {
  const sec = Number(n);
  if (!Number.isFinite(sec) || sec <= 0) return null;
  return sec;
}

type ClipClockDraft = { plateTimings?: PlateTiming[] } | null;

/**
 * TRACK hang clock for this mp4 — `plateTimings.startMs`, not cut.startSec.
 * Cooks often write startSec: 0, which is why every thumb said 0:00.0.
 * Missing hang → null (stamp "off"). Never invent 15s.
 */
export function clipHangStartMs(
  clip: Pick<MobileClipUnit, "shotId" | "clipFile" | "priorClipFiles">,
  song?: ClipClockSong,
  draft?: ClipClockDraft,
): number | null {
  const timings = sortPlateTimings(resolvePlateTimings(song, draft));
  if (!timings.length) return null;
  const clock = {
    cuts: song?.cuts,
    plateTimings: timings,
  };
  const stacked = stackedClipFiles(clip);
  const file = stacked.at(-1) || clipFileBasename(clip.clipFile || "");
  const owned = file ? clipHangTiming(clock, file) : null;
  if (owned) return owned.startMs;
  const shotHit = timings.find((t) => t.plateId === (clip.shotId || "").trim());
  if (shotHit && isRealPlateHang(shotHit)) {
    const onShot = (song?.cuts || []).filter(
      (c) =>
        (c.shotId || "").trim() === (clip.shotId || "").trim() &&
        clipFileBasename(c.clipFile || ""),
    );
    if (!onShot.length) return shotHit.startMs;
  }
  return null;
}

/** `16s` / `5s` — mp4 or cut length, never a wave start. */
export function formatClipFileLengthSec(sec: number): string {
  const n = positiveClipSec(sec);
  if (n == null) return "";
  return `${Math.round(n)}s`;
}

/**
 * File / cut seconds first. Hang-window width only when those are missing.
 * A 5s cook hung at 0:15 must stay 5, not the 15s box it sits in.
 */
export function clipTakeDurationSec(opts: ClipTakeClockOpts): number | null {
  const asked = positiveClipSec(opts.durationSec);
  if (asked != null) return asked;
  const file = clipFileBasename(opts.fileName);
  if (!file) return null;
  const cut = (opts.songCuts || []).find((c) => clipFileBasename(c.clipFile || "") === file);
  const cutDur = positiveClipSec(cut?.durationSec);
  if (cutDur != null) return cutDur;
  const startMs = clipHangStartMs(
    { shotId: opts.shotId || "", clipFile: file, priorClipFiles: [] },
    { cuts: opts.songCuts, plateTimings: opts.plateTimings },
  );
  if (startMs == null) return null;
  const shotId = (opts.shotId || cut?.shotId || "").trim();
  const timings = sortPlateTimings(opts.plateTimings || []);
  const timing =
    timings.find((t) => t.plateId === shotId) || timings.find((t) => t.startMs === startMs);
  if (!timing) return null;
  return positiveClipSec(msToSec(timing.endMs - timing.startMs));
}

/**
 * Hung + length → `0:15 · 5s`. Not hung → "off".
 * Never start-only (that read as a 15s file). Never a filename tail (kI0).
 */
export function formatClipTakeStamp(startMs: number | null, durationSec: number | null): string {
  const length = durationSec != null ? formatClipFileLengthSec(durationSec) : "";
  if (startMs == null) return "off";
  if (length) return `${formatTrackClock(startMs)} · ${length}`;
  return "off";
}

/**
 * Hung → `0:00 · 16s` (wave start · mp4 length). Not hung → "off".
 * Never cut.startSec as the only number. Never a filename tail (that was kI0).
 */
export function stableClipTakeLabel(opts: ClipTakeClockOpts): string {
  const file = clipFileBasename(opts.fileName);
  if (!file) return "";
  const startMs = clipHangStartMs(
    { shotId: opts.shotId || "", clipFile: file, priorClipFiles: [] },
    { cuts: opts.songCuts, plateTimings: opts.plateTimings },
  );
  return formatClipTakeStamp(startMs, clipTakeDurationSec(opts));
}

/** Hung first by TRACK clock; leftovers stay in cook / first-seen order. */
export function orderClipsOnSongClock(
  clips: MobileClipUnit[],
  song?: ClipClockSong,
  draft?: ClipClockDraft,
): MobileClipUnit[] {
  return clips
    .map((clip, index) => ({ clip, index, ms: clipHangStartMs(clip, song, draft) }))
    .sort((a, b) => {
      if (a.ms != null && b.ms != null && a.ms !== b.ms) return a.ms - b.ms;
      if (a.ms != null && b.ms == null) return -1;
      if (a.ms == null && b.ms != null) return 1;
      return a.index - b.index;
    })
    .map((row) => row.clip);
}

/** CLIPS strip — clip 1, clip 2, … in rail order. Not story plate 8. */
export function clipRailLabels(count: number): string[] {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return Array.from({ length: n }, (_, i) => `clip ${i + 1}`);
}

/**
 * Fourth cook of the first plate used the same beat and overwrote clip 1.
 * A cut that already has a file, or a done clip on this beat, must append.
 */
export function songCookAppendsNewClip(opts: {
  cutClipFile?: string;
  clips?: Array<{ beatId?: string; clipFile?: string; clipStatus?: string }>;
  beatId: string;
}): boolean {
  if (clipFileBasename(opts.cutClipFile || "")) return true;
  const beat = (opts.beatId || "").trim();
  if (!beat) return false;
  return (opts.clips || []).some((c) => {
    if ((c.beatId || "").trim() !== beat) return false;
    if ((c.clipStatus || "") === "error") return false;
    return Boolean(clipFileBasename(c.clipFile || ""));
  });
}

/** Start a cook without stomping a done clip on this beat. */
export function withSongCookPendingClip(opts: {
  clips: MobileClipUnit[];
  beatId: string;
  cutClipFile?: string;
  hangId: string;
  sceneId: string;
  speaker: string;
  line: string;
  voiceFile: string;
  imageMotion: string;
  newBeatId: () => string;
}): { clips: MobileClipUnit[]; cookBeatId: string } {
  const hangId = (opts.hangId || "").trim();
  const patch = {
    shotId: hangId,
    sceneId: opts.sceneId,
    speaker: opts.speaker,
    line: opts.line,
    voiceFile: opts.voiceFile,
    imageMotion: opts.imageMotion,
    clipStatus: "pending" as const,
    error: "",
  };
  if (
    songCookAppendsNewClip({
      cutClipFile: opts.cutClipFile,
      clips: opts.clips,
      beatId: opts.beatId,
    })
  ) {
    const cookBeatId = opts.newBeatId();
    return {
      cookBeatId,
      clips: [...opts.clips, { ...patch, beatId: cookBeatId, clipFile: "" }],
    };
  }
  if (opts.clips.some((c) => c.beatId === opts.beatId)) {
    return {
      cookBeatId: opts.beatId,
      clips: opts.clips.map((c) => (c.beatId === opts.beatId ? { ...c, ...patch } : c)),
    };
  }
  return {
    cookBeatId: opts.beatId,
    clips: [...opts.clips, { ...patch, beatId: opts.beatId, clipFile: "" }],
  };
}

/** Keep the old mp4 on the stack when a new LTX take lands. Files stay in Blob. */
export function rememberClipTake(
  clip: Pick<MobileClipUnit, "clipFile" | "priorClipFiles">,
  nextFile: string,
): { clipFile: string; priorClipFiles: string[] } {
  const next = clipFileBasename(nextFile);
  const old = clipFileBasename(clip.clipFile || "");
  const kept = stackedClipFiles(clip).filter((f) => f !== next);
  return {
    priorClipFiles: kept,
    clipFile: next || old,
  };
}

/** Every plate keeps its own clip(s). Match by beat first so two, three,
 * or more Saved lines on one still all sit under that thumb. */
export function clipsUnderPlate(
  shotId: string,
  beatIds: string[],
  clips: MobileClipUnit[],
): MobileClipUnit[] {
  const want = new Set(beatIds.filter(Boolean));
  const seen = new Set<string>();
  const out: MobileClipUnit[] = [];
  for (const clip of clips) {
    if (seen.has(clip.beatId)) continue;
    if (
      clip.shotId === shotId ||
      hangPlateShotId(clip.shotId || "") === shotId ||
      want.has(clip.beatId)
    ) {
      seen.add(clip.beatId);
      out.push(clip);
    }
  }
  return out;
}

/**
 * One mp4 → one CLIPS row. Prefer the hung plate (done song cut with
 * that file). A leftover job.clips row on the next still must not draw
 * the same cook as plate 1 and plate 2.
 */
export function uniqueClipsByFile(
  clips: MobileClipUnit[],
  song?: {
    cuts?: { shotId?: string; clipFile?: string; status?: string }[];
  } | null,
): MobileClipUnit[] {
  const hung = new Set<string>();
  for (const cut of song?.cuts || []) {
    const file = clipFileBasename(cut.clipFile || "");
    const shot = (cut.shotId || "").trim();
    if (file && shot && cut.status === "done") hung.add(`${file}::${shot}`);
  }
  const seenBeat = new Set<string>();
  const best = new Map<string, MobileClipUnit>();
  const order: string[] = [];
  for (const clip of clips) {
    if (seenBeat.has(clip.beatId)) continue;
    seenBeat.add(clip.beatId);
    const files = stackedClipFiles(clip);
    if (!files.length) continue;
    // Every mp4 is its own CLIPS thumb. Keying only the latest file used
    // to hide clip 4's 5s take when a recook reused clip 5's name.
    for (const file of files) {
      const row: MobileClipUnit = { ...clip, clipFile: file, priorClipFiles: [] };
      const prev = best.get(file);
      if (!prev) {
        best.set(file, row);
        order.push(file);
        continue;
      }
      const clipHung = hung.has(`${file}::${(clip.shotId || "").trim()}`);
      const prevHung = hung.has(`${file}::${(prev.shotId || "").trim()}`);
      if (clipHung && !prevHung) best.set(file, row);
    }
  }
  return order.map((file) => best.get(file)!);
}

/**
 * /m Clips fold under Stills. TRACK hang writes cuts + plateTimings.
 * If we only look at job.clips, a hung mute clip hides the whole dropdown.
 * ✕ must park the song cut too (`planParkDeskClipTake`) or this list
 * draws the file again and the X looks dead.
 *
 * TRACK wave is stills (on/off). A cooked mp4 appends here — it is not
 * a new wave plate.
 */
export function clipsForStillsDesk(job: {
  clips?: MobileClipUnit[];
  shots?: { shotId: string; sceneId: string }[];
  scratchSong?: {
    cuts?: {
      id?: string;
      shotId?: string;
      clipFile?: string;
      status?: string;
      durationSec?: number;
    }[];
    plateTimings?: PlateTiming[];
  } | null;
  trackDraft?: { plateTimings?: PlateTiming[] } | null;
}): MobileClipUnit[] {
  const clips = [...(job.clips || [])];
  const seenShot = new Set(
    clips.filter((c) => clipFileBasename(c.clipFile || "")).map((c) => (c.shotId || "").trim()),
  );
  for (const cut of job.scratchSong?.cuts || []) {
    const shotId = (cut.shotId || "").trim();
    const file = clipFileBasename(cut.clipFile || "");
    if (!shotId || !file || cut.status !== "done" || seenShot.has(shotId)) continue;
    seenShot.add(shotId);
    const shot = (job.shots || []).find((s) => s.shotId === shotId);
    clips.push({
      beatId: cut.id || `cut:${shotId}`,
      shotId,
      sceneId: shot?.sceneId || "",
      clipFile: file,
      clipStatus: "done",
      error: "",
      durationSec: cut.durationSec,
    });
  }
  return uniqueClipsByFile(clips, job.scratchSong);
}

/** Every plate's mp4s — hang clock first, then cook order. Not STILLS 1…8…9. */
export function gatherClipsForStillsRail(
  job: Parameters<typeof clipsForStillsDesk>[0],
  plates: { shotId: string; beatIds?: string[] }[],
): MobileClipUnit[] {
  const deskClips = clipsForStillsDesk(job);
  const matched: MobileClipUnit[] = [];
  const seenBeat = new Set<string>();
  for (const clip of deskClips) {
    for (const p of plates) {
      if (!clipsUnderPlate(p.shotId, p.beatIds || [], [clip]).length) continue;
      if (seenBeat.has(clip.beatId)) break;
      seenBeat.add(clip.beatId);
      matched.push(clip);
      break;
    }
  }
  return orderClipsOnSongClock(
    uniqueClipsByFile(matched, job.scratchSong),
    job.scratchSong,
    job.trackDraft,
  );
}

/**
 * Off song / TRACK unhang — mp4 stays on the CLIPS rail.
 * If the take only lived on the song cut, append it to job.clips.
 * Never parks. Never writes _cleared/.
 */
export function keepClipsAfterUnhang(opts: {
  clips: MobileClipUnit[];
  removedCuts: {
    id?: string;
    shotId?: string;
    clipFile?: string;
    durationSec?: number;
  }[];
  shots?: { shotId: string; sceneId?: string }[];
}): MobileClipUnit[] {
  const have = new Set(opts.clips.flatMap((c) => stackedClipFiles(c)));
  const next = [...opts.clips];
  for (const cut of opts.removedCuts) {
    const file = clipFileBasename(cut.clipFile || "");
    if (!file || have.has(file)) continue;
    const shot = hangPlateShotId((cut.shotId || "").trim());
    const sceneId =
      (opts.shots || []).find((s) => (s.shotId || "").trim() === shot)?.sceneId || "";
    next.push({
      beatId: (cut.id || "").trim() || `cut:${shot || file}`,
      shotId: shot || (cut.shotId || "").trim(),
      sceneId,
      clipFile: file,
      clipStatus: "done",
      error: "",
      ...(cut.durationSec != null ? { durationSec: cut.durationSec } : {}),
    });
    have.add(file);
  }
  return next;
}

/** Drop one take from a clip row — newest remaining take becomes clipFile. */
export function dropClipTakeFromRow(clip: MobileClipUnit, fileName: string): MobileClipUnit {
  const want = clipFileBasename(fileName);
  if (!want) return clip;
  const stacked = stackedClipFiles(clip);
  if (!stacked.includes(want)) return clip;
  const remaining = stacked.filter((f) => f !== want);
  if (!remaining.length) {
    return {
      ...clip,
      clipFile: "",
      priorClipFiles: [],
      clipStatus: "pending",
      error: "",
    };
  }
  const prior = remaining.slice(0, -1);
  const latest = remaining[remaining.length - 1]!;
  return {
    ...clip,
    clipFile: latest,
    priorClipFiles: prior,
    clipStatus: "done",
    error: "",
  };
}

/** Clear every take on one clip row. */
export function clearClipRowTakes(clip: MobileClipUnit): MobileClipUnit {
  return {
    ...clip,
    clipFile: "",
    priorClipFiles: [],
    clipStatus: "pending",
    error: "",
  };
}
