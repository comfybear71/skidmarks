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
  talkKeepsScriptOrder,
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
  const maxEp = cells.reduce(
    (n, cell) => Math.max(n, cell.episodeNo || talkShotNumber(cell.title || "") || 0),
    0,
  );
  // Count matters: 10 clips with only SHOT 01–02 used to mint SHOT 03 and
  // drop the new still in the middle of the desk.
  const no = String(Math.max(maxEp, cells.length) + 1).padStart(2, "0");
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

export type TalkClipTake = {
  key: string;
  beatId: string;
  speaker: string;
  line: string;
  clipFile: string;
  voiceFile: string;
  durationSec: number;
  clipStatus: MobileClipUnit["clipStatus"] | "empty";
};

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
  /** Every line on this shot, in story order. One box — not one box per line. */
  takes: TalkClipTake[];
};

export function talkCellTakes(cell: TalkClipCell): TalkClipTake[] {
  if (cell.takes?.length) return cell.takes;
  return [
    {
      key: cell.key,
      beatId: cell.beatId,
      speaker: cell.speaker,
      line: cell.line,
      clipFile: cell.clipFile,
      voiceFile: cell.voiceFile,
      durationSec: cell.durationSec,
      clipStatus: cell.clipStatus,
    },
  ];
}

/** First line that still needs a cook, else the first line with audio. */
export function talkSendTake(cell: TalkClipCell | null | undefined): TalkClipTake | null {
  if (!cell) return null;
  const takes = talkCellTakes(cell).filter((t) => t.beatId && t.voiceFile);
  return takes.find((t) => !t.clipFile) || takes[0] || null;
}

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

export function talkRomanToN(raw: string): number | null {
  const key = String(raw || "").trim().toUpperCase();
  const i = TALK_ROMAN.indexOf(key as (typeof TALK_ROMAN)[number]);
  if (i >= 0) return i + 1;
  const n = Number(key);
  if (Number.isFinite(n) && n >= 1 && n <= TALK_ROMAN.length) return n;
  return null;
}

/** Construction `[ACT] I — He shows up` — not the place the shot is in. */
export function talkActNFromEvents(events: TalkTimelineEvent[]): number | null {
  const ev = (events || []).find((e) => e.kind === "act");
  if (!ev) return null;
  const head = String(ev.detail || "").trim();
  const m = head.match(/^([IVXLCDM]+|\d+)\b/i);
  return m ? talkRomanToN(m[1]) : null;
}

/**
 * One act number per clip. Tagged `[ACT]` wins. Same-place shots stay
 * on their own act — Front of the houses can be Act I then Act II.
 * Untagged clips keep the last tagged act in film order.
 */
export function talkAssignActNs(cells: Array<{ events?: TalkTimelineEvent[]; title?: string; sceneTitle?: string }>): number[] {
  let last = 0;
  return (cells || []).map((cell) => {
    const tagged = talkActNFromEvents(cell.events || []);
    if (tagged) {
      last = tagged;
      return tagged;
    }
    const blob = `${cell.title || ""} ${cell.sceneTitle || ""}`.toLowerCase();
    const titled = STORY_SPINE_STAGES.find((s) => blob.includes(s.title.toLowerCase()));
    if (titled) {
      last = titled.n;
      return titled.n;
    }
    return last;
  });
}

function talkActCellScript(cell: TalkClipCell): string {
  const takes = talkCellTakes(cell);
  return `${takes
    .map((t) => [cell.title, t.speaker, t.line || "No line yet"].filter(Boolean).join("\n"))
    .join("\n\n")}\n\n`;
}

function talkActFromCells(n: number, group: TalkClipCell[], id: string): TalkActScript {
  return {
    id,
    sceneId: group[0]?.sceneId || id,
    roman: talkActRoman(n),
    title: group[0]?.sceneTitle || "Shot",
    script: group.map(talkActCellScript).join("").trim(),
    lineCount: group.length,
    cellKeys: group.map((c) => c.key),
  };
}

/**
 * Acts from `[ACT]` tags. Place stretches are only a fallback when no
 * construction act tags exist. Does not rewrite story.
 */
