/**
 * Script Go — hang the saved clock, then cook. One [name] per plate.
 * Place / camera / engine stay off the script text. This file plans them.
 *
 * Does not Start directing. Does not delete media. Long H3 bars use LTX
 * (H3 max 15s). Mute cinema — do not feed the song mp3.
 */

import { castNamesMatch } from "./mobileDropCast";
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

export function matchScriptGoSpeaker(who: string, speakers: string[]): string {
  const want = oneSongScriptSinger(who);
  if (!want) return "";
  return (speakers || []).find((s) => castNamesMatch(s, want)) || "";
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
  const beats = parseSongScript(opts.songScript || "");
  const out: ScriptGoPlanItem[] = [];
  for (const beat of beats) {
    const who = matchScriptGoSpeaker(beat.who, opts.speakers);
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
