/**
 * Shot plates start small — one or two people in the place.
 * Dumping the whole cast into one still melts faces.
 */

export const SIMPLE_PLATE_FACES = 2;

export function uniqueBeatSpeakers(
  beats: { speaker?: string }[] | undefined,
): string[] {
  return [
    ...new Set((beats || []).map((b) => (b.speaker || "").trim()).filter(Boolean)),
  ];
}

/** "Matty, BC, Big Sexy, Comfy · MATTY BAR" — a roster dump, not a stage. */
export function stagingLooksLikeCrowdDump(staging: string): boolean {
  const text = staging.trim();
  if (!text) return false;
  if (/\b(sits?|sitting|lean|walk|only|nobody else|two people)\b/i.test(text)) {
    return false;
  }
  const head = (text.split("·")[0] || text).split("—")[0] || text;
  const names = head
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s.length < 40);
  return names.length > SIMPLE_PLATE_FACES;
}

export function namesInStaging(staging: string, roster: string[]): string[] {
  const text = staging.trim();
  if (!text) return [];
  const hits: string[] = [];
  for (const raw of roster) {
    const name = raw.trim();
    if (!name) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) hits.push(name);
  }
  return hits;
}

export function defaultShotStaging(placeName: string, speakers: string[]): string {
  const who = speakers.map((s) => s.trim()).filter(Boolean).slice(0, SIMPLE_PLATE_FACES);
  const place = placeName.trim() || "the place";
  if (who.length === 0) {
    return `One person in ${place} — sitting or leaning. No crowd.`;
  }
  if (who.length === 1) {
    return `${who[0]} in ${place} — sitting or leaning, using the place. Nobody else in frame.`;
  }
  return `${who[0]} and ${who[1]} in ${place} — two people only, inhabiting the place. Nobody else.`;
}

/** Who to hand the compositor. Staging wins if it names people; a roster dump is ignored. */
export function peopleForShotPlate(opts: {
  staging: string;
  beatSpeakers: string[];
  roster?: string[];
}): string[] {
  const beats = opts.beatSpeakers.map((s) => s.trim()).filter(Boolean);
  const roster = [...new Set([...(opts.roster || []), ...beats])];
  if (!stagingLooksLikeCrowdDump(opts.staging)) {
    const named = namesInStaging(opts.staging, roster);
    if (named.length) return named;
  }
  return beats.slice(0, SIMPLE_PLATE_FACES);
}

export function editorStagingSeed(opts: {
  staging?: string;
  summary?: string;
  placeName?: string;
  beatSpeakers: string[];
}): string {
  const raw = (opts.staging || "").trim() || (opts.summary || "").trim();
  if (raw && !stagingLooksLikeCrowdDump(raw)) return raw;
  return defaultShotStaging(opts.placeName || "", opts.beatSpeakers);
}
