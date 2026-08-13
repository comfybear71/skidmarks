import type { CrashStoryDoc } from "./crashStoryTypes";
import type { SceneKitDiskDraft } from "./crashSceneKitStore";

function cleanName(name: string | undefined): string {
  return String(name || "").trim();
}

function isLogoName(name: string): boolean {
  return /^(cgen_|.*(?:logo|title|credits))/i.test(name);
}

/**
 * Disk packs show a thumb when story.plateFile matches a file in plates\.
 * Cloud recipes sometimes have the files in Neon but empty plateFile ("no plate").
 * Keep existing names; fill empty slots from this episode's plate filenames.
 */
export function attachPlateFilenamesToStory(
  story: CrashStoryDoc,
  plateFilenames: string[],
  sceneKitPlates?: string[],
): CrashStoryDoc {
  const pool = plateFilenames.map(cleanName).filter(Boolean);
  const kit = (sceneKitPlates || []).map(cleanName);
  if (!pool.length && !kit.some(Boolean)) return story;

  const taken = new Set<string>();
  const keepOrFill = (current: string | undefined, prefer?: string): string => {
    const have = cleanName(current);
    if (have) {
      taken.add(have);
      return have;
    }
    const pref = cleanName(prefer);
    if (pref && pool.includes(pref) && !taken.has(pref)) {
      taken.add(pref);
      return pref;
    }
    return "";
  };
  const takeFromPool = (pred: (n: string) => boolean): string => {
    const next = pool.find((n) => !taken.has(n) && pred(n));
    if (!next) return "";
    taken.add(next);
    return next;
  };

  let shotIndex = 0;
  const scenes = story.scenes.map((scene) => ({
    ...scene,
    shots: scene.shots.map((shot) => {
      const fromKit = kit[shotIndex];
      shotIndex += 1;
      let plateFile = keepOrFill(shot.plateFile, fromKit);
      if (!plateFile) {
        plateFile = takeFromPool((n) => !isLogoName(n));
      }
      return { ...shot, plateFile };
    }),
  }));

  const introLogo =
    keepOrFill(story.intro.logoFile) || takeFromPool(isLogoName);
  const outroLogo =
    keepOrFill(story.outro.logoFile) || takeFromPool(isLogoName);

  return {
    ...story,
    intro: { ...story.intro, logoFile: introLogo || story.intro.logoFile },
    outro: { ...story.outro, logoFile: outroLogo || story.outro.logoFile },
    scenes,
  };
}

export function attachPlateFilenamesToSceneKit(
  kit: SceneKitDiskDraft | null,
  story: CrashStoryDoc,
  plateFilenames: string[],
): SceneKitDiskDraft | null {
  if (!kit) return null;
  const existing = (kit.plateFiles || []).map(cleanName).filter(Boolean);
  if (existing.length) return kit;
  const fromStory: string[] = [];
  for (const scene of story.scenes) {
    for (const shot of scene.shots) {
      const f = cleanName(shot.plateFile);
      if (f) fromStory.push(f);
    }
  }
  const next = fromStory.length
    ? fromStory
    : plateFilenames.map(cleanName).filter(Boolean);
  if (!next.length) return kit;
  return {
    ...kit,
    plateFiles: next,
    plateSlotCount: Math.max(kit.plateSlotCount || 9, next.length),
  };
}
