import type { CrashStoryDoc, CrashStoryShot } from "./crashStoryTypes";
import { leftoverHydrateBeat } from "./mobilePlateLines";
import type { MobileClipUnit, MobileGenJob } from "./mobileGenJob";
import { isMobileSavedVoiceFile, isLeftoverPackVoiceFile } from "./mobileSavedVoice";
import { voiceNamesMatch } from "./voiceNameMatch";

export function findBeatHome(story: CrashStoryDoc, beatId: string): {
  sceneId: string;
  shotId: string;
  speaker: string;
  text: string;
  voiceFile: string;
} | null {
  for (const sc of story.scenes) {
    for (const sh of sc.shots) {
      const beat = sh.beats.find((b) => b.id === beatId);
      if (!beat) continue;
      return {
        sceneId: sc.id,
        shotId: sh.id,
        speaker: beat.speaker,
        text: beat.text,
        voiceFile: beat.voiceFile || "",
      };
    }
  }
  return null;
}

function speakerOnJob(speakers: string[], name: string): boolean {
  const who = name.trim();
  if (!who) return false;
  if (!speakers.length) return false;
  return speakers.some(
    (s) =>
      voiceNamesMatch(s, who) || s.trim().toLowerCase() === who.toLowerCase(),
  );
}

type QueueableBeat = {
  beatId: string;
  shotId: string;
  sceneId: string;
  speaker: string;
  line: string;
  voiceFile: string;
};

/**
 * Beats Generate video should send to LTX — this job's plated shots and
 * CAST, not leftover Matty/BC/Land screenplay still sitting in Neon.
 */
export function queueableStoryBeats(
  story: CrashStoryDoc,
  job: Pick<MobileGenJob, "shots" | "speakers">,
): QueueableBeat[] {
  const shotIds = new Set(job.shots.map((s) => s.shotId));
  const out: QueueableBeat[] = [];
  for (const sc of story.scenes) {
    for (const sh of sc.shots) {
      if (!shotIds.has(sh.id)) continue;
      for (const b of sh.beats) {
        if (!b.speaker.trim()) continue;
        if (leftoverHydrateBeat(sh.id, b.id)) continue;
        if (!speakerOnJob(job.speakers, b.speaker)) continue;
        const voiceFile = b.voiceFile || "";
        if (isLeftoverPackVoiceFile(voiceFile)) continue;
        if (!isMobileSavedVoiceFile(voiceFile)) continue;
        out.push({
          beatId: b.id,
          shotId: sh.id,
          sceneId: sc.id,
          speaker: b.speaker,
          line: b.text,
          voiceFile,
        });
      }
    }
  }
  return out;
}

/** Clear all — every story shot, not only the ones on the job strip.
 * Leftover screenplay shots were surviving refresh/Clear and then
 * Generate video queued them. */
export function clearAllStoryShots(story: CrashStoryDoc): {
  story: CrashStoryDoc;
  removed: { sceneId: string; shot: CrashStoryShot }[];
} {
  const removed: { sceneId: string; shot: CrashStoryShot }[] = [];
  for (const sc of story.scenes) {
    for (const sh of sc.shots) removed.push({ sceneId: sc.id, shot: sh });
  }
  return {
    removed,
    story: {
      ...story,
      scenes: story.scenes.map((sc) => ({ ...sc, shots: [] })),
    },
  };
}

/**
 * Keep existing clip status when the beat is already queued. Add missing
 * beats (Save-after-lock). Re-Save of a line puts that clip back on pending
 * so Generate video actually runs LTX against the new mp3.
 */
export function mergeClipsFromStory(
  job: MobileGenJob,
  story: CrashStoryDoc,
  opts?: { requeueSaved?: boolean },
): MobileClipUnit[] {
  const wanted = queueableStoryBeats(story, job);
  const byId = new Map(job.clips.map((c) => [c.beatId, c]));
  const next: MobileClipUnit[] = [];
  for (const row of wanted) {
    const prev = byId.get(row.beatId);
    if (!prev) {
      next.push({
        beatId: row.beatId,
        shotId: row.shotId,
        sceneId: row.sceneId,
        clipFile: "",
        clipStatus: "pending",
        error: "",
        speaker: row.speaker,
        line: row.line,
        voiceFile: row.voiceFile,
      });
      continue;
    }
    const requeue = Boolean(opts?.requeueSaved && row.voiceFile);
    next.push({
      ...prev,
      shotId: row.shotId,
      sceneId: row.sceneId,
      speaker: row.speaker,
      line: row.line,
      voiceFile: row.voiceFile,
      ...(requeue && prev.clipStatus !== "pending"
        ? { clipStatus: "pending" as const, error: "" }
        : {}),
    });
  }
  return next;
}

/** After Save on a line — queue that beat for LTX (or re-queue if it already ran). */
export function upsertPendingClip(
  job: MobileGenJob,
  story: CrashStoryDoc,
  beatId: string,
): MobileClipUnit[] {
  const clips = mergeClipsFromStory(job, story);
  const home = findBeatHome(story, beatId);
  if (!home) return clips;
  return clips.map((c) =>
    c.beatId === beatId
      ? {
          ...c,
          clipStatus: "pending",
          error: "",
          speaker: home.speaker,
          line: home.text,
          voiceFile: home.voiceFile,
        }
      : c,
  );
}

export function queuedSavedClips(clips: MobileClipUnit[]): MobileClipUnit[] {
  return clips.filter((c) => isMobileSavedVoiceFile(c.voiceFile));
}

export function clipQueueError(clips: MobileClipUnit[]): string {
  const failed = clips.filter((c) => c.clipStatus === "error" && c.error.trim());
  if (!failed.length) return "";
  const first = failed[0].error.trim();
  return failed.length === 1
    ? first
    : `${first} (+${failed.length - 1} more)`;
}
