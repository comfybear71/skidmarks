import {
  ensureVoiceSlotFromCards,
  findCrashVoiceByName,
  listApprovedCrashVoiceSlots,
  patchCrashVoiceApprovedId,
  type CrashVoiceSlot,
} from "./crashVoice";
import { listLibraryVoices } from "./elevenLabs";
import { pickLibraryVoiceId, usableLibraryVoices } from "./mobileVoicePick";
import type { ShowStyleId } from "./showStylePresets";

export { pickLibraryVoiceId } from "./mobileVoicePick";

/**
 * Mobile Auto Studio never designs a new ElevenLabs voice — Stuie's call
 * for this experiment (cost/quota reasons; upgrade later if it's worth it).
 * Pick a unique library voice per speaker (name match, then unused). Never
 * alias everyone to the first archive slot — that made the whole roster
 * sound like one person. Returns false only when there is truly nothing
 * to reuse yet.
 */
export async function assignReusedVoice(
  styleId: ShowStyleId,
  speaker: string,
  taken: Set<string> = new Set(),
): Promise<boolean> {
  const existing = findCrashVoiceByName(styleId, speaker);
  const already = existing?.approvedVoiceId?.trim() || "";
  if (already) {
    taken.add(already);
    return true;
  }

  for (const slot of listApprovedCrashVoiceSlots(styleId)) {
    const id = slot.approvedVoiceId?.trim();
    if (id) taken.add(id);
  }

  const library = await listLibraryVoices().catch(() => []);
  let donorId = pickLibraryVoiceId(styleId, speaker, library, taken);
  if (!donorId) {
    donorId = pickLibraryVoiceId(styleId, speaker, library, []);
  }
  if (!donorId) return false;

  const slot = existing || ensureVoiceSlotFromCards(styleId, speaker);
  if (!slot) return false;

  patchCrashVoiceApprovedId(styleId, slot.castKey, donorId);
  taken.add(donorId);
  return true;
}

/** Pin this speaker to a CAST-picked library id without designing or sampling. */
export function pinSpeakerLibraryVoice(
  styleId: ShowStyleId,
  speaker: string,
  voiceId: string,
): boolean {
  const id = voiceId.trim();
  if (!id) return false;
  const slot =
    findCrashVoiceByName(styleId, speaker) || ensureVoiceSlotFromCards(styleId, speaker);
  if (!slot) return false;
  patchCrashVoiceApprovedId(styleId, slot.castKey, id);
  return true;
}

/**
 * Vercel /tmp has no voice manifest, so Animate shows "no voice lock" and
 * hides Gen mp3 even when the ElevenLabs account already has DAP/Kim/Garry.
 * Surface those library voices as locked slots (read-only, no new designs).
 */
export async function libraryVoiceSlotsForShow(
  _styleId: ShowStyleId,
): Promise<Record<string, CrashVoiceSlot>> {
  const library = await listLibraryVoices().catch(() => []);
  const out: Record<string, CrashVoiceSlot> = {};
  for (const v of usableLibraryVoices(library)) {
    const key = `el_${v.voiceId.slice(0, 12)}`;
    out[key] = {
      castKey: key,
      castName: v.name,
      voiceDescription: v.name,
      approvedAttemptId: "library",
      approvedVoiceId: v.voiceId,
      attempts: [],
    };
  }
  return out;
}
