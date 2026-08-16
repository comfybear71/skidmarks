import { voiceNamesMatch } from "./voiceNameMatch";

/** CAST-assigned library voice, stored on the Neon job so Vercel /tmp can die. */
export type JobSpeakerVoice = {
  voiceId: string;
  voiceName?: string;
};

export function jobVoiceForSpeaker(
  map: Record<string, JobSpeakerVoice> | undefined,
  speaker: string,
): JobSpeakerVoice | undefined {
  if (!map) return undefined;
  const want = speaker.trim();
  if (!want) return undefined;
  const exact = map[want];
  if (exact?.voiceId?.trim()) {
    return { voiceId: exact.voiceId.trim(), voiceName: exact.voiceName?.trim() || undefined };
  }
  for (const [key, value] of Object.entries(map)) {
    if (!value?.voiceId?.trim()) continue;
    if (voiceNamesMatch(key, want) || key.trim().toLowerCase() === want.toLowerCase()) {
      return { voiceId: value.voiceId.trim(), voiceName: value.voiceName?.trim() || undefined };
    }
  }
  return undefined;
}

export function withJobSpeakerVoice(
  map: Record<string, JobSpeakerVoice> | undefined,
  speaker: string,
  voice: JobSpeakerVoice,
): Record<string, JobSpeakerVoice> {
  const next: Record<string, JobSpeakerVoice> = { ...(map || {}) };
  const who = speaker.trim();
  const voiceId = voice.voiceId.trim();
  if (!who || !voiceId) return next;
  for (const key of Object.keys(next)) {
    if (voiceNamesMatch(key, who) || key.trim().toLowerCase() === who.toLowerCase()) {
      delete next[key];
    }
  }
  next[who] = {
    voiceId,
    ...(voice.voiceName?.trim() ? { voiceName: voice.voiceName.trim() } : {}),
  };
  return next;
}

/** Name shown next to Save — CAST library name, never leftover Comfy mp3 text. */
export function lineVoiceLabel(opts: {
  speaker: string;
  jobVoices?: Record<string, JobSpeakerVoice>;
  assignedVoiceId?: string;
  library: { voiceId: string; name: string }[];
}): string {
  const job = jobVoiceForSpeaker(opts.jobVoices, opts.speaker);
  if (job?.voiceName?.trim()) return job.voiceName.trim();
  const id = (job?.voiceId || opts.assignedVoiceId || "").trim();
  if (!id) return "";
  return opts.library.find((v) => v.voiceId === id)?.name?.trim() || "";
}
