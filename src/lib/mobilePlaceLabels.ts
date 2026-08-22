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
