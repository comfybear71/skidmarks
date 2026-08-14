import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { CRASH_DIR } from "./paths";
import { sortableId } from "./types";

function stitchDir(): string {
  const dir = path.join(CRASH_DIR, "mobile", "final");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Concatenate per-shot clip mp4s (already the same codec/container coming
 * out of the same LTX pipeline, so a stream copy is safe and fast — no
 * re-encode) into one final video. Requires ffmpeg on PATH, same
 * assumption src/lib/mediaDuration.ts's probeDurationSeconds makes for
 * ffprobe; unlike that helper this one can't degrade gracefully (there's
 * no video without it), so it throws a clear message instead of silently
 * producing nothing.
 */
export function stitchClips(clipPaths: string[]): string {
  if (!clipPaths.length) throw new Error("No clips to stitch");
  if (clipPaths.length === 1) {
    const outName = `${sortableId("mfinal")}.mp4`;
    fs.copyFileSync(clipPaths[0]!, path.join(stitchDir(), outName));
    return outName;
  }

  const listPath = path.join(stitchDir(), `${sortableId("concat")}.txt`);
  const listContent = clipPaths
    .map((p) => `file '${path.resolve(p).replace(/'/g, "'\\''")}'`)
    .join("\n");
  fs.writeFileSync(listPath, listContent);

  const outName = `${sortableId("mfinal")}.mp4`;
  const outPath = path.join(stitchDir(), outName);

  try {
    execFileSync(
      "ffmpeg",
      ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath],
      { timeout: 120_000 },
    );
  } catch (e) {
    throw new Error(
      `ffmpeg stitch failed — is ffmpeg installed? (${e instanceof Error ? e.message : String(e)})`,
    );
  } finally {
    fs.rmSync(listPath, { force: true });
  }

  return outName;
}

export function mobileFinalVideoPath(fileName: string): string {
  return path.join(stitchDir(), fileName);
}
