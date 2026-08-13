let topZ = 40;

/** Cards stay under the desk toolbar (z 5000) and Open-episode modal. */
const CARD_Z_MAX = 400;

/** Bring a Crash Lab floating card to the front. */
export function bumpCrashLabZ(): number {
  if (topZ < 40) topZ = 40;
  topZ += 1;
  if (topZ > CARD_Z_MAX) topZ = 41;
  return topZ;
}

export function crashLabBaseZ(): number {
  return topZ;
}
