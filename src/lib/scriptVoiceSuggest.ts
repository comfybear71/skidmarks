import { askGrok, textKeyPresent } from "./textGen";

const SYSTEM_PROMPT = [
  "You cast voice actors for an Australian sitcom. Given a character's notes,",
  "write ONE ElevenLabs voice-design description: 1-2 sentences covering",
  "accent (Australian), age, gender, and vocal tone/texture/delivery.",
  "Sound only — no personality traits, no backstory, no character name, no quotes.",
  'Example: "Australian male voice, early thirties. Nasal, fast-talking, wound tight."',
].join(" ");

/**
 * LLM-written ElevenLabs casting description from a character's roster
 * notes. Returns "" on any failure (missing key, empty/failed response) —
 * callers fall through to the existing static defaultCrashVoicePrompt
 * table, so a missing/failed Grok call never blocks voice generation.
 */
export async function suggestVoiceDescription(opts: {
  name: string;
  pastNote?: string;
  tormentScratch?: string;
  lookNote?: string;
}): Promise<string> {
  if (!textKeyPresent()) return "";

  const notes = [opts.pastNote, opts.tormentScratch, opts.lookNote]
    .map((n) => (n || "").trim())
    .filter(Boolean)
    .join("\n");
  if (!notes) return "";

  try {
    const text = await askGrok({
      system: SYSTEM_PROMPT,
      user: `Character: ${opts.name}\nNotes:\n${notes}`,
      temperature: 0.8,
      maxTokens: 150,
    });
    return text.replace(/^"|"$/g, "").trim();
  } catch {
    return "";
  }
}
