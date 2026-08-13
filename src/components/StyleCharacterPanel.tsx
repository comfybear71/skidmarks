"use client";

import { useEffect, useRef, useState } from "react";
import { Btn } from "@/components/ui";
import type { ShowStylePreset } from "@/lib/showStylePresets";
import {
  getStyleCharacterRoster,
  pairStyleCharacters,
} from "@/lib/styleCharacterRoster";
import { matchLabCharacter } from "@/lib/matchLabCharacter";
import type { Character } from "@/lib/types";

export type StyleThumbRow = {
  key: string;
  name?: string;
  brief?: string;
  mtime?: number;
};

type CastEntry = { key: string; name: string; brief: string };
type FaceRow = {
  key: string;
  name: string;
  brief: string;
  labeled: boolean;
  faceCount: number;
};

type Props = {
  preset: ShowStylePreset;
  thumbs: StyleThumbRow[];
  thumbVersion: number;
  characters: Character[];
  selectedCastKeys: string[];
  characterNotes: string;
  onToggleCharacter: (entry: CastEntry) => void;
  onSelectAllCast: () => void;
  onClearCast: () => void;
  onCharacterNotesChange: (value: string) => void;
  onEditThumb: (thumbKey: string, name: string, brief: string) => void;
  onRemoveThumb: (thumbKey: string) => void;
  onSpinIdea: () => void;
  onGenerateCharacter: () => void;
  onUploadCharacter: (file: File, name: string, brief: string) => Promise<void>;
  onBuildWorld: () => void;
};

