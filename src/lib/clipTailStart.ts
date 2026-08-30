import { clipFileBasename } from "./mobilePlateClips";
import { hangPlateShotId } from "./musicVideoTrack";

export type ClipTailClip = {
  shotId?: string;
  clipFile?: string;
  clipStatus?: string;
};

/** Stable plate name for a clip's last frame. Same clip → same file. */
export function clipTailPlateFileName(clipFile: string): string {
  const file = clipFileBasename(clipFile);
  const stem = file.replace(/\.[^.]+$/, "");
  return stem ? `tail_${stem}.jpg` : "";
}

export function stillIdForClipTail(shotId: string): string {
  const raw = (shotId || "").trim();
  return hangPlateShotId(raw) || raw;
}

/** Latest done mp4 on this still — clip 1 when only one exists. */
export function previousDoneClipOnStill<T extends ClipTailClip>(
  clips: T[] | undefined,
  shotId: string,
): T | null {
  const still = stillIdForClipTail(shotId);
  if (!still) return null;
  const done = (clips || []).filter((c) => {
    if ((c.clipStatus || "") !== "done") return false;
    if (!clipFileBasename(c.clipFile || "")) return false;
    const id = (c.shotId || "").trim();
    return id === still || hangPlateShotId(id) === still;
  });
  return done[done.length - 1] || null;
}

/** New take on a still that already has a clip — chain from that last frame. */
export function shouldChainClipTail(opts: {
  shotId: string;
  clips?: ClipTailClip[];
}): boolean {
  return Boolean(previousDoneClipOnStill(opts.clips, opts.shotId));
}

export function clipTailPlateLabel(index = 1): string {
  return `Last frame · clip ${Math.max(1, Math.floor(Number(index) || 1))}`;
}
