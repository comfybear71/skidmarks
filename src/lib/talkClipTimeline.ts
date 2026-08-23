/**
 * Talking-episode clip desk — one sideways strip, speech and picture
 * the same width. Not a song TRACK. Music videos stay on MusicVideoTrack.
 */
import type { CrashStoryDoc } from "./crashStoryTypes";
import type { MobileClipUnit, MobileShotUnit } from "./mobileGenJob";
import { leftoverHydrateBeat } from "./mobilePlateLines";
import { clipFileBasename } from "./mobilePlateClips";
import { talkTimelineFrom, type TalkTimelinePlate } from "./talkTimeline";

/** Same scale as the music-video wave — a second is 28px, then the strip scrolls. */
export const TALK_CLIP_PX_PER_SEC = 28;
export const TALK_CLIP_DEFAULT_SEC = 5;
export const TALK_CLIP_MIN_PX = 72;

export const TALK_SCENE_COLORS = [
  "#ff3ea5",
  "#35d6d0",
  "#ff9f1c",
  "#9b7bff",
  "#4db8ff",
  "#ffd23f",
  "#f5f2ff",
] as const;

export function talkSceneColor(sceneId: string): string {
  const src = String(sceneId || "").trim() || "scene";
  let h = 0;
  for (let i = 0; i < src.length; i += 1) {
    h = (h * 31 + src.charCodeAt(i)) >>> 0;
  }
  return TALK_SCENE_COLORS[h % TALK_SCENE_COLORS.length];
}

export function talkClipDurationSec(raw: unknown): number {
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0.2) return Math.min(180, n);
  return TALK_CLIP_DEFAULT_SEC;
}

export function talkClipWidthPx(durationSec: number): number {
  return Math.max(TALK_CLIP_MIN_PX, Math.round(talkClipDurationSec(durationSec) * TALK_CLIP_PX_PER_SEC));
}

