import fs from "fs";
import path from "path";
import { clipFileBasename } from "./mobilePlateClips";
import { CRASH_DIR } from "./paths";

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
