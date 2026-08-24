/**
 * Jack Ash song queue — logged 2026-08-24 from Stuie.
 * Study concert-loop plates before cooking the list.
 * Do not mint a job from this file.
 */

export const JACK_ASH_BAND = "THE JACK ASH BAND";

export const JACK_ASH_QUEUE = [
  "MY NEW TOY",
  "FORGOTTEN",
  "BURNING BRIGHT",
  "EAST",
  "GIVE ME SOMETHING",
] as const;

export type JackAshSongTitle = (typeof JACK_ASH_QUEUE)[number];

/** Live Forgotten job. Do not Start directing again. */
export const FORGOTTEN_JOB_ID = "mgen_20260824085817084_edp";
export const FORGOTTEN_FOLDER = "THE JACK ASH BAND — FORGOTTEN 84_edp";

export function isJackAshQueueTitle(title: string): title is JackAshSongTitle {
  const t = title.trim().toUpperCase();
  return (JACK_ASH_QUEUE as readonly string[]).some((s) => s === t);
}
