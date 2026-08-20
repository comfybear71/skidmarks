"use client";

import { Btn } from "@/components/ui";
import { WorldPlaceTypeCard } from "@/components/WorldPlaceTypeCard";
import type { ShowStylePreset } from "@/lib/showStylePresets";
import {
  WORLD_PLACE_TYPES,
  type WorldPlaceTypeId,
} from "@/lib/worldPlaceTypes";

export type WorldThumbRow = {
  key: string;
  name?: string;
  brief?: string;
  placeType?: WorldPlaceTypeId;
};

export type EpisodeCastRow = {
  key: string;
  name?: string;
};

type Props = {
  preset: ShowStylePreset;
  episodeCast: EpisodeCastRow[];
  thumbVersion: number;
  worldThumbs: WorldThumbRow[];
  worldThumbVersion: number;
  activePlaceType: WorldPlaceTypeId;
  selectedWorldKey: string;
  locationNotes: string;
  onPickPlaceType: (id: WorldPlaceTypeId) => void;
  onPickWorldThumb: (entry: WorldThumbRow) => void;
  onLocationNotesChange: (value: string) => void;
  onSpinIdea: () => void;
  onGeneratePlace: () => void;
};

export function StyleWorldPanel({
  preset,
  episodeCast,
  thumbVersion,
  worldThumbs,
  worldThumbVersion,
  activePlaceType,
  selectedWorldKey,
  locationNotes,
  onPickPlaceType,
  onPickWorldThumb,
  onLocationNotesChange,
  onSpinIdea,
  onGeneratePlace,
}: Props) {
  const activeType = WORLD_PLACE_TYPES.find((t) => t.id === activePlaceType);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {episodeCast.length > 0 ? (
        <div className="shrink-0 rounded-sm border border-[var(--magenta-hot)]/40 bg-[var(--panel-2)] p-1.5">
          <p className="mb-1 text-[8px] uppercase tracking-wider text-[var(--magenta-hot)]">
            Episode cast
          </p>
          <div className="crash-tray-scroll flex gap-1 overflow-x-auto pb-0.5">
            {episodeCast.map((c) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={c.key}
                src={`/api/crash/style-cards/file?styleId=${encodeURIComponent(preset.id)}&thumb=${encodeURIComponent(c.key)}&v=${thumbVersion}`}
                alt={c.name || ""}
                title={c.name || ""}
                className="h-14 w-[4.5rem] shrink-0 rounded-sm border border-[var(--line)] object-cover object-top"
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="shrink-0">
        <p className="text-[9px] uppercase tracking-wider text-[var(--mute)]">
          World gallery — {preset.label}
        </p>
        <p className="mt-0.5 text-[9px] text-[var(--chrome-dim)]">
          Pick a place type, spin an Idea, Generate — same hunt as Style faces.
          Drag a saved thumb onto /m Locations (or use the World strip there).
        </p>
      </div>

      <div className="crash-tray-scroll min-h-0 flex-1 overflow-y-auto pr-0.5">
        <div className="grid grid-cols-3 gap-3">
          {WORLD_PLACE_TYPES.map((type) => (
            <WorldPlaceTypeCard
              key={type.id}
              preset={preset}
              placeType={type}
              thumbs={worldThumbs.filter(
                (t) => (t.placeType || "social_public") === type.id,
              )}
              worldThumbVersion={worldThumbVersion}
              selected={type.id === activePlaceType}
              selectedWorldKey={selectedWorldKey}
              onSelect={() => onPickPlaceType(type.id)}
              onPickThumb={onPickWorldThumb}
            />
          ))}
        </div>
      </div>

      <div className="shrink-0 space-y-1 border-t border-[var(--line)] pt-1.5">
        <p className="text-[8px] uppercase tracking-wider text-[var(--mute)]">
          Develop location — {activeType?.name ?? "place"}
        </p>
        <div className="overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--panel-2)]">
          <textarea
            rows={2}
            value={locationNotes}
            onChange={(e) => onLocationNotesChange(e.target.value)}
            placeholder={`${preset.label} empty place — hit Idea for another…`}
            className="block w-full resize-none border-0 bg-transparent px-2 py-1 text-[11px] text-[var(--chrome)] outline-none focus:ring-0"
          />
          <div className="flex items-center justify-end gap-1.5 border-t border-[var(--line)] px-2 py-1">
            <button
              type="button"
              onClick={onSpinIdea}
              className="flex items-center gap-0.5 rounded-sm border border-[var(--acid)] bg-[var(--panel)] px-1.5 py-0.5 text-[9px] text-[var(--acid)] hover:bg-[var(--acid)]/10"
            >
              Idea
            </button>
            <Btn
              tone="magenta"
              className="!px-2 !py-0.5 !text-[9px]"
              disabled={!locationNotes.trim()}
              onClick={onGeneratePlace}
            >
              Generate
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
