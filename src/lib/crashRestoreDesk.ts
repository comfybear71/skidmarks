/**
 * Cold load / refresh: empty desk. Stuie picks the show and opens an episode.
 * Never auto-open last night’s pack (that reopened Sunny Banks after Close).
 */
"use client";

import { clearActiveEpisode } from "./crashActiveEpisode";

let coldStartDone = false;

export function coldStartEmptyCrashDesk(): void {
  if (typeof window === "undefined" || coldStartDone) return;
  coldStartDone = true;
  clearActiveEpisode();
}

/** Kept so old callers compile — does not reopen a pack. */
export async function restoreActiveCrashEpisode(): Promise<boolean> {
  coldStartEmptyCrashDesk();
  return false;
}
