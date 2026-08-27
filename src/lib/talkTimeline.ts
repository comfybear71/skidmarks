/**
 * Talking-episode strip on /m — plates in story order, plus template [] tags.
 * This is not a song TRACK. Music videos stay behind isMusicVideoSongJob.
 */
import type { CrashStoryBeat, CrashStoryDoc, CrashStoryShot } from "./crashStoryTypes";
import type { MobileShotUnit } from "./mobileGenJob";
import { leftoverHydrateBeat } from "./mobilePlateLines";

export type TalkTagKind = "act" | "cast" | "dial" | "sfx" | "music" | "cutaway" | "visual" | "budget";

export type TalkTimelineEvent = {
  id: string;
  kind: TalkTagKind;
  /** Chip text, e.g. DIAL or SFX. */
  tag: string;
  detail: string;
};

export type TalkTimelinePlate = {
  shotId: string;
  sceneId: string;
  shotNo: number;
  /** 1-based SHOT 01 number when the title has one; otherwise null. */
  episodeNo: number | null;
  title: string;
  placeName: string;
  sceneTitle: string;
  plateFile: string;
  events: TalkTimelineEvent[];
  /** How wide this plate is on the strip — more beats = more room. */
  widthPx: number;
};

export const TALK_PLATE_MIN_PX = 220;
export const TALK_BEAT_PX = 80;

const TAG_KIND: { kind: TalkTagKind; tag: string; test: RegExp }[] = [
  { kind: "act", tag: "ACT", test: /^act$/i },
  { kind: "cast", tag: "CAST", test: /^cast$/i },
  { kind: "dial", tag: "DIAL", test: /^dial$/i },
  { kind: "sfx", tag: "SFX", test: /^sfx$/i },
  { kind: "music", tag: "MUSIC", test: /^music$/i },
  { kind: "cutaway", tag: "CUTAWAY", test: /^cutaway/i },
  { kind: "visual", tag: "VISUAL", test: /^(visual_action|visual)$/i },
  { kind: "budget", tag: "BUDGET", test: /^(budget_tier|cheap_take|expensive_take)$/i },
];

/** Episode-template brackets only — not ElevenLabs [laughs] / [smugly]. */
export function talkTagKind(raw: string): { kind: TalkTagKind; tag: string } | null {
  const token = String(raw || "").trim();
  if (!token) return null;
  for (const row of TAG_KIND) {
    if (row.test.test(token)) {
      const budget =
        /^cheap_take$/i.test(token) ? "CHEAP" : /^expensive_take$/i.test(token) ? "EXPENSIVE" : row.tag;
      return { kind: row.kind, tag: row.kind === "budget" ? budget : row.tag };
    }
  }
  return null;
}

/** SHOT 01 / SHOT_01 / Shot 4 — episode layout order, not job-add order. */
export function talkShotNumber(title: string): number | null {
  const m = String(title || "").match(/\bshot\s*_?\s*0*(\d+)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function templateTagsFrom(text: string): { kind: TalkTagKind; tag: string; body: string }[] {
  const out: { kind: TalkTagKind; tag: string; body: string }[] = [];
  const src = String(text || "");
  const re = /\[([^\]]+)\]/g;
  let hit: RegExpExecArray | null;
  while ((hit = re.exec(src))) {
    const parsed = talkTagKind(hit[1] || "");
    if (!parsed) continue;
    const after = src.slice(hit.index + hit[0].length);
    const stop = after.search(/\s*\[[^\]]+\]/);
    let body = (stop >= 0 ? after.slice(0, stop) : after)
      .replace(/^[:\s-]+/, "")
      .split(/\r?\n/)[0]
      ?.trim() || "";
    if (/^(scene|shot|line|beat|place|action|plate|image)\b/i.test(body)) body = "";
    out.push({ ...parsed, body });
  }
  return out;
}

function shotBlob(shot: CrashStoryShot): string {
  return [
    shot.title,
    shot.summary,
    shot.staging,
    ...shot.beats.map((b) => [b.text, b.action, b.imageMotion].filter(Boolean).join("\n")),
    ...shot.sfx.map((s) => [s.label, s.notes].filter(Boolean).join("\n")),
  ]
    .filter(Boolean)
    .join("\n");
}

function realBeats(shot: CrashStoryShot): CrashStoryBeat[] {
  return shot.beats.filter((b) => !leftoverHydrateBeat(shot.id, b.id) && b.speaker.trim());
}

