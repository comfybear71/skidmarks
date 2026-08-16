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

/**
 * Folders an approved still might live under. Generate/approve run while
 * folderName is empty, so the bytes go under the job id. After screenplay
 * folderName is the pack — a later reroll lands there instead. Try both.
 * Never treat the job id as a pack (do not set folderName = job.id).
 */
export function mobileCandidateFolders(job: { id: string; folderName: string }): string[] {
  const out: string[] = [];
  const id = job.id.trim();
  const pack = job.folderName.trim();
  if (id) out.push(id);
  if (pack && pack !== id) out.push(pack);
  return out;
}
