/** Client-safe preview URLs for /m candidates. Cast already used a
 * dedicated route; locations were still hitting /api/crash/gen/file,
 * which 404s on Vercel when the generate instance's /tmp is gone. */

export function mobileMediaFolderName(job: { id: string; folderName: string }): string {
  return job.folderName.trim() || job.id;
}

export function mobileLocationStillUrl(
  job: { id: string; styleId: string; folderName: string },
  fileName: string,
): string {
  return (
    `/api/crash/mobile/location-still?styleId=${encodeURIComponent(job.styleId)}` +
    `&folderName=${encodeURIComponent(mobileMediaFolderName(job))}` +
    `&fileName=${encodeURIComponent(fileName)}`
  );
}

export function mobileWorldShelfStillUrl(styleId: string, thumbKey: string): string {
  return (
    `/api/crash/world-cards/file?styleId=${encodeURIComponent(styleId)}` +
    `&thumb=${encodeURIComponent(thumbKey)}`
  );
}

/**
 * Place preview on /m. The approved take lives under the job in Blob
 * (`location-still`). `g:place_…` is a local-gallery copy and is not in
 * Blob — never point an <img> at world-cards/file for those keys (that
 * is the green [? ] box on the phone).
 */
export function mobilePlacePreviewUrl(
  job: { id: string; styleId: string; folderName: string },
  opts: { fileName?: string; worldThumbKey?: string },
): string {
  const file = (opts.fileName || "").trim();
  if (file) return mobileLocationStillUrl(job, file);
  const world = (opts.worldThumbKey || "").trim();
  if (!world || world.startsWith("g:")) return "";
  return mobileWorldShelfStillUrl(job.styleId, world);
}
