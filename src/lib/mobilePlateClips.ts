import path from "path";
import type { MobileClipUnit } from "./mobileGenJob";
import { mobileMediaFolder } from "./mobileJobFolder";
import { formatSongClock } from "./scratchSongWindow";

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

/**
 * Label that does not renumber when a middle take is deleted.
 * Prefer the song-cut clock (1:00.0) when this mp4 is a song slice;
 * otherwise a short stable tail of the filename — never "4/10" position.
 */
export function stableClipTakeLabel(opts: {
  fileName: string;
  songCuts?: { clipFile?: string; startSec?: number }[];
}): string {
  const file = clipFileBasename(opts.fileName);
  if (!file) return "";
  const cut = (opts.songCuts || []).find(
    (c) => clipFileBasename(c.clipFile || "") === file,
  );
  if (cut && Number.isFinite(cut.startSec)) {
    return formatSongClock(Number(cut.startSec));
  }
  const stem = file.replace(/\.[^.]+$/, "");
  const parts = stem.split(/[_-]/).filter(Boolean);
  const tail = parts[parts.length - 1] || stem;
  return tail.length >= 2 ? tail.slice(-8) : stem.slice(-6);
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
    if (clip.shotId === shotId || want.has(clip.beatId)) {
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
    const file = files[files.length - 1]!;
    const prev = best.get(file);
    if (!prev) {
      best.set(file, clip);
      order.push(file);
      continue;
    }
    const clipHung = hung.has(`${file}::${(clip.shotId || "").trim()}`);
    const prevHung = hung.has(`${file}::${(prev.shotId || "").trim()}`);
    if (clipHung && !prevHung) best.set(file, clip);
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
  } | null;
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

/** Every plate's mp4s, left to right — do not filter to the open still. */
export function gatherClipsForStillsRail(
  job: Parameters<typeof clipsForStillsDesk>[0],
  plates: { shotId: string; beatIds?: string[] }[],
): MobileClipUnit[] {
  const deskClips = clipsForStillsDesk(job);
  const out: MobileClipUnit[] = [];
  for (const p of plates) {
    out.push(...clipsUnderPlate(p.shotId, p.beatIds || [], deskClips));
  }
  return uniqueClipsByFile(out, job.scratchSong);
}

/** STILLS order — plate 1, plate 2, … on each CLIPS thumb. */
export function plateRailLabels(plates: { shotId: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  plates.forEach((p, i) => {
    const id = (p.shotId || "").trim();
    if (id) out[id] = `plate ${i + 1}`;
  });
  return out;
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
