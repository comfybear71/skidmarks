import { getEnv } from "./env";
import { recordVoiceDesignGeneration } from "./elevenQuota";

export function elevenKeyPresent(): boolean {
  return Boolean(getEnv("ELEVENLABS_API_KEY"));
}

function key(): string {
  const k = getEnv("ELEVENLABS_API_KEY");
  if (!k) {
    throw new Error(
      "Missing ELEVENLABS_API_KEY in MY MOVIES\\.env — restart Studio after adding.",
    );
  }
  return k;
}

type DesignPreview = {
  generated_voice_id?: string;
  generatedVoiceId?: string;
  audio_base_64?: string;
  audioBase64?: string;
  media_type?: string;
  duration_secs?: number;
};

type DesignResponse = {
  previews?: DesignPreview[];
  text?: string;
  detail?: { message?: string } | string;
};

/**
 * Spoken line for design previews — long enough (~15–20s) to keep as a
 * local clone sample. Not saved permanently on ElevenLabs.
 */
export const VOICE_CLONE_SAMPLE_SCRIPT =
  "Right, this is a working sample for the voice bank. Speak clear for about fifteen seconds so we can clone it later. Overcast grey English daylight, ordinary room, no polish, no radio presenter. Keep it dry and human when you finish the line.";

/** ElevenLabs voice design rejects anything shorter than this, so callers
 * building a description need the same number to pick a usable candidate. */
export const MIN_VOICE_DESCRIPTION_CHARS = 20;

/** Design voice previews from a text cast description. */
export async function designVoicePreviews(opts: {
  voiceDescription: string;
  previewText?: string;
  /** Reject reasons from earlier takes — steers a different design */
  rejectHints?: string[];
}): Promise<
  { generatedVoiceId: string; audioBase64: string; previewText: string }[]
