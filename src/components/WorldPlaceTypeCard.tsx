"use client";

import type { ShowStylePreset } from "@/lib/showStylePresets";
import { writePlateDrag } from "@/lib/crashPlateDrag";
import type { WorldPlaceType } from "@/lib/worldPlaceTypes";
import type { WorldThumbRow } from "@/components/StyleWorldPanel";

type Props = {
  preset: ShowStylePreset;
  placeType: WorldPlaceType;
  thumbs: WorldThumbRow[];
  worldThumbVersion: number;
  selected: boolean;
  selectedWorldKey: string;
  onSelect: () => void;
  onPickThumb: (entry: WorldThumbRow) => void;
};

export function WorldPlaceTypeCard({
  preset,
  placeType,
  thumbs,
  worldThumbVersion,
  selected,
  selectedWorldKey,
  onSelect,
  onPickThumb,
}: Props) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      title={selected ? `${placeType.name} — developing here` : `Pick ${placeType.name}`}
      className={`flex min-h-[5.5rem] cursor-pointer flex-col rounded-sm border p-2.5 transition-colors ${
        selected
          ? "border-[var(--magenta-hot)] bg-[var(--panel-2)] shadow-[0_0_0_1px_var(--magenta-hot)]"
          : "border-[var(--line)] bg-[var(--panel)] hover:border-[var(--chrome-dim)]"
      }`}
    >
      {thumbs.length > 0 ? (
        <div
          className="crash-tray-scroll mb-1.5 flex gap-1 overflow-x-auto pb-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {thumbs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onPickThumb(t)}
              className="shrink-0"
              title={t.name || "Place"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                draggable
                src={`/api/crash/world-cards/file?styleId=${encodeURIComponent(preset.id)}&thumb=${encodeURIComponent(t.key)}&v=${worldThumbVersion}`}
                alt=""
                className={`h-14 w-[4.5rem] cursor-grab rounded-sm object-cover active:cursor-grabbing ${
                  selectedWorldKey === t.key
                    ? "border-2 border-[var(--acid)]"
                    : "border border-[var(--line)]"
                }`}
                onDragStart={(e) => {
                  e.stopPropagation();
                  writePlateDrag(e, {
                    kind: "world",
                    styleId: preset.id,
                    thumbKey: t.key,
                    name: t.name,
                  });
                }}
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-1.5 flex h-14 items-center justify-center rounded-sm border border-dashed border-[var(--line)] bg-[var(--panel-2)]/50">
          <span className="text-[8px] text-[var(--mute)]">No plates yet</span>
        </div>
      )}
      <p className="display text-[11px] leading-tight text-[var(--chrome)]">
        {placeType.name}
      </p>
      <p className="mt-1 line-clamp-2 text-[8px] leading-snug text-[var(--mute)]">
        {placeType.brief}
      </p>
      {thumbs.length > 0 ? (
        <p className="mt-1 text-[8px] text-[var(--acid-deep)]">
          {thumbs.length} saved
        </p>
      ) : null}
    </article>
  );
}
