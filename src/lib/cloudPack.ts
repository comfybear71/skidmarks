import { useCloudStore } from "./cloudEnv";
import {
  getLatestOpenedEpisode,
  getNeonEpisode,
  listNeonEpisodes,
  listNeonFiles,
  listNeonShowFiles,
  markEpisodeOpened,
  upsertNeonEpisode,
  upsertNeonShow,
  type NeonEpisodeRow,
} from "./neonStore";
import { getShowStylePreset, type ShowStyleId } from "./showStylePresets";
import { firstPlateFile, type CrashLabEpisodeListItem, type CrashLabEpisodeMeta } from "./crashLabEpisodes";
import type { CrashStoryDoc } from "./crashStoryTypes";
import type { SceneKitDiskDraft } from "./crashSceneKitStore";
import { listComfyBeats, type ComfyDraft } from "./crashComfyStack";
import {
  attachAudioFilenamesToStory,
  attachPlateFilenamesToSceneKit,
  attachPlateFilenamesToStory,
} from "./cloudStoryMedia";
import { mapPackMp4sToBeats } from "./mediaMatch";

function toListItem(row: NeonEpisodeRow): CrashLabEpisodeListItem {
  return {
    label: row.name,
    styleId: row.show_id as ShowStyleId,
    folderName: row.folder_name,
    savedAt: row.saved_at || "",
    path: `shows/${row.show_id}/episodes/${row.folder_name}`,
    hasStory: Boolean(row.has_story || row.story_json),
    hasSceneKit: Boolean(row.has_scene_kit || row.scene_kit_json),
    thumbFile: firstPlateFile(row.story_json as never),
  };
}

export async function listCloudEpisodes(
  styleId: ShowStyleId,
): Promise<CrashLabEpisodeListItem[]> {
  if (!useCloudStore()) return [];
  const rows = await listNeonEpisodes(styleId);
  return rows.map(toListItem);
}

export async function cloudActivePack(styleId?: ShowStyleId): Promise<{
  folderName: string;
  styleId: ShowStyleId;
} | null> {
  if (!useCloudStore()) return null;
  const row = await getLatestOpenedEpisode(styleId);
  if (!row?.folder_name || !row.show_id) return null;
  if (styleId && row.show_id !== styleId) return null;
  return {
    folderName: row.folder_name,
    styleId: row.show_id as ShowStyleId,
  };
}

async function hydrateEpisodeMedia(row: NeonEpisodeRow): Promise<{
  story: CrashStoryDoc;
  sceneKit: SceneKitDiskDraft | null;
}> {
  const storyRaw = row.story_json;
  if (!storyRaw?.styleId) {
    throw new Error("No story saved in cloud for that episode");
  }
  const plates = await listNeonFiles({ episodeId: row.id, kind: "plates" });
  const audio = await listNeonFiles({ episodeId: row.id, kind: "audio" });
  const world = await listNeonShowFiles({
    showId: row.show_id as ShowStyleId,
    kind: "world",
  });
  const cast = await listNeonShowFiles({
    showId: row.show_id as ShowStyleId,
    kind: "cast",
  });
  const names = plates.map((f) => f.filename);
  const kitRaw = (row.scene_kit_json as SceneKitDiskDraft) || null;
  const withPlates = attachPlateFilenamesToStory(
    storyRaw,
    names,
    kitRaw?.plateFiles,
  );
  const story = attachAudioFilenamesToStory(
    withPlates,
    audio.map((f) => f.filename),
  );
  const labeled = {
    ...story,
    campaignLabel: story.campaignLabel?.trim() || row.name || story.campaignLabel,
  };
  return {
    story: labeled,
    sceneKit: attachPlateFilenamesToSceneKit(
      kitRaw,
      labeled,
      names,
      world.map((w) => w.filename),
      cast.map((c) => ({ filename: c.filename, label: c.label_name })),
    ),
  };
}

export async function openCloudEpisode(opts: {
  folderName: string;
  styleId: ShowStyleId;
}): Promise<{
  story: CrashStoryDoc;
  sceneKit: SceneKitDiskDraft | null;
  comfyDraft: ComfyDraft | null;
  ltxCount: number;
  ltxResults: { beatId: string; url: string; file: string }[];
  lipsyncCount: number;
  backupFile: string | null;
  meta: CrashLabEpisodeMeta;
}> {
  const row = await getNeonEpisode(opts.styleId, opts.folderName);
  if (!row) {
    throw new Error("Episode not in cloud yet — upload from local Studio first");
  }
  const { story, sceneKit } = await hydrateEpisodeMedia(row);
  if (story.styleId !== opts.styleId) {
    throw new Error(
      `That pack is ${story.styleId}, not ${opts.styleId}. Switch the style dropdown.`,
    );
  }
  await markEpisodeOpened(opts.styleId, opts.folderName);
  const ltx = await cloudLtxResultsForStyle(opts.styleId, opts.folderName);
  return {
    story,
    sceneKit,
    comfyDraft: (row.comfy_draft_json as ComfyDraft) || null,
    ltxCount: ltx.length,
    ltxResults: ltx,
    lipsyncCount: 0,
    backupFile: null,
    meta: {
      label: row.name,
      styleId: opts.styleId,
      folderName: row.folder_name,
      savedAt: row.saved_at || "",
    },
  };
}

function storyHasScenes(story: unknown): boolean {
  if (!story || typeof story !== "object") return false;
  const scenes = (story as CrashStoryDoc).scenes;
  return Array.isArray(scenes) && scenes.length > 0;
}

