import type {
  CrashStoryBeat,
  CrashStoryDoc,
  CrashStoryShot,
} from "./crashStoryTypes";
import type { SceneKitDiskDraft } from "./crashSceneKitStore";
import { humanMediaLabel, inferWorldKeysFromPlates, pickBestMediaMatch } from "./mediaMatch";

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

  function shotFromPlate(plateFile: string, index: number): CrashStoryShot {
    const title = humanMediaLabel(plateFile);
    return {
      id: `shot_cloud_${index}`,
      title,
      summary: title,
      plateFile,
      beats: [{ id: `shot_cloud_${index}_hold`, speaker: "", text: "" }],
      sfx: [],
    };
  }

  const existingShots = story.scenes.flatMap((s) => s.shots);
  const plated = existingShots.filter((s) => cleanName(s.plateFile)).length;
  const stubStory = existingShots.length <= 1 && plated === 0;

  let scenes: CrashStoryDoc["scenes"];
  if (stubStory) {
    // EP01 / Cornish: recipe is one empty Shot 1; plates live on the kit / Blob.
    const kitPlates = kit.filter(Boolean);
    const source = kitPlates.length
      ? kitPlates
      : pool.filter((n) => !isLogoName(n));
    const base = story.scenes[0] || {
      id: "scene_cloud",
      title: "Scene 01",
      placeName: "",
      worldThumbKey: "",
      shots: [],
    };
    for (const f of source) taken.add(f);
    scenes = source.length
      ? [{ ...base, shots: source.map((f, i) => shotFromPlate(f, i + 1)) }]
      : story.scenes;
  } else {
    let shotIndex = 0;
    scenes = story.scenes.map((scene) => ({
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
  }

  scenes = scenes.map((scene) => ({
    ...scene,
    shots: scene.shots.map((shot, i) => {
      if (shot.beats.length) return shot;
      const title = shot.title || humanMediaLabel(shot.plateFile || "") || `Shot ${i + 1}`;
      return {
        ...shot,
        title,
        beats: [{ id: `${shot.id}_hold`, speaker: "", text: "" }],
      };
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
  worldFilenames?: string[],
): SceneKitDiskDraft | null {
  if (!kit) return null;
  const existing = (kit.plateFiles || []).map(cleanName).filter(Boolean);
  const fromStory: string[] = [];
  for (const scene of story.scenes) {
    for (const shot of scene.shots) {
      const f = cleanName(shot.plateFile);
      if (f) fromStory.push(f);
    }
  }
  const nextPlates = existing.length
    ? existing
    : fromStory.length
      ? fromStory
      : plateFilenames.map(cleanName).filter(Boolean);
  const havePlaces = (kit.worldKeys || []).filter(Boolean);
  const inferred = inferWorldKeysFromPlates(
    nextPlates,
    worldFilenames || [],
  ).filter((k) => !havePlaces.includes(k));
  const worldKeys = [...havePlaces, ...inferred];
  return {
    ...kit,
    plateFiles: nextPlates.length ? nextPlates : kit.plateFiles,
    plateSlotCount: Math.max(kit.plateSlotCount || 9, nextPlates.length),
    worldKeys,
    placeSlotCount: Math.max(kit.placeSlotCount || 5, worldKeys.length, 5),
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
  let scenes = story.scenes.map((scene) => ({
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

  scenes = scenes.map((scene) => ({
    ...scene,
    shots: scene.shots.map((shot) => {
      const hasVoice = shot.beats.some((b) => cleanName(b.voiceFile));
      if (hasVoice || !shot.plateFile) return shot;
      const unused = dialogue.filter((n) => !taken.has(n));
      const hit = pickBestMediaMatch(shot.plateFile, unused, undefined, 3);
      if (!hit) return shot;
      const fam = hit.replace(/\.[^.]+$/, "").replace(/_\d+$/, "");
      const famRe = new RegExp(
        `^${fam.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(_\\d+)?$`,
        "i",
      );
      const takes = unused
        .filter((n) => famRe.test(n.replace(/\.[^.]+$/, "")))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const files = takes.length ? takes : [hit];
      for (const f of files) taken.add(f);
      const speakerGuess = (fn: string): string => {
        const b = fn.replace(/\.[^.]+$/, "");
        if (/^MUM_/i.test(b)) return "Mum";
        if (/^DAD_/i.test(b)) return "Dad";
        if (/^DAP_/i.test(b)) return "DAP";
        if (/^FUZZ_/i.test(b)) return "Fuzz";
        if (/^JUDGE_/i.test(b)) return "Judge";
        if (/^SILAS_/i.test(b)) return "Silas";
        const h = /^H\d+_(.+)$/i.exec(b);
        if (h) return h[1].replace(/_/g, " ");
        return "";
      };
      return {
        ...shot,
        beats: files.map((fn, i) => ({
          id: `${shot.id}_a${i + 1}`,
          speaker: speakerGuess(fn),
          text: humanMediaLabel(fn),
          voiceFile: fn,
        })),
      };
    }),
  }));

  return {
    ...story,
    intro: { ...story.intro, voiceFile: introVo },
    outro: { ...story.outro, voiceFile: outroVo },
    scenes,
  };
}
