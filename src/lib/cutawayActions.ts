/**
 * Cutaway move chips + SFX length rule. Safe for the phone page —
 * no disk, no ffprobe.
 */

export const CUTAWAY_SFX_MIN_SEC = 6;
export const CUTAWAY_SFX_MAX_SEC = 10;

export type CutawayAction = {
  id: string;
  label: string;
  action: string;
};

export const CUTAWAY_ACTIONS: CutawayAction[] = [
  {
    id: "stand-up",
    label: "Stand up",
    action: "stands up from sitting, rises to their feet",
  },
  {
    id: "walk-away",
    label: "Walk away",
    action: "stands and walks away from camera, leaving the place",
  },
  {
    id: "walk-toward",
    label: "Walk toward",
    action: "walks toward the camera, filling the frame",
  },
  {
    id: "sit-up",
    label: "Sit up",
    action: "sits up, weight shifting upright",
  },
  {
    id: "look-away",
    label: "Look away",
    action: "turns their head and looks away",
  },
  {
    id: "shake-head",
    label: "Shake head",
    action: "shakes their head, no words",
  },
];

export function cutawayActionById(id: string): CutawayAction | undefined {
  return CUTAWAY_ACTIONS.find((a) => a.id === id);
}

/** Probe jitter — a 6.00 file can read 5.97. */
export function cutawaySfxInRange(sec: number): boolean {
  if (!Number.isFinite(sec) || sec <= 0) return false;
  return sec >= CUTAWAY_SFX_MIN_SEC - 0.25 && sec <= CUTAWAY_SFX_MAX_SEC + 0.25;
}

export function cutawaySfxRangeError(sec: number): string {
  const shown = Number.isFinite(sec) ? `${sec.toFixed(1)}s` : "unknown length";
  return `Need a 6–10 second SFX (this one is ${shown}). Pick another, or add one on the SPX shelf.`;
}
