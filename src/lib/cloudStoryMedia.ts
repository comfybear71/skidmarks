import type { CrashStoryBeat, CrashStoryDoc } from "./crashStoryTypes";
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

function isSfxAudioName(name: string): boolean {
  return /(?:^|_)sfx(?:_|-|$)/i.test(name) || /^hold_/i.test(name);
}

function parseDialogueAudioName(name: string): {
  shotNum: number;
  beatNum: number;
  speaker: string;
  text: string;
} | null {
  const m = name.match(/^(\d{2})_(\d{2})_([^_]+)_(.+)\.(mp3|wav|ogg|m4a)$/i);
  if (!m) return null;
  const speaker = m[3].replace(/[-_]+/g, " ").trim();
  const text = m[4].replace(/-/g, " ").trim();
  return {
    shotNum: Number(m[1]),
    beatNum: Number(m[2]),
    speaker,
    text,
  };
}

function beatFromAudioName(
  shotId: string,
  filename: string,
  fallbackBeat: number,
): CrashStoryBeat {
  const parsed = parseDialogueAudioName(filename);
  return {
    id: `${shotId}_a${parsed?.beatNum || fallbackBeat}`,
    speaker: parsed?.speaker || "",
    text: parsed?.text || "",
    voiceFile: filename,
  };
}

/**
 * Disk packs link beats to audio\ mp3s. Cloud recipes often have empty
 * voiceFile (or empty beats → DAP silent hold) while Neon still has the mp3s.
 * Prefer those files over a silent-hold row.
 */
export function attachAudioFilenamesToStory(
  story: CrashStoryDoc,
  audioFilenames: string[],
): CrashStoryDoc {
  const pool = audioFilenames.map(cleanName).filter(Boolean);
  const dialogue = pool.filter((n) => !isSfxAudioName(n));
  if (!pool.length) return story;

  const taken = new Set<string>();
  const keep = (current: string | undefined): string => {
    const have = cleanName(current);
    if (have && pool.includes(have)) {
      taken.add(have);
      return have;
    }
    return "";
  };
  const takeNamed = (name: string): string => {
    const n = cleanName(name);
    if (!n || taken.has(n) || !pool.includes(n)) return "";
    taken.add(n);
    return n;
  };
  const takeForShot = (shotNum: number): string => {
    const hit = dialogue.find((n) => {
      if (taken.has(n)) return false;
      const p = parseDialogueAudioName(n);
      return p ? p.shotNum === shotNum : false;
    });
    if (hit) {
      taken.add(hit);
      return hit;
    }
    const next = dialogue.find(
      (n) => !taken.has(n) && !parseDialogueAudioName(n),
    );
    if (!next) return "";
    taken.add(next);
    return next;
  };

  const introVo = keep(story.intro.voiceFile) || story.intro.voiceFile;
  const outroVo = keep(story.outro.voiceFile) || story.outro.voiceFile;

  let shotNum = 0;
  const scenes = story.scenes.map((scene) => ({
    ...scene,
    shots: scene.shots.map((shot) => {
      shotNum += 1;
      const n = shotNum;
      if (!shot.beats.length) {
        const files = dialogue
          .filter((fn) => {
            if (taken.has(fn)) return false;
            const p = parseDialogueAudioName(fn);
            return p ? p.shotNum === n : false;
          })
          .sort((a, b) => {
            const pa = parseDialogueAudioName(a);
            const pb = parseDialogueAudioName(b);
            return (pa?.beatNum || 0) - (pb?.beatNum || 0);
          });
        if (!files.length) {
          const leftover = dialogue.filter(
            (fn) => !taken.has(fn) && !parseDialogueAudioName(fn),
          );
          if (!leftover.length) return shot;
          files.push(leftover[0]!);
        }
        const beats = files.map((fn, i) => {
          taken.add(fn);
          return beatFromAudioName(shot.id, fn, i + 1);
        });
        return { ...shot, beats };
      }

      const beats = shot.beats.map((beat, beatIndex) => {
        const existing = keep(beat.voiceFile);
        if (existing) return { ...beat, voiceFile: existing };
        const byId = takeNamed(`${beat.id}.mp3`);
        const parsedHit = dialogue.find((fn) => {
          if (taken.has(fn)) return false;
          const p = parseDialogueAudioName(fn);
          return Boolean(p && p.shotNum === n && p.beatNum === beatIndex + 1);
        });
        const fromParsed = parsedHit ? takeNamed(parsedHit) : "";
        const voiceFile = byId || fromParsed || takeForShot(n);
        if (!voiceFile) return beat;
        const parsed = parseDialogueAudioName(voiceFile);
        const silent = !beat.text.trim();
        return {
          ...beat,
          voiceFile,
          speaker:
            silent && parsed?.speaker ? parsed.speaker : beat.speaker,
          text: silent && parsed?.text ? parsed.text : beat.text,
        };
      });
      return { ...shot, beats };
    }),
  }));

  return {
    ...story,
    intro: { ...story.intro, voiceFile: introVo },
    outro: { ...story.outro, voiceFile: outroVo },
    scenes,
  };
}
