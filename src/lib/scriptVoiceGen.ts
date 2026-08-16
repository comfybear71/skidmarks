import type { ShowStyleId } from "./showStylePresets";
import type { CrashStoryDoc } from "./crashStoryTypes";
import { listCharacters } from "./characters";
import {
  ensureVoiceReadyWithDescription,
  findCrashVoiceByName,
} from "./crashVoice";
import { suggestVoiceDescription } from "./scriptVoiceSuggest";
import { synthesizeStoryBeat } from "./crashStorySpeak";
import { readCrashStory } from "./crashStory";
import { readVoiceQuota } from "./elevenQuota";
import { openCrashLabEpisode, saveCrashLabEpisode } from "./crashLabEpisodes";
import { persistCursorPackToCloud } from "./cursorCloudSync";
import { writeScriptVoiceProgress } from "./scriptVoiceProgress";
import { assignReusedVoice } from "./mobileVoiceReuse";

export type ScriptVoiceGenItemResult = {
  name: string;
  ok: boolean;
  detail: string;
};

export type ScriptVoiceGenResult = {
  folderName: string;
  cast: ScriptVoiceGenItemResult[];
  lines: ScriptVoiceGenItemResult[];
  quotaExceeded: boolean;
};

function uniqueSpeakers(story: CrashStoryDoc): string[] {
  const names = new Set<string>();
  for (const scene of story.scenes) {
    for (const shot of scene.shots) {
      for (const beat of shot.beats) {
        if (beat.speaker.trim()) names.add(beat.speaker.trim());
      }
    }
  }
  return Array.from(names);
}

async function castEpisodeVoices(
  styleId: ShowStyleId,
  story: CrashStoryDoc,
): Promise<{ results: ScriptVoiceGenItemResult[]; quotaExceeded: boolean }> {
  const speakers = uniqueSpeakers(story);
  const byLowerName = new Map(
    listCharacters().map((c) => [c.name.trim().toLowerCase(), c] as const),
  );
  const results: ScriptVoiceGenItemResult[] = [];
  let quotaExceeded = false;

  for (let i = 0; i < speakers.length; i++) {
    const speaker = speakers[i];
    writeScriptVoiceProgress({
      phase: "casting",
      current: i + 1,
      total: speakers.length,
      label: speaker,
    });

    const alreadyCast = Boolean(
      findCrashVoiceByName(styleId, speaker)?.approvedVoiceId,
    );
    if (alreadyCast) {
      results.push({ name: speaker, ok: true, detail: "Already cast" });
      continue;
    }

    // Designing a voice is an ElevenLabs add/edit operation and the monthly
    // allowance is small. Reusing a voice that already exists is not, so try
    // that before spending one — and once the allowance is gone, reuse is the
    // only thing that still works. Silence is worse than a shared voice.
    if (quotaExceeded || readVoiceQuota().remaining <= 0) {
      quotaExceeded = true;
      const reused = await assignReusedVoice(styleId, speaker).catch(() => false);
      results.push(
        reused
          ? { name: speaker, ok: true, detail: "Reused an existing voice — design quota used up" }
          : {
              name: speaker,
              ok: false,
              detail: "Monthly voice-design quota used up — try again next month",
            },
      );
      continue;
    }

    try {
      const character = byLowerName.get(speaker.toLowerCase());
      await ensureVoiceReadyWithDescription(styleId, speaker, () =>
        suggestVoiceDescription({
          name: speaker,
          pastNote: character?.pastNote,
          tormentScratch: character?.tormentScratch,
          lookNote: character?.lookNote,
        }),
      );
      results.push({ name: speaker, ok: true, detail: "Cast" });
    } catch (e) {
      // ElevenLabs reports the allowance mid-run too, not just via our own
      // counter — that counter lives on disk and resets on every Vercel
      // invocation, so it can read "plenty left" when there is none.
      const why = e instanceof Error ? e.message : String(e);
      if (/limit|quota/i.test(why)) {
        quotaExceeded = true;
        const reused = await assignReusedVoice(styleId, speaker).catch(() => false);
        if (reused) {
          results.push({
            name: speaker,
            ok: true,
            detail: "Reused an existing voice — design quota used up",
          });
          continue;
        }
      }
      results.push({ name: speaker, ok: false, detail: why });
    }
  }
  return { results, quotaExceeded };
}

