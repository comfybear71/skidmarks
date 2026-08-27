/**
 * Empty stage plate — far out, no people. Not an invisible musician.
 * Safe on the phone (no fs).
 */

export function emptyStageFarOutStaging(placeName: string): string {
  const place = placeName.trim() || "this place";
  return `Far out, wide empty ${place}. Empty stage. No people. No musicians. No faces. Establishing shot.`;
}

/** The far-out establishing card — putting a person on it must not keep this. */
export function isEmptyStageStaging(text: string): boolean {
  const t = String(text || "").trim();
  if (!t) return false;
  return /\bempty stage\b/i.test(t) && /\bno people\b/i.test(t);
}
