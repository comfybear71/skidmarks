import fs from "fs";
import path from "path";
import {
  findCrashVoiceByName,
  refreshCrashVoiceId,
} from "./crashVoice";
import { readCrashStory, writeCrashStory } from "./crashStory";
import type { CrashStoryDoc } from "./crashStoryTypes";
import { dialogueFileName } from "./crashStoryNames";
import {
  storyDialogueDir,
} from "./crashStoryLocations";
import { CRASH_DIR } from "./paths";
import { elevenKeyPresent, synthesizeSpeech } from "./elevenLabs";
import { sanitizeDialogueForSpeech } from "./sanitizeDialogue";
import type { ShowStyleId } from "./showStylePresets";
import { assignReusedVoice } from "./mobileVoiceReuse";

/** ElevenLabs stock Adam — one-shot unblock only. Never write onto cast. */
const STOCK_FALLBACK_VOICE_ID = "pNInz6obpgDQGcFmaJgB";

function voiceNotFoundError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("was not found") || m.includes("voice_id_does_not_exist");
}

/** Legacy flat folder — old beats still here */
function legacyAudioDir(styleId: ShowStyleId): string {
  return path.join(CRASH_DIR, "story", styleId, "audio");
}

export function findBeatInStory(
  doc: CrashStoryDoc,
  beatId: string,
): {
  shotNum: number;
  beatNum: number;
  speaker: string;
  text: string;
} | null {
  let shotNum = 0;
  for (const sc of doc.scenes) {
    for (const sh of sc.shots) {
      shotNum += 1;
      const beatNum = sh.beats.findIndex((b) => b.id === beatId);
      if (beatNum >= 0) {
        const beat = sh.beats[beatNum]!;
        return {
          shotNum,
          beatNum: beatNum + 1,
          speaker: beat.speaker,
          text: beat.text,
        };
      }
    }
  }
  return null;
}

