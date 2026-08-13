/**
 * Same client path as clicking Open episode — copy pack into the working desk.
 * Never deletes pack media.
 */
import {
  CRASH_COMFY_DEFAULT_GLOBAL,
  writeComfyDraft,
  type ComfyDraft,
} from "./crashComfyStack";
import { setActiveEpisodeFromOpen, writeOpenLtxCache } from "./crashActiveEpisode";
import {
  hydrateSceneKitFromDisk,
  writeSceneKitDraft,
} from "./crashSceneKitFields";
import { dispatchStorySaved } from "./crashStyleSync";
import { saveShowStyleId, type ShowStyleId } from "./showStylePresets";

export type OpenedPackOnDesk = {
  folderName: string;
  styleId: ShowStyleId;
  story: unknown;
  comfyDraft?: unknown;
  meta?: { label?: string; folderName?: string; styleId?: ShowStyleId };
};

/** POST open → write style, scene kit, comfy draft, active episode. */
export async function openCrashLabPackOnDesk(opts: {
  folderName: string;
  styleId: ShowStyleId;
}): Promise<OpenedPackOnDesk> {
  const openRes = await fetch("/api/crash/episodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "open",
      folderName: opts.folderName,
      styleId: opts.styleId,
    }),
  });
  const opened = (await openRes.json()) as {
    error?: string;
    story?: unknown;
    sceneKit?: Parameters<typeof writeSceneKitDraft>[0] | null;
    ltxResults?: Array<{ beatId: string; url: string; file?: string }>;
    comfyDraft?: {
      global?: string;
      beats?: Record<string, { imageMotion?: string; segmentText?: string }>;
    };
    meta?: { label?: string; folderName?: string; styleId?: ShowStyleId };
  };
  if (!openRes.ok) {
    throw new Error(opened.error || "Open failed");
  }
  const nextStyle = (opened.meta?.styleId || opts.styleId) as ShowStyleId;
  saveShowStyleId(nextStyle);
  if (opened.comfyDraft) {
    const beats: ComfyDraft["beats"] = {};
    for (const [id, row] of Object.entries(opened.comfyDraft.beats || {})) {
      beats[id] = {
        imageMotion: row.imageMotion || "",
        segmentText: row.segmentText || "",
      };
    }
    writeComfyDraft(nextStyle, {
      global: opened.comfyDraft.global || CRASH_COMFY_DEFAULT_GLOBAL,
      beats,
    });
  }
  if (opened.sceneKit && typeof opened.sceneKit === "object") {
    writeSceneKitDraft(opened.sceneKit);
  } else {
    await hydrateSceneKitFromDisk();
  }
  setActiveEpisodeFromOpen({
    folderName: opts.folderName,
    label:
      opened.meta?.label || opened.meta?.folderName || opts.folderName,
    styleId: nextStyle,
    story: opened.story,
  });
  if (Array.isArray(opened.ltxResults) && opened.ltxResults.length) {
    writeOpenLtxCache({
      styleId: nextStyle,
      folderName: opts.folderName,
      results: opened.ltxResults,
    });
  }
  dispatchStorySaved();
  return {
    folderName: opts.folderName,
    styleId: nextStyle,
    story: opened.story,
    comfyDraft: opened.comfyDraft,
    meta: opened.meta,
  };
}

/**
 * Auto-restore is off. Cold load must not reopen last pack (Sunny Banks
 * was coming back after Close → pick Skidmarks). Open episode still uses
 * openCrashLabPackOnDesk.
 */
export async function hydrateCrashDeskFromServer(): Promise<{
  folderName: string;
  styleId: ShowStyleId;
} | null> {
  return null;
}
