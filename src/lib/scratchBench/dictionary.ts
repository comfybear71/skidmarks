/**
 * Banned / stress-word highlighter stub.
 * Wire real dictionaries later — do not block Draw on matches.
 */

export type ScratchDictHit = {
  word: string;
  start: number;
  end: number;
  severity: "soft" | "hard";
};

/** Placeholder list — expand when Stuie pastes a real bank. */
export const SCRATCH_STRESS_WORDS: { word: string; severity: "soft" | "hard" }[] = [
  { word: "nude", severity: "hard" },
  { word: "naked", severity: "hard" },
  { word: "explicit", severity: "soft" },
  { word: "blood", severity: "soft" },
  { word: "gore", severity: "soft" },
];

export function findStressHits(text: string): ScratchDictHit[] {
  const lower = text.toLowerCase();
  const hits: ScratchDictHit[] = [];
  for (const entry of SCRATCH_STRESS_WORDS) {
    let from = 0;
    const needle = entry.word.toLowerCase();
    while (from < lower.length) {
      const i = lower.indexOf(needle, from);
      if (i < 0) break;
      hits.push({ word: entry.word, start: i, end: i + needle.length, severity: entry.severity });
      from = i + needle.length;
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

export function stressHitCount(text: string): { soft: number; hard: number } {
  const hits = findStressHits(text);
  return {
    soft: hits.filter((h) => h.severity === "soft").length,
    hard: hits.filter((h) => h.severity === "hard").length,
  };
}