/**
 * Reuse-then-design for exactly one speaker, on demand — the mobile review
 * step's "Save & hear it" runs before the bulk cast pass ever does now
 * (voice is a deliberate step after plates, not automatic), so the first
 * save for anyone new has no slot yet. Same priority castEpisodeVoices'
 * loop uses, just for one name instead of the whole roster.
 */
export async function ensureSpeakerVoiceCast(
  styleId: ShowStyleId,
  speaker: string,
): Promise<boolean> {
  if (findCrashVoiceByName(styleId, speaker)?.approvedVoiceId?.trim()) return true;
  if (await assignReusedVoice(styleId, speaker).catch(() => false)) return true;
  if (readVoiceQuota().remaining <= 0) return false;
  try {
    const character = listCharacters().find(
      (c) => c.name.trim().toLowerCase() === speaker.trim().toLowerCase(),
    );
    await ensureVoiceReadyWithDescription(styleId, speaker, () =>
      suggestVoiceDescription({
        name: speaker,
        pastNote: character?.pastNote,
        tormentScratch: character?.tormentScratch,
        lookNote: character?.lookNote,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

async function generateEpisodeLines(
  styleId: ShowStyleId,
  story: CrashStoryDoc,
): Promise<ScriptVoiceGenItemResult[]> {
  const beats: { beatId: string; speaker: string; text: string }[] = [];
  for (const scene of story.scenes) {
    for (const shot of scene.shots) {
      for (const beat of shot.beats) {
        if (!beat.text.trim() || beat.voiceFile?.trim()) continue;
        beats.push({ beatId: beat.id, speaker: beat.speaker, text: beat.text });
      }
    }
  }

  const results: ScriptVoiceGenItemResult[] = [];
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    writeScriptVoiceProgress({
      phase: "lines",
      current: i + 1,
      total: beats.length,
      label: `${beat.speaker}: ${beat.text.slice(0, 40)}`,
    });
    try {
      // synthesizeStoryBeat re-reads/re-writes the current desk story itself
      // (including its own expired-voice-id retry) — no local story mutation
      // needed here, each call persists immediately.
      await synthesizeStoryBeat({ styleId, ...beat });
      results.push({ name: beat.speaker, ok: true, detail: "Line generated" });
    } catch (e) {
      results.push({
        name: beat.speaker,
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}

/**
 * Batch-fill voices for a script-imported episode: cast every speaker who
 * doesn't have an approved voice yet (LLM-suggested design description,
 * falling back to the static table), then generate mp3s for every dialogue
 * beat without one. Sequential with per-item try/catch, mirroring
 * scriptImageGen.ts's batch shape.
 */
export async function generateEpisodeVoices(
  styleId: ShowStyleId,
  folderName: string,
): Promise<ScriptVoiceGenResult> {
  const opened = openCrashLabEpisode({ folderName, styleId });

  writeScriptVoiceProgress({ phase: "casting", current: 0, total: 1, label: "Starting…" });
  const { results: cast, quotaExceeded } = await castEpisodeVoices(styleId, opened.story);

  const lines = await generateEpisodeLines(styleId, opened.story);

  // synthesizeStoryBeat already persisted the current desk story per beat —
  // re-read fresh rather than reusing opened.story, which has no voiceFile
  // patches applied locally.
  const finalStory = readCrashStory(styleId);
  saveCrashLabEpisode({ styleId, folderName, label: finalStory.campaignLabel });
  await persistCursorPackToCloud({
    styleId,
    folderName,
    story: finalStory,
    sceneKit: opened.sceneKit,
  });

  writeScriptVoiceProgress({
    phase: "done",
    current: cast.length + lines.length,
    total: cast.length + lines.length,
    label: "Done",
  });

  return { folderName, cast, lines, quotaExceeded };
}
