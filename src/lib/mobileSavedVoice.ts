/**
 * Saved mobile takes vs leftover compiled-pack dialogue.
 * Pack leftover: `01_05_CRAZY_BIG_HOLE_JO_Not-that.mp3`
 * Save take:     `01_01_CRAZY_BIG_HOLE_JO_her-line_mjx8k2.mp3`
 * (synthesizeStoryBeat appends `_${Date.now().toString(36)}`).
 */

function takeStamp(fileName: string): string {
  const m = String(fileName || "")
    .trim()
    .match(/_([0-9a-z]{6,12})\.mp3$/i);
  if (!m?.[1] || !/\d/.test(m[1])) return "";
  return m[1];
}

/** Mp3 this job actually Saved — Generate video may queue it. */
export function isMobileSavedVoiceFile(fileName?: string): boolean {
  const n = String(fileName || "").trim();
  if (!n) return false;
  if (takeStamp(n)) return true;
  if (/^beat_.+\.mp3$/i.test(n) && !/^\d{2}_\d{2}_/.test(n)) return true;
  return false;
}

/** Old compiled-episode `NN_NN_SPEAKER_slug.mp3` — park, then burn on open. */
export function isLeftoverPackVoiceFile(fileName?: string): boolean {
  const n = String(fileName || "").trim();
  if (!n || isMobileSavedVoiceFile(n)) return false;
  return /^\d{2}_\d{2}_/.test(n);
}

export function storyHasLeftoverPackAudio(story: {
  scenes?: { shots?: { beats?: { voiceFile?: string }[] }[] }[];
}): boolean {
  for (const sc of story.scenes || []) {
    for (const sh of sc.shots || []) {
      for (const b of sh.beats || []) {
        if (isLeftoverPackVoiceFile(b.voiceFile)) return true;
      }
    }
  }
  return false;
}
