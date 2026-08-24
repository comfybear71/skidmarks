/**
 * Talking-episode clip desk — one sideways strip, speech and picture
 * the same width. Not a song TRACK. Music videos stay on MusicVideoTrack.
 */
import type { CrashStoryDoc } from "./crashStoryTypes";
import type { MobileClipUnit, MobileShotUnit } from "./mobileGenJob";
import { STORY_SPINE_STAGES } from "./storySpine";
import { leftoverHydrateBeat } from "./mobilePlateLines";
import { clipFileBasename } from "./mobilePlateClips";
import {
  talkShotNumber,
  talkTimelineFrom,
  type TalkTimelineEvent,
  type TalkTimelinePlate,
} from "./talkTimeline";

/** Next SHOT 0N title so a new slot lands on the talking desk, even with no take. */
export function talkNextShotTitle(
  cells: { episodeNo?: number | null; title?: string }[],
  speaker = "",
): string {
  const max = cells.reduce(
    (n, cell) => Math.max(n, cell.episodeNo || talkShotNumber(cell.title || "") || 0),
    0,
  );
  const no = String(max + 1).padStart(2, "0");
  const who = String(speaker || "").trim();
  return who ? `SHOT ${no} — ${who}` : `SHOT ${no}`;
}

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
  events: TalkTimelineEvent[];
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

export type TalkActScript = {
  id: string;
  sceneId: string;
  roman: string;
  title: string;
  script: string;
  lineCount: number;
  cellKeys: string[];
  stageNote?: string;
};

const TALK_ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"] as const;

export function talkActRoman(n: number): string {
  return TALK_ROMAN[Math.max(1, Math.floor(n)) - 1] || String(n);
}

function talkActCellScript(cell: TalkClipCell): string {
  const bits = [cell.title, cell.speaker, cell.line || "No line yet"].filter(Boolean);
  return `${bits.join("\n")}\n\n`;
}

/**
 * One script box per stretch on the talking desk — same job as lyrics
 * on a music-video section. Built from the live cells. Does not rewrite story.
 */
export function talkActScriptsFrom(cells: TalkClipCell[]): TalkActScript[] {
  const acts: TalkActScript[] = [];
  for (const cell of cells) {
    const last = acts[acts.length - 1];
    if (last && last.sceneId === cell.sceneId) {
      last.cellKeys.push(cell.key);
      last.script += talkActCellScript(cell);
      last.lineCount += 1;
      continue;
    }
    acts.push({
      id: `${cell.sceneId}:${acts.length}`,
      sceneId: cell.sceneId,
      roman: talkActRoman(acts.length + 1),
      title: cell.sceneTitle || "Shot",
      script: talkActCellScript(cell),
      lineCount: 1,
      cellKeys: [cell.key],
    });
  }
  return acts.map((act) => ({ ...act, script: act.script.trim() }));
}

/**
 * Skidmarks only — always nine chips, one per locked stage.
 * Live lines from place stretches map onto the first stages.
 * Extra stretches stay on stage 9 so nothing on the desk is hidden.
 * Does not rewrite story_json.
 */
export function talkSkidmarksActsFrom(cells: TalkClipCell[]): TalkActScript[] {
  const stretches = talkActScriptsFrom(cells);
  const acts: TalkActScript[] = STORY_SPINE_STAGES.map((stage, i) => {
    const stretch = stretches[i];
    return {
      id: `stage-${stage.n}`,
      sceneId: stretch?.sceneId || `stage-${stage.n}`,
      roman: talkActRoman(stage.n),
      title: stage.title,
      stageNote: stage.note,
      script:
        stretch?.script ||
        `${stage.title}\n${stage.note}\n\nNo lines on this stage yet.`,
      lineCount: stretch?.lineCount || 0,
      cellKeys: stretch?.cellKeys || [],
    };
  });
  const leftovers = stretches.slice(STORY_SPINE_STAGES.length);
  const last = acts[acts.length - 1];
  for (const extra of leftovers) {
    last.script = `${last.script}\n\n${extra.script}`;
    last.cellKeys.push(...extra.cellKeys);
    last.lineCount += extra.lineCount;
  }
  return acts;
}

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

