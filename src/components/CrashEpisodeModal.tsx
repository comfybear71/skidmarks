"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { type ShowStyleId } from "@/lib/showStylePresets";
import { openCrashLabPackOnDesk } from "@/lib/crashDeskHydrate";

/** Above cards (≤400) and the desk toolbar (5000) so Open episode is clickable. */
const EPISODE_MODAL_Z = 6000;

type EpisodeRow = {
  label: string;
  styleId: ShowStyleId;
  folderName: string;
  savedAt: string;
  hasStory: boolean;
  hasSceneKit: boolean;
  thumbFile?: string;
};

type Mode = "open";

export function CrashEpisodeModal({
  styleId,
  mode,
  onClose,
  onNewEpisode,
}: {
  styleId: ShowStyleId;
  mode: Mode;
  onClose: () => void;
  /** New Episode clears live desk state and has a documented history of
   * wiping packs when re-implemented casually — this modal never touches
   * that logic itself, only hands off to the toolbar's existing, guarded
   * handler. Omit to hide the tile entirely rather than fake the action. */
  onNewEpisode?: () => void;
}) {
  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [mounted, setMounted] = useState(false);
  // Second tap confirms — a delete has no undo, so a single stray tap should
  // not be able to trigger one.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function loadList() {
    try {
      const res = await fetch(
        `/api/crash/episodes?styleId=${encodeURIComponent(styleId)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "List failed");
      setEpisodes((data.episodes || []) as EpisodeRow[]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "List failed");
    }
  }

  useEffect(() => {
    void loadList();
  }, [styleId]);

  // mode kept for call-site typing; open-only modal
  void mode;

  async function onOpen(folderName: string) {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const data = await openCrashLabPackOnDesk({ folderName, styleId });
      setMsg(`Opened: ${data.meta?.label || folderName}`);
      onClose();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Open failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(folderName: string) {
    if (busy) return;
    if (confirmDelete !== folderName) {
      setConfirmDelete(folderName);
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(
        `/api/crash/episodes?styleId=${encodeURIComponent(styleId)}&folderName=${encodeURIComponent(folderName)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setMsg(`Deleted: ${folderName}`);
      setConfirmDelete(null);
      await loadList();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 flex items-start justify-center bg-black/70 p-4 pt-16"
      style={{ zIndex: EPISODE_MODAL_Z }}
      role="dialog"
      aria-label="Open episode"
    >
      <div className="w-full max-w-2xl rounded-sm border border-[var(--acid)]/40 bg-[var(--panel)] p-3 shadow-xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-[12px] font-medium uppercase tracking-wide text-[var(--acid)]">
            Open episode
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-[var(--mute)] hover:text-[var(--chrome)]"
          >
            Close
          </button>
        </div>
        <p className="mb-2 text-[11px] text-[var(--chrome-dim)]">
          Folder: MY MOVIES\
          {styleId === "sunny_banks"
            ? "_SUNNY_BANKS"
            : styleId === "deepfake"
              ? "_REAL_FAKES"
              : styleId === "doc"
                ? "_DOCUMENTARY"
                : styleId === "music_video"
                  ? "_MUSIC_VIDEO"
                  : styleId === "photoreal"
                    ? "_PHOTOREAL"
                    : "_SKIDMARKS"}
          \_CRASH_LAB\
        </p>

        <div className="max-h-[28rem] overflow-auto rounded-sm border border-[var(--line)] p-2">
          {episodes.length === 0 && !onNewEpisode ? (
            <p className="p-3 text-[12px] text-[var(--mute)]">
              No episodes saved yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {onNewEpisode ? (
                <button
                  type="button"
                  onClick={onNewEpisode}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-[var(--acid)]/50 text-[var(--acid)] hover:bg-[var(--acid)]/10"
                >
                  <span className="text-2xl leading-none">+</span>
                  <span className="text-[11px]">New project</span>
                </button>
              ) : null}
              {episodes.map((ep) => (
                <div
                  key={ep.folderName}
                  className="flex flex-col overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--panel-2)]"
                >
                  <div className="relative aspect-square w-full bg-[var(--void)]">
                    {ep.thumbFile ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/crash/gen/file?name=${encodeURIComponent(ep.thumbFile)}`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--mute)]">
                        No plate yet
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 p-1.5">
                    <p className="truncate text-[12px] text-[var(--chrome)]">{ep.label}</p>
                    <p className="truncate text-[9px] text-[var(--mute)]">
                      {ep.savedAt ? new Date(ep.savedAt).toLocaleDateString() : ep.folderName}
                    </p>
                    <div className="mt-1 flex gap-1">
                      <button
                        type="button"
                        disabled={busy || !ep.hasStory}
                        onClick={() => void onOpen(ep.folderName)}
                        className="flex-1 rounded-sm border border-[var(--magenta-hot)]/60 py-1 text-[10px] text-[var(--magenta-hot)] hover:bg-[var(--magenta-hot)]/10 disabled:opacity-40"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onDelete(ep.folderName)}
                        onBlur={() =>
                          setConfirmDelete((cur) => (cur === ep.folderName ? null : cur))
                        }
                        className="flex-1 rounded-sm border border-[var(--line)] py-1 text-[10px] text-[var(--mute)] hover:border-[var(--magenta-hot)]/60 hover:text-[var(--magenta-hot)] disabled:opacity-40"
                      >
                        {confirmDelete === ep.folderName ? "Confirm?" : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {msg ? (
          <p className="mt-2 text-[11px] text-[var(--chrome-dim)]">{msg}</p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
