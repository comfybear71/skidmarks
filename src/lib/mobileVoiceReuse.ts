import {
  ensureVoiceSlotFromCards,
  findCrashVoiceByName,
  listApprovedCrashVoiceSlots,
  patchCrashVoiceApprovedId,
} from "./crashVoice";
import { readVoiceLibrary } from "./voiceLibrary";
import type { ShowStyleId } from "./showStylePresets";

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

  const donorId =
    listApprovedCrashVoiceSlots(styleId)[0]?.approvedVoiceId ||
    Object.values(readVoiceLibrary()).find((e) => e.approvedVoiceId?.trim())
      ?.approvedVoiceId ||
    "";
  if (!donorId) return false;

  const slot = existing || ensureVoiceSlotFromCards(styleId, speaker);
  if (!slot) return false;

  patchCrashVoiceApprovedId(styleId, slot.castKey, donorId);
  return true;
}
