/**
 * Sunny Banks episode order.
 *
 * The shared paste parser folds every shot at the same Place into one scene,
 * so a script that leaves a place and comes back plays 1, 2, 4, 3. Everything
 * downstream walks scene -> shot (orderedJobClips, the direction PDF, the
 * Storyboard strip), so the delivered mp4s and the zip numbers come out in
 * place order instead of script order. On a cartoon the shot order IS the
 * episode.
 *
 * Put the paste order back and split a revisited place into its own scene,
 * so every scene -> shot walk is already in script order and each scene keeps
 * its own id (a duplicate scene id breaks the animate lookup).
 *
 * Sunny only — the shared parser is not touched.
 */
import type {
  CrashStoryDoc,
  CrashStoryScene,
  CrashStoryShot,
} from "./crashStoryTypes";
import { placeKey } from "./sunnyEpisodeSpec";
import { newId } from "./types";

/** The Place: of every --- SHOT --- block, in the order they were pasted. */
export function sunnyScriptPlaceOrder(script: string): string[] {
  return String(script || "")
    .split(/(?:^|\n)---\s*SHOT(?:\s+\d+[A-Za-z]*)?\s*---\s*/im)
    .slice(1)
    .map((block) => block.match(/^Place:\s*(.+)$/im)?.[1]?.trim() || "")
    .filter(Boolean);
}

/** Shots as the story holds them now, place by place, in parse order. */
function shotQueues(story: CrashStoryDoc): {
  queues: Map<string, CrashStoryShot[]>;
  labels: Map<string, string>;
} {
  const queues = new Map<string, CrashStoryShot[]>();
  const labels = new Map<string, string>();
  for (const scene of story.scenes) {
    const key = placeKey(scene.placeName);
    if (!labels.has(key)) labels.set(key, scene.placeName);
    queues.set(key, [...(queues.get(key) || []), ...scene.shots]);
  }
  return { queues, labels };
}

/**
 * Re-lay the story in the order the shots were pasted. Within one place the
 * parser already keeps script order, so walking the script's Place: lines and
 * pulling the next shot off that place's queue restores the whole episode
 * without having to match titles (which repeat).
 */
export function orderSunnyStoryByScript(
  story: CrashStoryDoc,
  script: string,
): CrashStoryDoc {
  if (!story.scenes.length) return story;
  const { queues, labels } = shotQueues(story);

  const ordered: { place: string; shot: CrashStoryShot }[] = [];
  for (const wanted of sunnyScriptPlaceOrder(script)) {
    const key = placeKey(wanted);
    const shot = queues.get(key)?.shift();
    if (shot) ordered.push({ place: labels.get(key) || wanted, shot });
  }
  // A block the parser folded somewhere we could not follow still ships —
  // at the end, in the order it was grouped. Never drop a shot.
  for (const [key, left] of queues) {
    for (const shot of left) ordered.push({ place: labels.get(key) || "", shot });
  }
  if (!ordered.length) return story;

  const scenes: CrashStoryScene[] = [];
  for (const { place, shot } of ordered) {
    const open = scenes.at(-1);
    if (open && placeKey(open.placeName) === placeKey(place)) {
      open.shots.push(shot);
      continue;
    }
    scenes.push({
      id: newId("scene"),
      title: place,
      placeName: place,
      worldThumbKey: "",
      shots: [shot],
    });
  }
  return { ...story, scenes };
}
