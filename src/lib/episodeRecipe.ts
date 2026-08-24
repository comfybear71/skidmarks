import type { ShowStyleId } from "./showStylePresets";
import { getShowStylePreset } from "./showStylePresets";

export type EpisodeRecipe = {
  /** Rough target — Resolve edit guide, not Comfy */
  targetMinutes: number;
  /** Scenes in this episode (Skidmarks) or gag blocks (Sunny Banks) */
  sceneCount: number;
  /** Shots per scene / per gag */
  shotsPerScene: number;
};

const DEFAULTS: Record<ShowStyleId, EpisodeRecipe> = {
  skidmarks: {
    targetMinutes: 22,
    sceneCount: 3,
    shotsPerScene: 4,
  },
  sunny_banks: {
    targetMinutes: 5,
    sceneCount: 1,
    shotsPerScene: 4,
  },
  doc: {
    targetMinutes: 22,
    sceneCount: 4,
    shotsPerScene: 4,
  },
  music_video: {
    targetMinutes: 7,
    sceneCount: 1,
    shotsPerScene: 6,
  },
  deepfake: {
    targetMinutes: 2,
    sceneCount: 1,
    shotsPerScene: 3,
  },
  photoreal: {
    targetMinutes: 22,
    sceneCount: 3,
    shotsPerScene: 5,
  },
};

const STORAGE_PREFIX = "crashlab-episode-recipe-";

export function defaultEpisodeRecipe(styleId: ShowStyleId): EpisodeRecipe {
  return { ...DEFAULTS[styleId] };
}

export function readEpisodeRecipe(styleId: ShowStyleId): EpisodeRecipe {
  const base = defaultEpisodeRecipe(styleId);
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${styleId}`);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<EpisodeRecipe>;
    return {
      targetMinutes: clampNum(parsed.targetMinutes, 1, 120, base.targetMinutes),
      sceneCount: clampNum(parsed.sceneCount, 1, 24, base.sceneCount),
      shotsPerScene: clampNum(parsed.shotsPerScene, 1, 12, base.shotsPerScene),
    };
  } catch {
    return base;
  }
}

export function writeEpisodeRecipe(
  styleId: ShowStyleId,
  recipe: EpisodeRecipe,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${styleId}`, JSON.stringify(recipe));
  } catch {
    /* ignore */
  }
}

function clampNum(
  v: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Plain labels for Script desk — changes per show */
export function episodeRecipeLabels(styleId: ShowStyleId): {
  sceneLabel: string;
  sceneHint: string;
  shotHint: string;
  lengthHint: string;
} {
  const preset = getShowStylePreset(styleId);
  if (styleId === "sunny_banks") {
    return {
      sceneLabel: "Gags in this episode",
      sceneHint: "Each gag = 1 scene · 4 shots · Nan button",
      shotHint: "Shots per gag (usually 4)",
      lengthHint: "Target length in Resolve — short test ~5 min, full ep ~22",
    };
  }
  if (preset?.hasStorySpine) {
    return {
      sceneLabel: "Scenes this episode",
      sceneHint: "Skidmarks spine — often 3 big scenes or up to 9 stages",
      shotHint: "Shots per scene (avg)",
      lengthHint: "Target episode length in Resolve",
    };
  }
  return {
    sceneLabel: "Scenes",
    sceneHint: "How many scenes in this episode",
    shotHint: "Shots per scene",
    lengthHint: "Target length in Resolve",
  };
}

/** Storyboard panel count guide */
export function estimatedPanelCount(recipe: EpisodeRecipe): number {
  return 2 + recipe.sceneCount * recipe.shotsPerScene;
}
