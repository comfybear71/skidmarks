/**
 * Script Go — hang the saved clock, then cook. One [name] per plate.
 * Place / camera / engine stay off the script text. This file plans them.
 *
 * Does not Start directing. Does not delete media. Long H3 bars use LTX
 * (H3 max 15s). Mute cinema — do not feed the song mp3.
 */

import {
  MUSIC_VIDEO_CAMERAS,
  type MusicVideoCameraKey,
} from "./musicVideoGroupPlate";
import { MINIMAX_H3_MAX_SEC, MINIMAX_H3_MIN_SEC } from "./minimaxH3";
import {
  oneSongScriptSinger,
  parseSongScript,
  type SongScriptBeat,
} from "./songScript";

export type ScriptGoEngine = "ltx" | "h3" | "grok";

/** LTX will not cook a 1s chorus flip. Cook this, then cut to the hang. */
export const SCRIPT_GO_SHORT_COOK_SEC = 5;

/**
 * Short chorus hang → cook 5s, then cut the mp4 to the bar.
 * A 14s verse cooks 14s. Does not invent a 15s hang.
 */
export function scriptGoShortChorusCook(hangSec: number): {
  cookSec: number;
  cutToSec: number | null;
} {
  const hang = Number(hangSec);
  if (!Number.isFinite(hang) || hang <= 0) {
    return { cookSec: SCRIPT_GO_SHORT_COOK_SEC, cutToSec: null };
  }
  if (hang + 0.05 >= 4) return { cookSec: hang, cutToSec: null };
  return { cookSec: SCRIPT_GO_SHORT_COOK_SEC, cutToSec: Math.max(0.4, hang) };
}

/** Singing stays in the face. Wide / medium / sitting pulled Soul Rebel
 * off his tight CAST still and the draw invented someone else. */
const SING_CAMERAS: readonly MusicVideoCameraKey[] = ["tight-cu", "mcu"];
/** Dance / break can turn a little. Never a distant full-body. */
const BREAK_CAMERAS: readonly MusicVideoCameraKey[] = ["tight-cu", "mcu", "ots"];

export type ScriptGoPlanItem = {
  startMs: number;
  endMs: number;
  kind: SongScriptBeat["kind"];
  who: string;
  line: string;
  sceneIndex: number;
  cameraKey: MusicVideoCameraKey;
  engine: ScriptGoEngine;
};

function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function matchScriptGoSpeaker(who: string, speakers: string[]): string {
  const want = oneSongScriptSinger(who);
  if (!want) return "";
  return (speakers || []).find((s) => namesMatch(s, want)) || "";
}

export function pickScriptGoEngine(beat: Pick<SongScriptBeat, "kind" | "startMs" | "endMs">): ScriptGoEngine {
  const sec = Math.max(0, (beat.endMs - beat.startMs) / 1000);
  if (beat.kind === "sing") return "ltx";
  if (sec > MINIMAX_H3_MAX_SEC) return "ltx";
  if (sec < MINIMAX_H3_MIN_SEC) return "grok";
  return Math.floor(beat.startMs / 8000) % 2 === 0 ? "h3" : "grok";
}

export function pickScriptGoCamera(
  index: number,
  kind: SongScriptBeat["kind"] = "sing",
): MusicVideoCameraKey {
  const list = kind === "break" ? BREAK_CAMERAS : SING_CAMERAS;
  return list[index % list.length]!;
}

export function scriptGoStaging(opts: {
  who: string;
  placeName: string;
  cameraKey: MusicVideoCameraKey;
  kind?: SongScriptBeat["kind"];
}): string {
  const who = opts.who.trim() || "The character";
  const place = opts.placeName.trim() || "the place";
  const cam = MUSIC_VIDEO_CAMERAS[opts.cameraKey];
  const sing = opts.kind !== "break";
  return [
    `${who} alone. Only ${who} in frame, no one else appears.`,
    `Same person as the ${who} still. Same face, same sex, same beard or no beard as that still. Do not turn them into a different person.`,
    `At ${place}.`,
    cam,
    sing
      ? "Facing camera, mouth clear. Face fills the frame, huge and near the camera. Do not pull back. Not a distant full-body. Not over the shoulder. Not a wide of the place."
      : "Face fills the frame, huge and near the camera. Do not pull back. Not a distant full-body. Not a wide of the place.",
    "Empty hands. No phone. No extra objects. No saxophone. No trumpet.",
  ].join(" ");
}

