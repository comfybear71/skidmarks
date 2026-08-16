import type { CrashStoryDoc } from "./crashStoryTypes";
import { leftoverHydrateBeat } from "./mobilePlateLines";
import type { MobileClipUnit, MobileGenJob } from "./mobileGenJob";

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

/** Beats Generate video should send to LTX — saved lines, not leftover Comfy. */
export function queueableStoryBeats(story: CrashStoryDoc): {
  beatId: string;
  shotId: string;
  sceneId: string;
  speaker: string;
  line: string;
  voiceFile: string;
}[] {
  const out: {
    beatId: string;
    shotId: string;
    sceneId: string;
    speaker: string;
    line: string;
    voiceFile: string;
  }[] = [];
  for (const sc of story.scenes) {
    for (const sh of sc.shots) {
      for (const b of sh.beats) {
        if (!b.speaker.trim()) continue;
        if (leftoverHydrateBeat(sh.id, b.id)) continue;
        if (!b.text.trim() && !(b.voiceFile || "").trim()) continue;
        out.push({
          beatId: b.id,
          shotId: sh.id,
          sceneId: sc.id,
          speaker: b.speaker,
          line: b.text,
          voiceFile: b.voiceFile || "",
        });
      }
    }
  }
  return out;
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
  const wanted = queueableStoryBeats(story);
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
        }
      : c,
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
