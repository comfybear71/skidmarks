import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { resolveFfmpeg } from "./mobileStitch";

/**
 * A scene the screenplay wrote with no dialogue (an establishing beat, a
 * reaction, a sight gag) used to get zero seconds in the final cut — the
 * animate phase only ever ran per beat, and a shot with no beats produced no
 * clip. Cloud IA2V's workflow has a wired LoadAudio node, so it can't
 * animate a hold shot without *some* mp3 — this generates a short silence to
 * feed it, the same way a real line's mp3 would be.
 */
export function writeSilentMp3(destPath: string, seconds = 3): boolean {
  if (fs.existsSync(destPath)) return true;
  const { bin } = resolveFfmpeg();
  const ffmpeg = bin || "ffmpeg";
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  try {
    execFileSync(
      ffmpeg,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=44100:cl=mono",
        "-t",
        String(seconds),
        // Every other mp3 in this pipeline gets its length estimated from file
        // size assuming ~128kbps (ltxCloudIa2v's estimateMp3DurationSec) — a
        // lower bitrate here would silently under-report this clip's length.
        "-b:a",
        "128k",
        destPath,
      ],
      { timeout: 20_000, stdio: "ignore" },
    );
    return fs.existsSync(destPath);
  } catch {
    return false;
  }
}
