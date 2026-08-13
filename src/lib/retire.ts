import fs from "fs";
import path from "path";
import { DATA_DIR } from "./paths";

/**
 * Stuie's rule: no mp4, mp3, plate or face is ever destroyed.
 * "Delete" in Studio means gone from the UI — the file moves in here and stays,
 * keeping its original folder shape so it can be dragged back by hand.
 */
export const RETIRED_DIR = path.join(DATA_DIR, "retired");

function freeName(target: string): string {
  if (!fs.existsSync(target)) return target;
  const ext = path.extname(target);
  const base = path.basename(target, ext);
  const stamp = Date.now().toString(36);
  return path.join(path.dirname(target), `${base}_${stamp}${ext}`);
}

function destinationFor(sourcePath: string): string {
  const rel = path.relative(DATA_DIR, sourcePath);
  const insideData = rel && !rel.startsWith("..") && !path.isAbsolute(rel);
  return path.join(
    RETIRED_DIR,
    insideData ? rel : path.basename(sourcePath),
  );
}

/** Move one file to retired. Returns where it went, or null if it wasn't there. */
export function retireFile(sourcePath: string | null): string | null {
  if (!sourcePath || !fs.existsSync(sourcePath)) return null;
  const dest = freeName(destinationFor(sourcePath));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.renameSync(sourcePath, dest);
  } catch {
    // Locked or across drives — copy first so the bytes survive either way
    fs.copyFileSync(sourcePath, dest);
    try {
      fs.unlinkSync(sourcePath);
    } catch {
      /* leave the original; a duplicate is better than a hole */
    }
  }
  return dest;
}

/** Move a whole folder (a character, location or room) to retired. */
export function retireDir(sourceDir: string | null): string | null {
  if (!sourceDir || !fs.existsSync(sourceDir)) return null;
  let dest = destinationFor(sourceDir);
  if (fs.existsSync(dest)) dest = `${dest}_${Date.now().toString(36)}`;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.renameSync(sourceDir, dest);
  } catch {
    fs.cpSync(sourceDir, dest, { recursive: true });
    try {
      fs.rmSync(sourceDir, { recursive: true, force: true });
    } catch {
      /* leave it — never lose the only copy */
    }
  }
  return dest;
}
