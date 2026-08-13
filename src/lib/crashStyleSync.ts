import type { ShowStyleId } from "./showStylePresets";

export const CRASH_SHOW_STYLE_EVENT = "crash-show-style";
export const CRASH_SHOW_STYLE_CLEAR_EVENT = "crash-show-style-clear";
export const CRASH_NEW_STYLE_CHARACTER_EVENT = "crash-new-style-character";
export const CRASH_NEW_STYLE_PLACE_EVENT = "crash-new-style-place";
export const CRASH_STYLE_THUMB_SAVED = "crash-style-thumb-saved";
export const CRASH_WORLD_THUMB_SAVED = "crash-world-thumb-saved";
export const CRASH_SWAP_SAVED = "crash-swap-saved";
export const CRASH_GEN_PLATE_SAVED = "crash-gen-plate-saved";
export const CRASH_PRODUCTION_STEP_EVENT = "crash-production-step";
export const CRASH_SCRIPT_FIELDS_EVENT = "crash-script-fields";
export const CRASH_SPX_SAVED = "crash-spx-saved";
export const CRASH_STORY_SAVED = "crash-story-saved";
export const CRASH_VOICE_SAVED = "crash-voice-saved";

/** Story panel already applied the change — skip its own refetch (keeps focus). */
let skipStoryPanelReloadOnce = false;

export function dispatchStorySaved(opts?: { fromStoryPanel?: boolean }): void {
  if (typeof window === "undefined") return;
  if (opts?.fromStoryPanel) skipStoryPanelReloadOnce = true;
  window.dispatchEvent(new CustomEvent(CRASH_STORY_SAVED));
}

/** Story panel: true = ignore this event (own save/gen). */
export function consumeSkipStoryPanelReload(): boolean {
  if (!skipStoryPanelReloadOnce) return false;
  skipStoryPanelReloadOnce = false;
  return true;
}

export function dispatchVoiceSaved(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CRASH_VOICE_SAVED));
}

export function dispatchProductionStep(step: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("crashlab-production-step", String(step));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(CRASH_PRODUCTION_STEP_EVENT, { detail: step }),
  );
}

export type NewStylePlaceDetail = {
  id: ShowStyleId;
  prompt: string;
  placeType: string;
  /** Load prompt in Image gen and run Generate immediately */
  generate?: boolean;
};

export type NewStyleCharacterDetail = {
  id: ShowStyleId;
  prompt: string;
  usedNames?: string[];
  /** Load prompt in Image gen and run Generate immediately */
  generate?: boolean;
};

const STEP_MS = 65;
const STEPS = 10;

/** Animate VU meter 1→10, then resolve. Calls onStep each tick. */
export function animateStyleSync(
  onStep: (level: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let step = 0;
    onStep(0);

    const tick = () => {
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      step += 1;
      onStep(step);
      if (step >= STEPS) {
        resolve();
        return;
      }
      window.setTimeout(tick, STEP_MS);
    };

    window.setTimeout(tick, STEP_MS);
  });
}

export function parseStyleEventDetail(
  detail: unknown,
): ShowStyleId | null {
  if (typeof detail === "string" && detail) return detail as ShowStyleId;
  if (detail && typeof detail === "object" && "id" in detail) {
    const id = (detail as { id?: string }).id;
    if (id) return id as ShowStyleId;
  }
  return null;
}

export function dispatchShowStylePick(id: ShowStyleId): void {
  window.dispatchEvent(
    new CustomEvent(CRASH_SHOW_STYLE_EVENT, { detail: id }),
  );
}

export function parseNewStyleCharacterDetail(
  detail: unknown,
): NewStyleCharacterDetail | null {
  if (detail && typeof detail === "object" && "id" in detail) {
    const id = (detail as { id?: string }).id;
    const prompt = String((detail as { prompt?: string }).prompt ?? "").trim();
    if (!id || !prompt) return null;
    const usedRaw = (detail as { usedNames?: unknown }).usedNames;
    const usedNames = Array.isArray(usedRaw)
      ? usedRaw.filter((n): n is string => typeof n === "string")
      : [];
    const generate = Boolean((detail as { generate?: boolean }).generate);
    return { id: id as ShowStyleId, prompt, usedNames, generate };
  }
  return null;
}

export function dispatchNewStyleCharacter(
  id: ShowStyleId,
  prompt: string,
  usedNames: string[] = [],
  generate = false,
): void {
  window.dispatchEvent(
    new CustomEvent(CRASH_NEW_STYLE_CHARACTER_EVENT, {
      detail: { id, prompt, usedNames, generate } satisfies NewStyleCharacterDetail,
    }),
  );
}

export function parseNewStylePlaceDetail(
  detail: unknown,
): NewStylePlaceDetail | null {
  if (detail && typeof detail === "object" && "id" in detail) {
    const id = (detail as { id?: string }).id;
    const prompt = String((detail as { prompt?: string }).prompt ?? "").trim();
    const placeType = String((detail as { placeType?: string }).placeType ?? "").trim();
    if (!id || !prompt || !placeType) return null;
    const generate = Boolean((detail as { generate?: boolean }).generate);
    return { id: id as ShowStyleId, prompt, placeType, generate };
  }
  return null;
}

export function dispatchNewStylePlace(
  id: ShowStyleId,
  prompt: string,
  placeType: string,
  generate = false,
): void {
  window.dispatchEvent(
    new CustomEvent(CRASH_NEW_STYLE_PLACE_EVENT, {
      detail: { id, prompt, placeType, generate } satisfies NewStylePlaceDetail,
    }),
  );
}
