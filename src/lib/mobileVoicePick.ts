import {
  getShowStylePreset,
  SHOW_STYLE_PRESETS,
  type ShowStyleId,
} from "./showStylePresets";
import { defaultCrashVoicePrompt } from "./crashVoicePrompt";
import {
  pickLibraryVoiceFromPool,
  type PickableVoice,
} from "./voiceNameMatch";

export {
  STOCK_ADAM_VOICE_ID,
  usableLibraryVoices,
  voiceNamesMatch,
  type PickableVoice,
} from "./voiceNameMatch";

/** Pick an existing ElevenLabs voice for this speaker. Never Adam.
 * `taken` are voice ids already given to someone else this run. */
export function pickLibraryVoiceId(
  styleId: ShowStyleId,
  speaker: string,
  library: PickableVoice[],
  taken: Iterable<string> = [],
): string {
  const wanted = /\bfemale voice\b/i.test(defaultCrashVoicePrompt(speaker))
    ? "female"
    : "male";
  return pickLibraryVoiceFromPool({
    speaker,
    library,
    taken,
    showLabel: getShowStylePreset(styleId).label,
    otherLabels: SHOW_STYLE_PRESETS.filter((p) => p.id !== styleId).map(
      (p) => p.label,
    ),
    wantedSex: wanted,
  });
}
