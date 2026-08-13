import type { Character } from "./types";

const SKIP_WORDS = new Set(["the", "a", "an"]);

/** Match a preset / roster name to a Character Lab entry. */
export function matchLabCharacter(
  characters: Character[],
  presetName: string,
): Character | null {
  const low = presetName.toLowerCase().trim();
  const exact = characters.find((c) => c.name.toLowerCase() === low);
  if (exact) return exact;

  const words = low.split(/\s+/).filter((w) => w && !SKIP_WORDS.has(w));
  for (const word of words) {
    if (word.length < 2) continue;
    const hit = characters.find((c) => {
      const cn = c.name.toLowerCase();
      return cn === word || cn.startsWith(`${word} `) || cn.includes(word);
    });
    if (hit) return hit;
  }

  return null;
}
