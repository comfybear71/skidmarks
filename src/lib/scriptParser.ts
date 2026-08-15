import type {
  ProductionScript,
  ScriptEpisodeData,
  ScriptSceneData,
  ScriptCharacterData,
  ScriptDialogueLine,
} from "./types";
import { emptyProductionScript, newId } from "./types";

/**
 * Parse production script in the Sunny Banks / Skidmarks format.
 * Recognizes:
 * - Character rosters (CHARACTERS: section)
 * - Act headings (ACT I, ACT II, etc.)
 * - Scene headings (EXT./INT. LOCATION - TIME)
 * - Dialogue (CHARACTER\nline)
 */
export function parseProductionScript(
  text: string,
  showSlug: string,
  title: string,
): Omit<ProductionScript, "id" | "importedAt"> {
  const characters = extractCharacterRoster(text);
  const episodes = extractEpisodes(text, characters);

  return {
    showSlug,
    title,
    content: text,
    parsedCharacters: characters,
    parsedEpisodes: episodes,
  };
}

/**
 * Extract CHARACTERS: section into structured data
 */
function extractCharacterRoster(text: string): ScriptCharacterData[] {
  const charRosterRegex = /CHARACTERS:\s*\n([\s\S]*?)(?=\n\nACT|$)/i;
  const match = text.match(charRosterRegex);
  if (!match) return [];

  const rosterText = match[1];
  const characters: ScriptCharacterData[] = [];

  // Split by character blocks (name in CAPS followed by description)
  const charBlocks = rosterText
    .split(/\n(?=[A-Z][A-Z_\s]+:)/g)
    .filter((block) => block.trim());

  for (const block of charBlocks) {
    const lines = block.trim().split("\n");
    if (lines.length === 0) continue;

    // First line is character name
    const nameLine = lines[0].replace(/:.*$/, "").trim();
    const name = nameLine.replace(/[:\-].*$/, "").trim();

    // Rest is description
    const description = lines.slice(1).join("\n").trim();

    // Try to extract appearance from description (usually after first sentence or age descriptor)
    const appearance = extractAppearanceFromDescription(description);

    if (name) {
      characters.push({
        name,
        description,
        appearance,
      });
    }
  }

  return characters;
}

/**
 * Extract key appearance traits from character description
 */
function extractAppearanceFromDescription(description: string): string {
  // Look for patterns like "leopard print dress, gold hoops" or age + appearance
  const lines = description.split(". ");
  if (lines.length > 0) {
    return lines[0];
  }
  return description.substring(0, 100);
}

/**
 * Extract episodes from script text
 */
function extractEpisodes(
  text: string,
  characters: ScriptCharacterData[],
): ScriptEpisodeData[] {
  const episodes: ScriptEpisodeData[] = [];

  // Extract title and logline from beginning
  const titleMatch = text.match(
    /^([\w\s]+)\n+(\d+-)?Episode\s+(\d+):\s*"([^"]+)"/im,
  );
  if (!titleMatch) return episodes;

  const showTitle = titleMatch[1];
  const episodeNum = parseInt(titleMatch[3] || "1", 10);
  const episodeTitle = titleMatch[4];

  // Find the logline (text before first ACT or CHARACTERS)
  const contentStart = text.indexOf("Episode");
  const actStart = text.indexOf("\nACT", contentStart);
  const charStart = text.indexOf("\nCHARACTERS", contentStart);
  const nextSectionStart = Math.min(
    actStart > -1 ? actStart : Infinity,
    charStart > -1 ? charStart : Infinity,
  );

  let logline = "";
  if (nextSectionStart > -1) {
    const header = text.substring(contentStart, nextSectionStart);
    const loglineMatch = header.match(/^[^\n]+\n+(.+?)(?=\n|$)/m);
    if (loglineMatch) {
      logline = loglineMatch[1].trim();
    }
  }

  // Extract all acts and scenes
  const scenes = extractScenes(text);

  episodes.push({
    episodeNum,
    title: episodeTitle,
    logline,
    scenes,
  });

  return episodes;
}

