import type { ScriptEpisodeData } from "./types";
import type { ShowStyleId } from "./showStylePresets";
import { createCursorEpisodePack } from "./cursorPackCreate";
import { writeCrashStory } from "./crashStory";
import { saveCrashLabEpisode } from "./crashLabEpisodes";
import { scriptEpisodeToStoryDoc } from "./scriptToStory";
import { hydrateShowShelfManifests, persistCursorPackToCloud } from "./cursorCloudSync";

export type ImportedScriptEpisode = {
  episodeNum: number;
  title: string;
  folderName: string;
  scenes: number;
  lines: number;
};

/**
 * Turn parsed screenplay episodes into real Crash Lab episode packs —
 * one pack per episode, same pipeline CURSOR/PROMPT already use
 * (createCursorEpisodePack → writeCrashStory), immediately snapshotted
 * into that pack (saveCrashLabEpisode) so a multi-episode batch doesn't
 * just leave the last one sitting in the single shared "current" desk
 * slot. Cloud-synced too, so this survives on Vercel the same way.
 */
export async function importScriptEpisodes(
  styleId: ShowStyleId,
  episodes: ScriptEpisodeData[],
): Promise<ImportedScriptEpisode[]> {
  await hydrateShowShelfManifests(styleId);

  const results: ImportedScriptEpisode[] = [];
  for (const ep of episodes) {
    const created = createCursorEpisodePack({
      styleId,
      baseLabel: ep.title || `Episode ${ep.episodeNum}`,
      cursorPrefix: false,
    });
    const story = scriptEpisodeToStoryDoc(ep, styleId);
    writeCrashStory(story);
    saveCrashLabEpisode({
      styleId,
      folderName: created.folderName,
      label: story.campaignLabel,
    });
    await persistCursorPackToCloud({
      styleId,
      folderName: created.folderName,
      story,
      sceneKit: created.sceneKit,
    });

    results.push({
      episodeNum: ep.episodeNum,
      title: story.campaignLabel,
      folderName: created.folderName,
      scenes: ep.scenes.length,
      lines: ep.scenes.reduce((n, s) => n + s.dialogueLines.length, 0),
    });
  }
  return results;
}
