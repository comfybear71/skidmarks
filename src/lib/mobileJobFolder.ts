/** Blob folder for a run. Empty until the screenplay creates a pack —
 *  use the job id so cast/location candidates still have a place to live. */
export function mobileMediaFolder(job: { id: string; folderName: string }): string {
  return job.folderName.trim() || job.id;
}

/** Real Crash Lab pack from the screenplay — not the job-id shelf used
 *  while cast/locations are still being built. A set folderName used to
 *  mean "pack exists"; writing a story against the job id would mint a
 *  stub episode or, locally, touch the desk story. */
export function jobHasEpisodePack(job: { id: string; folderName: string }): boolean {
  const folder = job.folderName.trim();
  return Boolean(folder) && folder !== job.id;
}
