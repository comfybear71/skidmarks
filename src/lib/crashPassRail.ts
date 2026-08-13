/**
 * Pass → next episode rail — scaffold only.
 * Visible steps; Pass/Fail clicks stay local until a real director lands.
 */
export type CrashPassStepId =
  | "plan"
  | "script"
  | "voices"
  | "plates"
  | "animate"
  | "sfx"
  | "edit"
  | "outro";

export type CrashPassStep = {
  id: CrashPassStepId;
  label: string;
};

export const CRASH_PASS_STEPS: CrashPassStep[] = [
  { id: "plan", label: "Plan" },
  { id: "script", label: "Script" },
  { id: "voices", label: "Voices" },
  { id: "plates", label: "Plates" },
  { id: "animate", label: "Animate" },
  { id: "sfx", label: "SFX" },
  { id: "edit", label: "Edit" },
  { id: "outro", label: "Outro" },
];

export type CrashPassVerdict = "pass" | "fail" | "pending";

export type CrashPassState = Record<CrashPassStepId, CrashPassVerdict>;

export function emptyPassState(): CrashPassState {
  return {
    plan: "pending",
    script: "pending",
    voices: "pending",
    plates: "pending",
    animate: "pending",
    sfx: "pending",
    edit: "pending",
    outro: "pending",
  };
}

const STORAGE_KEY = "crashlab-pass-rail-v1";

export function readPassState(): CrashPassState {
  if (typeof window === "undefined") return emptyPassState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyPassState();
    const parsed = JSON.parse(raw) as Partial<CrashPassState>;
    return { ...emptyPassState(), ...parsed };
  } catch {
    return emptyPassState();
  }
}

export function writePassState(state: CrashPassState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
