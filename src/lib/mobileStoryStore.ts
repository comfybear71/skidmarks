/**
 * Story read/write for the mobile pipeline — a run spans many separate
 * requests (screenplay -> candidates -> step, repeated), and on Vercel each
 * can land on a different serverless instance with its own scratch /tmp, so
 * readCrashStory()/writeCrashStory() (local-disk only) silently see a blank
 * or stale story once a request lands on a fresh instance. Reads/writes go
 * through Neon (keyed by the job's own folderName, not the "latest opened"
 * pointer — a mobile job shouldn't care what else was opened elsewhere) when
 * useCloudStore() is live, and always mirror to local disk too so the rest
 * of the Crash Lab machinery (which expects readCrashStory() to just work
 * within a request) keeps working unchanged.
 */
import fs from "fs";
import path from "path";
import { useCloudStore } from "./cloudEnv";
import { readCloudEpisodeStory, saveCloudEpisodeMeta } from "./cloudPack";
import { readCrashStory, writeCrashStory } from "./crashStory";
import { writeActivePack } from "./crashActivePack";
import { episodePackDir } from "./crashLabEpisodes";
import type { CrashStoryDoc } from "./crashStoryTypes";
import type { ShowStyleId } from "./showStylePresets";

export async function readMobileStory(
  styleId: ShowStyleId,
  folderName: string,
): Promise<CrashStoryDoc> {
  if (useCloudStore()) {
    const cloud = await readCloudEpisodeStory(styleId, folderName);
    if (cloud) {
      writeCrashStory(cloud);
      return cloud;
    }
  }
  return readCrashStory(styleId);
}

/**
 * Recreate the pack folder shell + story.json on THIS container's scratch
 * disk from the cloud story, and point the active-pack pointer at it —
 * needed before any call that expects a real local pack folder (e.g.
 * openCrashLabEpisode, which reads _RECIPE/story.json directly rather than
 * through readCrashStory()'s active-pack indirection). No-op locally, where
 * the pack folder already exists for real.
 */
export async function hydrateMobilePackOnDisk(
  styleId: ShowStyleId,
  folderName: string,
): Promise<void> {
  if (!useCloudStore()) return;
  const story = await readCloudEpisodeStory(styleId, folderName);
  if (!story) return;
  const dir = episodePackDir(folderName, styleId);
  for (const sub of [
    "_RECIPE",
    "audio",
    "plates",
    "mp4",
    path.join("images", "characters"),
    path.join("images", "places"),
  ]) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }
  fs.writeFileSync(
    path.join(dir, "_RECIPE", "story.json"),
    JSON.stringify(story, null, 2) + "\n",
  );
  writeActivePack({ folderName, styleId });
}

export async function writeMobileStory(
  story: CrashStoryDoc,
  folderName: string,
): Promise<void> {
  if (useCloudStore()) {
    await saveCloudEpisodeMeta({
      styleId: story.styleId,
      folderName,
      label: story.campaignLabel?.trim() || folderName,
      story,
    });
  } else {
    writeCrashStory(story);
  }
}
