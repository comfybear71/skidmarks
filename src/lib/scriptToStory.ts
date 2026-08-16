import type {
  ScriptEpisodeData,
  ScriptSceneData,
} from "./types";
import { newId } from "./types";
import type {
  CrashStoryBeat,
  CrashStoryDoc,
  CrashStoryScene,
  CrashStoryShot,
} from "./crashStoryTypes";
import type { ShowStyleId } from "./showStylePresets";
import { resolvePlaceKey } from "./cursorPromptBuild";
import { defaultShotStaging } from "./mobilePlateStaging";

const HEADING_RE = /^(EXT\.|INT\.)\s+(.+?)\s+-\s+(.+?)$/i;

/** "SHARON", "CRACKWHORE_DARRYL" → "Sharon", "Crackwhore Darryl" — matches cast-name casing elsewhere. */
function titleCaseName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** EXT./INT. LOCATION - TIME → { placeName, timeOfDay }. Falls back to the raw heading. */
function splitHeading(heading: string): { placeName: string; timeOfDay: string } {
  const m = heading.match(HEADING_RE);
  if (!m) return { placeName: heading.trim(), timeOfDay: "" };
  return { placeName: m[2].trim(), timeOfDay: m[3].trim() };
}

/** Best-effort world-card match — empty string (unresolved) if this place isn't a card yet. */
function tryResolvePlaceKey(styleId: ShowStyleId, placeName: string): string {
  if (!placeName) return "";
  try {
    return resolvePlaceKey(styleId, placeName);
  } catch {
    return "";
  }
}

function sceneToStoryScene(scene: ScriptSceneData, styleId: ShowStyleId): CrashStoryScene {
  const { placeName, timeOfDay } = splitHeading(scene.heading);
  const cast = Array.from(
    new Set(scene.dialogueLines.map((d) => titleCaseName(d.character))),
  );

  // A scene with no dialogue (an establishing shot, a sight gag) still needs
  // one beat — the animate phase builds clips per beat, so a shot with none
  // got zero seconds of screen time and silently vanished from the final
  // cut. This "hold" beat has no speaker/text; its mp3 is a short silence
  // materialized in the voices phase (see writeSilentMp3), which the LTX
  // pipeline already knows how to turn into a held-pose clip.
  const beats: CrashStoryBeat[] = scene.dialogueLines.length
    ? scene.dialogueLines.map((d) => ({
        id: newId("beat"),
        speaker: titleCaseName(d.character),
        text: d.line,
        voiceFile: "",
      }))
    : (() => {
        const id = newId("beat");
        return [{ id, speaker: "", text: "", voiceFile: `${id}.mp3` }];
      })();

  const shot: CrashStoryShot = {
    id: newId("shot"),
    title: scene.heading,
    summary: scene.action.join(" ").trim(),
    staging: defaultShotStaging(placeName, cast),
    plateFile: "",
    beats,
    sfx: [],
  };

  return {
    id: newId("scene"),
    title: placeName + (timeOfDay ? ` — ${timeOfDay}` : ""),
    placeName,
    worldThumbKey: tryResolvePlaceKey(styleId, placeName),
    shots: [shot],
  };
}

/**
 * One parsed screenplay episode → one CrashStoryDoc, same shape the rest of
 * Crash Lab (Animate/SFX/Storyboard/Populate) already reads via
 * writeCrashStory()/readCrashStory(). plateFile/voiceFile start empty —
 * Stage 1 (image gen) and Stage 3 (voice gen) fill them in.
 */
export function scriptEpisodeToStoryDoc(
  ep: ScriptEpisodeData,
  styleId: ShowStyleId,
): CrashStoryDoc {
  return {
    styleId,
    campaignLabel: ep.title || `Episode ${ep.episodeNum}`,
    gagNote: ep.logline || "",
    intro: { title: "", notes: "", sfx: [] },
    outro: { title: "", notes: "", sfx: [] },
    scenes: ep.scenes.map((scene) => sceneToStoryScene(scene, styleId)),
    updatedAt: new Date().toISOString(),
  };
}
