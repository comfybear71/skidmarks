import { askGrok } from "./textGen";
import { parseProductionScript } from "./scriptParser";
import { getShowStylePreset, type ShowStyleId } from "./showStylePresets";
import type { ScriptCharacterData, ScriptEpisodeData } from "./types";

const SCRIPT_FORMAT = `Show Name
Episode 1: "Episode Title"

CHARACTERS:
FIRST NAME: What they physically look like — species, build, age, face, clothing, colours. Then one sentence on who they are.
SECOND NAME: What they physically look like — species, build, age, face, clothing, colours. Then one sentence on who they are.

ACT I

INT. LOCATION NAME - DAY

Action line describing what happens.

CHARACTER NAME
Their line of dialogue.

Another action line.

CHARACTER NAME
Another line.

EXT. ANOTHER LOCATION - NIGHT

More action.

CHARACTER NAME
More dialogue.`;

const SYSTEM_PROMPT = (styleId: ShowStyleId, label: string, tagline: string) =>
  [
    `You write short screenplays for "${label}" (${tagline}).`,
    `Output ONLY the screenplay text in EXACTLY this format — no markdown, no commentary, no code fences:`,
    "",
    SCRIPT_FORMAT,
    "",
    "Rules:",
    `- First line is the show name, exactly: ${label}`,
    `- Second line: Episode 1: "Title" (title in double quotes)`,
    // The CHARACTERS: block is not decoration — scriptParser.extractCharacterRoster()
    // keys off it, and without it every character is created with no appearance
    // for the image generator to work from.
    "- Then a CHARACTERS: block, before ACT I. One line per character: NAME: what they look like. Then who they are.",
    "- Appearance comes FIRST on the line, before personality — the first sentence is what the image generator gets.",
    "- EVERY character named in the idea must have a line in the CHARACTERS: block, including animals, creatures and anyone who never speaks",
    "- Describe appearance literally — species, body shape, size, colours, markings, and clothing if any. This text is fed straight to an image generator, so write what a camera would see, not backstory.",
    // The cast is whatever the idea says it is. A talking monkey, a flying
    // goldfish that whistles, a sentient toaster — the description has to keep
    // the impossible bits or the image comes back as an ordinary animal.
    "- A character can be a person, an animal, a creature, or an object. Never turn a non-human character into a human, and never give it a human body unless the idea says so.",
    "- Keep every impossible trait from the idea in the appearance — if it flies, glows, wears a hat, has wings or stands upright, say so plainly.",
    "- Each character is drawn on their own, so describe each one alone. Never describe two characters together in one line.",
    "- ACT headings are roman numerals on their own line: ACT I, ACT II, etc.",
    "- Scene headings: INT. or EXT. PLACE - DAY/NIGHT (all caps place + time)",
    "- Character cues are ALL CAPS on their own line, immediately followed by their spoken line",
    "- Keep it tight — action lines are one sentence, dialogue is naturalistic",
  ].join("\n");

/** Roughly how many scenes a shot-count target needs — ~3 beats/action lines per scene. */
function sceneCountFor(shotCount: number): number {
  return Math.max(1, Math.ceil(shotCount / 3));
}

async function writeWholeScript(opts: {
  prompt: string;
  styleId: ShowStyleId;
  sceneCount: number;
}): Promise<string> {
  const preset = getShowStylePreset(opts.styleId);
  // Mobile pipeline: prompt is the only source of truth for characters.
  // Don't suggest existing cast — let the prompt drive character creation.
  const text = await askGrok({
    system: SYSTEM_PROMPT(opts.styleId, preset.label, preset.tagline),
    user: [
      `Idea / prompt: ${opts.prompt}`,
      `Write ${opts.sceneCount} scene(s) total, spread across ACT I${opts.sceneCount > 4 ? " and ACT II" : ""}.`,
    ]
      .filter(Boolean)
      .join("\n"),
    temperature: 0.9,
    maxTokens: Math.min(4000, 400 + opts.sceneCount * 220),
  });
  return text.trim();
}

/**
 * Prompt -> full screenplay text in scriptParser.ts's exact ingest format.
 * Short/medium targets (<=4 scenes) get one call. Longer targets are built
 * scene-by-scene from an outline so one call's token limit doesn't cap how
 * long a run can be — same code path either way, only the loop count differs.
 */
export async function generateScreenplayText(opts: {
  prompt: string;
  styleId: ShowStyleId;
  shotCount: number;
}): Promise<{
  text: string;
  title: string;
  parsedEpisodes: ScriptEpisodeData[];
  parsedCharacters: ScriptCharacterData[];
}> {
  const sceneCount = sceneCountFor(opts.shotCount);
  const preset = getShowStylePreset(opts.styleId);

  let text: string;
  if (sceneCount <= 4) {
    text = await writeWholeScript({
      prompt: opts.prompt,
      styleId: opts.styleId,
      sceneCount,
    });
  } else {
    // Outline first, then expand each scene with its own call so long
    // targets aren't capped by a single response's token limit.
    const outline = await askGrok({
      system: `You outline episodes for "${preset.label}" (${preset.tagline}).`,
      user: `Idea / prompt: ${opts.prompt}\nList exactly ${sceneCount} scenes as numbered lines, each: LOCATION - one sentence of what happens and who's in it. Nothing else.`,
      temperature: 0.8,
      maxTokens: 60 * sceneCount + 200,
    });
    const beats = outline
      .split("\n")
      .map((l) => l.replace(/^\d+[.)]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, sceneCount);

    const scenes: string[] = [];
    for (let i = 0; i < beats.length; i++) {
      const sceneText = await askGrok({
        system: SYSTEM_PROMPT(opts.styleId, preset.label, preset.tagline),
        user: [
          `Write ONE scene (just the INT./EXT. heading, action, and dialogue — no show name, no episode header, no ACT heading).`,
          `Scene beat: ${beats[i]}`,
          `Overall story idea: ${opts.prompt}`,
        ].join("\n"),
        temperature: 0.9,
        maxTokens: 500,
      });
      scenes.push(sceneText.trim());
    }

    // Scene-by-scene assembly skips the whole-script format, so ask for the
    // CHARACTERS: block on its own — the roster parse needs it either way.
    const roster = await askGrok({
      system: `You cast episodes for "${preset.label}" (${preset.tagline}).`,
      user: [
        `Idea / prompt: ${opts.prompt}`,
        `Scenes:\n${beats.join("\n")}`,
        "List every character who speaks, one per line, exactly: NAME: who they are. What they look like — species, build, age, clothing, colours.",
        "Describe each character alone, never two together. This text goes straight to an image generator. Nothing else — no heading, no numbering.",
      ].join("\n"),
      temperature: 0.7,
      maxTokens: 500,
    });

    const half = Math.ceil(scenes.length / 2);
    text = [
      preset.label,
      `Episode 1: "${opts.prompt.slice(0, 60)}"`,
      "",
      "CHARACTERS:",
      roster.trim(),
      "",
      "ACT I",
      "",
      scenes.slice(0, half).join("\n\n"),
      scenes.length > half ? "\nACT II\n" : "",
      scenes.slice(half).join("\n\n"),
    ]
      .filter(Boolean)
      .join("\n");
  }

  const parsed = parseProductionScript(text, opts.styleId, preset.label);
  if (!parsed.parsedEpisodes.length) {
    throw new Error(
      "Screenplay generation didn't produce a parseable script — try again",
    );
  }

  return {
    text,
    title: parsed.parsedEpisodes[0]!.title,
    parsedEpisodes: parsed.parsedEpisodes,
    parsedCharacters: parsed.parsedCharacters,
  };
}
