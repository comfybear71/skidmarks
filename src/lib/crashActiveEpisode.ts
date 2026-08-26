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

const STORY_CACHE_KEY = "crash-lab-open-story-v1";

type OpenStoryCache = {
  styleId: ShowStyleId;
  folderName: string;
  story: unknown;
};

export function writeOpenStoryCache(opts: {
  styleId: ShowStyleId;
  folderName: string;
  story: unknown;
}): void {
  if (typeof window === "undefined") return;
  if (!opts.story) return;
  try {
    const payload: OpenStoryCache = {
      styleId: opts.styleId,
      folderName: opts.folderName,
      story: opts.story,
    };
    sessionStorage.setItem(STORY_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

export function readOpenStoryCache(styleId: ShowStyleId): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OpenStoryCache>;
    if (parsed.styleId !== styleId || !parsed.story) return null;
    const ep = readActiveEpisode();
    if (ep && parsed.folderName && parsed.folderName !== ep.folderName) {
      return null;
    }
    return parsed.story;
  } catch {
    return null;
  }
}

function storyPlateCount(story: unknown): number {
  if (!story || typeof story !== "object") return 0;
  const scenes = (story as { scenes?: Array<{ shots?: Array<{ plateFile?: string }> }> }).scenes;
  if (!Array.isArray(scenes)) return 0;
  let n = 0;
  for (const sc of scenes) {
    for (const sh of sc.shots || []) {
      if (String(sh.plateFile || "").trim()) n += 1;
    }
  }
  return n;
}

/** Keep the Open pack if a later GET returns the empty Shot 1 stub. */
export function preferPackedStory(fetched: unknown, cached: unknown): unknown {
  const fetchedPlates = storyPlateCount(fetched);
  const cachedPlates = storyPlateCount(cached);
  if (cachedPlates > fetchedPlates) return cached;
  return fetched ?? cached ?? null;
}

export type CrashLtxThumb = {
  beatId: string;
  url: string;
  file?: string;
};

const LTX_CACHE_KEY = "crash-lab-open-ltx-v1";

export function writeOpenLtxCache(opts: {
  styleId: ShowStyleId;
  folderName: string;
  results: CrashLtxThumb[];
}): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      LTX_CACHE_KEY,
      JSON.stringify({
        styleId: opts.styleId,
        folderName: opts.folderName,
        results: opts.results,
      }),
    );
  } catch {
    /* ignore quota */
  }
}

export function readOpenLtxCache(styleId: ShowStyleId): CrashLtxThumb[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(LTX_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      styleId?: ShowStyleId;
      folderName?: string;
      results?: CrashLtxThumb[];
    };
    if (parsed.styleId !== styleId || !Array.isArray(parsed.results)) return [];
    const ep = readActiveEpisode();
    if (ep && parsed.folderName && parsed.folderName !== ep.folderName) {
      return [];
    }
    return parsed.results.filter((r) => r?.beatId && r?.url);
  } catch {
    return [];
  }
}

export function clearActiveEpisode(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  try {
    sessionStorage.removeItem(STORY_CACHE_KEY);
    sessionStorage.removeItem(LTX_CACHE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(CRASH_ACTIVE_EPISODE_EVENT, { detail: null }),
  );
}

/** Open pack for this show, or null when the desk is empty. */
export function crashDeskOpenQuery(
  styleId: ShowStyleId,
): { styleId: ShowStyleId; folderName: string } | null {
  if (typeof window === "undefined") return null;
  const ep = readActiveEpisode();
  if (!ep?.folderName || ep.styleId !== styleId) return null;
  return { styleId, folderName: ep.folderName };
}

/** Story GET url for the open pack, or null when the desk is empty. */
export function crashDeskStoryFetchUrl(styleId: ShowStyleId): string | null {
  const q = crashDeskOpenQuery(styleId);
  if (!q) return null;
  return `/api/crash/story?styleId=${encodeURIComponent(q.styleId)}&folderName=${encodeURIComponent(q.folderName)}`;
}

/** PUT body for the open pack. Never omit folderName on cloud. */
export function crashDeskStoryPutBody(story: {
  styleId: ShowStyleId;
}): { story: typeof story; folderName?: string } {
  const q = crashDeskOpenQuery(story.styleId);
  return q ? { story, folderName: q.folderName } : { story };
}

/** Scene kit GET url for the open pack (Reload places). */
export function crashDeskSceneKitFetchUrl(styleId: ShowStyleId): string | null {
  const q = crashDeskOpenQuery(styleId);
  if (!q) return null;
  return `/api/crash/scene-kit?styleId=${encodeURIComponent(q.styleId)}&folderName=${encodeURIComponent(q.folderName)}`;
}

/** Animate LTX results for the open pack (falls back to style-only). */
export function crashDeskLtxFetchUrl(styleId: ShowStyleId): string {
  const q = crashDeskOpenQuery(styleId);
  const params = new URLSearchParams({ styleId });
  if (q) params.set("folderName", q.folderName);
  return `/api/crash/comfy/ltx?${params.toString()}`;
}

export async function fetchStudioFingerprint(
  styleId: ShowStyleId,
): Promise<string> {
  const url = crashDeskStoryFetchUrl(styleId);
  const story = url
    ? ((await (await fetch(url)).json().catch(() => ({}))) as { story?: unknown })
        ?.story ?? null
    : null;
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
  writeOpenStoryCache({
    styleId: opts.styleId,
    folderName: opts.folderName,
    story: opts.story,
  });
}
