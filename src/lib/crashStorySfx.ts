import fs from "fs";
import path from "path";
import { readCrashStory, writeCrashStory } from "./crashStory";
import type { CrashStoryDoc, CrashStorySfx } from "./crashStoryTypes";
import { CRASH_DIR } from "./paths";
import { retireFile } from "./retire";
import type { ShowStyleId } from "./showStylePresets";

function storySfxDir(styleId: ShowStyleId): string {
  return path.join(CRASH_DIR, "story", styleId, "sfx");
}

export function storySfxPath(
  styleId: ShowStyleId,
  sfxId: string,
): string | null {
  if (!sfxId || sfxId.includes("..")) return null;
  const dir = storySfxDir(styleId);
  if (!fs.existsSync(dir)) return null;
  for (const ext of [".mp3", ".wav", ".m4a", ".ogg"]) {
    const p = path.join(dir, `${sfxId}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function patchSfxList(
  items: CrashStorySfx[],
  sfxId: string,
  audioFile: string,
): CrashStorySfx[] {
  return items.map((s) => (s.id === sfxId ? { ...s, audioFile } : s));
}

export function patchStorySfxAudio(
  doc: CrashStoryDoc,
  sfxId: string,
  audioFile: string,
): CrashStoryDoc {
  return {
    ...doc,
    intro: { ...doc.intro, sfx: patchSfxList(doc.intro.sfx, sfxId, audioFile) },
    outro: { ...doc.outro, sfx: patchSfxList(doc.outro.sfx, sfxId, audioFile) },
    scenes: doc.scenes.map((sc) => ({
      ...sc,
      shots: sc.shots.map((sh) => ({
        ...sh,
        sfx: patchSfxList(sh.sfx, sfxId, audioFile),
      })),
    })),
  };
}

export function saveStorySfxUpload(opts: {
  styleId: ShowStyleId;
  sfxId: string;
  buffer: Buffer;
  ext: string;
}): { audioFile: string; story: CrashStoryDoc } {
  const sfxId = opts.sfxId.trim();
  if (!sfxId || sfxId.includes("..") || !/^[\w-]+$/.test(sfxId)) {
    throw new Error("Bad sfx id");
  }
  const ext = opts.ext.toLowerCase();
  if (!/^\.(mp3|wav|m4a|ogg)$/.test(ext)) {
    throw new Error("Use mp3, wav, m4a, or ogg");
  }

  const dir = storySfxDir(opts.styleId);
  fs.mkdirSync(dir, { recursive: true });

  for (const old of [".mp3", ".wav", ".m4a", ".ogg"]) {
    const p = path.join(dir, `${sfxId}${old}`);
    if (fs.existsSync(p)) retireFile(p);
  }

  const fileName = `${sfxId}${ext === ".jpeg" ? ".jpg" : ext}`;
  fs.writeFileSync(path.join(dir, fileName), opts.buffer);

  let story = readCrashStory(opts.styleId);
  story = patchStorySfxAudio(story, sfxId, fileName);
  writeCrashStory(story);

  return { audioFile: fileName, story };
}

export function storySfxContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".wav") return "audio/wav";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".ogg") return "audio/ogg";
  return "audio/mpeg";
}
