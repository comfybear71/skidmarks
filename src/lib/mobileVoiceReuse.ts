import {
  ensureVoiceSlotFromCards,
  findCrashVoiceByName,
  listApprovedCrashVoiceSlots,
  patchCrashVoiceApprovedId,
} from "./crashVoice";
import { readVoiceLibrary } from "./voiceLibrary";
import { listLibraryVoices } from "./elevenLabs";
import type { ShowStyleId } from "./showStylePresets";

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
      donorId = usable[stableIndex(speaker, usable.length)]?.voiceId || "";
    }
  }
  if (!donorId) return false;

  const slot = existing || ensureVoiceSlotFromCards(styleId, speaker);
  if (!slot) return false;

  patchCrashVoiceApprovedId(styleId, slot.castKey, donorId);
  return true;
}
