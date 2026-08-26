import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { episodePackDir } from "@/lib/crashLabEpisodes";
import type { CrashStoryDoc } from "@/lib/crashStoryTypes";
import type { ShowStyleId } from "@/lib/showStylePresets";

/**
 * Spoken Save names: `03_01_Ranger_Bazza_line_mtaj6shu.mp3`.
 * Hold files stay `beat_9d909fn.mp3` — do not strip that id as a take stamp.
 */
export function voiceFileStem(fileName: string): string {
  const base = path.basename(String(fileName || "")).replace(/\.mp3$/i, "");
  if (/^\d{2}_\d{2}_/.test(base)) {
    return base.replace(/_[0-9a-z]{5,14}$/i, "");
  }
  return base;
}

export function findSiblingVoiceFile(dir: string, stampedName: string): string | null {
  const want = path.basename(stampedName);
  if (!want || !dir || !existsSync(dir)) return null;
  const exact = path.join(dir, want);
  if (existsSync(exact)) return want;
  const stem = voiceFileStem(want);
  if (!stem || stem === path.basename(want).replace(/\.mp3$/i, "")) return null;
  const hits = readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith(".mp3") && voiceFileStem(name) === stem)
    .sort();
  return hits[0] ?? null;
}

export function findSiblingVoicePath(dirs: string[], stampedName: string): string | null {
  for (const dir of dirs) {
    const name = findSiblingVoiceFile(dir, stampedName);
    if (!name) continue;
    const full = path.join(dir, name);
    if (existsSync(full)) return full;
  }
  return null;
}

export function packAudioDir(styleId: ShowStyleId, folderName: string): string | null {
  const folder = String(folderName || "").trim();
  if (!folder) return null;
  try {
    return path.join(episodePackDir(folder, styleId), "audio");
  } catch {
    return null;
  }
}

export function rebindStoryVoiceFiles(
  story: CrashStoryDoc,
  audioDir: string,
): { rebound: number; missing: string[] } {
  const missing: string[] = [];
  let rebound = 0;
  const scenes = (story.scenes || []).map((scene) => ({
    ...scene,
    shots: (scene.shots || []).map((shot) => ({
      ...shot,
      beats: (shot.beats || []).map((beat) => {
        const want = String(beat.voiceFile || "").trim();
        if (!want) return beat;
        const found = findSiblingVoiceFile(audioDir, want);
        if (!found) {
          missing.push(`${beat.id}:${want}`);
          return beat;
        }
        if (found === path.basename(want)) return beat;
        rebound += 1;
        return { ...beat, voiceFile: found };
      }),
    })),
  }));
  story.scenes = scenes;
  return { rebound, missing };
}

export function rebindJobClipVoices<T extends { voiceFile?: string }>(
  clips: T[],
  audioDir: string,
): { clips: T[]; rebound: number } {
  let rebound = 0;
  const next = (clips || []).map((clip) => {
    const want = String(clip.voiceFile || "").trim();
    if (!want) return clip;
    const found = findSiblingVoiceFile(audioDir, want);
    if (!found || found === path.basename(want)) return clip;
    rebound += 1;
    return { ...clip, voiceFile: found };
  });
  return { clips: next, rebound };
}
