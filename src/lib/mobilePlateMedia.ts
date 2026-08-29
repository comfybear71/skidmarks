import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import { resolveMobileMedia, resolveMobileMediaByFilename } from "./mobileMediaStore";
import type { ShowStyleId } from "./showStylePresets";
import { locationStillFileName } from "./mobileJobReady";
import { mobileCandidateFolders } from "./mobileJobFolder";
import type { MobileGenJob } from "./mobileGenJob";
import { newId } from "./types";

export { approvedCandidateFileName } from "./mobileJobReady";
export { mobileCandidateFolders } from "./mobileJobFolder";

/** Pull an approved candidate still into /tmp so plateCastIntoGen can read it. */
export async function cacheJobPlateFile(opts: {
  styleId: ShowStyleId;
  folders: string[];
  fileName: string;
}): Promise<string | null> {
  const fileName = opts.fileName.trim();
  if (!fileName) return null;
  const dest = path.join(CRASH_DIR, "gen", fileName);
  if (fs.existsSync(dest)) return dest;
  for (const folder of opts.folders) {
    if (!folder) continue;
    const resolved = await resolveMobileMedia({
      styleId: opts.styleId,
      folderName: folder,
      kind: "plates",
      fileName,
      destPath: dest,
    });
    if (resolved) return resolved;
  }
  return resolveMobileMediaByFilename({
    kind: "plates",
    fileName,
    destPath: dest,
  });
}

/**
 * Copy the locked place still onto a new plate file. Do not reuse the
 * location filename — dropping the plate must not park the place still.
 */
export async function copyPlaceStillAsEmptyPlate(opts: {
  job: MobileGenJob;
  sceneId: string;
}): Promise<string | null> {
  const srcName = locationStillFileName(opts.job.locationCandidates, opts.sceneId);
  if (!srcName) return null;
  const srcPath = await cacheJobPlateFile({
    styleId: opts.job.styleId,
    folders: mobileCandidateFolders(opts.job),
    fileName: srcName,
  });
  if (!srcPath) return null;
  const ext = path.extname(srcName) || ".png";
  const destName = `plate_empty_${newId("p")}${ext}`;
  const destPath = path.join(CRASH_DIR, "gen", destName);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
  return destName;
}
