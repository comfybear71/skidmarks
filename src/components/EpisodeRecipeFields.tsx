"use client";

import { useEffect, useState } from "react";
import {
  episodeRecipeLabels,
  estimatedPanelCount,
  readEpisodeRecipe,
  writeEpisodeRecipe,
  type EpisodeRecipe,
} from "@/lib/episodeRecipe";
import type { ShowStyleId } from "@/lib/showStylePresets";

type Props = {
  styleId: ShowStyleId;
};

export function EpisodeRecipeFields({ styleId }: Props) {
  const labels = episodeRecipeLabels(styleId);
  const [recipe, setRecipe] = useState<EpisodeRecipe>(() =>
    readEpisodeRecipe(styleId),
  );

  useEffect(() => {
    setRecipe(readEpisodeRecipe(styleId));
  }, [styleId]);

  function patch(partial: Partial<EpisodeRecipe>) {
    const next = { ...recipe, ...partial };
    setRecipe(next);
    writeEpisodeRecipe(styleId, next);
  }

  const panels = estimatedPanelCount(recipe);

  return (
    <div className="space-y-2 rounded-sm border border-[var(--acid)]/30 bg-[var(--acid)]/5 p-2">
      <p className="text-[9px] font-medium uppercase tracking-wider text-[var(--acid-deep)]">
        Episode shape
      </p>

      <label className="block">
        <span className="text-[8px] uppercase text-[var(--mute)]">
          Target length (minutes)
        </span>
        <input
          type="number"
          min={1}
          max={120}
          value={recipe.targetMinutes}
          onChange={(e) =>
            patch({ targetMinutes: Number(e.target.value) || 1 })
          }
          className="mt-0.5 w-full rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-2 py-1 text-[11px] text-[var(--chrome)]"
        />
        <span className="text-[8px] text-[var(--mute)]">{labels.lengthHint}</span>
      </label>

      <label className="block">
        <span className="text-[8px] uppercase text-[var(--mute)]">
          {labels.sceneLabel}
        </span>
        <input
          type="number"
          min={1}
          max={24}
          value={recipe.sceneCount}
          onChange={(e) => patch({ sceneCount: Number(e.target.value) || 1 })}
          className="mt-0.5 w-full rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-2 py-1 text-[11px] text-[var(--chrome)]"
        />
        <span className="text-[8px] text-[var(--mute)]">{labels.sceneHint}</span>
      </label>

      <label className="block">
        <span className="text-[8px] uppercase text-[var(--mute)]">
          Shots per scene
        </span>
        <input
          type="number"
          min={1}
          max={12}
          value={recipe.shotsPerScene}
          onChange={(e) =>
            patch({ shotsPerScene: Number(e.target.value) || 1 })
          }
          className="mt-0.5 w-full rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-2 py-1 text-[11px] text-[var(--chrome)]"
        />
        <span className="text-[8px] text-[var(--mute)]">{labels.shotHint}</span>
      </label>

      <p className="text-[9px] text-[var(--chrome-dim)]">
        ≈ {panels} storyboard panels (intro + outro + shots). CURSOR test builds
        one gag at a time — raise gags/scenes when you chain a full episode.
      </p>
    </div>
  );
}
