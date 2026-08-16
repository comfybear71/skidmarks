import { voiceNamesMatch } from "./voiceNameMatch";

export function leftoverHydrateBeat(shotId: string, beatId: string): boolean {
  if (!shotId || !beatId) return false;
  if (beatId === `${shotId}_hold`) return true;
  return new RegExp(
    `^${shotId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_a\\d+$`,
  ).test(beatId);
}

/** `01_01_Comfy_Keep-the-rhythm.mp3` → "Comfy" */
export function packDialogueSpeaker(fileName: string): string {
  const m = String(fileName || "").match(
    /^(\d{2})_(\d{2})_([^_]+)_(.+)\.(mp3|wav|ogg|m4a)$/i,
  );
  return m ? m[3].replace(/[-_]+/g, " ").trim() : "";
}

export function speakerMentionedOnPlate(
  speaker: string,
  jobSpeakers: string[],
  plateWords: string,
): boolean {
  const who = speaker.trim();
  if (!who) return false;
  const roster = jobSpeakers.map((s) => s.trim()).filter(Boolean);
  const inRoster =
    !roster.length ||
    roster.some((s) => voiceNamesMatch(s, who) || s.toLowerCase() === who.toLowerCase());
  if (!inRoster) return false;
  const words = plateWords.trim();
  if (!words) return true;
  const mentioned = roster.filter(
    (s) =>
      voiceNamesMatch(s, words) ||
      words.toLowerCase().includes(s.toLowerCase()),
  );
  if (!mentioned.length) return true;
  return mentioned.some(
    (s) => voiceNamesMatch(s, who) || s.toLowerCase() === who.toLowerCase(),
  );
}

export function voiceFileBelongsToSpeaker(
  fileName: string | undefined,
  speaker: string,
): boolean {
  const fromFile = packDialogueSpeaker(fileName || "");
  if (!fromFile) return true;
  return voiceNamesMatch(fromFile, speaker);
}

type LineBeat = { id: string; speaker: string; voiceFile?: string };

/** Line editors on a plate: people actually on this card, not leftover Comfy/Land. */
export function plateLineBeats<T extends LineBeat>(opts: {
  shotId: string;
  title?: string;
  staging?: string;
  summary?: string;
  jobSpeakers: string[];
  beats: T[];
}): T[] {
  const words = [opts.title, opts.staging, opts.summary].filter(Boolean).join(" ");
  return opts.beats.filter((b) => {
    if (!b.speaker.trim()) return false;
    if (leftoverHydrateBeat(opts.shotId, b.id)) return false;
    if (!voiceFileBelongsToSpeaker(b.voiceFile, b.speaker)) return false;
    return speakerMentionedOnPlate(b.speaker, opts.jobSpeakers, words);
  });
}
