/**
 * Which _CRASH_LAB pack is open in the toolbar — local session only.
 * Dirty = studio story + scene kit fingerprint ≠ last open/save.
 */
import { readSceneKitDraft } from "./crashSceneKitFields";
import type { ShowStyleId } from "./showStylePresets";

export const CRASH_ACTIVE_EPISODE_EVENT = "crash-active-episode";

const STORAGE_KEY = "crash-lab-active-episode-v1";

export type CrashActiveEpisode = {
  folderName: string;
  label: string;
  styleId: ShowStyleId;
  /** Fingerprint at last open or successful save */
  cleanFingerprint: string;
};

function hashString(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/** Stable fingerprint of working cut + scene kit. */
export function fingerprintStudioState(opts: {
  story: unknown;
  sceneKit: unknown;
}): string {
  return hashString(
    JSON.stringify({
      story: opts.story ?? null,
      sceneKit: opts.sceneKit ?? null,
    }),
  );
}

let episodeSnapRaw = "\0";
let episodeSnap: CrashActiveEpisode | null = null;

export function readActiveEpisode(): CrashActiveEpisode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CrashActiveEpisode>;
    const folderName = String(parsed.folderName || "").trim();
    if (!folderName) return null;
    return {
      folderName,
      label: String(parsed.label || folderName).trim() || folderName,
      styleId: (parsed.styleId || "skidmarks") as ShowStyleId,
      cleanFingerprint: String(parsed.cleanFingerprint || ""),
    };
  } catch {
    return null;
  }
}

export function subscribeActiveEpisode(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CRASH_ACTIVE_EPISODE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CRASH_ACTIVE_EPISODE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function getActiveEpisodeSnapshot(): CrashActiveEpisode | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY) ?? "";
  if (raw === episodeSnapRaw) return episodeSnap;
  episodeSnapRaw = raw;
  episodeSnap = readActiveEpisode();
  return episodeSnap;
}

export function writeActiveEpisode(ep: CrashActiveEpisode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ep));
  window.dispatchEvent(
    new CustomEvent(CRASH_ACTIVE_EPISODE_EVENT, { detail: ep }),
  );
}

export function clearActiveEpisode(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent(CRASH_ACTIVE_EPISODE_EVENT, { detail: null }),
  );
}

export async function fetchStudioFingerprint(
  styleId: ShowStyleId,
): Promise<string> {
  const res = await fetch(
    `/api/crash/story?styleId=${encodeURIComponent(styleId)}`,
  );
  const data = await res.json().catch(() => ({}));
  const story = data?.story ?? null;
  const sceneKit = readSceneKitDraft();
  return fingerprintStudioState({ story, sceneKit });
}

export async function markActiveEpisodeClean(
  styleId: ShowStyleId,
): Promise<void> {
  const cur = readActiveEpisode();
  if (!cur) return;
  const fp = await fetchStudioFingerprint(styleId);
  writeActiveEpisode({ ...cur, styleId, cleanFingerprint: fp });
}

export function setActiveEpisodeFromOpen(opts: {
  folderName: string;
  label?: string;
  styleId: ShowStyleId;
  story: unknown;
}): void {
  const sceneKit = readSceneKitDraft();
  const cleanFingerprint = fingerprintStudioState({
    story: opts.story,
    sceneKit,
  });
  writeActiveEpisode({
    folderName: opts.folderName,
    label: (opts.label || opts.folderName).trim() || opts.folderName,
    styleId: opts.styleId,
    cleanFingerprint,
  });
}
