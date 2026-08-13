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
};

type Mode = "open";

export function CrashEpisodeModal({
  styleId,
  mode,
  onClose,
}: {
  styleId: ShowStyleId;
  mode: Mode;
  onClose: () => void;
}) {
  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [mounted, setMounted] = useState(false);

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

  if (!mounted) return null;

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 flex items-start justify-center bg-black/70 p-4 pt-16"
      style={{ zIndex: EPISODE_MODAL_Z }}
      role="dialog"
      aria-label="Open episode"
    >
      <div className="w-full max-w-lg rounded-sm border border-[var(--acid)]/40 bg-[var(--panel)] p-3 shadow-xl">
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

        <div className="max-h-64 overflow-auto rounded-sm border border-[var(--line)]">
          {episodes.length === 0 ? (
            <p className="p-3 text-[12px] text-[var(--mute)]">
              No episodes saved yet.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {episodes.map((ep) => (
                <li
                  key={ep.folderName}
                  className="flex items-center gap-2 px-2 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-[var(--chrome)]">
                      {ep.label}
                    </p>
                    <p className="truncate text-[10px] text-[var(--mute)]">
                      {ep.folderName}
                      {ep.savedAt
                        ? ` · ${new Date(ep.savedAt).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy || !ep.hasStory}
                    onClick={() => void onOpen(ep.folderName)}
                    className="shrink-0 rounded-sm border border-[var(--magenta-hot)]/60 px-2 py-1 text-[11px] text-[var(--magenta-hot)] hover:bg-[var(--magenta-hot)]/10 disabled:opacity-40"
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
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
