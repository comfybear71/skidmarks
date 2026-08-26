/**
 * Extra / SFX / look-only Sunny shots still need an mp3 so LTX can hold
 * the still. Not a spoken line. Not the song mix.
 */
import fs from "fs";
import path from "path";
import { storyDialogueDir } from "./crashStoryLocations";
import type { CrashStoryBeat, CrashStoryDoc } from "./crashStoryTypes";
import { leftoverHydrateBeat } from "./mobilePlateLines";
import { uploadMobileMedia } from "./mobileMediaStore";
import { writeSilentMp3 } from "./silentAudio";
import { isSunnyExtraName } from "./sunnyEpisodeSpec";
import { newId } from "./types";
import type { MobileGenJob } from "./mobileGenJob";
import { SUNNY_HOLD_SEC, sunnyShotNeedsHold } from "./sunnyHoldBeat";

export { isSunnyHoldBeat, sunnyShotHasSeriesLine, sunnyShotNeedsHold, SUNNY_HOLD_SEC } from "./sunnyHoldBeat";

function holdVoiceName(beatId: string): string {
  return `${beatId}.mp3`;
}

export async function ensureSunnyHoldAudio(
  job: Pick<MobileGenJob, "styleId" | "folderName">,
  story: CrashStoryDoc,
): Promise<{ story: CrashStoryDoc; wrote: number }> {
  if (!job.folderName) return { story, wrote: 0 };
  const dir = storyDialogueDir(job.styleId);
  fs.mkdirSync(dir, { recursive: true });
  let wrote = 0;
  const scenes = [];
  for (const scene of story.scenes) {
    const shots = [];
    for (const shot of scene.shots) {
      if (!sunnyShotNeedsHold(shot)) {
        shots.push(shot);
        continue;
      }
      let beats = [...(shot.beats || [])];
      if (!beats.length) {
        const id = newId("beat");
        beats = [{ id, speaker: "", text: "", voiceFile: holdVoiceName(id), kind: "hold" }];
      }
      const nextBeats: CrashStoryBeat[] = [];
      for (const beat of beats) {
        if (leftoverHydrateBeat(shot.id, beat.id)) {
          nextBeats.push(beat);
          continue;
        }
        const speaker = (beat.speaker || "").trim();
        const extraOrEmpty = !speaker || isSunnyExtraName(speaker);
        if (!extraOrEmpty && (beat.text || "").trim()) {
          nextBeats.push(beat);
          continue;
        }
        const voiceFile = (beat.voiceFile || "").trim() || holdVoiceName(beat.id);
        const dest = path.join(dir, voiceFile);
        const existed = fs.existsSync(dest);
        if (!existed) {
          if (!writeSilentMp3(dest, SUNNY_HOLD_SEC)) {
            nextBeats.push(beat);
            continue;
          }
          try {
            await uploadMobileMedia({
              styleId: job.styleId,
              folderName: job.folderName,
              kind: "audio",
              localPath: dest,
            });
          } catch {
            /* disk still has the hold */
          }
          wrote += 1;
        } else if (!(beat.voiceFile || "").trim() || beat.kind !== "hold") {
          wrote += 1;
        }
        nextBeats.push({ ...beat, voiceFile, kind: "hold" });
      }
      shots.push({ ...shot, beats: nextBeats });
    }
    scenes.push({ ...scene, shots });
  }
  return { story: { ...story, scenes }, wrote };
}
