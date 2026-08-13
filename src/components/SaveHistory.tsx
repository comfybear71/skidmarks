"use client";

import type { SavedText, SavedVoice } from "@/lib/types";

/** Only shows when dirty — "save/edit". History list always under when any. */
export function SaveEditHistory({
  dirty,
  saving,
  onSave,
  history,
  onUse,
  onDelete,
}: {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  history: SavedText[];
  onUse: (text: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mt-1 space-y-1">
      {dirty ? (
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="rounded-sm border border-[var(--acid)] bg-[var(--acid)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--void)] hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save / edit"}
        </button>
      ) : null}
      {history.length > 0 ? (
        <ul className="space-y-1 border-t border-[var(--line)]/60 pt-1">
          {history.map((h) => (
            <li
              key={h.id}
              className="flex items-start gap-2 text-[11px] text-[var(--chrome-dim)]"
            >
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                {h.text.trim() || "(empty)"}
              </span>
              <button
                type="button"
                className="shrink-0 text-[var(--acid)] underline decoration-dotted"
                onClick={() => onUse(h.text)}
              >
                Use
              </button>
              <button
                type="button"
                className="shrink-0 text-[var(--magenta-hot)] underline decoration-dotted"
                onClick={() => onDelete(h.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function VoiceHistoryList({
  history,
  onUse,
  onDelete,
}: {
  history: SavedVoice[];
  onUse: (fileName: string) => void;
  onDelete: (id: string, fileName: string) => void;
}) {
  if (!history.length) return null;
  return (
    <ul className="mt-1 space-y-1 border-t border-[var(--line)]/60 pt-1">
      {history.map((h) => (
        <li
          key={h.id}
          className="flex items-center gap-2 text-[11px] text-[var(--chrome-dim)]"
        >
          <span
            className="min-w-0 flex-1 truncate"
            title={h.fileName}
          >
            {h.label && !h.label.startsWith("shot_")
              ? h.label
              : h.label || h.fileName}
          </span>
          <button
            type="button"
            className="shrink-0 text-[var(--acid)] underline decoration-dotted"
            onClick={() => onUse(h.fileName)}
          >
            Use
          </button>
          <button
            type="button"
            className="shrink-0 text-[var(--magenta-hot)] underline decoration-dotted"
            onClick={() => onDelete(h.id, h.fileName)}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
