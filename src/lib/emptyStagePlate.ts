/**
 * Empty stage plate — far out, no people. Not an invisible musician.
 * Safe on the phone (no fs).
 */

export function emptyStageFarOutStaging(placeName: string): string {
  const place = placeName.trim() || "this place";
  return `Far out, wide empty ${place}. Empty stage. No people. No musicians. No faces. Establishing shot.`;
}

/**
 * Is this staging the "Add empty plate" boilerplate rather than a director's
 * position? Matched on the sentences that make it wrong once a person is on
 * the card, not on the place name, so it holds for any place.
 */
export function isEmptyStageStaging(staging: string): boolean {
  const t = (staging || "").toLowerCase();
  if (!t.trim()) return false;
  return /\bempty stage\b/.test(t) && /\bno people\b/.test(t);
}
