import type { CrashStoryDoc, CrashStoryShot } from "./crashStoryTypes";
import { leftoverHydrateBeat } from "./mobilePlateLines";
import type { MobileClipUnit, MobileGenJob } from "./mobileGenJob";
import { clipFileBasename, stackedClipFiles } from "./mobilePlateClips";
import { isLeftoverPackVoiceFile, isMobileSavedVoiceFile } from "./mobileSavedVoice";
import { voiceNamesMatch } from "./voiceNameMatch";

type ClipQueueRow = Pick<MobileClipUnit, "beatId" | "shotId" | "clipStatus" | "clipFile">;

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
      line: row.line || prev.line,
      voiceFile: row.voiceFile || prev.voiceFile,
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
    if (prev.clipStatus === "done" || prev.clipStatus === "running" || stackedClipFiles(prev).length > 0) {
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

/**
 * Generate on one plate line — pending that beat only.
 * Does not re-queue every other Saved line (that's Generate video).
 */
export function queueOneBeatForAnimate(
  job: MobileGenJob,
  story: CrashStoryDoc,
  beatId: string,
): { clips: MobileClipUnit[]; error?: string } {
  const id = beatId.trim();
  const home = findBeatHome(story, id);
  if (!home) return { clips: job.clips || [], error: "That line isn't on this pack" };
  const existing = (job.clips || []).find((c) => c.beatId === id);
  const voice =
    (isMobileSavedVoiceFile(home.voiceFile) && home.voiceFile) ||
    (isMobileSavedVoiceFile(existing?.voiceFile) && existing?.voiceFile) ||
    "";
  if (!isMobileSavedVoiceFile(voice)) {
    return {
      clips: job.clips || [],
      error: "Save the spoken line first — Play appears when the mp3 is ready.",
    };
  }
  const clips = upsertPendingClip(job, story, id).map((c) =>
    c.beatId === id
      ? { ...c, voiceFile: voice, clipStatus: "pending" as const, error: "" }
      : c,
  );
  return { clips };
}

export function queuedSavedClips(clips: MobileClipUnit[]): MobileClipUnit[] {
  return clips.filter(
    (c) => Boolean((c.voiceFile || "").trim()) && !isLeftoverPackVoiceFile(c.voiceFile),
  );
}

/** Still waiting on LTX (queued or this worker owns it). */
export function clipNeedsAnimate(clip: Pick<MobileClipUnit, "clipStatus">): boolean {
  return clip.clipStatus === "pending" || clip.clipStatus === "running";
}

function hasPlayableTake(clip: Pick<MobileClipUnit, "clipStatus" | "clipFile">): boolean {
  return clip.clipStatus === "done" && Boolean(clipFileBasename(clip.clipFile));
}

/**
 * Later rant chunks must not start until earlier same-shot clips finish —
 * clip N's last frame is clip N+1's start still. Error does not block:
 * there is no last frame, so the next chunk falls back to the original plate.
 */
export function earlierSameShotIncomplete(
  clips: ClipQueueRow[],
  candidate: Pick<MobileClipUnit, "beatId" | "shotId">,
  skip?: (clip: ClipQueueRow) => boolean,
): boolean {
  const idx = clips.findIndex((c) => c.beatId === candidate.beatId);
  const end = idx < 0 ? clips.length : idx;
  for (let i = 0; i < end; i++) {
    const c = clips[i];
    if (skip?.(c)) continue;
    if (c.shotId !== candidate.shotId) continue;
    if (c.clipStatus === "pending" || c.clipStatus === "running") return true;
  }
  return false;
}

/** First pending clip that is not waiting on an earlier same-shot take. */
export function nextClipToAnimate<T extends ClipQueueRow>(
  clips: T[],
  skip?: (clip: ClipQueueRow) => boolean,
): T | null {
  for (const c of clips) {
    if (c.clipStatus !== "pending") continue;
    if (skip?.(c)) continue;
    if (earlierSameShotIncomplete(clips, c, skip)) continue;
    return c;
  }
  return null;
}

/** Nearest earlier finished take on the same shot — that mp4's last frame seeds this clip. */
export function previousDoneClipOnShot<T extends ClipQueueRow>(
  clips: T[],
  next: Pick<MobileClipUnit, "beatId" | "shotId">,
  skip?: (clip: ClipQueueRow) => boolean,
): T | null {
  const idx = clips.findIndex((c) => c.beatId === next.beatId);
  const start = idx < 0 ? clips.length - 1 : idx - 1;
  for (let i = start; i >= 0; i--) {
    const c = clips[i];
    if (skip?.(c)) continue;
    if (c.shotId !== next.shotId) continue;
    if (hasPlayableTake(c)) return c;
  }
  return null;
}

export function clipQueueError(clips: MobileClipUnit[]): string {
  const failed = clips.filter((c) => c.clipStatus === "error" && c.error.trim());
  if (!failed.length) return "";
  const first = failed[0].error.trim();
  return failed.length === 1
    ? first
    : `${first} (+${failed.length - 1} more)`;
}