/**
 * Extract scenes from script (ACT I, ACT II, etc.)
 */
function extractScenes(text: string): ScriptSceneData[] {
  const scenes: ScriptSceneData[] = [];

  // Split by ACT headings — collect every match up front (matchAll) and
  // walk pairwise, rather than peeking ahead with a second exec() call:
  // re-pointing a global regex's lastIndex back after an exec() either
  // re-matches the same heading forever (infinite loop) or silently
  // consumes every other act, depending on which line does the resetting.
  const actRegex = /^ACT\s+([IVivx]+)\s*$/gm;
  const actMatches = Array.from(text.matchAll(actRegex));

  actMatches.forEach((match, i) => {
    const actNum = romanToNumber(match[1]) || i + 1;
    const actStart = (match.index ?? 0) + match[0].length;
    const actEnd = actMatches[i + 1]?.index ?? text.length;
    const actContent = text.substring(actStart, actEnd);
    scenes.push(...extractScenesFromAct(actContent, actNum));
  });

  return scenes;
}

/**
 * Extract individual scenes from an act
 */
function extractScenesFromAct(actText: string, actNum: number): ScriptSceneData[] {
  // Scene heading pattern: EXT./INT. LOCATION - TIME
  const sceneHeadingRegex = /^(EXT\.|INT\.)\s+(.+?)\s+-\s+(.+?)$/gm;
  const sceneMatches = Array.from(actText.matchAll(sceneHeadingRegex));

  return sceneMatches.map((match, i) => {
    const heading = match[0];
    const sceneStart = (match.index ?? 0) + match[0].length;
    const sceneEnd = sceneMatches[i + 1]?.index ?? actText.length;
    const sceneContent = actText.substring(sceneStart, sceneEnd);

    return {
      act: actNum,
      heading,
      action: extractActionLines(sceneContent),
      dialogueLines: extractDialogueLines(sceneContent),
    };
  });
}

/**
 * Extract action description lines (non-dialogue)
 */
function extractActionLines(sceneText: string): string[] {
  const lines: string[] = [];
  const textLines = sceneText.split("\n");

  for (const line of textLines) {
    const trimmed = line.trim();

    // Skip empty, dialogue, and parenthetical
    if (
      !trimmed ||
      trimmed.startsWith("(") ||
      trimmed.match(/^[A-Z][A-Z_\s]+$/)
    ) {
      continue;
    }

    // Check if previous line was a character name (dialogue)
    const isDialogue = lines.some((l) => l === trimmed);
    if (!isDialogue) {
      lines.push(trimmed);
    }
  }

  return lines;
}

/**
 * Extract dialogue lines (character name + line)
 */
function extractDialogueLines(sceneText: string): ScriptDialogueLine[] {
  const dialogue: ScriptDialogueLine[] = [];
  const lines = sceneText.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Character line: all caps, not all caps in parentheses
    if (line && line.match(/^[A-Z][A-Z_\s\-]+$/) && !line.startsWith("(")) {
      const character = line;
      const nextLine = lines[i + 1]?.trim() || "";

      // Skip if next line is empty or action
      if (nextLine && !nextLine.startsWith("(") && nextLine.length > 0) {
        dialogue.push({
          character,
          line: nextLine,
        });
      }
    }
  }

  return dialogue;
}

/**
 * Convert Roman numerals to numbers
 */
function romanToNumber(roman: string): number {
  const romanMap: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };

  const upper = roman.toUpperCase();
  let result = 0;
  let prev = 0;

  for (let i = upper.length - 1; i >= 0; i--) {
    const curr = romanMap[upper[i]] || 0;
    if (curr < prev) {
      result -= curr;
    } else {
      result += curr;
    }
    prev = curr;
  }

  return result;
}
