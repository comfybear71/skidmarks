/**
 * Talking-episode strip on /m — plates in story order, plus template [] tags.
 * This is not a song TRACK. Music videos stay behind isMusicVideoSongJob.
 */
import type { CrashStoryBeat, CrashStoryDoc, CrashStoryShot } from "./crashStoryTypes";
import type { MobileShotUnit } from "./mobileGenJob";
import { leftoverHydrateBeat } from "./mobilePlateLines";

export type TalkTagKind = "dial" | "sfx" | "music" | "cutaway" | "visual" | "budget";

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
  title: string;
  placeName: string;
  plateFile: string;
  events: TalkTimelineEvent[];
  /** How wide this plate is on the strip — more beats = more room. */
  widthPx: number;
};

export const TALK_PLATE_MIN_PX = 132;
export const TALK_BEAT_PX = 56;

const TAG_KIND: { kind: TalkTagKind; tag: string; test: RegExp }[] = [
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
    if (!hasDial && beat.text.trim()) {
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

export function talkPlateWidthPx(beatCount: number, eventCount: number): number {
  const beats = Math.max(1, Math.floor(Number(beatCount) || 1));
  const events = Math.max(0, Math.floor(Number(eventCount) || 0));
  return Math.max(TALK_PLATE_MIN_PX, TALK_BEAT_PX * beats + Math.min(48, events * 8));
}

export function talkTimelineFrom(opts: {
  story: CrashStoryDoc | null | undefined;
  plated: MobileShotUnit[];
}): TalkTimelinePlate[] {
  const story = opts.story;
  return (opts.plated || []).map((unit, i) => {
    let shot: CrashStoryShot | undefined;
    let placeName = "";
    for (const scene of story?.scenes || []) {
      const hit = scene.shots.find((sh) => sh.id === unit.shotId);
      if (!hit) continue;
      shot = hit;
      placeName = scene.placeName;
      break;
    }
    const events = shot ? eventsForShot(shot) : [];
    const beats = shot ? realBeats(shot).length : 1;
    const title = (shot?.title || "").trim() || `Plate ${i + 1}`;
    return {
      shotId: unit.shotId,
      sceneId: unit.sceneId,
      title,
      placeName,
      plateFile: (unit.plateFile || "").trim(),
      events,
      widthPx: talkPlateWidthPx(beats, events.length),
    };
  });
}
