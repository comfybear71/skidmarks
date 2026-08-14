import { askGrok } from "./textGen";
import { parseProductionScript } from "./scriptParser";
import { getShowStylePreset, type ShowStyleId } from "./showStylePresets";

const SCRIPT_FORMAT = `Show Name
Episode 1: "Episode Title"

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
  const castNote = preset.presetCast.length
    ? `Existing cast to use where relevant: ${preset.presetCast.map((c) => c.name).join(", ")}.`
    : "";
  const text = await askGrok({
    system: SYSTEM_PROMPT(opts.styleId, preset.label, preset.tagline),
    user: [
      `Idea / prompt: ${opts.prompt}`,
      `Write ${opts.sceneCount} scene(s) total, spread across ACT I${opts.sceneCount > 4 ? " and ACT II" : ""}.`,
      castNote,
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
}): Promise<{ text: string; title: string }> {
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
      const actNum = i < Math.ceil(beats.length / 2) ? "I" : "II";
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

    const half = Math.ceil(scenes.length / 2);
    text = [
      preset.label,
      `Episode 1: "${opts.prompt.slice(0, 60)}"`,
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

  return { text, title: parsed.parsedEpisodes[0]!.title };
}