/** A chorus flip is a short sung row. Three-plus alternating shorts
 * become two full-chorus takes — backup, then the other — same clock.
 * He revolves them later. Does not rewrite the script text. */
export const SCRIPT_GO_CHORUS_FLIP_MAX_MS = 6000;
export const SCRIPT_GO_CHORUS_MIN_FLIPS = 4;

export function revolveChorusBeats(
  beats: SongScriptBeat[],
  speakers: string[],
): SongScriptBeat[] {
  const rows = (beats || []).map((b) => ({
    ...b,
    who: matchScriptGoSpeaker(b.who, speakers) || oneSongScriptSinger(b.who),
  }));
  const out: SongScriptBeat[] = [];
  for (let i = 0; i < rows.length; ) {
    const first = rows[i]!;
    const shortSing =
      first.kind === "sing" &&
      first.who &&
      first.endMs - first.startMs <= SCRIPT_GO_CHORUS_FLIP_MAX_MS;
    if (!shortSing) {
      out.push(rows[i]!);
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < rows.length) {
      const prev = rows[j - 1]!;
      const row = rows[j]!;
      const dur = row.endMs - row.startMs;
      const join = row.startMs <= prev.endMs + 400;
      if (row.kind !== "sing" || !row.who || dur > SCRIPT_GO_CHORUS_FLIP_MAX_MS || !join) break;
      j += 1;
    }
    const cluster = rows.slice(i, j);
    const names: string[] = [];
    for (const row of cluster) {
      if (row.who && !names.includes(row.who)) names.push(row.who);
    }
    if (cluster.length >= SCRIPT_GO_CHORUS_MIN_FLIPS && names.length >= 2) {
      const startMs = cluster[0]!.startMs;
      const endMs = cluster[cluster.length - 1]!.endMs;
      const words = cluster.map((r) => r.line.trim()).filter(Boolean);
      const line = words.filter((w, n) => n === 0 || w !== words[n - 1]).join(" ");
      for (const who of names.slice(0, 2)) {
        out.push({ startMs, endMs, kind: "sing", who, line });
      }
      i = j;
      continue;
    }
    out.push(rows[i]!);
    i += 1;
  }
  return out;
}

export function uniqueScriptGoPlaces(
  scenes: Array<{ id?: string; placeName?: string }>,
  locationCandidates?: Record<string, Array<{ approved?: boolean; fileName?: string }>>,
): Array<{ id: string; placeName: string }> {
  const ranked = (scenes || [])
    .map((s, idx) => {
      const id = String(s.id || "").trim();
      const placeName = String(s.placeName || "").trim();
      const cands = locationCandidates?.[id] || [];
      const score = cands.filter((c) => c.approved && String(c.fileName || "").trim()).length;
      return { id, placeName, score, idx };
    })
    .filter((s) => s.id && s.placeName)
    .sort((a, b) => b.score - a.score || a.idx - b.idx);
  const out: Array<{ id: string; placeName: string }> = [];
  const seen = new Set<string>();
  for (const s of ranked) {
    const key = s.placeName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: s.id, placeName: s.placeName });
  }
  return out;
}

export function planScriptGo(opts: {
  songScript: string;
  speakers: string[];
  sceneCount: number;
}): ScriptGoPlanItem[] {
  const scenes = Math.max(1, Math.round(opts.sceneCount || 1));
  const lead = (opts.speakers || [])[0] || "";
  const beats = revolveChorusBeats(parseSongScript(opts.songScript || ""), opts.speakers);
  const out: ScriptGoPlanItem[] = [];
  for (const beat of beats) {
    // An untagged break is a real pause in the singing (a bridge / instrumental
    // stretch) — nobody types a [NAME] on those rows, so they used to get
    // dropped here and never cooked at all. The lead vocalist is who the
    // camera holds on through a pause, same as everywhere else `speakers[0]`
    // is the default prominent character.
    const namedWho = matchScriptGoSpeaker(beat.who, opts.speakers);
    const who = namedWho || (beat.kind === "break" ? lead : "");
    if (!who) continue;
    if (beat.endMs <= beat.startMs) continue;
    out.push({
      startMs: beat.startMs,
      endMs: beat.endMs,
      kind: beat.kind,
      who,
      line: beat.line,
      sceneIndex: out.length % scenes,
      cameraKey: pickScriptGoCamera(out.length, beat.kind),
      engine: pickScriptGoEngine(beat),
    });
  }
  return out;
}

export function scriptGoNeedsWho(songScript: string, speakers: string[]): boolean {
  return planScriptGo({ songScript, speakers, sceneCount: 1 }).length === 0;
}
