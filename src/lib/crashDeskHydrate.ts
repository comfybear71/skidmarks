/**
 * Same client path as clicking Open episode — copy pack into the working desk.
 * Never deletes pack media.
 */
import { writeComfyDraft } from "./crashComfyStack";
import { setActiveEpisodeFromOpen } from "./crashActiveEpisode";
import { hydrateSceneKitFromDisk } from "./crashSceneKitFields";
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
    writeComfyDraft(nextStyle, opened.comfyDraft);
  }
  await hydrateSceneKitFromDisk();
  setActiveEpisodeFromOpen({
    folderName: opts.folderName,
    label:
      opened.meta?.label || opened.meta?.folderName || opts.folderName,
    styleId: nextStyle,
    story: opened.story,
  });
  dispatchStorySaved();
  return {
    folderName: opts.folderName,
    styleId: nextStyle,
    story: opened.story,
    comfyDraft: opened.comfyDraft,
    meta: opened.meta,
  };
}

/** Last night’s pack from the server — same as Open episode. */
export async function hydrateCrashDeskFromServer(): Promise<{
  folderName: string;
  styleId: ShowStyleId;
} | null> {
  const res = await fetch("/api/crash/episodes?active=1");
  const data = (await res.json()) as {
    pack?: { folderName?: string; styleId?: ShowStyleId } | null;
  };
  const pack = data.pack;
  if (!pack?.folderName || !pack.styleId) return null;
  const opened = await openCrashLabPackOnDesk({
    folderName: pack.folderName,
    styleId: pack.styleId,
  });
  return { folderName: opened.folderName, styleId: opened.styleId };
}
