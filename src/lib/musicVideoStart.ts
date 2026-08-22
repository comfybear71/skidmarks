/**
 * Music video start desk — song + lyrics, before the pack exists.
 *
 * A music video is a band, a place, and a song. There is no script to paste,
 * so the Plates template is not shown for music_video. The mp3 cannot be
 * attached until Lock has built the story (the upload route needs a real
 * beatId), so the picked file is parked here and handed to the song desk the
 * moment a carrier beat exists.
 */

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

export function parkPendingSong<F extends PickedSongFile>(
  jobId: string,
  song: PendingSong<F>,
): void {
  const id = (jobId || "").trim();
  if (!id) return;
  parked.set(id, song);
}

export function peekPendingSong(jobId: string): PendingSong | null {
  return parked.get((jobId || "").trim()) || null;
}

/** Read once and forget — the song desk must not re-upload on every render. */
export function takePendingSong(jobId: string): PendingSong | null {
  const id = (jobId || "").trim();
  const song = parked.get(id) || null;
  if (song) parked.delete(id);
  return song;
}

export function clearPendingSong(jobId: string): void {
  parked.delete((jobId || "").trim());
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
