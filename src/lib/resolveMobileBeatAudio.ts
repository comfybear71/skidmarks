import path from "path";
import { isSafeMediaName } from "./cloudMedia";
import { resolveBeatAudioPath } from "./crashStorySpeak";
import { storyDialogueDir } from "./crashStoryLocations";
import {
  resolveMobileMedia,
  resolveMobileMediaByFilename,
} from "./mobileMediaStore";
import type { ShowStyleId } from "./showStylePresets";

/**
 * Same lookup Play uses: disk, then this pack's Blob folder, then Neon
 * by filename. LTX used to stop at disk and die GEN MP3 while Play worked.
 */
export async function resolveMobileBeatAudio(opts: {
  styleId: ShowStyleId;
  folderName: string;
  beatId: string;
  voiceFile?: string;
}): Promise<string | null> {
  const names = [
    ...new Set(
      [opts.voiceFile?.trim(), opts.beatId ? `${opts.beatId}.mp3` : ""].filter(
        (n): n is string => Boolean(n),
      ),
    ),
  ];
  for (const fileName of names) {
    if (!isSafeMediaName(fileName)) continue;
    const destPath = path.join(storyDialogueDir(opts.styleId), fileName);
    const onDisk = resolveBeatAudioPath(opts.styleId, opts.beatId, fileName);
    if (onDisk) return onDisk;
    if (!opts.folderName) continue;
    const fromFolder = await resolveMobileMedia({
      styleId: opts.styleId,
      folderName: opts.folderName,
      kind: "audio",
      fileName,
      destPath,
    });
    if (fromFolder) return fromFolder;
    const byName = await resolveMobileMediaByFilename({
      kind: "audio",
      fileName,
      destPath,
    });
    if (byName) return byName;
  }
  return null;
}
