import {
  getShowStylePreset,
  SHOW_STYLE_PRESETS,
  type ShowStyleId,
} from "./showStylePresets";
import { speakerWantedSex } from "./crashVoicePrompt";
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
  appearanceHint?: string,
): string {
  return pickLibraryVoiceFromPool({
    speaker,
    library,
    taken,
    showLabel: getShowStylePreset(styleId).label,
    otherLabels: SHOW_STYLE_PRESETS.filter((p) => p.id !== styleId).map(
      (p) => p.label,
    ),
    wantedSex: speakerWantedSex(speaker, appearanceHint),
  });
}

/** Dropdown shows the locked recycled voice, not "Auto". */
export function shownVoiceId(opts: {
  assignedId?: string;
  speaker: string;
  styleId: ShowStyleId;
  library: PickableVoice[];
}): string {
  const assigned = (opts.assignedId || "").trim();
  if (assigned) return assigned;
  return pickLibraryVoiceId(opts.styleId, opts.speaker, opts.library);
}
