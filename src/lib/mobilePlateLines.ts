import { voiceNamesMatch } from "./voiceNameMatch";
import { joPhoneStagingExtra } from "./mobileImageMotion";

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
  plateFile?: string;
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

/** Before anyone is tapped, every face stays in colour. Grey is "the rest" after a pick. */
export function castPopupFaceGrey(picked: string | null, name: string): boolean {
  return Boolean(picked) && picked !== name;
}

/** People actually added to this plate — leftover Comfy/Land mp3s do not count. */
export function speakersAlreadyInPlate(opts: {
  shotId: string;
  title?: string;
  staging?: string;
  summary?: string;
  plateFile?: string;
  jobSpeakers: string[];
  beats: LineBeat[];
}): string[] {
  const emptyCard =
    !String(opts.plateFile || "").trim() &&
    !String(opts.staging || "").trim() &&
    !String(opts.summary || "").trim();
  return plateLineBeats(opts)
    .filter((b) => !(emptyCard && packDialogueSpeaker(b.voiceFile || "")))
    .map((b) => b.speaker.trim())
    .filter(Boolean);
}

/** Unique faces for composite / Image motion — same people the line editors show. */
export function shotSpeakersOnCard(opts: {
  shotId: string;
  title?: string;
  staging?: string;
  summary?: string;
  plateFile?: string;
  jobSpeakers: string[];
  beats: LineBeat[];
}): string[] {
  return [...new Set(speakersAlreadyInPlate(opts))];
}

export function leftoverHydrateSpeakers(
  shotId: string,
  beats: { id: string; speaker: string }[],
): string[] {
  return [
    ...new Set(
      beats
        .filter((b) => leftoverHydrateBeat(shotId, b.id))
        .map((b) => b.speaker.trim())
        .filter(Boolean),
    ),
  ];
}

export function dropLeftoverHydrateBeats<T extends { id: string }>(
  shotId: string,
  beats: T[],
  keepId?: string,
): T[] {
  return beats.filter(
    (b) => (keepId && b.id === keepId) || !leftoverHydrateBeat(shotId, b.id),
  );
}

export function imageMotionNamesLeftovers(
  motion: string,
  leftoverNames: string[],
): boolean {
  const text = String(motion || "");
  if (!text.trim() || !leftoverNames.length) return false;
  return leftoverNames.some((name) => {
    const n = name.trim();
    if (n.length < 2) return false;
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(text);
  });
}

/** Keep a stored Image motion unless leftover Comfy/Land crowd is named in it. */
export function keepStoredImageMotion(
  motion: string | undefined,
  leftoverNames: string[],
): boolean {
  const existing = (motion || "").trim();
  if (!existing) return false;
  return !imageMotionNamesLeftovers(existing, leftoverNames);
}

/**
 * Still-compositor staging. One tapped face must not read as a crowd —
 * the old default ("People inhabit the place" / "Bodies in the room")
 * invited extras into a Jo-only plate.
 */
export function plateCastStagingNote(opts: {
  speakers: string[];
  staging?: string;
  looks?: string;
  placeLook?: string;
}): string {
  const speakers = [...new Set(opts.speakers.map((s) => s.trim()).filter(Boolean))];
  const solo = speakers.length === 1;
  const name = speakers[0] || "The character";
  const staging =
    (opts.staging || "").trim() ||
    (solo
      ? `${name} alone. Only ${name} in frame, no one else appears.`
      : "People inhabit the place — sitting, leaning, presenting, using the furniture.");
  return [
    staging,
    joPhoneStagingExtra(speakers, staging),
    opts.looks,
    opts.placeLook ? `This place: ${opts.placeLook}` : "",
    solo
      ? `Only ${name} in frame, no one else appears. ${name} is the only person. Empty of extra people and animals. Do not invent anyone else.`
      : speakers[0]
        ? `${speakers[0]} is prominent if this is their line.`
        : "",
    "Identity from each single face card — one person per reference. Never a turnaround sheet with several copies of the same character.",
    solo
      ? "One body in the room — sitting, leaning, or standing as staged. Matching light. Not a lineup of people standing in the foreground like cutouts."
      : "Bodies in the room — sitting, leaning, mid-stride, using the bar or furniture. Matching light. Not a lineup of people standing in the foreground like cutouts.",
  ]
    .filter(Boolean)
    .join(". ");
}
