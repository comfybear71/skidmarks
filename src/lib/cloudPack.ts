import { useCloudStore } from "./cloudEnv";
import {
  getLatestOpenedEpisode,
  getNeonEpisode,
  listNeonEpisodes,
  listNeonFiles,
  markEpisodeOpened,
  upsertNeonEpisode,
  upsertNeonShow,
  type NeonEpisodeRow,
} from "./neonStore";
import { getShowStylePreset, type ShowStyleId } from "./showStylePresets";
import type { CrashLabEpisodeListItem, CrashLabEpisodeMeta } from "./crashLabEpisodes";
import type { CrashStoryDoc } from "./crashStoryTypes";
import type { SceneKitDiskDraft } from "./crashSceneKitStore";
import type { ComfyDraft } from "./crashComfyStack";
import {
  attachAudioFilenamesToStory,
  attachPlateFilenamesToSceneKit,
  attachPlateFilenamesToStory,
} from "./cloudStoryMedia";

function toListItem(row: NeonEpisodeRow): CrashLabEpisodeListItem {
  return {
    label: row.name,
    styleId: row.show_id as ShowStyleId,
    folderName: row.folder_name,
    savedAt: row.saved_at || "",
    path: `shows/${row.show_id}/episodes/${row.folder_name}`,
    hasStory: Boolean(row.has_story || row.story_json),
    hasSceneKit: Boolean(row.has_scene_kit || row.scene_kit_json),
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
  return {
    story: {
      ...story,
      campaignLabel: story.campaignLabel?.trim() || row.name || story.campaignLabel,
    },
    sceneKit: attachPlateFilenamesToSceneKit(kitRaw, story, names),
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
  return {
    story,
    sceneKit,
    comfyDraft: (row.comfy_draft_json as ComfyDraft) || null,
    ltxCount: 0,
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
  await upsertNeonEpisode({
    showId: opts.styleId,
    folderName: opts.folderName,
    name: opts.label,
    hasStory: true,
    hasSceneKit: Boolean(opts.sceneKit),
    storyJson: opts.story,
    sceneKitJson: opts.sceneKit ?? null,
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
