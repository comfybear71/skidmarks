/**
 * Put the last opened episode back on the desk (same path as Open episode).
 * Runs from Crash Lab page mount — toolbar-only restore was not firing in Chrome.
 */
"use client";

import { hydrateCrashDeskFromServer } from "./crashDeskHydrate";

export async function restoreActiveCrashEpisode(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const pack = await hydrateCrashDeskFromServer();
    return Boolean(pack);
  } catch {
    return false;
  }
}
