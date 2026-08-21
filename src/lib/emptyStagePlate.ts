/**
 * Empty stage plate — far out, no people. Not an invisible musician.
 * Safe on the phone (no fs).
 */

export function emptyStageFarOutStaging(placeName: string): string {
  const place = placeName.trim() || "this place";
  return `Far out, wide empty ${place}. Empty stage. No people. No musicians. No faces. Establishing shot.`;
}
