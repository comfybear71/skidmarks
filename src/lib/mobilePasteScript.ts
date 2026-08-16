import type { CrashStoryDoc } from "./crashStoryTypes";
import type { ShowStyleId } from "./showStylePresets";
import { createCursorEpisodePack } from "./cursorPackCreate";
import { writeCrashStory } from "./crashStory";
import { saveCrashLabEpisode } from "./crashLabEpisodes";
import { hydrateShowShelfManifests, persistCursorPackToCloud } from "./cursorCloudSync";

export {
  MOBILE_PASTE_SAMPLE,
  episodeTemplateFromJob,
  normalizePlaceKey,
  parseMobilePaste,
  storyHasSpokenLine,
  type MobilePasteResult,
} from "./mobilePasteParse";

export async function importPastedStory(opts: {
  styleId: ShowStyleId;
  title: string;
  story: CrashStoryDoc;
}): Promise<{ folderName: string }> {
  await hydrateShowShelfManifests(opts.styleId);
  const created = createCursorEpisodePack({
    styleId: opts.styleId,
    baseLabel: opts.title,
    cursorPrefix: false,
  });
  const story: CrashStoryDoc = {
    ...opts.story,
    styleId: opts.styleId,
    campaignLabel: opts.story.campaignLabel || opts.title,
  };
  writeCrashStory(story);
  saveCrashLabEpisode({
    styleId: opts.styleId,
    folderName: created.folderName,
    label: story.campaignLabel,
  });
  await persistCursorPackToCloud({
    styleId: opts.styleId,
    folderName: created.folderName,
    story,
    sceneKit: created.sceneKit,
  });
  return { folderName: created.folderName };
}
