import type { CrashStoryDoc, CrashStoryShot } from "./crashStoryTypes";
import { leftoverHydrateBeat } from "./mobilePlateLines";
import type { MobileClipUnit, MobileGenJob } from "./mobileGenJob";
import { stackedClipFiles } from "./mobilePlateClips";
import { isLeftoverPackVoiceFile } from "./mobileSavedVoice";
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
        if (!voiceFile.trim()) continue;
        if (isLeftoverPackVoiceFile(voiceFile)) continue;
        if (!b.text.trim()) continue;
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
  const seen = new Set<string>();
  for (const row of wanted) {
    seen.add(row.beatId);
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
  for (const prev of job.clips) {
    if (seen.has(prev.beatId)) continue;
    // Finished takes must survive even if the beat fell out of the
    // queueable set (speaker rename, leftover hydrate, etc.). Wiping
    // them made the previous Generate video disappear on the next Save.
    if (prev.clipStatus === "done" || stackedClipFiles(prev).length > 0) {
      next.push(prev);
      continue;
    }
    if (prev.clipStatus !== "pending") continue;
    if (!(prev.voiceFile || "").trim()) continue;
    if (isLeftoverPackVoiceFile(prev.voiceFile)) continue;
    const home = findBeatHome(story, prev.beatId);
    if (!home) continue;
    const voiceFile = isLeftoverPackVoiceFile(home.voiceFile)
      ? prev.voiceFile
      : home.voiceFile || prev.voiceFile;
    if (!(voiceFile || "").trim() || isLeftoverPackVoiceFile(voiceFile)) continue;
    next.push({
      ...prev,
      shotId: home.shotId,
      sceneId: home.sceneId,
      speaker: home.speaker,
      line: home.text.trim() || prev.line,
      voiceFile,
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
  const home = findBeatHome(story, beatId);
  if (!home) return mergeClipsFromStory(job, story);
  const clips = mergeClipsFromStory(job, story);
  if (!clips.some((c) => c.beatId === beatId)) {
    if (!(home.voiceFile || "").trim() || isLeftoverPackVoiceFile(home.voiceFile)) {
      return clips;
    }
    return [
      ...clips,
      {
        beatId,
        shotId: home.shotId,
        sceneId: home.sceneId,
        clipFile: "",
        clipStatus: "pending",
        error: "",
        speaker: home.speaker,
        line: home.text,
        voiceFile: home.voiceFile,
      },
    ];
  }
  return clips.map((c) =>
    c.beatId === beatId
      ? {
          ...c,
          shotId: home.shotId,
          sceneId: home.sceneId,
          speaker: home.speaker,
          line: home.text,
          voiceFile: home.voiceFile,
          clipStatus: "pending" as const,
          error: "",
        }
      : c,
  );
}

export function queuedSavedClips(clips: MobileClipUnit[]): MobileClipUnit[] {
  return clips.filter(
    (c) => Boolean((c.voiceFile || "").trim()) && !isLeftoverPackVoiceFile(c.voiceFile),
  );
}

export function clipQueueError(clips: MobileClipUnit[]): string {
  const failed = clips.filter((c) => c.clipStatus === "error" && c.error.trim());
  if (!failed.length) return "";
  const first = failed[0].error.trim();
  return failed.length === 1
    ? first
    : `${first} (+${failed.length - 1} more)`;
}
