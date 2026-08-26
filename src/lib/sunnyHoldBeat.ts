/**
 * Client-safe hold checks. The writer that makes the silent mp3 stays in
 * sunnyHoldAudio.ts (fs) — do not import that from /m.
 */
import type { CrashStoryBeat, CrashStoryShot } from "./crashStoryTypes";
import { leftoverHydrateBeat } from "./mobilePlateLines";
import { isSunnyExtraName } from "./sunnyEpisodeSpec";

export const SUNNY_HOLD_SEC = 8;

export function isSunnyHoldBeat(
  beat: Pick<CrashStoryBeat, "speaker" | "text" | "voiceFile" | "kind">,
): boolean {
  if (beat.kind === "hold") return true;
  const speaker = (beat.speaker || "").trim();
  const voice = (beat.voiceFile || "").trim();
  if (!speaker && voice) return true;
  if (isSunnyExtraName(speaker) && voice) return true;
  return false;
}

export function sunnyShotHasSeriesLine(shot: CrashStoryShot): boolean {
  return (shot.beats || []).some((beat) => {
    if (leftoverHydrateBeat(shot.id, beat.id)) return false;
    const speaker = (beat.speaker || "").trim();
    if (!speaker || isSunnyExtraName(speaker)) return false;
    return Boolean((beat.text || "").trim());
  });
}

export function sunnyShotNeedsHold(shot: CrashStoryShot): boolean {
  return !sunnyShotHasSeriesLine(shot);
}
