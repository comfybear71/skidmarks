/**
 * Scratch studio floor — the machine must not fail the director.
 * Models may still Fail a still. These laws are the send path, not a hope.
 *
 * 1. Who is on the pad is the person. Generic chips never name Jo.
 * 2. The full Draw stack is visible and stored with the run.
 * 3. A new test is a new sealed run. Nothing copies unless pinned.
 * 4. Scratch does not rewrite a live episode shot. Only the Scratch shot.
 * 5. If a lock cannot be seen, it cannot be sent.
 */

export const SCRATCH_FLOOR_LAWS = [
  "Who is on the pad is the person. Do not name anyone who is not on the pad.",
  "The full Draw stack is visible and stored with the run.",
  "A new test is a new sealed run. Nothing copies unless pinned.",
  "Scratch does not rewrite a live episode shot. Only the Scratch shot.",
  "If a lock cannot be seen, it cannot be sent.",
] as const;

/** Jo leftover stills that must not hide in generic wardrobe / body chips. */
export const SCRATCH_JO_BLEED = /crazed maniac/i;