export function StyleCharacterPanel({
  preset,
  thumbs,
  thumbVersion,
  characters,
  selectedCastKeys,
  characterNotes,
  onToggleCharacter,
  onSelectAllCast,
  onClearCast,
  onCharacterNotesChange,
  onEditThumb,
  onRemoveThumb,
  onSpinIdea,
  onGenerateCharacter,
  onUploadCharacter,
  onBuildWorld,
}: Props) {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [editingFace, setEditingFace] = useState<FaceRow | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{
    file: File;
    previewUrl: string;
    defaultName: string;
  } | null>(null);
  const faces = pairStyleCharacters(preset.id, thumbs);
  const labeledFaces = faces.filter((f) => f.labeled);
  const roster = getStyleCharacterRoster(preset.id);
  const isArsehole = preset.characterMode === "arsehole";
  const unlabeled = faces.length - labeledFaces.length;
  const castMode = selectedCastKeys.length > 0;
  const allSelected =
    labeledFaces.length > 0 &&
    labeledFaces.every((f) => selectedCastKeys.includes(f.key));
  const pickedFaces = labeledFaces.filter((f) => selectedCastKeys.includes(f.key));

  function pickUpload(file: File | null | undefined) {
    if (!file || uploadBusy || pendingUpload) return;
    const defaultName = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim();
    setPendingUpload({
      file,
      previewUrl: URL.createObjectURL(file),
      defaultName,
    });
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  }

  function cancelPendingUpload() {
    if (pendingUpload?.previewUrl) URL.revokeObjectURL(pendingUpload.previewUrl);
    setPendingUpload(null);
  }

  async function confirmPendingUpload(name: string, brief: string) {
    if (!pendingUpload || uploadBusy) return;
    setUploadBusy(true);
    try {
      await onUploadCharacter(pendingUpload.file, name, brief);
      URL.revokeObjectURL(pendingUpload.previewUrl);
      setPendingUpload(null);
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="shrink-0">
        <p className="display text-sm text-[var(--magenta-hot)]">{preset.label}</p>
        <p className="mt-0.5 text-[9px] text-[var(--mute)]">
          {isArsehole
            ? "Tap the arsehole for this episode — one or many, then Build World."
            : "Tap cast for this episode — one or all — then Build World."}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {labeledFaces.length > 0 ? (
            <>
              {castMode ? (
                <span className="text-[9px] text-[var(--acid)]">
                  {selectedCastKeys.length} picked
                </span>
              ) : null}
              <button
                type="button"
                onClick={onSelectAllCast}
                disabled={allSelected || labeledFaces.length === 0}
                className="text-[9px] text-[var(--chrome-dim)] hover:text-[var(--acid)] disabled:opacity-40"
              >
                Select all
              </button>
              {castMode ? (
                <button
                  type="button"
                  onClick={onClearCast}
                  className="text-[9px] text-[var(--chrome-dim)] hover:text-[var(--magenta-hot)]"
                >
                  Clear
                </button>
              ) : null}
            </>
          ) : null}
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            disabled={uploadBusy}
            className="text-[9px] text-[var(--chrome-dim)] hover:text-[var(--acid)] disabled:opacity-40"
          >
            {uploadBusy ? "Uploading…" : "Upload image"}
          </button>
        </div>
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => void pickUpload(e.target.files?.[0])}
        />
        {unlabeled > 0 ? (
          <p className="mt-0.5 text-[9px] text-[var(--chrome-dim)]">
            Unnamed face — hit Edit to name it.
          </p>
        ) : null}
      </div>

      {faces.length === 0 ? (
        <p className="shrink-0 text-[10px] text-[var(--mute)]">
          No faces yet. Upload an image, or spin an Idea → Generate.
        </p>
      ) : (
        <ul className="crash-tray-scroll min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
          {faces.map((face) => {
            const selected = selectedCastKeys.includes(face.key);
            const lab = face.labeled
              ? matchLabCharacter(characters, face.name)
              : null;
            return (
              <li key={face.key}>
                <div
                  className={`flex gap-0.5 rounded-sm border p-0.5 ${
                    selected
                      ? "border-[var(--magenta-hot)] bg-[var(--panel-2)] shadow-[0_0_0_1px_var(--magenta-hot)]"
                      : "border-[var(--line)] bg-[var(--panel)]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleCharacter(face)}
                    disabled={!face.labeled}
                    className={`flex min-w-0 flex-1 gap-1.5 p-1 text-left ${
                      face.labeled
                        ? "hover:opacity-95"
                        : "cursor-not-allowed opacity-80"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border text-[8px] ${
                        selected
                          ? "border-[var(--magenta-hot)] bg-[var(--magenta-hot)] text-black"
                          : "border-[var(--line)] bg-[var(--panel-2)] text-transparent"
                      }`}
                      aria-hidden
                    >
                      ✓
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/crash/style-cards/file?styleId=${encodeURIComponent(preset.id)}&thumb=${encodeURIComponent(face.key)}&v=${thumbVersion}`}
                      alt=""
                      className="h-10 w-9 shrink-0 rounded-sm object-cover object-top"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[11px] font-medium leading-tight ${
                          face.labeled
                            ? "text-[var(--chrome)]"
                            : "text-[var(--mute)]"
                        }`}
                      >
                        {face.name}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-[var(--mute)]">
                        {face.faceCount > 1
                          ? `${face.faceCount} faces · ${face.brief}`
                          : face.brief}
                      </p>
                      {lab ? (
                        <span className="mt-0.5 inline-block text-[8px] text-[var(--acid-deep)]">
                          Lab → {lab.name}
                        </span>
                      ) : null}
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5 py-1 pr-0.5">
                    <button
                      type="button"
                      title="Edit name"
                      onClick={() => setEditingFace(face)}
                      className="flex h-4 w-4 items-center justify-center rounded-sm text-[8px] leading-none text-[var(--chrome-dim)] hover:bg-[var(--panel-2)] hover:text-[var(--acid)]"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => onRemoveThumb(face.key)}
                      className="flex h-4 w-4 items-center justify-center rounded-sm text-[10px] leading-none text-[var(--fail)] hover:bg-[var(--fail)]/15"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editingFace ? (
        <FaceEditModal
          face={editingFace}
          roster={roster}
          onClose={() => setEditingFace(null)}
          onSave={(name, brief) => {
            onEditThumb(editingFace.key, name, brief);
            setEditingFace(null);
          }}
        />
      ) : null}

      {pendingUpload ? (
        <UploadNameModal
          previewUrl={pendingUpload.previewUrl}
          defaultName={pendingUpload.defaultName}
          roster={roster}
          busy={uploadBusy}
          onClose={cancelPendingUpload}
          onSave={confirmPendingUpload}
        />
      ) : null}

      {castMode ? (
        <div className="shrink-0 rounded-sm border border-[var(--magenta-hot)]/40 bg-[var(--panel-2)] p-1.5">
          <p className="mb-1 text-[8px] uppercase tracking-wider text-[var(--magenta-hot)]">
            Episode cast — going to World
          </p>
          <ul className="crash-tray-scroll flex max-h-[5.5rem] gap-1.5 overflow-x-auto overflow-y-hidden pb-0.5">
            {pickedFaces.map((face) => (
              <li key={face.key} className="w-[4.25rem] shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleCharacter(face)}
                  title={`Remove ${face.name}`}
                  className="group relative w-full text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/crash/style-cards/file?styleId=${encodeURIComponent(preset.id)}&thumb=${encodeURIComponent(face.key)}&v=${thumbVersion}`}
                    alt=""
                    className="h-12 w-full rounded-sm border border-[var(--magenta-hot)] object-cover object-top"
                  />
                  <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-black/70 text-[9px] text-[var(--magenta-hot)] opacity-0 group-hover:opacity-100">
                    ×
                  </span>
                  <p className="mt-0.5 line-clamp-2 text-[8px] leading-tight text-[var(--chrome)]">
                    {face.name}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="shrink-0 space-y-1.5 border-t border-[var(--line)] pt-1.5">
        {castMode ? (
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-[9px] text-[var(--chrome-dim)]">
              {pickedFaces.map((f) => f.name).join(" · ")}
            </p>
            <Btn
              tone="accent"
              className="shrink-0 !px-2.5 !py-0.5 !text-[10px]"
              onClick={onBuildWorld}
            >
              Build World →
            </Btn>
          </div>
        ) : (
          <>
            <p className="text-[8px] uppercase tracking-wider text-[var(--mute)]">
              Develop character — idea prompt
            </p>
            <div className="overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--panel-2)]">
              <textarea
                rows={2}
                value={characterNotes}
                onChange={(e) => onCharacterNotesChange(e.target.value)}
                placeholder={`${preset.label} face idea — Idea for another…`}
                className="block w-full resize-none border-0 bg-transparent px-2 py-1 text-[11px] text-[var(--chrome)] outline-none focus:ring-0"
              />
              <div className="flex items-center justify-end gap-1.5 border-t border-[var(--line)] px-2 py-1">
                <button
                  type="button"
                  onClick={onSpinIdea}
                  className="flex items-center gap-0.5 rounded-sm border border-[var(--acid)] bg-[var(--panel)] px-1.5 py-0.5 text-[9px] text-[var(--acid)] hover:bg-[var(--acid)]/10"
                  title={`Another ${preset.label} face idea`}
                >
                  <svg
                    aria-hidden
                    viewBox="0 0 16 16"
                    className="h-3 w-3 shrink-0 fill-current"
                  >
                    <path d="M8 1.5a4.5 4.5 0 0 0-2.35 8.32v.93a.75.75 0 0 0 .75.75h3.2a.75.75 0 0 0 .75-.75v-.93A4.5 4.5 0 0 0 8 1.5Zm-1.25 11.5a.75.75 0 0 0 .75.75h2.5a.75.75 0 0 0 0-1.5H7.5a.75.75 0 0 0-.75.75Z" />
                  </svg>
                  Idea
                </button>
                <Btn
                  tone="magenta"
                  className="!px-2 !py-0.5 !text-[9px]"
                  disabled={!characterNotes.trim()}
                  onClick={onGenerateCharacter}
                  title="Send to Image gen and generate"
                >
                  Generate
                </Btn>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function UploadNameModal({
  previewUrl,
  defaultName,
  roster,
  busy,
  onClose,
  onSave,
}: {
  previewUrl: string;
  defaultName: string;
  roster: { name: string; brief: string }[];
  busy: boolean;
  onClose: () => void;
  onSave: (name: string, brief: string) => void;
}) {
  const [editName, setEditName] = useState(defaultName);
  const [editBrief, setEditBrief] = useState("");
  const [pickRoster, setPickRoster] = useState("");

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Name uploaded character"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-sm rounded-sm border border-[var(--line)] bg-[var(--panel)] p-3 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="display text-sm text-[var(--magenta-hot)]">Add to cast</p>
        <p className="mt-0.5 text-[9px] text-[var(--mute)]">
          Name them before they land in the list.
        </p>
        <div className="mt-2 flex gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt=""
            className="h-16 w-14 shrink-0 rounded-sm border border-[var(--line)] object-cover object-top"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <select
              className="w-full rounded-sm border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 text-[11px]"
              value={pickRoster}
              disabled={busy}
              onChange={(e) => {
                const v = e.target.value;
                setPickRoster(v);
                if (!v) return;
                const hit = roster.find((r) => r.name === v);
                if (hit) {
                  setEditName(hit.name);
                  setEditBrief(hit.brief);
                }
              }}
            >
              <option value="">— pick preset —</option>
              {roster.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={editName}
              disabled={busy}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Name — e.g. Brother"
              className="w-full rounded-sm border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 text-[11px] text-[var(--chrome)]"
            />
          </div>
        </div>
        <textarea
          rows={2}
          value={editBrief}
          disabled={busy}
          onChange={(e) => setEditBrief(e.target.value)}
          placeholder="Describe this face…"
          className="mt-2 w-full resize-none rounded-sm border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 text-[11px] text-[var(--chrome)]"
        />
        <div className="mt-3 flex justify-end gap-2">
          <Btn
            tone="ghost"
            className="!px-2 !py-0.5 !text-[10px]"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Btn>
          <Btn
            tone="accent"
            className="!px-2 !py-0.5 !text-[10px]"
            disabled={busy || !editName.trim()}
            onClick={() => onSave(editName.trim(), editBrief.trim())}
          >
            {busy ? "Adding…" : "Add to list"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function FaceEditModal({
  face,
  roster,
  onClose,
  onSave,
}: {
  face: FaceRow;
  roster: { name: string; brief: string }[];
  onClose: () => void;
  onSave: (name: string, brief: string) => void;
}) {
  const startName = face.labeled ? face.name : "";
  const startBrief = face.labeled ? face.brief : "";
  const [editName, setEditName] = useState(startName);
  const [editBrief, setEditBrief] = useState(startBrief);
  const [pickRoster, setPickRoster] = useState("");

  useEffect(() => {
    setEditName(startName);
    setEditBrief(startBrief);
    setPickRoster("");
  }, [face.key, startName, startBrief]);

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Edit character"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-sm border border-[var(--line)] bg-[var(--panel)] p-3 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="display text-sm text-[var(--magenta-hot)]">Edit character</p>
        <div className="mt-2 space-y-2">
          <select
            className="w-full rounded-sm border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 text-[11px]"
            value={pickRoster}
            onChange={(e) => {
              const v = e.target.value;
              setPickRoster(v);
              if (!v) return;
              const hit = roster.find((r) => r.name === v);
              if (hit) {
                setEditName(hit.name);
                setEditBrief(hit.brief);
              }
            }}
          >
            <option value="">— pick preset —</option>
            {roster.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Name — e.g. Brother"
            className="w-full rounded-sm border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 text-[11px] text-[var(--chrome)]"
          />
          <textarea
            rows={2}
            value={editBrief}
            onChange={(e) => setEditBrief(e.target.value)}
            placeholder="Brief (optional)"
            className="w-full resize-none rounded-sm border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 text-[11px] text-[var(--chrome)]"
          />
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Btn tone="ghost" className="!px-2 !py-0.5 !text-[10px]" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            tone="accent"
            className="!px-2 !py-0.5 !text-[10px]"
            disabled={!editName.trim()}
            onClick={() => onSave(editName.trim(), editBrief.trim())}
          >
            Save
          </Btn>
        </div>
      </div>
    </div>
  );
}
