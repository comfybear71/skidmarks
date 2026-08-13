"use client";

import { useRef, useState } from "react";
import { Btn } from "@/components/ui";
import { formatCplateLabel } from "@/lib/cplateLabel";
import { writePlateDrag } from "@/lib/crashPlateDrag";
import type { ShowStylePreset } from "@/lib/showStylePresets";
import type { SwapResultLabel, SwapTargetRef } from "@/lib/swapCards";

export type EpisodeCastRow = { key: string; name?: string; brief?: string };

export type GenPlateRow = { fileName: string; mtime: number; label?: string };

export type SwapEngineInfo = {
  configured: boolean;
  hint: string;
};

type Props = {
  preset: ShowStylePreset;
  episodeCast: EpisodeCastRow[];
  thumbVersion: number;
  selectedWorldKey: string;
  worldThumbVersion: number;
  targetKind: "gen" | "world" | "upload";
  targetGenFile: string;
  targetUploadFile: string;
  genPlates: GenPlateRow[];
  swapResults: Record<string, SwapResultLabel>;
  swapVersion: number;
  engine: SwapEngineInfo;
  swapBusyKey: string;
  onTargetKindChange: (kind: "gen" | "world" | "upload") => void;
  onTargetGenFileChange: (fileName: string) => void;
  onUploadTarget: (file: File) => Promise<void>;
  onRunSwap: (cast: EpisodeCastRow) => void;
  onImportSwap: (cast: EpisodeCastRow, file: File) => void;
  onContinueVoice: () => void;
  onRetirePlate?: (fileName: string) => void;
  swapError?: string;
};

