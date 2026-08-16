import type { ShowStyleId } from "./showStylePresets";

export type CrashStorySfx = {
  id: string;
  label: string;
  notes: string;
  /** Crash SPX item id when linked */
  spxId?: string;
  /** mp3/wav under data/crash/story/{styleId}/sfx/ */
  audioFile?: string;
};

export type CrashStoryBeat = {
  id: string;
  speaker: string;
  text: string;
  /** mp3 under data/crash/story/{styleId}/audio/ */
  voiceFile?: string;
};

/** One drawn still for a shot — a conversation shot can want several, each
 * framed on a different moment/speaker, swiped through rather than one
 * static picture standing in for the whole back-and-forth. */
export type PlateTake = {
  id: string;
  /** cplate_*.png under data/crash/gen/ */
  fileName: string;
  /** The position tweak that drew this specific take. */
  staging: string;
  /** The take currently mirrored onto plateFile/staging below. */
  approved: boolean;
};

export type CrashStoryShot = {
  id: string;
  title: string;
  summary: string;
  /**
   * Who's prominent + place roles for Gen plate
   * e.g. "Sharon prominent · cafe table · Kim secondary back"
   */
  staging?: string;
  /** cplate_*.png under data/crash/gen/ — always mirrors the approved take. */
  plateFile: string;
  /** Every still drawn for this shot. Older shots have none — plateFile is
   * their only picture, treated as a single take. */
  plateTakes?: PlateTake[];
  beats: CrashStoryBeat[];
  sfx: CrashStorySfx[];
};

export type CrashStoryScene = {
  id: string;
  title: string;
  placeName: string;
  /** world-cards thumb key */
  worldThumbKey: string;
  shots: CrashStoryShot[];
  /** User shut the scene strip after filling it in */
  collapsed?: boolean;
};

export type CrashStoryBookend = {
  title: string;
  notes: string;
  sfx: CrashStorySfx[];
  collapsed?: boolean;
  /** Title card / logo still under data/crash/gen/ */
  logoFile?: string;
  /** Optional VO/sting mp3 under data/crash/story/{styleId}/dialogue/ — for Comfy LTX */
  voiceFile?: string;
};

export type CrashStoryDoc = {
  styleId: ShowStyleId;
  campaignLabel: string;
  gagNote: string;
  intro: CrashStoryBookend;
  outro: CrashStoryBookend;
  scenes: CrashStoryScene[];
  updatedAt: string;
};

/** Scene ready to collapse — world plate + every shot has a plate. */
export function sceneIsFilled(scene: CrashStoryScene): boolean {
  if (!scene.worldThumbKey?.trim()) return false;
  if (!scene.shots.length) return false;
  return scene.shots.every((sh) => Boolean(sh.plateFile?.trim()));
}
