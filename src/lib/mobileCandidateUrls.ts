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
