/** Client-safe labels for /m Locations — short chips, not whole paragraphs. */

function trimWords(text: string, maxLen: number): string {
  const raw = text.trim();
  if (!raw || raw.length <= maxLen) return raw;
  const words = raw.split(/\s+/);
  let out = "";
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > maxLen - 1) break;
    out = next;
  }
  return out ? `${out}…` : `${raw.slice(0, Math.max(1, maxLen - 1))}…`;
}

/** Thumbnail strip under Locations — one short line, ellipsis if needed. */
export function placeChipLabel(placeName: string, maxLen = 22): string {
  const raw = placeName.trim();
  if (!raw) return "Place";
  if (raw.length <= maxLen) return raw;
  const clause = raw.split(/[.!?]\s/)[0]?.trim() || raw;
  if (clause.length <= maxLen) return clause;
  return trimWords(clause, maxLen);
}

/** Detail header when a place is open — still short; full look folds away. */
export function placeDetailTitle(placeName: string, maxLen = 40): string {
  const raw = placeName.trim();
  if (!raw) return "Place";
  if (raw.length <= maxLen) return raw;
  const clause = raw.split(/[.!?]\s/)[0]?.trim() || raw;
  if (clause.length <= maxLen) return clause;
  return trimWords(clause, maxLen);
}

/** Saved look words for the place still — not the chip title. */
export function placeLookWords(placeName: string, candidatePrompt?: string): string {
  const prompt = (candidatePrompt || "").trim();
  const name = placeName.trim();
  if (prompt) return prompt;
  if (name.length > 40) return name;
  return "";
}

export function placeLookFoldsUnderTitle(placeName: string, candidatePrompt?: string): boolean {
  const look = placeLookWords(placeName, candidatePrompt);
  if (!look) return false;
  return look.trim() !== placeDetailTitle(placeName).trim();
}

export type PlacePickOption = {
  sceneId: string;
  name: string;
  thumbUrl: string;
};

/**
 * ADD PLATE is person / empty / place — not a second STILLS shelf.
 * Adding a plate often mints another scene with the same still, so
 * job.scenes can list the same Dark image seven times. One card each.
 */
export function uniquePlacePickOptions<T extends PlacePickOption>(places: T[]): T[] {
  const seenThumb = new Set<string>();
  const seenName = new Set<string>();
  const out: T[] = [];
  for (const place of places) {
    const thumb = (place.thumbUrl || "").trim();
    const name = (place.name || "").trim().toLowerCase();
    if (thumb && seenThumb.has(thumb)) continue;
    if (name && seenName.has(name)) continue;
    if (thumb) seenThumb.add(thumb);
    if (name) seenName.add(name);
    out.push(place);
  }
  return out;
}
