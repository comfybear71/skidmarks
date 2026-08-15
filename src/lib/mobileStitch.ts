import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import { CRASH_DIR } from "./paths";
import { sortableId } from "./types";

/**
 * Vercel's runtime has no ffmpeg on PATH. Two packaged sources are tried
 * because they fail differently: @ffmpeg-installer ships the binary as a real
 * dependency, while ffmpeg-static downloads it in a postinstall that a build
 * can skip — leaving the module present and the file absent.
 */
function ffmpegCandidates(): string[] {
  const out: string[] = [];
  if (typeof ffmpegStatic === "string" && ffmpegStatic) out.push(ffmpegStatic);
  // @ffmpeg-installer is referenced by path, never required: its index.js uses
  // dynamic requires that Turbopack cannot resolve and the build fails on them.
  // The platform subpackage lays the binary down at a fixed location.
  for (const root of [process.cwd(), "/var/task"]) {
    out.push(
      path.join(root, "node_modules", "@ffmpeg-installer", "linux-x64", "ffmpeg"),
      path.join(root, "node_modules", "ffmpeg-static", "ffmpeg"),
    );
  }
  return [...new Set(out)];
}

/** Chosen binary, or null with the list of what was tried. */
function resolveFfmpeg(): { bin: string | null; tried: string[] } {
  const tried: string[] = [];
  for (const candidate of ffmpegCandidates()) {
    const exists = fs.existsSync(candidate);
    tried.push(`${candidate}${exists ? "" : " (missing)"}`);
    if (!exists) continue;
    try {
      // Some lambda runtimes unpack without the executable bit.
      fs.accessSync(candidate, fs.constants.X_OK);
    } catch {
      try {
        fs.chmodSync(candidate, 0o755);
      } catch {
        continue;
      }
    }
    return { bin: candidate, tried };
  }
  return { bin: null, tried };
}

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

  const { bin, tried } = resolveFfmpeg();
  try {
    // "ffmpeg" on PATH is the PC's normal case and the last resort on Vercel,
    // where it does not exist — so say what was looked for rather than only
    // that it was not found.
    execFileSync(
      bin || "ffmpeg",
      ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath],
      { timeout: 120_000 },
    );
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new Error(
      bin
        ? `ffmpeg stitch failed using ${bin} — ${why}`
        : `No packaged ffmpeg found and none on PATH — ${why}. Looked in: ${tried.join(", ")}`,
    );
  } finally {
    fs.rmSync(listPath, { force: true });
  }

  return outName;
}

export function mobileFinalVideoPath(fileName: string): string {
  return path.join(stitchDir(), fileName);
}