function kitFillCount(kit: unknown): number {
  if (!kit || typeof kit !== "object") return 0;
  const k = kit as SceneKitDiskDraft;
  return (
    (k.worldKeys || []).filter(Boolean).length +
    (k.castKeys || []).filter(Boolean).length +
    (String(k.arseholeKey || "").trim() ? 1 : 0) +
    (k.plateFiles || []).filter(Boolean).length
  );
}

export async function saveCloudEpisodeMeta(opts: {
  styleId: ShowStyleId;
  folderName: string;
  label: string;
  story: CrashStoryDoc;
  sceneKit?: unknown | null;
  comfyDraft?: unknown | null;
}): Promise<CrashLabEpisodeListItem> {
  const preset = getShowStylePreset(opts.styleId);
  await upsertNeonShow(opts.styleId, preset.label);
  const existing = await getNeonEpisode(opts.styleId, opts.folderName);
  // Keep Neon when the incoming doc is a scene-less GET stub — never when
  // the caller cleared plates / added unplated test cards. A plated-count
  // guard here made Clear all a no-op: job.shots emptied, story_json stayed
  // the old Comfy/Land crowd, and the next add appended onto that corpse.
  const keepStory =
    storyHasScenes(existing?.story_json) && !storyHasScenes(opts.story)
      ? (existing!.story_json as CrashStoryDoc)
      : opts.story;
  const incomingKit = opts.sceneKit ?? null;
  const existingKit = existing?.scene_kit_json ?? null;
  const keepKit =
    kitFillCount(existingKit) > 0 && kitFillCount(incomingKit) === 0
      ? existingKit
      : incomingKit;
  await upsertNeonEpisode({
    showId: opts.styleId,
    folderName: opts.folderName,
    name: opts.label,
    hasStory: true,
    hasSceneKit: Boolean(keepKit),
    storyJson: keepStory,
    sceneKitJson: keepKit,
    comfyDraftJson: opts.comfyDraft ?? null,
  });
  const row = await getNeonEpisode(opts.styleId, opts.folderName);
  if (row) return toListItem(row);
  return {
    label: opts.label,
    styleId: opts.styleId,
    folderName: opts.folderName,
    savedAt: new Date().toISOString(),
    path: `shows/${opts.styleId}/episodes/${opts.folderName}`,
    hasStory: true,
    hasSceneKit: Boolean(opts.sceneKit),
  };
}

export async function readCloudEpisodeStory(
  styleId: ShowStyleId,
  folderName: string,
): Promise<CrashStoryDoc | null> {
  if (!useCloudStore()) return null;
  const row = await getNeonEpisode(styleId, folderName);
  if (!row?.story_json?.styleId) return null;
  const { story } = await hydrateEpisodeMedia(row);
  return story;
}

export async function readCloudEpisodeSceneKit(
  styleId: ShowStyleId,
  folderName: string,
): Promise<SceneKitDiskDraft | null> {
  if (!useCloudStore()) return null;
  const row = await getNeonEpisode(styleId, folderName);
  if (!row?.story_json?.styleId && !row?.scene_kit_json) return null;
  if (!row.story_json?.styleId) {
    const world = await listNeonShowFiles({
      showId: row.show_id as ShowStyleId,
      kind: "world",
    });
    const plates = await listNeonFiles({ episodeId: row.id, kind: "plates" });
    return attachPlateFilenamesToSceneKit(
      row.scene_kit_json as SceneKitDiskDraft,
      {
        styleId,
        campaignLabel: row.name || folderName,
        gagNote: "",
        intro: { title: "", notes: "", sfx: [] },
        outro: { title: "", notes: "", sfx: [] },
        scenes: [],
        updatedAt: "",
      },
      plates.map((f) => f.filename),
      world.map((w) => w.filename),
    );
  }
  const { sceneKit } = await hydrateEpisodeMedia(row);
  return sceneKit;
}

export async function readCloudStory(
  styleId: ShowStyleId,
): Promise<CrashStoryDoc | null> {
  if (!useCloudStore()) return null;
  const row = await getLatestOpenedEpisode(styleId);
  if (!row?.story_json?.styleId) return null;
  const { story } = await hydrateEpisodeMedia(row);
  return story;
}

export async function writeCloudStory(story: CrashStoryDoc): Promise<boolean> {
  if (!useCloudStore()) return false;
  const opened = await getLatestOpenedEpisode(story.styleId);
  const folderName =
    opened?.folder_name ||
    story.campaignLabel?.trim() ||
    "Untitled episode";
  const label = story.campaignLabel?.trim() || folderName;
  await saveCloudEpisodeMeta({
    styleId: story.styleId,
    folderName,
    label,
    story,
    sceneKit: opened?.scene_kit_json ?? null,
    comfyDraft: opened?.comfy_draft_json ?? null,
  });
  return true;
}

/** Pack mp4s → Animate player rows for the open cloud episode. */
export async function cloudLtxResultsForStyle(
  styleId: ShowStyleId,
  folderName?: string,
): Promise<{ beatId: string; url: string; file: string }[]> {
  if (!useCloudStore()) return [];
  const row = folderName
    ? await getNeonEpisode(styleId, folderName)
    : await getLatestOpenedEpisode(styleId);
  if (!row?.story_json?.styleId) return [];
  if (row.show_id !== styleId) return [];
  const { story } = await hydrateEpisodeMedia(row);
  const mp4s = (await listNeonFiles({ episodeId: row.id, kind: "mp4" })).map(
    (f) => f.filename,
  );
  return mapPackMp4sToBeats(listComfyBeats(story), mp4s).map((hit) => ({
    beatId: hit.beatId,
    file: hit.file,
    url: `/api/crash/comfy/ltx/file?name=${encodeURIComponent(hit.file)}`,
  }));
}