/** Resolve mp3 on disk — dialogue/ first, then legacy audio/. */
export function resolveBeatAudioPath(
  styleId: ShowStyleId,
  beatId: string,
  voiceFile?: string,
): string | null {
  if (!beatId || beatId.includes("..")) return null;
  const dirs = [storyDialogueDir(styleId), legacyAudioDir(styleId)];
  const names = [
    voiceFile?.trim(),
    voiceFile?.trim() ? undefined : `${beatId}.mp3`,
  ].filter(Boolean) as string[];

  for (const dir of dirs) {
    for (const name of names) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/** @deprecated use resolveBeatAudioPath */
export function storyAudioPath(
  styleId: ShowStyleId,
  beatId: string,
): string | null {
  return resolveBeatAudioPath(styleId, beatId);
}

/** Link beats to mp3 files on disk (dialogue/ or legacy audio/). */
export function syncStoryVoiceFilesFromDisk(
  doc: CrashStoryDoc,
): CrashStoryDoc {
  let changed = false;
  const scenes = doc.scenes.map((sc) => ({
    ...sc,
    shots: sc.shots.map((sh) => ({
      ...sh,
      beats: sh.beats.map((b) => {
        if (b.voiceFile) {
          const hit = resolveBeatAudioPath(doc.styleId, b.id, b.voiceFile);
          if (hit) return b;
        }
        const ctx = findBeatInStory(doc, b.id);
        const guess = ctx
          ? dialogueFileName({
              shotNum: ctx.shotNum,
              beatNum: ctx.beatNum,
              speaker: ctx.speaker,
              text: ctx.text,
            })
          : `${b.id}.mp3`;
        const onDisk = resolveBeatAudioPath(doc.styleId, b.id, guess);
        if (!onDisk) return b;
        changed = true;
        return { ...b, voiceFile: path.basename(onDisk) };
      }),
    })),
  }));
  return changed ? { ...doc, scenes } : doc;
}

function patchBeatVoiceFile(
  doc: CrashStoryDoc,
  beatId: string,
  voiceFile: string,
  text?: string,
  speaker?: string,
): CrashStoryDoc {
  const scenes = doc.scenes.map((sc) => ({
    ...sc,
    shots: sc.shots.map((sh) => ({
      ...sh,
      beats: sh.beats.map((b) =>
        b.id === beatId
          ? {
              ...b,
              voiceFile,
              ...(text !== undefined ? { text } : {}),
              ...(speaker !== undefined && speaker.trim()
                ? { speaker: speaker.trim() }
                : {}),
            }
          : b,
      ),
    })),
  }));
  return { ...doc, scenes };
}

export async function synthesizeStoryBeat(opts: {
  styleId: ShowStyleId;
  beatId: string;
  speaker: string;
  text: string;
}): Promise<{ voiceFile: string; story: CrashStoryDoc }> {
  if (!elevenKeyPresent()) {
    throw new Error(
      "Missing ELEVENLABS_API_KEY in MY MOVIES\\.env — restart Studio after adding.",
    );
  }

  const text = sanitizeDialogueForSpeech(opts.text.trim());
  if (!text) throw new Error("Write a line first");

  let slot = findCrashVoiceByName(opts.styleId, opts.speaker);
  if (!slot?.approvedVoiceId?.trim()) {
    // Vercel /tmp has no voice manifest. Reuse an ElevenLabs library voice
    // already on the account — do not design a new one, do not lock Adam.
    await assignReusedVoice(opts.styleId, opts.speaker);
    slot = findCrashVoiceByName(opts.styleId, opts.speaker);
  }
  if (!slot) {
    throw new Error(
      `No voice for ${opts.speaker} — add them in Characters for this show`,
    );
  }

  const attempt = slot.approvedAttemptId
    ? slot.attempts.find((a) => a.id === slot.approvedAttemptId)
    : undefined;

  // Prefer locked id; if Adam was wrongly saved, try the attempt's real id first.
  let voiceId = slot.approvedVoiceId?.trim() || "";
  if (!voiceId || voiceId === STOCK_FALLBACK_VOICE_ID) {
    const fromAttempt =
      attempt?.voiceId?.trim() || attempt?.generatedVoiceId?.trim() || "";
    if (fromAttempt && fromAttempt !== STOCK_FALLBACK_VOICE_ID) {
      voiceId = fromAttempt;
    }
  }
  if (!voiceId) {
    // Design a fresh real voice — do not lock Adam onto the cast.
    voiceId = await refreshCrashVoiceId(opts.styleId, slot.castName);
  }

  let story = readCrashStory(opts.styleId);
  const ctx = findBeatInStory(story, opts.beatId);
  const speakerForName = opts.speaker.trim() || ctx?.speaker || "Speaker";
  const baseName = ctx
    ? dialogueFileName({
        shotNum: ctx.shotNum,
        beatNum: ctx.beatNum,
        speaker: speakerForName,
        text: opts.text,
      })
    : `${opts.beatId}.mp3`;
  // Unique take each Gen — never overwrite old mp3; busts browser cache.
  const stamp = Date.now().toString(36);
  const fileName = baseName.replace(/\.mp3$/i, "") + `_${stamp}.mp3`;

  let buf: Buffer;
  try {
    buf = await synthesizeSpeech({ voiceId, text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!voiceNotFoundError(msg)) throw e;

    // Dead id — refresh a real cast voice. Adam is last-resort audio only (never saved).
    try {
      voiceId = await refreshCrashVoiceId(opts.styleId, slot.castName);
      buf = await synthesizeSpeech({ voiceId, text });
    } catch (refreshErr) {
      const refreshMsg =
        refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
      if (voiceId === STOCK_FALLBACK_VOICE_ID) throw refreshErr;
      console.warn(
        `[story-speak] refresh failed for ${opts.speaker}: ${refreshMsg} — one-shot Adam (not saved)`,
      );
      buf = await synthesizeSpeech({
        voiceId: STOCK_FALLBACK_VOICE_ID,
        text,
      });
    }
  }

  const dir = storyDialogueDir(opts.styleId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), buf);

  story = patchBeatVoiceFile(
    story,
    opts.beatId,
    fileName,
    opts.text,
    opts.speaker,
  );
  writeCrashStory(story);

  return { voiceFile: fileName, story };
}