> {
  const base = opts.voiceDescription.trim();
  if (base.length < MIN_VOICE_DESCRIPTION_CHARS) {
    throw new Error("Voice description too short — write a proper cast note.");
  }

  const hints = (opts.rejectHints || [])
    .map((h) => h.trim())
    .filter(Boolean)
    .slice(0, 8);

  // Fresh seed every run so we don't get the same three clones again
  const seed = Math.floor(Math.random() * 2_000_000_000);

  let description = base;
  if (hints.length) {
    description = [
      base,
      "IMPORTANT — previous previews were REJECTED. Design a clearly DIFFERENT voice.",
      `Fix these problems: ${hints.join("; ")}.`,
      "Push harder: strong Australian working-class accent, human and organic (not robotic), lower pitch if previous was high, rough not polished.",
    ].join("\n");
  }

  const body: Record<string, unknown> = {
    voice_description: description.slice(0, 1000),
    model_id: "eleven_multilingual_ttv_v2",
    // Slightly freer when fixing rejects so it can leave the first cluster
    guidance_scale: hints.length ? 3.5 : 5,
    seed,
  };

  const line = (opts.previewText || VOICE_CLONE_SAMPLE_SCRIPT).trim();
  if (line.length >= 100) {
    body.text = line.slice(0, 1000);
  } else {
    body.auto_generate_text = true;
  }

  const res = await fetch("https://api.elevenlabs.io/v1/text-to-voice/design", {
    method: "POST",
    headers: {
      "xi-api-key": key(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as DesignResponse;
  if (!res.ok) {
    const msg =
      typeof data.detail === "string"
        ? data.detail
        : data.detail?.message || `ElevenLabs design failed (${res.status})`;
    throw new Error(msg);
  }

  // Counts against the monthly voice-design quota — one design call here
  // produces the whole batch of previews, so this is one "generation".
  recordVoiceDesignGeneration();

  const spoken = data.text || line || "";
  const out: {
    generatedVoiceId: string;
    audioBase64: string;
    previewText: string;
  }[] = [];

  for (const p of data.previews || []) {
    const gid = p.generated_voice_id || p.generatedVoiceId || "";
    const b64 = p.audio_base_64 || p.audioBase64 || "";
    if (!gid || !b64) continue;
    out.push({ generatedVoiceId: gid, audioBase64: b64, previewText: spoken });
  }
  if (out.length === 0) throw new Error("ElevenLabs returned no voice previews");
  return out;
}

/** Lock a preview into the ElevenLabs library — returns permanent voice_id. */
export async function createLibraryVoice(opts: {
  voiceName: string;
  voiceDescription: string;
  generatedVoiceId: string;
}): Promise<string> {
  const res = await fetch("https://api.elevenlabs.io/v1/text-to-voice", {
    method: "POST",
    headers: {
      "xi-api-key": key(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      voice_name: opts.voiceName.slice(0, 100),
      voice_description: opts.voiceDescription.slice(0, 500),
      generated_voice_id: opts.generatedVoiceId,
    }),
  });
  const data = (await res.json()) as {
    voice_id?: string;
    voiceId?: string;
    detail?: { message?: string } | string;
  };
  if (!res.ok) {
    const msg =
      typeof data.detail === "string"
        ? data.detail
        : data.detail?.message || `ElevenLabs create voice failed (${res.status})`;
    throw new Error(msg);
  }
  const id = data.voice_id || data.voiceId || "";
  if (!id) throw new Error("ElevenLabs create returned no voice_id");
  return id;
}

/**
 * Free a slot on the ElevenLabs account. Never throws — losing a keeper
 * matters, failing to tidy up does not.
 */
export async function deleteLibraryVoice(voiceId: string): Promise<boolean> {
  if (!voiceId) return false;
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`,
      { method: "DELETE", headers: { "xi-api-key": key() } },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export type ElevenVoiceSummary = {
  voiceId: string;
  name: string;
  category?: string;
  /** "male" / "female" from the account's voice labels, when tagged. */
  gender?: string;
};

/** List voices on the ElevenLabs account (custom + default). */
export async function listLibraryVoices(): Promise<ElevenVoiceSummary[]> {
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": key() },
  });
  const data = (await res.json()) as {
    voices?: {
      voice_id?: string;
      voiceId?: string;
      name?: string;
      category?: string;
      labels?: Record<string, string> | null;
    }[];
    detail?: { message?: string } | string;
  };
  if (!res.ok) {
    const msg =
      typeof data.detail === "string"
        ? data.detail
        : data.detail?.message || `ElevenLabs list voices failed (${res.status})`;
    throw new Error(msg);
  }
  return (data.voices || [])
    .map((v) => ({
      voiceId: (v.voice_id || v.voiceId || "").trim(),
      name: (v.name || "").trim(),
      category: v.category,
      // ElevenLabs tags most voices with a gender label. Carried through so a
      // reused voice can at least match the character's sex.
      gender: (v.labels?.gender || "").trim().toLowerCase() || undefined,
    }))
    .filter((v) => v.voiceId);
}

/** Eleven v3 hard-caps a request around 5k. Split so a duration-push
 * letter actually speaks instead of silently truncating or 504-ing Save. */
const ELEVEN_SPEAK_MAX = 5000;
const ELEVEN_SPEAK_CHUNK = 2400;

function splitSpeakChunks(text: string): string[] {
  const t = text.trim();
  if (t.length <= ELEVEN_SPEAK_CHUNK) return [t];
  const chunks: string[] = [];
  let rest = t;
  while (rest.length > ELEVEN_SPEAK_CHUNK) {
    const window = rest.slice(0, ELEVEN_SPEAK_CHUNK);
    let cut = window.lastIndexOf(". ");
    if (cut < ELEVEN_SPEAK_CHUNK * 0.4) cut = window.lastIndexOf(" ");
    if (cut < 1) cut = ELEVEN_SPEAK_CHUNK;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks.filter(Boolean);
}

async function synthesizeSpeechChunk(voiceId: string, text: string): Promise<Buffer> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: text.slice(0, ELEVEN_SPEAK_MAX),
        model_id: "eleven_v3",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.85,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const d = errBody as { detail?: { message?: string } | string };
    const msg =
      typeof d.detail === "string"
        ? d.detail
        : d.detail?.message || `ElevenLabs speak failed (${res.status})`;
    throw new Error(msg);
  }

  return Buffer.from(await res.arrayBuffer());
}

/**
 * Speak a line with a locked library voice_id → mp3 buffer.
 * Eleven v3 — supports audio tags: [whispers] [shouts] [laughs] [sighs] etc.
 */
export async function synthesizeSpeech(opts: {
  voiceId: string;
  text: string;
}): Promise<Buffer> {
  const text = opts.text.trim();
  if (!text) throw new Error("Nothing to speak — fill TEXT / spoken words first");
  if (!opts.voiceId.trim()) {
    throw new Error("No locked voice_id — Keep a voice in Character Lab / Scene kit first");
  }
  const voiceId = opts.voiceId.trim();
  const chunks = splitSpeakChunks(text);
  const parts: Buffer[] = [];
  for (const chunk of chunks) {
    parts.push(await synthesizeSpeechChunk(voiceId, chunk));
  }
  return parts.length === 1 ? parts[0]! : Buffer.concat(parts);
}

/** Text → sound effect mp3 (ElevenLabs sound-generation). */
export async function generateSoundEffect(opts: {
  text: string;
  durationSeconds?: number;
  promptInfluence?: number;
}): Promise<Buffer> {
  const text = opts.text.trim();
  if (!text) throw new Error("Write a sound prompt first");

  const body: Record<string, unknown> = {
    text: text.slice(0, 500),
    model_id: "eleven_text_to_sound_v2",
    prompt_influence: opts.promptInfluence ?? 0.45,
  };
  if (
    typeof opts.durationSeconds === "number" &&
    opts.durationSeconds >= 0.5 &&
    opts.durationSeconds <= 30
  ) {
    body.duration_seconds = opts.durationSeconds;
  }

  const res = await fetch(
    "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128",
    {
      method: "POST",
      headers: {
        "xi-api-key": key(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const d = errBody as { detail?: { message?: string } | string };
    const msg =
      typeof d.detail === "string"
        ? d.detail
        : d.detail?.message || `ElevenLabs SFX failed (${res.status})`;
    throw new Error(msg);
  }

  return Buffer.from(await res.arrayBuffer());
}
