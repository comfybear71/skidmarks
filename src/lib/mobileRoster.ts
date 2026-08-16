import { createCharacter, listCharacters } from "./characters";
import type { ScriptCharacterData } from "./types";

/**
 * Auto-create Character rows for a parsed screenplay's cast. The mobile
 * pipeline has no manual "Save Roster" click, so it runs the same create
 * call itself right after script parsing, before image gen needs the records.
 */
export function createCharactersFromScriptRoster(
  characters: ScriptCharacterData[],
): { created: number; skipped: number } {
  const existingNames = new Set(
    listCharacters().map((c) => c.name.trim().toLowerCase()),
  );
  let created = 0;
  let skipped = 0;

  for (const c of characters) {
    const name = c.name.trim();
    if (!name) continue;
    if (existingNames.has(name.toLowerCase())) {
      skipped++;
      continue;
    }
    createCharacter({
      name,
      pastNote: c.description || "",
      lookNote: c.appearance || "",
      tormentScratch: c.tormentScratch || "",
      voiceDescription: c.voiceType || "",
    });
    existingNames.add(name.toLowerCase());
    created++;
  }

  return { created, skipped };
}
