import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import { sortableId } from "./types";

/** Must match `340:330` / `340:324` in workflow/LTX_2.3_IA2V_Cloud.json. */
export const LTX_CLOUD_FRAME_WIDTH = 1280;
export const LTX_CLOUD_FRAME_HEIGHT = 720;

function ltxPlateScratchDir(): string {
  const d = path.join(CRASH_DIR, "ltx", "plates");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/**
 * Square Scratch stills get center-cropped inside Comfy's IA2V resize (head
 * gone). Fit the full plate inside 1280×720 with letterbox bars first.
 */
export async function letterboxPlateForCloudIa2v(platePath: string): Promise<{
  path: string;
  letterboxed: boolean;
}> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(platePath).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) throw new Error("Plate has no size");

  if (w === LTX_CLOUD_FRAME_WIDTH && h === LTX_CLOUD_FRAME_HEIGHT) {
    return { path: platePath, letterboxed: false };
  }

  const sourceAspect = w / h;
  // 3:2 episode plates (~768×512) were already OK with Comfy center crop.
  // Square Scratch stills are not — letterbox those before upload.
  if (sourceAspect >= 1.45) {
    return { path: platePath, letterboxed: false };
  }

  const outPath = path.join(ltxPlateScratchDir(), `${sortableId("ltx_plate")}_720p.jpg`);
  await sharp(platePath)
    .rotate()
    .resize({
      width: LTX_CLOUD_FRAME_WIDTH,
      height: LTX_CLOUD_FRAME_HEIGHT,
      fit: "contain",
      background: { r: 0, g: 0, b: 0 },
    })
    .jpeg({ quality: 92 })
    .toFile(outPath);

  return { path: outPath, letterboxed: true };
}
