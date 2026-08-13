import { execFileSync } from "child_process";

/**
 * Length of an mp4/mp3 in seconds, read straight off the file with ffprobe.
 * Returns undefined rather than throwing — a missing ffprobe on someone's
 * machine should never stop an upload landing.
 */
export function probeDurationSeconds(filePath: string): number | undefined {
  try {
    const out = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "csv=p=0",
        filePath,
      ],
      { encoding: "utf8", timeout: 8000 },
    ).trim();
    const seconds = Number(out);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
  } catch {
    return undefined;
  }
}
