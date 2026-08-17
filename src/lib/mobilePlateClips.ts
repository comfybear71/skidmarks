import type { MobileClipUnit } from "./mobileGenJob";

export function mobileClipSrc(
  job: { styleId: string; folderName: string },
  clipFile: string,
): string {
  const fileName = clipFile.split(/[\\/]/).pop() || clipFile;
  return (
    `/api/crash/mobile/clip?styleId=${encodeURIComponent(job.styleId)}` +
    `&folderName=${encodeURIComponent(job.folderName)}` +
    `&fileName=${encodeURIComponent(fileName)}`
  );
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
