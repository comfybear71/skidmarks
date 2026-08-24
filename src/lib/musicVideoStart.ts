/**
 * Music video start desk — song + lyrics, before the pack exists.
 *
 * A music video is a band, a place, and a song. There is no script to paste,
 * so the Plates template is not shown for music_video. The mp3 cannot be
 * attached until Lock has built the story (the upload route needs a real
 * beatId), so the picked file is parked here and handed to the song desk the
 * moment a carrier beat exists.
 *
 * Drift (browser probe vs ffmpeg slice clock) is out of scope here — if a
 * song reads 4:45 in the player but slices land at 4:27, that mismatch must
 * be diagnosed before anyone "fixes" the cut list blind.
 */

import type { CrashStoryDoc, CrashStoryScene, CrashStoryShot } from "./crashStoryTypes";
import type { MobileGenJob } from "./mobileGenJob";
import { MUSIC_VIDEO_SHOW_NAME, musicVideoCreditLine } from "./musicVideoSong";
import type { ScriptCharacterData } from "./types";
import { newId } from "./types";
import {
  forgottenResearchDrafts,
  forgottenSoloCamera,
  isForgottenSongJob,
  musicVideoSoloCamera,
} from "./musicVideoGroupPlate";

/** Structural — the phone passes a real File, tests pass a stub. */
export type PickedSongFile = {
  name: string;
  size: number;
  type: string;
};

export type PendingSong<F extends PickedSongFile = PickedSongFile> = {
  file: F;
  durationSec: number;
};

const parked = new Map<string, PendingSong<PickedSongFile>>();

/**
 * A plain Map is invisible to React: parking a file re-rendered only the one
 * component holding it, so the track kept saying "Add the song" and drew a
 * second drop box. Anything reading the park must be able to subscribe.
 */
const listeners = new Set<() => void>();

export function subscribePendingSong(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit(): void {
  for (const fn of [...listeners]) fn();
}

export function parkPendingSong<F extends PickedSongFile>(
  jobId: string,
  song: PendingSong<F>,
): void {
  const id = (jobId || "").trim();
  if (!id) return;
  parked.set(id, song);
  emit();
}

export function peekPendingSong(jobId: string): PendingSong | null {
  return parked.get((jobId || "").trim()) || null;
}

/** Read once and forget — the song desk must not re-upload on every render. */
export function takePendingSong(jobId: string): PendingSong | null {
  const id = (jobId || "").trim();
  const song = parked.get(id) || null;
  if (song) {
    parked.delete(id);
    emit();
  }
  return song;
}

export function clearPendingSong(jobId: string): void {
  if (parked.delete((jobId || "").trim())) emit();
}

const MP3_NAME = /\.mp3$/i;
const MP3_TYPE = /^audio\/(mpeg|mp3)$/i;

/** Some phones hand over an empty type for a file picked out of Files. */
export function isMp3File(file: Pick<PickedSongFile, "name" | "type">): boolean {
  return MP3_TYPE.test((file.type || "").trim()) || MP3_NAME.test((file.name || "").trim());
}

/** `4:27` — song length, not the tenths clock the cut list uses. */
export function formatSongLength(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "";
  const whole = Math.round(sec);
  const m = Math.floor(whole / 60);
  const s = whole - m * 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Drop the file extension for the on-screen chip — the stamp is noise. */
export function songChipName(fileName: string): string {
  const base = (fileName || "").trim().replace(MP3_NAME, "");
  if (base.length <= 34) return base;
  return `${base.slice(0, 33)}…`;
}

export function lyricLineCount(text: string): number {
  return (text || "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0).length;
}

/** Closed by default unless there is already something in there to see. */
export function lyricsPanelOpensAt(text: string): boolean {
  return lyricLineCount(text) > 0;
}

function emptyBookend(): CrashStoryDoc["intro"] {
  return { title: "", notes: "", sfx: [] };
}

/** Default Position for a band member — not facing camera, not singing. */
export function defaultMusicVideoBandStaging(speaker: string, placeName: string): string {
  const who = speaker.trim() || "The character";
  const place = placeName.trim() || "the stage";
  return `${who} alone. Only ${who} in frame, no one else appears. At ${place}, half turned away in profile. NO SINGING MOUTH NOT MOVE. No phone. No extra objects.`;
}

/** One shot per band member at the first locked place — no script paste. */
export function buildMusicVideoStartStory(job: MobileGenJob): {
  title: string;
  logline: string;
  story: CrashStoryDoc;
  characters: ScriptCharacterData[];
} {
  const sceneRef = job.scenes[0];
  if (!sceneRef) throw new Error("Add at least one location first");
  if (!job.speakers.length) throw new Error("Add at least one character first");

  const placeName = sceneRef.placeName.trim();
  const credit = musicVideoCreditLine(job);
  const title = credit || job.prompt.trim() || "Untitled video";
  const logline = [MUSIC_VIDEO_SHOW_NAME, credit].filter(Boolean).join(" · ");

  const scene: CrashStoryScene = {
    id: sceneRef.id,
    title: placeName,
    placeName,
    worldThumbKey: sceneRef.worldThumbKey || "",
    shots: [
      ...job.speakers.map(
        (speaker): CrashStoryShot => ({
          id: newId("shot"),
          title: speaker.trim(),
          summary: `[BUDGET_TIER] CHEAP_TAKE. ${speaker.trim()} at ${placeName}`,
          staging: isForgottenSongJob(job)
            ? forgottenSoloCamera(speaker, placeName)
            : musicVideoSoloCamera(speaker, placeName),
          plateFile: "",
          beats: [{ id: newId("beat"), speaker: speaker.trim(), text: "" }],
          sfx: [],
        }),
      ),
      ...(isForgottenSongJob(job)
        ? forgottenResearchDrafts(job.speakers, placeName).map(
            (draft): CrashStoryShot => ({
              id: newId("shot"),
              title: draft.title,
              summary: draft.summary,
              staging: draft.staging,
              plateFile: "",
              beats: draft.speakers.map((speaker) => ({
                id: newId("beat"),
                speaker,
                text: "",
              })),
              sfx: [],
            }),
          )
        : []),
    ],
  };

  const story: CrashStoryDoc = {
    styleId: "music_video",
    campaignLabel: title,
    gagNote: logline,
    intro: emptyBookend(),
    outro: emptyBookend(),
    scenes: [scene],
    updatedAt: new Date().toISOString(),
  };

  const characters: ScriptCharacterData[] = job.speakers.map((name) => ({
    name: name.trim(),
    description: "",
    appearance:
      job.roster.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase())
        ?.appearance || "",
  }));

  return { title, logline, story, characters };
}
