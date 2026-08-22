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
