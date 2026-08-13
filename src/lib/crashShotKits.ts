/**
 * Shot-type kit stubs — labels + which Crash Lab kit owns the work.
 * Full auto-router later; this is the filmmaker map only.
 */
export type CrashShotKitId = "dialogue" | "boom" | "titles";

export type CrashShotKit = {
  id: CrashShotKitId;
  label: string;
  /** Plain English what this shot is for */
  blurb: string;
  /** Which Crash Lab panel / kit */
  kit: string;
  /** What’s real vs stub today */
  status: "live" | "stub";
};

export const CRASH_SHOT_KITS: CrashShotKit[] = [
  {
    id: "dialogue",
    label: "Dialogue",
    blurb: "Talking head / lip sync — plate → LTX → MuseTalk",
    kit: "Animate (LTX + Lipsync v1d)",
    status: "live",
  },
  {
    id: "boom",
    label: "Boom",
    blurb: "Explosion / hit FX — still → Wan boom → Keep",
    kit: "Animate → Boom FX",
    status: "live",
  },
  {
    id: "titles",
    label: "Titles",
    blurb: "Intro / outro cards — plates + Resolve titles later",
    kit: "Story bookends (stub router)",
    status: "stub",
  },
];