function cellFrom(opts: {
  plate: TalkTimelinePlate;
  clip: MobileClipUnit | null;
  story: CrashStoryDoc | null | undefined;
}): TalkClipCell | null {
  const beatId = opts.clip?.beatId || firstRealBeatId(opts.story, opts.plate.shotId);
  if (!beatId && !opts.clip) return null;
  const meta = beatMeta(opts.story, opts.plate.shotId, beatId || opts.clip?.beatId || "");
  const clipFile = clipFileBasename(opts.clip?.clipFile || "");
  const durationSec = talkClipDurationSec(opts.clip?.durationSec);
  return {
    key: opts.clip ? `${opts.clip.beatId}:${clipFile || opts.clip.clipStatus}` : `empty:${opts.plate.shotId}`,
    beatId: beatId || opts.clip?.beatId || "",
    shotId: opts.plate.shotId,
    sceneId: opts.plate.sceneId,
    sceneTitle: opts.plate.sceneTitle || opts.plate.placeName,
    sceneColor: talkSceneColor(opts.plate.sceneId || opts.plate.sceneTitle),
    title: opts.plate.title,
    episodeNo: opts.plate.episodeNo,
    speaker: (opts.clip?.speaker || meta.speaker || "").trim(),
    line: (opts.clip?.line || meta.line || "").trim(),
    plateFile: opts.plate.plateFile,
    clipFile,
    voiceFile: (opts.clip?.voiceFile || meta.voiceFile || "").trim(),
    durationSec,
    startSec: 0,
    widthPx: talkClipWidthPx(durationSec),
    clipStatus: opts.clip?.clipStatus || "empty",
    events: opts.plate.events || [],
  };
}

function clipsOnPlate(
  plate: TalkTimelinePlate,
  clips: MobileClipUnit[],
  story: CrashStoryDoc | null | undefined,
): MobileClipUnit[] {
  const order = storyBeatOrder(story, plate.shotId);
  return uniqueByBeat(
    clips.filter((c) => c.shotId === plate.shotId && !leftoverHydrateBeat(plate.shotId, c.beatId)),
  ).sort((a, b) => {
    const ai = order.indexOf(a.beatId);
    const bi = order.indexOf(b.beatId);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
}

/**
 * Episode-titled shots lead (SHOT 01…). Other playable episode clips
 * follow — leftover untitled stills with no take stay off the desk.
 * Each beat keeps its own still. Width follows that take's duration.
 */
export function talkClipDeskFrom(opts: {
  story: CrashStoryDoc | null | undefined;
  plated: MobileShotUnit[];
  clips: MobileClipUnit[];
}): TalkClipDesk {
  const allPlates = talkTimelineFrom({ story: opts.story, plated: opts.plated });
  const titled = allPlates.filter((p) => p.episodeNo != null);
  const rest = allPlates.filter((p) => p.episodeNo == null);
  const lead = titled.length ? titled : allPlates;
  const tail = titled.length ? rest : [];
  const clips = opts.clips || [];
  const cells: TalkClipCell[] = [];

  const pushPlate = (plate: TalkTimelinePlate, allowEmpty: boolean) => {
    const shotClips = clipsOnPlate(plate, clips, opts.story);
    const units: Array<MobileClipUnit | null> = shotClips.length
      ? shotClips
      : allowEmpty
        ? [null]
        : [];
    for (const clip of units) {
      const cell = cellFrom({ plate, clip, story: opts.story });
      if (cell) cells.push(cell);
    }
  };

  for (const plate of lead) pushPlate(plate, plate.episodeNo != null);
  for (const plate of tail) pushPlate(plate, false);

  const laid = talkClipLayout(cells);
  return {
    cells: laid,
    totalSec: laid.reduce((n, c) => n + c.durationSec, 0),
    innerWidthPx: talkDeskInnerWidth(laid),
  };
}
