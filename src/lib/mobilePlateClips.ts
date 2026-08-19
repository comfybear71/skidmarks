import fs from "fs";
import path from "path";
import type { MobileClipUnit } from "./mobileGenJob";
import { mobileMediaFolder } from "./mobileJobFolder";
import { CRASH_DIR } from "./paths";

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

/** Move one mp4 off the playable shelf — local disk only; Blob rows stay. */
export function parkMobileClipFile(fileName: string): string | null {
  const file = clipFileBasename(fileName);
  if (!file || file.includes("..") || file.includes("/") || file.includes("\\")) {
    return null;
  }
  const pairs = [
    { dir: path.join(CRASH_DIR, "ltx"), cleared: path.join(CRASH_DIR, "ltx", "_cleared") },
    { dir: path.join(CRASH_DIR, "gen"), cleared: path.join(CRASH_DIR, "gen", "_cleared") },
  ];
  for (const { dir, cleared } of pairs) {
    const src = path.join(dir, file);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(cleared, { recursive: true });
    let dest = path.join(cleared, file);
    if (fs.existsSync(dest)) dest = path.join(cleared, `${Date.now()}_${file}`);
    fs.renameSync(src, dest);
    return path.basename(dest);
  }
  return null;
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
