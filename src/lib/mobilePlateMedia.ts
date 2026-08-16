import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import { resolveMobileMedia, resolveMobileMediaByFilename } from "./mobileMediaStore";
import type { ShowStyleId } from "./showStylePresets";

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
