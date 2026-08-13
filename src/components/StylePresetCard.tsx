"use client";

import type { ShowStylePreset, ShowStyleId } from "@/lib/showStylePresets";
import { styleFaceSummaryLine } from "@/lib/styleCharacterRoster";

type Props = {
  preset: ShowStylePreset;
  selected: boolean;
  expanded: boolean;
  thumbKeys?: string[];
  thumbVersion?: number;
  onSelect: (id: ShowStyleId) => void;
  onToggleExpand: (id: ShowStyleId) => void;
};

export function StylePresetCard({
  preset,
  selected,
  expanded,
  thumbKeys = [],
  thumbVersion = 0,
  onSelect,
  onToggleExpand,
}: Props) {
  const castLabel =
    preset.characterMode === "arsehole" ? "Preset character" : "Preset cast";
  const faceLine = styleFaceSummaryLine(preset.id);

  function select() {
    onSelect(preset.id);
  }

  return (
    <article
      role="button"
      tabIndex={0}
      // pointerdown so selection lands even if a re-render eats the click
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest("[data-details]")) return;
        select();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select();
        }
      }}
      title={
        selected
          ? `${preset.label} — opens Characters`
          : `Select ${preset.label}`
      }
      className={`flex min-h-[5.5rem] cursor-pointer flex-col rounded-sm border p-2.5 transition-colors ${
        selected
          ? "border-[var(--magenta-hot)] bg-[var(--panel-2)] shadow-[0_0_0_1px_var(--magenta-hot)]"
          : "border-[var(--line)] bg-[var(--panel)] hover:border-[var(--chrome-dim)]"
      }`}
    >
      {thumbKeys.length > 0 ? (
        <div className="crash-tray-scroll mb-1.5 flex gap-1 overflow-x-auto pb-0.5">
          {thumbKeys.map((key) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={key}
              src={`/api/crash/style-cards/file?styleId=${encodeURIComponent(preset.id)}&thumb=${encodeURIComponent(key)}&v=${thumbVersion}`}
              alt=""
              draggable={false}
              className="pointer-events-none h-14 w-[4.5rem] shrink-0 rounded-sm object-cover object-top"
            />
          ))}
        </div>
      ) : null}
      <p className="display text-[11px] leading-tight text-[var(--chrome)]">
        {preset.label}
      </p>
      <p className="mt-1 line-clamp-2 text-[8px] leading-snug text-[var(--mute)]">
        {preset.tagline}
      </p>
      {faceLine ? (
        <p className="mt-1 line-clamp-2 text-[8px] text-[var(--acid-deep)]">
          {faceLine}
        </p>
      ) : null}

      <button
        type="button"
        data-details
        aria-expanded={expanded}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand(preset.id);
        }}
        className="mt-auto flex w-full items-center justify-between gap-1 pt-2 text-[8px] uppercase tracking-wider text-[var(--acid-deep)]"
      >
        <span>{expanded ? "Hide" : "Details"}</span>
        <span className="text-[10px] leading-none text-[var(--chrome-dim)]">
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded ? (
        <div
          className="mt-2 space-y-2 border-t border-[var(--line)] pt-2"
          data-details
          onPointerDown={(e) => e.stopPropagation()}
        >
          <p className="text-[9px] leading-relaxed text-[var(--chrome-dim)]">
            {preset.description}
          </p>
          <div>
            <p className="mb-1 text-[8px] uppercase tracking-wider text-[var(--mute)]">
              {castLabel}
            </p>
            <ul className="space-y-1">
              {preset.presetCast.map((c) => (
                <li
                  key={c.id}
                  className="rounded-sm border border-[var(--line)] bg-[var(--panel)] px-1.5 py-1"
                >
                  <span className="text-[9px] font-medium text-[var(--magenta-hot)]">
                    {c.name}
                  </span>
                  <p className="text-[8px] leading-snug text-[var(--mute)]">
                    {c.rule}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </article>
  );
}
