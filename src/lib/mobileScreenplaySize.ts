/** Scene count from the places already built — not a guessed runtime.
 * Clip length comes from the voiced lines + plates after those exist. */
export function screenplaySceneCount(locationCount: number): number {
  return Math.max(1, locationCount);
}
