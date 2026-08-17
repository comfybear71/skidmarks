/** Pass / fail scorecard tags for Scratch bench runs. */

import type { ScratchScoreTag } from "./types";

export type ScratchScoreOption = {
  id: ScratchScoreTag;
  label: string;
  /** Group for UI. */
  group: "verdict" | "fail-why" | "meta";
};

export const SCRATCH_SCORE_OPTIONS: ScratchScoreOption[] = [
  { id: "pass", label: "Pass", group: "verdict" },
  { id: "fail", label: "Fail", group: "verdict" },
  { id: "close", label: "Close", group: "verdict" },
  { id: "wardrobe", label: "Wardrobe", group: "fail-why" },
  { id: "anatomy", label: "Anatomy", group: "fail-why" },
  { id: "pose", label: "Pose", group: "fail-why" },
  { id: "face", label: "Face", group: "fail-why" },
  { id: "place", label: "Place", group: "fail-why" },
  { id: "speech", label: "Speech", group: "fail-why" },
  { id: "chaos", label: "Chaos hit", group: "meta" },
];

/** Toggle a tag; pass/fail/close stay mutually exclusive. */
export function toggleScoreTag(current: ScratchScoreTag[], tag: ScratchScoreTag): ScratchScoreTag[] {
  const verdicts: ScratchScoreTag[] = ["pass", "fail", "close"];
  const has = current.includes(tag);
  if (verdicts.includes(tag)) {
    const without = current.filter((t) => !verdicts.includes(t));
    return has ? without : [...without, tag];
  }
  if (has) return current.filter((t) => t !== tag);
  return [...current, tag];
}

export function scoreSummary(tags: ScratchScoreTag[]): string {
  if (!tags.length) return "—";
  return tags.join(" · ");
}
