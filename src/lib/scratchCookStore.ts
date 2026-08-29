/**
 * Persist the last Send step on the job. Server only — reads Neon/disk.
 * Formatters stay in scratchCookProgress so /m does not import fs.
 */
import { patchMobileGenJob, readMobileGenJob } from "./mobileGenJob";
import {
  parseScratchCook,
  type ScratchCookEngine,
  type ScratchCookProgress,
  type ScratchCookStep,
} from "./scratchCookProgress";

export async function writeScratchCookProgress(
  jobId: string,
  next: {
    cutId?: string;
    engine: ScratchCookEngine;
    step: ScratchCookStep;
    message?: string;
    mute?: boolean;
    startedAt?: string;
  },
): Promise<void> {
  const id = (jobId || "").trim();
  if (!id) return;
  try {
    const job = await readMobileGenJob(id);
    if (!job) return;
    const prev = parseScratchCook(job.scratchCook);
    const now = new Date().toISOString();
    const sameCut = Boolean(prev && (next.cutId || "") === (prev.cutId || ""));
    if (
      prev &&
      sameCut &&
      prev.step === next.step &&
      next.step !== "error" &&
      next.step !== "done"
    ) {
      return;
    }
    const cook: ScratchCookProgress = {
      engine: next.engine,
      step: next.step,
      startedAt: next.startedAt || (sameCut && prev?.startedAt) || now,
      updatedAt: now,
      ...(next.cutId ? { cutId: next.cutId } : prev?.cutId ? { cutId: prev.cutId } : {}),
      ...(next.message ? { message: next.message } : {}),
      ...((next.mute ?? prev?.mute) ? { mute: true } : {}),
    };
    await patchMobileGenJob(id, { scratchCook: cook });
  } catch {
    /* progress must not break the cook */
  }
}

export async function clearScratchCookProgress(jobId: string): Promise<void> {
  const id = (jobId || "").trim();
  if (!id) return;
  try {
    await patchMobileGenJob(id, { scratchCook: null });
  } catch {
    /* ignore */
  }
}