export function talkClipClock(sec: number): string {
  const s = Math.max(0, Number(sec) || 0);
  if (s < 60) {
    const t = Math.round(s * 10) / 10;
    return t % 1 ? `${t.toFixed(1)}s` : `${t}s`;
  }
  const m = Math.floor(s / 60);
  const r = Math.floor(s - m * 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

export type TalkClipCell = {
  key: string;
  beatId: string;
  shotId: string;
  sceneId: string;
  sceneTitle: string;
  sceneColor: string;
  title: string;
  episodeNo: number | null;
  speaker: string;
  line: string;
  plateFile: string;
  clipFile: string;
  voiceFile: string;
  durationSec: number;
  startSec: number;
  widthPx: number;
  clipStatus: MobileClipUnit["clipStatus"] | "empty";
};

export type TalkSceneBand = {
  sceneId: string;
  title: string;
  color: string;
  widthPx: number;
};

export type TalkClipDesk = {
  cells: TalkClipCell[];
  totalSec: number;
  innerWidthPx: number;
};

function uniqueByBeat(clips: MobileClipUnit[]): MobileClipUnit[] {
  const seen = new Set<string>();
  const out: MobileClipUnit[] = [];
  for (const clip of clips) {
    if (seen.has(clip.beatId)) continue;
    seen.add(clip.beatId);
    out.push(clip);
  }
  return out;
}

function beatMeta(
  story: CrashStoryDoc | null | undefined,
  shotId: string,
  beatId: string,
): { speaker: string; line: string; voiceFile: string } {
  for (const scene of story?.scenes || []) {
    const shot = scene.shots.find((s) => s.id === shotId);
    const beat = shot?.beats.find((b) => b.id === beatId);
    if (!beat) continue;
    return {
      speaker: beat.speaker || "",
      line: beat.text || "",
      voiceFile: (beat.voiceFile || "").trim(),
    };
  }
  return { speaker: "", line: "", voiceFile: "" };
}

function firstRealBeatId(story: CrashStoryDoc | null | undefined, shotId: string): string {
  for (const scene of story?.scenes || []) {
    const shot = scene.shots.find((s) => s.id === shotId);
    if (!shot) continue;
    const beat = shot.beats.find((b) => !leftoverHydrateBeat(shotId, b.id) && b.speaker.trim());
    if (beat) return beat.id;
  }
  return "";
}

function storyBeatOrder(story: CrashStoryDoc | null | undefined, shotId: string): string[] {
  for (const scene of story?.scenes || []) {
    const shot = scene.shots.find((s) => s.id === shotId);
    if (!shot) continue;
    return shot.beats.filter((b) => !leftoverHydrateBeat(shotId, b.id)).map((b) => b.id);
  }
  return [];
}

function deskPlates(plates: TalkTimelinePlate[]): TalkTimelinePlate[] {
  const titled = plates.filter((p) => p.episodeNo != null);
  return titled.length ? titled : plates;
}

export function talkClipLayout(
  cells: TalkClipCell[],
  measured: Record<string, number> = {},
): TalkClipCell[] {
  let start = 0;
  return cells.map((cell) => {
    const durationSec = talkClipDurationSec(measured[cell.key] ?? cell.durationSec);
    const widthPx = talkClipWidthPx(durationSec);
    const next = { ...cell, durationSec, startSec: start, widthPx };
    start += durationSec;
    return next;
  });
}

export function talkSceneBands(cells: TalkClipCell[]): TalkSceneBand[] {
  const bands: TalkSceneBand[] = [];
  for (const cell of cells) {
    const last = bands[bands.length - 1];
    if (last && last.sceneId === cell.sceneId) {
      last.widthPx += cell.widthPx;
      continue;
    }
    bands.push({
      sceneId: cell.sceneId,
      title: cell.sceneTitle || "Shot",
      color: cell.sceneColor,
      widthPx: cell.widthPx,
    });
  }
  return bands;
}

export function talkDeskInnerWidth(cells: TalkClipCell[]): number {
  return cells.reduce((n, cell) => n + cell.widthPx, 0);
}

/**
 * Episode-titled shots lead (SHOT 01…). Leftover untitled plates stay off
 * the desk when those exist — this is the cut, not the plate factory.
 * Each beat keeps its own still. Width follows that take's duration.
 */
export function talkClipDeskFrom(opts: {
  story: CrashStoryDoc | null | undefined;
  plated: MobileShotUnit[];
  clips: MobileClipUnit[];
}): TalkClipDesk {
  const plates = deskPlates(talkTimelineFrom({ story: opts.story, plated: opts.plated }));
  const clips = opts.clips || [];
  const cells: TalkClipCell[] = [];

  for (const plate of plates) {
    const order = storyBeatOrder(opts.story, plate.shotId);
    const shotClips = uniqueByBeat(
      clips.filter((c) => c.shotId === plate.shotId && !leftoverHydrateBeat(plate.shotId, c.beatId)),
    ).sort((a, b) => {
      const ai = order.indexOf(a.beatId);
      const bi = order.indexOf(b.beatId);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });
    const units: Array<MobileClipUnit | null> = shotClips.length
      ? shotClips
      : plate.episodeNo != null
        ? [null]
        : [];

    for (const clip of units) {
      const beatId = clip?.beatId || firstRealBeatId(opts.story, plate.shotId);
      if (!beatId && !clip) continue;
      const meta = beatMeta(opts.story, plate.shotId, beatId || clip?.beatId || "");
      const speaker = (clip?.speaker || meta.speaker || "").trim();
      const line = (clip?.line || meta.line || "").trim();
      const voiceFile = (clip?.voiceFile || meta.voiceFile || "").trim();
      const clipFile = clipFileBasename(clip?.clipFile || "");
      const durationSec = talkClipDurationSec(clip?.durationSec);
      cells.push({
        key: clip ? `${clip.beatId}:${clipFile || clip.clipStatus}` : `empty:${plate.shotId}`,
        beatId: beatId || clip?.beatId || "",
        shotId: plate.shotId,
        sceneId: plate.sceneId,
        sceneTitle: plate.sceneTitle || plate.placeName,
        sceneColor: talkSceneColor(plate.sceneId || plate.sceneTitle),
        title: plate.title,
        episodeNo: plate.episodeNo,
        speaker,
        line,
        plateFile: plate.plateFile,
        clipFile,
        voiceFile,
        durationSec,
        startSec: 0,
        widthPx: talkClipWidthPx(durationSec),
        clipStatus: clip?.clipStatus || "empty",
      });
    }
  }

  const laid = talkClipLayout(cells);
  return {
    cells: laid,
    totalSec: laid.reduce((n, c) => n + c.durationSec, 0),
    innerWidthPx: talkDeskInnerWidth(laid),
  };
}
