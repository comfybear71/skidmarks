import type { ShowStyleId } from "./showStylePresets";
import { liveCastRoster } from "./styleCardThumbs";
import { livePlaceNames } from "./worldCardThumbs";
import { buildAiWriterBrief, type AiWriterLiveData } from "./cursorAiWriterTemplate";
import path from "path";
import { showArchiveRoot } from "./showArchivePaths";

export const AI_WRITER_FILE = "AI_EPISODE_WRITER.txt";

/** Full path to AI_EPISODE_WRITER.txt on disk. */
export function aiWriterTemplatePath(styleId: ShowStyleId): string | null {
  const root = showArchiveRoot(styleId);
  if (!root) return null;
  return path.join(root, AI_WRITER_FILE);
}

/** AI brief with cast + places read fresh from Studio galleries. */
export function buildAiWriterBriefLive(styleId: ShowStyleId): string {
  const cast = liveCastRoster(styleId);
  const places = livePlaceNames(styleId);
  const live: AiWriterLiveData = { cast, places };
  return buildAiWriterBrief(styleId, live);
}

export function liveRosterForStyle(styleId: ShowStyleId): AiWriterLiveData {
  return {
    cast: liveCastRoster(styleId),
    places: livePlaceNames(styleId),
  };
}
