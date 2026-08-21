import type { CrashStoryBeat, CrashStoryDoc, CrashStoryShot } from "./crashStoryTypes";
import { leftoverHydrateBeat } from "./mobilePlateLines";
import type { MobileClipUnit, MobileShotUnit } from "./mobileGenJob";
import { parkMobileClipFile } from "./mobileClipPark";
import { stackedClipFiles } from "./mobilePlateClips";

/** CAST × uses exact name match — not voiceNamesMatch (Jo must not vanish). */
export function castNamesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Pull a dropped CAST name out of prompt text so the model cannot print it on shirts. */
export function stripSpeakerWord(text: string, name: string): string {
  const n = name.trim();
  const src = String(text || "");
  if (!n || !src.trim()) return src;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const stripped = src.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
  return stripped
    .replace(/\s{2,}/g, " ")
    .replace(/\s*,\s*,+/g, ",")
    .replace(/,\s+and\s+,/gi, ", ")
    .replace(/\s+and\s+and\s+/gi, " and ")
    .replace(/^\s*,\s*/g, "")
    .replace(/,\s*$/g, "")
    .replace(/\s+,/g, ",")
    .trim();
}

function realBeats(shotId: string, beats: CrashStoryBeat[]): CrashStoryBeat[] {
  return beats.filter((b) => b.speaker.trim() && !leftoverHydrateBeat(shotId, b.id));
}

function scrubBeat(beat: CrashStoryBeat, name: string): CrashStoryBeat {
  return {
    ...beat,
    text: stripSpeakerWord(beat.text || "", name),
    imageMotion: beat.imageMotion
      ? stripSpeakerWord(beat.imageMotion, name)
      : beat.imageMotion,
  };
}

function scrubShot(shot: CrashStoryShot, name: string): CrashStoryShot | null {
  const beats = shot.beats
    .filter((b) => !castNamesMatch(b.speaker, name))
    .map((b) => scrubBeat(b, name));
  if (!realBeats(shot.id, beats).length) return null;
  const remaining = realBeats(shot.id, beats).map((b) => b.speaker.trim());
  return {
    ...shot,
    title: stripSpeakerWord(shot.title || "", name) || remaining.join(", ") || shot.title,
    summary: stripSpeakerWord(shot.summary || "", name),
    staging: stripSpeakerWord(shot.staging || "", name),
    beats,
  };
}

export type ScrubSpeakerResult = {
  story: CrashStoryDoc;
  removedShotIds: string[];
  removedBeatIds: string[];
};

/**
 * Drop CAST leftover: take the name off beats / plate words / motion.
 * Solo cards for that person leave the strip. Files stay (park, don't delete).
 * Does not wipe the pack or other people's shots.
 */
export function scrubSpeakerFromStory(
  story: CrashStoryDoc,
  name: string,
): ScrubSpeakerResult {
  const who = name.trim();
  const removedShotIds: string[] = [];
  const removedBeatIds: string[] = [];
  if (!who) {
    return { story, removedShotIds, removedBeatIds };
  }

  for (const sc of story.scenes) {
    for (const sh of sc.shots) {
      for (const b of sh.beats) {
        if (castNamesMatch(b.speaker, who)) removedBeatIds.push(b.id);
      }
    }
  }

  const intro = story.intro
    ? { ...story.intro, notes: stripSpeakerWord(story.intro.notes || "", who) }
    : story.intro;
  const outro = story.outro
    ? { ...story.outro, notes: stripSpeakerWord(story.outro.notes || "", who) }
    : story.outro;

  const scenes = story.scenes.map((sc) => {
    const shots: CrashStoryShot[] = [];
    for (const sh of sc.shots) {
      const next = scrubShot(sh, who);
      if (!next) {
        removedShotIds.push(sh.id);
        continue;
      }
      shots.push(next);
    }
    return { ...sc, shots };
  });

  return {
    story: {
      ...story,
      gagNote: stripSpeakerWord(story.gagNote || "", who),
      intro,
      outro,
      scenes,
      updatedAt: new Date().toISOString(),
    },
    removedShotIds,
    removedBeatIds,
  };
}

export function dropSpeakerFromList(names: string[], who: string): string[] {
  return names.filter((s) => !castNamesMatch(s, who));
}

export function dropSpeakerFromRecord<T>(
  rec: Record<string, T> | undefined,
  who: string,
): Record<string, T> {
  const next: Record<string, T> = { ...(rec || {}) };
  for (const key of Object.keys(next)) {
    if (castNamesMatch(key, who)) delete next[key];
  }
  return next;
}

export function clipsAfterDroppedSpeaker(opts: {
  clips: MobileClipUnit[];
  name: string;
  removedShotIds: string[];
  removedBeatIds: string[];
}): MobileClipUnit[] {
  const goneShots = new Set(opts.removedShotIds);
  const goneBeats = new Set(opts.removedBeatIds);
  const kept: MobileClipUnit[] = [];
  for (const clip of opts.clips) {
    const named =
      castNamesMatch(clip.speaker || "", opts.name) ||
      goneBeats.has(clip.beatId) ||
      goneShots.has(clip.shotId);
    if (!named) {
      kept.push(clip);
      continue;
    }
    for (const file of stackedClipFiles(clip)) {
      parkMobileClipFile(file);
    }
  }
  return kept;
}

export function shotsAfterDroppedSpeaker(
  shots: MobileShotUnit[],
  removedShotIds: string[],
): MobileShotUnit[] {
  const gone = new Set(removedShotIds);
  return shots.filter((s) => !gone.has(s.shotId));
}