export function StyleSwapPanel({
  preset,
  episodeCast,
  thumbVersion,
  selectedWorldKey,
  worldThumbVersion,
  targetKind,
  targetGenFile,
  targetUploadFile,
  genPlates,
  swapResults,
  swapVersion,
  engine,
  swapBusyKey,
  onTargetKindChange,
  onTargetGenFileChange,
  onUploadTarget,
  onRunSwap,
  onImportSwap,
  onContinueVoice,
  onRetirePlate,
  swapError,
}: Props) {
  const targetInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importCastKey, setImportCastKey] = useState("");
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(null);
  const allSwapped =
    episodeCast.length > 0 &&
    episodeCast.every((c) => Boolean(swapResults[c.key]?.locked));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="shrink-0">
        <p className="display text-sm text-[var(--magenta-hot)]">Deep fake swap</p>
        <p className="mt-0.5 text-[9px] text-[var(--mute)]">
          Plate together is rough AI staging — Run swap puts your real face on.
          Two people? Andrew first, then Margot.
        </p>
        <p
          className={`mt-1 text-[9px] ${engine.configured ? "text-[var(--acid)]" : "text-[var(--chrome-dim)]"}`}
        >
          {engine.hint}
        </p>
      </div>

      <div className="shrink-0 rounded-sm border border-[var(--line)] bg-[var(--panel-2)] p-2">
        <p className="mb-1 text-[8px] uppercase tracking-wider text-[var(--mute)]">
          Target still (face to replace)
        </p>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-1 text-[9px] text-[var(--chrome)]">
            <input
              type="radio"
              checked={targetKind === "gen"}
              onChange={() => onTargetKindChange("gen")}
            />
            Plated composite
          </label>
          <label className="flex items-center gap-1 text-[9px] text-[var(--chrome)]">
            <input
              type="radio"
              checked={targetKind === "world"}
              onChange={() => onTargetKindChange("world")}
            />
            World plate
          </label>
          <label className="flex items-center gap-1 text-[9px] text-[var(--chrome)]">
            <input
              type="radio"
              checked={targetKind === "upload"}
              onChange={() => onTargetKindChange("upload")}
            />
            Upload target
          </label>
        </div>
        {targetKind === "gen" ? (
          <select
            className="mt-1.5 w-full rounded-sm border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-[10px]"
            value={targetGenFile}
            onChange={(e) => onTargetGenFileChange(e.target.value)}
          >
            <option value="">— pick a plate —</option>
            {genPlates.map((p) => (
              <option key={p.fileName} value={p.fileName}>
                {p.label || formatCplateLabel(p.fileName, p.mtime)}
              </option>
            ))}
          </select>
        ) : null}
        {targetKind === "gen" && targetGenFile ? (
          <div className="mt-1.5 flex items-start gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/crash/gen/file?name=${encodeURIComponent(targetGenFile)}`}
              alt=""
              role="button"
              tabIndex={0}
              title="Click for full size"
              onClick={() =>
                setPreview({
                  src: `/api/crash/gen/file?name=${encodeURIComponent(targetGenFile)}`,
                  title: "Plated composite",
                })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setPreview({
                    src: `/api/crash/gen/file?name=${encodeURIComponent(targetGenFile)}`,
                    title: "Plated composite",
                  });
                }
              }}
              className="h-20 w-full max-w-[12rem] cursor-zoom-in rounded-sm border border-[var(--line)] object-cover"
            />
            {onRetirePlate ? (
              <button
                type="button"
                onClick={() => onRetirePlate(targetGenFile)}
                className="shrink-0 text-[9px] text-[var(--fail)] hover:underline"
                title="Hides from this list — file kept in retired folder"
              >
                Remove from list
              </button>
            ) : null}
          </div>
        ) : null}
        {swapError ? (
          <p className="mt-1 text-[10px] text-[var(--magenta-hot)]">{swapError}</p>
        ) : null}
        {targetKind === "world" ? (
          selectedWorldKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/crash/world-cards/file?styleId=${encodeURIComponent(preset.id)}&thumb=${encodeURIComponent(selectedWorldKey)}&v=${worldThumbVersion}`}
              alt=""
              className="mt-1.5 h-14 w-full max-w-[8rem] rounded-sm border border-[var(--line)] object-cover"
            />
          ) : (
            <p className="mt-1 text-[9px] text-[var(--mute)]">Pick a world plate on World step first.</p>
          )
        ) : null}
        {targetKind === "upload" ? (
          <div className="mt-1.5">
            <button
              type="button"
              onClick={() => targetInputRef.current?.click()}
              className="text-[9px] text-[var(--acid)] hover:underline"
            >
              {targetUploadFile ? targetUploadFile : "Upload target still…"}
            </button>
            <input
              ref={targetInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUploadTarget(f);
                e.target.value = "";
              }}
            />
          </div>
        ) : null}
        {targetKind === "gen" && !genPlates.length ? (
          <p className="mt-1 text-[9px] text-[var(--chrome-dim)]">
            No deep-fake plates yet — plate cast in Image gen (tags this style).
          </p>
        ) : null}
      </div>

      {episodeCast.length === 0 ? (
        <p className="text-[10px] text-[var(--mute)]">Pick episode cast on Characters first.</p>
      ) : (
        <ul className="crash-tray-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
          {episodeCast.map((cast) => {
            const swap = swapResults[cast.key];
            const busy = swapBusyKey === cast.key;
            return (
              <li
                key={cast.key}
                className="rounded-sm border border-[var(--line)] bg-[var(--panel)] p-1.5"
              >
                <p className="text-[11px] font-medium text-[var(--chrome)]">{cast.name}</p>
                <div className="mt-1 flex items-start gap-1.5">
                  <div className="shrink-0 text-center">
                    <p className="text-[7px] text-[var(--mute)]">Source</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      draggable
                      src={`/api/crash/style-cards/file?styleId=${encodeURIComponent(preset.id)}&thumb=${encodeURIComponent(cast.key)}&v=${thumbVersion}`}
                      alt=""
                      title="Drag to Story shot DROP"
                      className="h-12 w-10 cursor-grab rounded-sm border border-[var(--line)] object-cover object-top active:cursor-grabbing"
                      onDragStart={(e) => {
                        e.stopPropagation();
                        writePlateDrag(e, {
                          kind: "cast",
                          styleId: preset.id,
                          thumbKey: cast.key,
                          label: cast.name,
                        });
                      }}
                    />
                  </div>
                  <span className="mt-4 text-[10px] text-[var(--chrome-dim)]">→</span>
                  <div className="min-w-0 flex-1 text-center">
                    <p className="text-[7px] text-[var(--mute)]">Swap result</p>
                    {swap?.resultFile ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        draggable
                        src={`/api/crash/swap/file?styleId=${encodeURIComponent(preset.id)}&file=${encodeURIComponent(swap.resultFile)}&v=${swapVersion}`}
                        alt=""
                        role="button"
                        tabIndex={0}
                        title="Drag to Story shot DROP · click for full size"
                        onDragStart={(e) => {
                          e.stopPropagation();
                          writePlateDrag(e, {
                            kind: "swap",
                            styleId: preset.id,
                            fileName: swap.resultFile,
                            label: cast.name,
                          });
                        }}
                        onClick={() =>
                          setPreview({
                            src: `/api/crash/swap/file?styleId=${encodeURIComponent(preset.id)}&file=${encodeURIComponent(swap.resultFile)}&v=${swapVersion}`,
                            title: `${cast.name} — swap result`,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            setPreview({
                              src: `/api/crash/swap/file?styleId=${encodeURIComponent(preset.id)}&file=${encodeURIComponent(swap.resultFile)}&v=${swapVersion}`,
                              title: `${cast.name} — swap result`,
                            });
                          }
                        }}
                        className="mx-auto h-12 w-[4.5rem] cursor-grab rounded-sm border border-[var(--acid)] object-cover active:cursor-grabbing"
                      />
                    ) : (
                      <div className="mx-auto flex h-12 w-[4.5rem] items-center justify-center rounded-sm border border-dashed border-[var(--line)] text-[8px] text-[var(--mute)]">
                        —
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap justify-end gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setImportCastKey(cast.key);
                      importInputRef.current?.click();
                    }}
                    className="text-[9px] text-[var(--chrome-dim)] hover:text-[var(--acid)] disabled:opacity-40"
                  >
                    Import swap
                  </button>
                  <Btn
                    tone="accent"
                    className="!px-2 !py-0.5 !text-[9px]"
                    disabled={busy}
                    onClick={() => onRunSwap(cast)}
                  >
                    {busy ? "Swapping…" : "Run swap"}
                  </Btn>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <input
        ref={importInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          const cast = episodeCast.find((c) => c.key === importCastKey);
          if (f && cast) onImportSwap(cast, f);
          e.target.value = "";
        }}
      />

      <div className="shrink-0 border-t border-[var(--line)] pt-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[9px] text-[var(--chrome-dim)]">
            {allSwapped
              ? "All cast swapped ✓"
              : "QA: source photo next to result — same person?"}
          </p>
          <Btn
            tone="accent"
            className="shrink-0 !px-2.5 !py-0.5 !text-[10px]"
            onClick={onContinueVoice}
          >
            Voice →
          </Btn>
        </div>
      </div>

      {preview ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative max-h-[92vh] max-w-[min(960px,96vw)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--chrome)]">{preview.title}</p>
              <Btn
                tone="magenta"
                className="!px-2 !py-0.5 !text-[11px]"
                onClick={() => setPreview(null)}
              >
                Close
              </Btn>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.src}
              alt={preview.title}
              className="max-h-[85vh] w-auto max-w-full rounded-sm border border-[var(--line)] object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
