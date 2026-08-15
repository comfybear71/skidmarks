import {
  ensureVoiceSlotFromCards,
  findCrashVoiceByName,
  listApprovedCrashVoiceSlots,
  patchCrashVoiceApprovedId,
} from "./crashVoice";
import { readVoiceLibrary } from "./voiceLibrary";
import { listLibraryVoices } from "./elevenLabs";
import { defaultCrashVoicePrompt } from "./crashVoicePrompt";
import {
  getShowStylePreset,
  SHOW_STYLE_PRESETS,
  type ShowStyleId,
} from "./showStylePresets";

/** Same speaker → same voice on every run, without persisting the choice.
 * The local voice records live in per-invocation /tmp on Vercel, so nothing
 * about this decision survives; deriving it from the name keeps a character
 * sounding the same anyway. */
function stableIndex(name: string, count: number): number {
  let hash = 0;
  for (const ch of name.trim().toLowerCase()) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return count > 0 ? hash % count : 0;
}

/**
 * Mobile Auto Studio never designs a new ElevenLabs voice — Stuie's call
 * for this experiment (cost/quota reasons; upgrade later if it's worth it).
 * If a speaker has no approved voice yet, alias them to any already-approved
 * voice_id (this show first, any show as fallback) via patchCrashVoiceApprovedId
 * — a pure local JSON patch, zero ElevenLabs calls. Returns false only when
 * there is truly nothing to reuse yet (first-ever run, nothing cast anywhere).
 */
export async function assignReusedVoice(
  styleId: ShowStyleId,
  speaker: string,
): Promise<boolean> {
  const existing = findCrashVoiceByName(styleId, speaker);
  if (existing?.approvedVoiceId?.trim()) return true;

  let donorId =
    listApprovedCrashVoiceSlots(styleId)[0]?.approvedVoiceId ||
    Object.values(readVoiceLibrary()).find((e) => e.approvedVoiceId?.trim())
      ?.approvedVoiceId ||
    "";

  // Both lookups above read local JSON, which on Vercel is per-invocation
  // /tmp — empty on every run. So this returned false every time and the
  // caller designed a brand new voice per speaker instead, which is what
  // burned through the monthly add/edit allowance. Voices already on the
  // account cost nothing to reuse, so fall back to those.
  if (!donorId) {
    const library = await listLibraryVoices().catch(() => []);
    const usable = library.filter((v) => v.voiceId?.trim());
    if (usable.length) {
      const sp = speaker.trim().toLowerCase();
      const showLabel = getShowStylePreset(styleId).label.toLowerCase();
      const otherLabels = SHOW_STYLE_PRESETS.filter((p) => p.id !== styleId).map(
        (p) => p.label.toLowerCase(),
      );

      // The account already holds voices named after these characters —
      // "Sunny Banks Nan", "Dazza", "Skidmarks Narrator". Matching on the name
      // gets the character's actual voice rather than a stranger's, and costs
      // no add/edit operation. Prefer one tagged with this show, then one
      // belonging to no other show, so "Shazza" does not pick up
      // "Skidmarks Shazza Crack" while making Sunny Banks.
      const named = usable.filter((v) => v.name.toLowerCase().includes(sp));
      const thisShow = named.filter((v) => v.name.toLowerCase().includes(showLabel));
      const unclaimed = named.filter(
        (v) => !otherLabels.some((o) => v.name.toLowerCase().includes(o)),
      );

      // Nothing named for them: any voice will do, but a wrong-sex one will
      // not. defaultCrashVoicePrompt already encodes the name-to-sex guess, so
      // read the answer off it rather than keeping a second list in sync.
      const wanted = /\bfemale voice\b/i.test(defaultCrashVoicePrompt(speaker))
        ? "female"
        : "male";
      const bySex = usable.filter((v) => v.gender === wanted);
      const pool = bySex.length ? bySex : usable;

      donorId =
        thisShow[0]?.voiceId ||
        unclaimed[0]?.voiceId ||
        named[0]?.voiceId ||
        pool[stableIndex(speaker, pool.length)]?.voiceId ||
        "";
    }
  }
  if (!donorId) return false;

  const slot = existing || ensureVoiceSlotFromCards(styleId, speaker);
  if (!slot) return false;

  patchCrashVoiceApprovedId(styleId, slot.castKey, donorId);
  return true;
}
