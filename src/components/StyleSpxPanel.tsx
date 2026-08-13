"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CrashSpxItem } from "@/lib/crashSpx";
import {
  getShowStylePreset,
  type ShowStyleId,
} from "@/lib/showStylePresets";
import { CRASH_SPX_SAVED } from "@/lib/crashStyleSync";

type Props = {
  styleId: ShowStyleId;
};

export function StyleSpxPanel({ styleId }: Props) {
  const [items, setItems] = useState<CrashSpxItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState("");
  const [label, setLabel] = useState("");
  const [duration, setDuration] = useState("");
  const sfxInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const preset = getShowStylePreset(styleId);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/crash/spx?styleId=${encodeURIComponent(styleId)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Load failed");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [styleId]);

  useEffect(() => {
    void refresh();
    const onSpx = () => void refresh();
    window.addEventListener(CRASH_SPX_SAVED, onSpx);
    return () => window.removeEventListener(CRASH_SPX_SAVED, onSpx);
  }, [refresh]);

  async function upload(kind: "sfx" | "video", file: File) {
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("styleId", styleId);
      fd.set("kind", kind);
      fd.set("file", file);
      fd.set("label", file.name.replace(/\.[^.]+$/, ""));
      const res = await fetch("/api/crash/spx/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      window.dispatchEvent(new CustomEvent(CRASH_SPX_SAVED));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function generateSfx() {
    if (!prompt.trim()) {
      setError("Write a sound prompt first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const dur = duration.trim() ? Number(duration) : undefined;
      const res = await fetch("/api/crash/spx/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId,
          prompt: prompt.trim(),
          label: label.trim() || undefined,
          durationSeconds:
            typeof dur === "number" && !Number.isNaN(dur) ? dur : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generate failed");
      window.dispatchEvent(new CustomEvent(CRASH_SPX_SAVED));
      await refresh();
      setPrompt("");
      setLabel("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crash/spx", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Remove failed");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  const sfx = items.filter((i) => i.kind === "sfx");
  const videos = items.filter((i) => i.kind === "video");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="shrink-0 text-[9px] text-[var(--mute)]">
        {preset.label} library — gen or upload once, reuse every episode. Mix in
        Resolve.
      </p>

      {error ? (
        <p className="shrink-0 text-[9px] text-[var(--magenta-hot)]">{error}</p>
      ) : null}

      <div className="crash-tray-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
        <section>
          <p className="mb-1 text-[8px] uppercase tracking-wider text-[var(--mute)]">
            Gen sound — ElevenLabs
          </p>
          <div className="mb-2 space-y-1 rounded-sm border border-[var(--line)] bg-[var(--panel-2)] p-1.5">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label — Theme sting, Title whoosh…"
              disabled={busy}
              className="w-full rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-1.5 py-0.5 text-[10px] text-[var(--chrome)]"
            />
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Short sharp caravan-park theme sting, comedic TV opener, brass hit and vinyl crackle"
              disabled={busy}
              className="w-full resize-none rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-1.5 py-0.5 text-[10px] text-[var(--chrome)]"
            />
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1 text-[9px] text-[var(--chrome-dim)]">
                Sec
                <input
                  type="number"
                  min={0.5}
                  max={30}
                  step={0.5}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="auto"
                  disabled={busy}
                  className="w-12 rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-1 py-0.5 text-[10px]"
                />
              </label>
              <button
                type="button"
                disabled={busy || !prompt.trim()}
                onClick={() => void generateSfx()}
                className="rounded-sm border border-[var(--magenta-hot)] bg-[var(--magenta-hot)]/15 px-2 py-0.5 text-[9px] font-medium text-[var(--magenta-hot)] disabled:opacity-40"
              >
                {busy ? "Generating…" : "Gen SFX"}
              </button>
            </div>
          </div>

          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[8px] uppercase tracking-wider text-[var(--mute)]">
              Saved sounds — reuse any episode
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => sfxInputRef.current?.click()}
              className="text-[9px] text-[var(--acid)] hover:underline disabled:opacity-40"
            >
              + Add sound
            </button>
          </div>
          <input
            ref={sfxInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload("sfx", f);
              e.target.value = "";
            }}
          />
          {sfx.length ? (
            <ul className="grid grid-cols-4 gap-1.5">
              {sfx.map((row) => (
                <li
                  key={row.id}
                  className="min-w-0 rounded-sm border border-[var(--line)] bg-[var(--panel-2)] p-1.5"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className="truncate text-[10px] text-[var(--chrome)]">
                        {row.label}
                      </p>
                      {row.note ? (
                        <p className="line-clamp-1 text-[8px] text-[var(--mute)]">
                          {row.note}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      title="Remove from shelf"
                      disabled={busy}
                      onClick={() => void removeItem(row.id)}
                      className="shrink-0 text-[10px] text-[var(--fail)] hover:underline disabled:opacity-40"
                    >
                      ×
                    </button>
                  </div>
                  <audio
                    controls
                    preload="none"
                    className="mt-1 h-7 w-full max-w-full"
                    src={`/api/crash/spx/file?styleId=${encodeURIComponent(styleId)}&kind=sfx&file=${encodeURIComponent(row.fileName)}&t=${row.mtime}`}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[9px] text-[var(--chrome-dim)]">
              No sounds yet — Gen SFX above, or + Add sound to upload mp3/wav.
            </p>
          )}
        </section>

        <section>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[8px] uppercase tracking-wider text-[var(--mute)]">
              Video — morph + clips
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => videoInputRef.current?.click()}
              className="text-[9px] text-[var(--acid)] hover:underline disabled:opacity-40"
            >
              + Add video
            </button>
          </div>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*,.mp4,.webm,.mov"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload("video", f);
              e.target.value = "";
            }}
          />

          {videos.length ? (
            <ul className="space-y-1">
              {videos.map((row) => (
                <li
                  key={row.id}
                  className="rounded-sm border border-[var(--line)] bg-[var(--panel-2)] p-1.5"
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="truncate text-[10px] text-[var(--chrome)]">
                      {row.label}
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeItem(row.id)}
                      className="shrink-0 text-[10px] text-[var(--fail)] hover:underline disabled:opacity-40"
                    >
                      ×
                    </button>
                  </div>
                  <video
                    controls
                    preload="metadata"
                    className="mt-1 max-h-28 w-full rounded-sm border border-[var(--line)] bg-black"
                    src={`/api/crash/spx/file?styleId=${encodeURIComponent(styleId)}&kind=video&file=${encodeURIComponent(row.fileName)}&t=${row.mtime}`}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[9px] text-[var(--chrome-dim)]">
              No clips yet — morph in Crash Lab then + Add video, or save an mp4
              here.
            </p>
          )}
        </section>
      </div>

      <div className="shrink-0 border-t border-[var(--line)] pt-1 text-[8px] text-[var(--chrome-dim)]">
        Story panel → Shelf picks from here. Switch style = different library.
      </div>
    </div>
  );
}
