/** Pass / fail scorecard tags for Scratch bench runs. */

import type { ScratchScoreTag } from "./types";

export type ScratchScoreOption = {
  id: ScratchScoreTag;
  label: string;
  /** Short hint under stress chips. */
  hint?: string;
  /** Group for UI. */
  group: "verdict" | "fail-why" | "stress" | "meta";
};

export const SCRATCH_SCORE_OPTIONS: ScratchScoreOption[] = [
  { id: "pass", label: "Pass", group: "verdict" },
  { id: "fail", label: "Fail", group: "verdict" },
  { id: "close", label: "Close", group: "verdict" },
  { id: "eye", label: "Eye glitch", hint: "Iris drift / misaligned gaze", group: "stress" },
  { id: "fingers", label: "Fingers", hint: "Extra digits / morph", group: "stress" },
  { id: "melt", label: "Face melt", hint: "Mesh / structure collapse", group: "stress" },
  { id: "ghost", label: "Ghost / warp", hint: "Backdrop shear / ghosting", group: "stress" },
  { id: "wardrobe", label: "Wardrobe", group: "fail-why" },
  { id: "anatomy", label: "Anatomy", group: "fail-why" },
  { id: "pose", label: "Pose", group: "fail-why" },
  { id: "face", label: "Face", group: "fail-why" },
  { id: "place", label: "Place", group: "fail-why" },
  { id: "speech", label: "Speech", group: "fail-why" },
  {
    id: "style",
    label: "Style slip",
    hint: "Still turned cartoon, human, or photoreal — not the start plate",
    group: "fail-why",
  },
  { id: "chaos", label: "Chaos hit", group: "meta" },
];

export const SCRATCH_STRESS_TAGS: ScratchScoreTag[] = ["eye", "fingers", "melt", "ghost"];

/** Toggle a tag; pass/fail/close stay mutually exclusive. */
export function toggleScoreTag(current: ScratchScoreTag[], tag: ScratchScoreTag): ScratchScoreTag[] {
  const verdicts: ScratchScoreTag[] = ["pass", "fail", "close"];
  const has = current.includes(tag);
  if (verdicts.includes(tag)) {
    const without = current.filter((t) => !verdicts.includes(t));
    return has ? without : [...without, tag];
  }
  if (has) return current.filter((t) => t !== tag);
  let next = [...current, tag];
  // Stress flags imply fail unless a verdict is already set.
  if (SCRATCH_STRESS_TAGS.includes(tag) && !next.some((t) => verdicts.includes(t))) {
    next = [...next, "fail"];
  }
  return next;
}

export function scoreSummary(tags: ScratchScoreTag[]): string {
  if (!tags.length) return "—";
  return tags.join(" · ");
}

export function stressFailCount(tags: ScratchScoreTag[]): number {
  return tags.filter((t) => SCRATCH_STRESS_TAGS.includes(t)).length;
}

export function runVerdict(tags: ScratchScoreTag[]): "pass" | "fail" | "close" | "open" {
  if (tags.includes("pass")) return "pass";
  if (tags.includes("fail")) return "fail";
  if (tags.includes("close")) return "close";
  if (stressFailCount(tags) > 0) return "fail";
  return "open";
}