function clip(text: string, n = 72): string {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

function eventKey(e: Pick<TalkTimelineEvent, "kind" | "detail">): string {
  return `${e.kind}|${e.detail.trim().toLowerCase()}`;
}

export function eventsForShot(shot: CrashStoryShot): TalkTimelineEvent[] {
  const events: TalkTimelineEvent[] = [];
  const seen = new Set<string>();
  const push = (kind: TalkTagKind, tag: string, detail: string, id: string) => {
    const row: TalkTimelineEvent = { id, kind, tag, detail: clip(detail) };
    const key = eventKey(row);
    if (seen.has(key)) return;
    seen.add(key);
    events.push(row);
  };

  templateTagsFrom(shotBlob(shot)).forEach((t, i) => {
    push(t.kind, t.tag, t.body, `${shot.id}_tag_${i}`);
  });

  const hasDial = events.some((e) => e.kind === "dial");
  const hasCutaway = events.some((e) => e.kind === "cutaway");
  const hasSfx = events.some((e) => e.kind === "sfx");

  for (const beat of realBeats(shot)) {
    if (beat.kind === "cutaway") {
      if (!hasCutaway) push("cutaway", "CUTAWAY", beat.action || beat.text || beat.speaker, `cut_${beat.id}`);
      continue;
    }
    if (beat.text.trim()) {
      push("dial", "DIAL", `${beat.speaker}: ${beat.text}`, `dial_${beat.id}`);
    }
  }

  if (!hasSfx) {
    shot.sfx.forEach((sfx, i) => {
      const label = (sfx.label || sfx.notes || "").trim();
      if (label) push("sfx", "SFX", label, `sfx_${shot.id}_${i}`);
    });
  }

  return events;
}

/** Final-stage film chrome: ACT above the player, SFX under it, the rest folded. */
export type TalkFilmChrome = {
  act: TalkTimelineEvent | null;
  sfx: TalkTimelineEvent[];
  notes: TalkTimelineEvent[];
};

export function talkFilmChrome(events: TalkTimelineEvent[]): TalkFilmChrome {
  const list = Array.isArray(events) ? events : [];
  return {
    act: list.find((e) => e.kind === "act") ?? null,
    sfx: list.filter((e) => e.kind === "sfx"),
    notes: list.filter((e) => e.kind !== "act" && e.kind !== "sfx"),
  };
}

export function talkFilmTagText(ev: Pick<TalkTimelineEvent, "tag" | "detail">): string {
  const tag = String(ev.tag || "").trim();
  const detail = String(ev.detail || "").trim();
  return detail ? `[${tag}] ${detail}` : `[${tag}]`;
}

export function talkPlateWidthPx(beatCount: number, eventCount: number): number {
  const beats = Math.max(1, Math.floor(Number(beatCount) || 1));
  const events = Math.max(0, Math.floor(Number(eventCount) || 0));
  return Math.max(TALK_PLATE_MIN_PX, TALK_BEAT_PX * beats + Math.min(48, events * 8));
}

function plateFileOf(unit: MobileShotUnit | undefined, shot?: CrashStoryShot): string {
  const fromJob = (unit?.plateFile || "").trim();
  if (fromJob && fromJob !== "__error__") return fromJob;
  const fromStory = (shot?.plateFile || "").trim();
  if (fromStory && fromStory !== "__error__") return fromStory;
  return "";
}

function rowFrom(opts: {
  unit: MobileShotUnit;
  shot?: CrashStoryShot;
  placeName: string;
  sceneTitle: string;
  shotNo: number;
}): TalkTimelinePlate {
  const events = opts.shot ? eventsForShot(opts.shot) : [];
  const beats = opts.shot ? realBeats(opts.shot).length : 1;
  const title = (opts.shot?.title || "").trim() || `Plate ${opts.shotNo}`;
  return {
    shotId: opts.unit.shotId,
    sceneId: opts.unit.sceneId,
    shotNo: opts.shotNo,
    episodeNo: talkShotNumber(title),
    title,
    placeName: opts.placeName,
    sceneTitle: opts.sceneTitle || opts.placeName,
    plateFile: plateFileOf(opts.unit, opts.shot),
    events,
    widthPx: talkPlateWidthPx(beats, events.length),
  };
}

/** Sunny Banks walks the story as pasted. SHOT 11 in the title is not order. */
export function talkKeepsScriptOrder(styleId?: string | null): boolean {
  return styleId === "sunny_banks";
}

/**
 * Episode first (SHOT 01, SHOT 02…) then the rest of the pack in story
 * order. Job-add order is ignored. A still on the story still lands even
 * if the job row has not caught up yet.
 *
 * Sunny Banks skips the SHOT 0N sort — Act 1 titles can be 01 / 02 /
 * unnumbered / 06 / 07 / 11 while the script order is 1→8.
 */
export function talkTimelineFrom(opts: {
  story: CrashStoryDoc | null | undefined;
  plated: MobileShotUnit[];
  styleId?: string | null;
}): TalkTimelinePlate[] {
  const plated = opts.plated || [];
  const byId = new Map(plated.map((u) => [u.shotId, u]));
  const collected: TalkTimelinePlate[] = [];
  let shotNo = 0;

  for (const scene of opts.story?.scenes || []) {
    for (const shot of scene.shots) {
      const unit = byId.get(shot.id) || {
        shotId: shot.id,
        sceneId: scene.id,
        plateFile: (shot.plateFile || "").trim(),
      };
      const file = plateFileOf(unit, shot);
      const episodeNo = talkShotNumber((shot.title || "").trim());
      const hasSpeaker = (shot.beats || []).some((b) => String(b.speaker || "").trim());
      // Untitled leftover stills stay off until they have a file.
      // A titled SHOT 0N with a speaker can sit empty so + Add clip lands.
      if (!file && (episodeNo == null || !hasSpeaker)) continue;
      shotNo += 1;
      collected.push(
        rowFrom({
          unit: { ...unit, sceneId: unit.sceneId || scene.id, plateFile: file },
          shot,
          placeName: scene.placeName,
          sceneTitle: (scene.title || scene.placeName || "").trim(),
          shotNo,
        }),
      );
    }
  }

  for (const unit of plated) {
    if (collected.some((r) => r.shotId === unit.shotId)) continue;
    const file = plateFileOf(unit);
    if (!file) continue;
    shotNo += 1;
    collected.push(
      rowFrom({
        unit: { ...unit, plateFile: file },
        placeName: "",
        sceneTitle: "",
        shotNo,
      }),
    );
  }

  if (talkKeepsScriptOrder(opts.styleId || opts.story?.styleId)) {
    return collected;
  }

  const episode = collected
    .filter((r) => r.episodeNo != null)
    .sort((a, b) => (a.episodeNo || 0) - (b.episodeNo || 0) || a.shotNo - b.shotNo);
  const rest = collected.filter((r) => r.episodeNo == null);
  return [...episode, ...rest];
}