export function talkActScriptsFrom(cells: TalkClipCell[]): TalkActScript[] {
  const list = cells || [];
  const ns = talkAssignActNs(list);
  if (ns.some((n) => n > 0)) {
    const byN = new Map<number, TalkClipCell[]>();
    list.forEach((cell, i) => {
      const n = ns[i] || 0;
      if (!n) return;
      const group = byN.get(n) || [];
      group.push(cell);
      byN.set(n, group);
    });
    return [...byN.keys()]
      .sort((a, b) => a - b)
      .map((n) => talkActFromCells(n, byN.get(n) || [], `act-${n}`));
  }
  const acts: TalkActScript[] = [];
  for (const cell of list) {
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
 * Skidmarks — nine chips, one per locked stage. Clips land on the
 * `[ACT]` they were written with, not the place they share.
 * Does not rewrite story_json.
 */
export function talkSkidmarksActsFrom(cells: TalkClipCell[]): TalkActScript[] {
  const list = cells || [];
  const ns = talkAssignActNs(list);
  return STORY_SPINE_STAGES.map((stage) => {
    const group = list.filter((_, i) => ns[i] === stage.n);
    return {
      id: `stage-${stage.n}`,
      sceneId: `stage-${stage.n}`,
      roman: talkActRoman(stage.n),
      title: stage.title,
      stageNote: stage.note,
      script: group.map(talkActCellScript).join("").trim(),
      lineCount: group.length,
      cellKeys: group.map((c) => c.key),
    };
  });
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
    const clipTakes = talkCellTakes(cell).filter((t) => t.clipFile);
    // A multi-clip shot keeps the summed clock. One video's metadata
    // must not shrink the box to a single line.
    const raw =
      clipTakes.length > 1 ? cell.durationSec : measured[cell.key] ?? cell.durationSec;
    const durationSec = talkClipDurationSec(raw);
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

function takeFrom(opts: {
  plate: TalkTimelinePlate;
  clip: MobileClipUnit | null;
  beatId: string;
  story: CrashStoryDoc | null | undefined;
}): TalkClipTake | null {
  const beatId = opts.beatId || opts.clip?.beatId || "";
  if (!beatId && !opts.clip) return null;
  const meta = beatMeta(opts.story, opts.plate.shotId, beatId || opts.clip?.beatId || "");
  const clipFile = clipFileBasename(opts.clip?.clipFile || "");
  return {
    key: opts.clip ? `${opts.clip.beatId}:${clipFile || opts.clip.clipStatus}` : `empty:${opts.plate.shotId}:${beatId}`,
    beatId: beatId || opts.clip?.beatId || "",
    speaker: (opts.clip?.speaker || meta.speaker || "").trim(),
    line: (opts.clip?.line || meta.line || "").trim(),
    clipFile,
    voiceFile: (opts.clip?.voiceFile || meta.voiceFile || "").trim(),
    durationSec: talkClipDurationSec(opts.clip?.durationSec),
    clipStatus: opts.clip?.clipStatus || "empty",
  };
}

function shotDurationSec(takes: TalkClipTake[]): number {
  const cooked = takes.filter((t) => t.clipFile);
  if (cooked.length) return cooked.reduce((n, t) => n + t.durationSec, 0);
  return talkClipDurationSec(undefined);
}

function shotCellFrom(opts: {
  plate: TalkTimelinePlate;
  clips: MobileClipUnit[];
  story: CrashStoryDoc | null | undefined;
  allowEmpty: boolean;
}): TalkClipCell | null {
  const shotClips = clipsOnPlate(opts.plate, opts.clips, opts.story);
  if (!shotClips.length && !opts.allowEmpty) return null;
  const beatIds = storyBeatOrder(opts.story, opts.plate.shotId);
  const takes: TalkClipTake[] = [];
  if (beatIds.length) {
    for (const beatId of beatIds) {
      const clip = shotClips.find((c) => c.beatId === beatId) || null;
      const take = takeFrom({ plate: opts.plate, clip, beatId, story: opts.story });
      if (take) takes.push(take);
    }
  } else {
    for (const clip of shotClips) {
      const take = takeFrom({
        plate: opts.plate,
        clip,
        beatId: clip.beatId,
        story: opts.story,
      });
      if (take) takes.push(take);
    }
  }
  if (!takes.length && opts.allowEmpty) {
    const empty = takeFrom({
      plate: opts.plate,
      clip: null,
      beatId: firstRealBeatId(opts.story, opts.plate.shotId),
      story: opts.story,
    });
    if (empty) takes.push(empty);
  }
  if (!takes.length) return null;
  const lead = takes.find((t) => t.clipFile) || takes.find((t) => t.voiceFile) || takes[0];
  const durationSec = shotDurationSec(takes);
  return {
    key: `shot:${opts.plate.shotId}`,
    beatId: lead.beatId,
    shotId: opts.plate.shotId,
    sceneId: opts.plate.sceneId,
    sceneTitle: opts.plate.sceneTitle || opts.plate.placeName,
    sceneColor: talkSceneColor(opts.plate.sceneId || opts.plate.sceneTitle),
    title: opts.plate.title,
    episodeNo: opts.plate.episodeNo,
    speaker: lead.speaker,
    line: lead.line,
    plateFile: opts.plate.plateFile,
    clipFile: lead.clipFile,
    voiceFile: lead.voiceFile,
    durationSec,
    startSec: 0,
    widthPx: talkClipWidthPx(durationSec),
    clipStatus: lead.clipStatus,
    events: opts.plate.events || [],
    takes,
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
 * Same scene → shot walk as the talking strip. One box per shot.
 * Two or three lines on that still stay on that box, in story order.
 * Leftover untitled stills with no take stay off the desk. A titled
 * SHOT 0N can sit empty so + Add clip lands. Sunny Act 1 untitled
 * cards with a still still sit (SHOT 11 cannot jump them). Width is
 * the sum of the clips on that shot.
 */
export function talkClipDeskFrom(opts: {
  story: CrashStoryDoc | null | undefined;
  plated: MobileShotUnit[];
  clips: MobileClipUnit[];
  styleId?: string | null;
}): TalkClipDesk {
  const styleId = opts.styleId || opts.story?.styleId;
  const allPlates = talkTimelineFrom({
    story: opts.story,
    plated: opts.plated,
    styleId,
  });
  const clips = opts.clips || [];
  const cells: TalkClipCell[] = [];
  const sunnyStill = talkKeepsScriptOrder(styleId);

  for (const plate of allPlates) {
    const cell = shotCellFrom({
      plate,
      clips,
      story: opts.story,
      allowEmpty: plate.episodeNo != null || (sunnyStill && Boolean(plate.plateFile)),
    });
    if (cell) cells.push(cell);
  }

  const laid = talkClipLayout(cells);
  return {
    cells: laid,
    totalSec: laid.reduce((n, c) => n + c.durationSec, 0),
    innerWidthPx: talkDeskInnerWidth(laid),
  };
}
