import { cloudEnvReady } from "./cloudEnv";
import { deleteBlobFiles } from "./blobStore";
import { episodeRowId, listNeonFiles, deleteNeonFiles } from "./neonStore";
import { isLeftoverPackVoiceFile, isMobileSavedVoiceFile } from "./mobileSavedVoice";
import type { CrashStoryDoc } from "./crashStoryTypes";
import type { ShowStyleId } from "./showStylePresets";

export function savedVoiceFilesOnStory(story: CrashStoryDoc): string[] {
  const out: string[] = [];
  for (const sc of story.scenes) {
    for (const sh of sc.shots) {
      for (const b of sh.beats) {
        const n = (b.voiceFile || "").trim();
        if (isMobileSavedVoiceFile(n)) out.push(n);
      }
    }
  }
  return out;
}

/**
 * On Open, burn leftover compiled-pack `01_05_NAME_slug.mp3` so hydrate
 * cannot glue them back. Keep files still on the story.
 */
export async function burnLeftoverPackAudio(opts: {
  styleId: ShowStyleId;
  folderName: string;
  keepFiles?: Iterable<string>;
}): Promise<number> {
  if (!cloudEnvReady() || !opts.folderName) return 0;
  const keep = new Set(
    [...(opts.keepFiles || [])].map((n) => String(n || "").trim()).filter(Boolean),
  );
  const rows = await listNeonFiles({
    episodeId: episodeRowId(opts.styleId, opts.folderName),
    kind: "audio",
  });
  const burn = rows.filter((r) => {
    const name = (r.filename || "").trim();
    if (!isLeftoverPackVoiceFile(name)) return false;
    if (keep.has(name)) return false;
    return true;
  });
  if (!burn.length) return 0;
  const pathnames = burn
    .map((r) => (r.blob_pathname || r.blob_url || "").trim())
    .filter(Boolean);
  await deleteBlobFiles(pathnames);
  await deleteNeonFiles(burn.map((r) => r.id).filter(Boolean));
  return burn.length;
}
