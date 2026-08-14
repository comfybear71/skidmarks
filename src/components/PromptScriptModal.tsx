"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cursorPromptExampleForStyle } from "@/lib/cursorAiWriterTemplate";
import { normalizePromptScript } from "@/lib/cursorPromptNormalize";
import { copyTextToClipboard } from "@/lib/copyText";
import { runPromptBuild } from "@/lib/crashPromptTour";
import { px } from "@/lib/crashDeskLayout";
import { usePanelPointerDrag } from "@/hooks/usePanelPointerDrag";
import {
  CRASH_PANEL_MIN_H,
  CRASH_PANEL_MIN_W,
  CRASH_PANEL_TITLE_BAR,
} from "@/lib/crashLabPanel";
import { bumpCrashLabZ } from "@/lib/crashLabZ";
import { getShowStylePreset, type ShowStyleId } from "@/lib/showStylePresets";

/** Above stack panels; rendered on document.body via portal. */
const PROMPT_BACKDROP_Z = 6000;
const PROMPT_PANEL_Z = 6001;

type Preview = {
  highestNumber: number;
  nextNumber: number;
  nextFolderName: string | null;
};

type PanelGeom = { x: number; y: number; w: number; h: number };

const PANEL_DEFAULT_W = 720;
const PANEL_DEFAULT_H = 480;
const PANEL_MIN_W = Math.max(CRASH_PANEL_MIN_W, 420);
const PANEL_MIN_H = Math.max(CRASH_PANEL_MIN_H, 280);

function defaultPanelGeom(): PanelGeom {
  if (typeof window === "undefined") {
    return { x: 240, y: 120, w: PANEL_DEFAULT_W, h: PANEL_DEFAULT_H };
  }
  const toolbar = document.getElementById("crash-desk-toolbar");
  const top =
    (toolbar?.getBoundingClientRect().bottom ?? 88) + 20;
  const w = Math.min(PANEL_DEFAULT_W, window.innerWidth - 32);
  const h = Math.min(PANEL_DEFAULT_H, window.innerHeight - top - 24);
  const x = Math.max(16, (window.innerWidth - w) / 2);
  return { x, y: top, w, h };
}

export function PromptScriptModal({
  styleId,
  busy,
  onBusyChange,
  onClose,
  frontKey = 0,
}: {
  styleId: ShowStyleId;
  busy: boolean;
  onBusyChange: (v: boolean) => void;
  onClose: () => void;
  /** Increment when Prompt toolbar button clicked — brings panel forward. */
  frontKey?: number;
}) {
  const preset = getShowStylePreset(styleId);
  const [script, setScript] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [aiBrief, setAiBrief] = useState("");
  const [templateFile, setTemplateFile] = useState("");
  const [briefLoading, setBriefLoading] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [copiedCount, setCopiedCount] = useState(0);
  const [geom, setGeom] = useState<PanelGeom>(() => defaultPanelGeom());
  const [mounted, setMounted] = useState(false);
  const templateRef = useRef<HTMLTextAreaElement>(null);
  const hiddenCopyRef = useRef<HTMLTextAreaElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  const refreshPreview = useCallback(async (campaignLabel?: string) => {
    try {
      const q = new URLSearchParams({ styleId });
      if (campaignLabel?.trim()) {
        q.set("campaignLabel", campaignLabel.trim());
      }
      const res = await fetch(`/api/crash/cursor/prompt?${q}`);
      const data = await res.json();
      if (res.ok) {
        setPreview({
          highestNumber: data.highestNumber ?? 0,
          nextNumber: data.nextNumber ?? 1,
          nextFolderName: data.nextFolderName ?? null,
        });
      }
    } catch {
      /* ignore */
    }
  }, [styleId]);

  useEffect(() => {
    setMounted(true);
    setGeom(defaultPanelGeom());
    bumpCrashLabZ();
  }, []);

  useEffect(() => {
    if (frontKey > 0) setGeom(defaultPanelGeom());
  }, [frontKey]);

  useEffect(() => {
    void refreshPreview();
  }, [refreshPreview]);

  async function fetchFullBrief(): Promise<string> {
    const res = await fetch(
      `/api/crash/cursor/prompt?styleId=${encodeURIComponent(styleId)}&brief=1`,
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load template");
    if (data.templateFile) setTemplateFile(String(data.templateFile));
    const text = String(data.brief ?? "").trim();
    if (text.length < 1500) {
      throw new Error(
        `Template only ${text.length} chars — should be ~5000. Refresh page.`,
      );
    }
    return text;
  }

  useEffect(() => {
    let cancelled = false;
    setBriefLoading(true);
    void (async () => {
      try {
        const text = await fetchFullBrief();
        if (!cancelled) {
          setAiBrief(text);
          setError("");
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Could not load AI template",
          );
        }
      } finally {
        if (!cancelled) setBriefLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [styleId]);

  useEffect(() => {
    const ep = script.match(/^EPISODE:\s*(.+)$/im)?.[1]?.trim();
    if (ep) void refreshPreview(ep);
  }, [script, refreshPreview]);

  const bringFront = useCallback(() => {
    bumpCrashLabZ();
  }, []);

  const { startMove, startResize } = usePanelPointerDrag({
    geom,
    setGeom,
    minW: PANEL_MIN_W,
    minH: PANEL_MIN_H,
    bringFront,
  });

  function loadExample() {
    setScript(cursorPromptExampleForStyle(styleId));
    setError("");
    setShowTemplate(false);
  }

  function downloadBrief(text: string) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AI_EPISODE_WRITER_${styleId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyForAi() {
    setError("");
    try {
      let text = aiBrief.trim();
      if (text.length < 1500) {
        text = await fetchFullBrief();
        setAiBrief(text);
      }
      setShowTemplate(true);
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      });
      const n = await copyTextToClipboard(
        text,
        templateRef.current ?? hiddenCopyRef.current,
      );
      setCopiedCount(n);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      try {
        const text =
          aiBrief.trim().length >= 1500 ? aiBrief.trim() : await fetchFullBrief();
        downloadBrief(text);
        setError(
          "Copy blocked — downloaded AI_EPISODE_WRITER.txt instead. Open that file and copy from Notepad.",
        );
      } catch (inner) {
        setError(
          inner instanceof Error
            ? inner.message
            : e instanceof Error
              ? e.message
              : "Copy failed — Show template → Ctrl+A → Ctrl+C",
        );
      }
    }
  }

  async function openTemplateFile() {
    if (!templateFile) {
      setError("Template file path not loaded — refresh page");
      return;
    }
    setError("");
    try {
      const res = await fetch("/api/crash/open-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: templateFile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not open file");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open file");
    }
  }

  function fixFormatting() {
    setScript((prev) => normalizePromptScript(prev));
    setError("");
  }

  async function switchToPasteScript() {
    setShowTemplate(false);
    setError("");
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
    pasteRef.current?.focus();
    if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
      try {
        const clip = (await navigator.clipboard.readText()).trim();
        if (clip && /EPISODE:|---\s*SHOT/i.test(clip)) {
          setScript(normalizePromptScript(clip));
        }
      } catch {
        /* clipboard blocked — user can Ctrl+V in the box */
      }
    }
  }

  async function onGo() {
    if (!script.trim()) return;
    setError("");
    const cleaned = normalizePromptScript(script);
    setScript("");
    setShowTemplate(false);
    onClose();
    onBusyChange(true);
    try {
      await runPromptBuild(styleId, cleaned);
    } catch (e) {
      emitPromptError(
        e instanceof Error ? e.message : "Build failed",
      );
    } finally {
      onBusyChange(false);
    }
  }

  function emitPromptError(message: string) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("crash-cursor-tour", {
        detail: {
          phase: "error",
          index: 0,
          total: 11,
          label: message,
        },
      }),
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void onGo();
    }
  }

  const highest =
    preview && preview.highestNumber > 0
      ? String(preview.highestNumber).padStart(2, "0")
      : null;
  const nextNum = preview
    ? String(preview.nextNumber).padStart(2, "0")
    : "??";

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/35"
        aria-hidden
        style={{ zIndex: PROMPT_BACKDROP_Z }}
        onClick={onClose}
      />
      <div
        className="fixed flex flex-col overflow-hidden rounded-sm border border-[var(--acid)] bg-[var(--panel)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Prompt script"
        style={{
          left: px(geom.x),
          top: px(geom.y),
          width: px(geom.w),
          height: px(geom.h),
          zIndex: PROMPT_PANEL_Z,
        }}
        onPointerDown={bringFront}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`${CRASH_PANEL_TITLE_BAR} touch-none`}
          onPointerDown={startMove}
        >
          <h2 className="display shrink-0 text-sm leading-none text-[var(--acid)]">
            PROMPT
          </h2>
          <span className="min-w-0 flex-1 truncate text-[9px] uppercase tracking-[0.12em] text-[var(--acid-deep)]">
            {preset.label}
            {highest
              ? ` · last ${highest}_ · next ${nextNum}_`
              : ` · next ${nextNum}_`}
            {preview?.nextFolderName ? ` → ${preview.nextFolderName}` : ""}
          </span>
          <button
            type="button"
            className="shrink-0 rounded-sm border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--chrome-dim)] hover:text-[var(--chrome)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-3">
          <textarea
            ref={hiddenCopyRef}
            aria-hidden
            tabIndex={-1}
            readOnly
            value={aiBrief}
            className="pointer-events-none absolute h-px w-px opacity-0"
          />
          <div className="mb-2 flex shrink-0 gap-2">
            <button
              type="button"
              className={`rounded-sm border px-2 py-0.5 text-[10px] uppercase ${
                !showTemplate
                  ? "border-[var(--acid)] text-[var(--acid)]"
                  : "border-[var(--line)] text-[var(--chrome-dim)]"
              }`}
              onClick={() => void switchToPasteScript()}
            >
              Paste script
            </button>
            <button
              type="button"
              className={`rounded-sm border px-2 py-0.5 text-[10px] uppercase ${
                showTemplate
                  ? "border-[var(--acid)] text-[var(--acid)]"
                  : "border-[var(--line)] text-[var(--chrome-dim)]"
              }`}
              onClick={() => setShowTemplate(true)}
            >
              Show template
              {aiBrief ? ` (${aiBrief.length.toLocaleString()} chars)` : ""}
            </button>
          </div>

          <div
            className={
              showTemplate
                ? "hidden min-h-0 flex-1 flex-col"
                : "flex min-h-0 flex-1 flex-col"
            }
          >
            <textarea
              ref={pasteRef}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Paste AI script here (EPISODE: … then --- SHOT 1 --- blocks)"
              className="min-h-0 flex-1 resize-none rounded-sm border border-[var(--line)] bg-[var(--void)]/50 p-3 font-mono text-[11px] leading-relaxed text-[var(--chrome)] outline-none focus:border-[var(--acid)]"
              spellCheck={false}
            />
          </div>
          <div
            className={
              showTemplate
                ? "flex min-h-0 flex-1 flex-col"
                : "hidden min-h-0 flex-1 flex-col"
            }
          >
            <textarea
              ref={templateRef}
              readOnly
              value={
                briefLoading
                  ? "Loading full template…"
                  : aiBrief || "Template failed to load — refresh page"
              }
              className="min-h-0 flex-1 resize-none rounded-sm border border-[var(--line)] bg-[var(--void)]/50 p-3 font-mono text-[10px] leading-relaxed text-[var(--chrome)] outline-none"
              spellCheck={false}
              onFocus={(e) => e.target.select()}
            />
          </div>

          {error ? (
            <p className="mt-2 shrink-0 text-[11px] text-[var(--magenta-hot)]">
              {error}
            </p>
          ) : (
            <p className="mt-2 shrink-0 text-[10px] text-[var(--mute)]">
              {briefLoading
                ? "Loading full AI template…"
                : copied
                  ? `Copied ${copiedCount.toLocaleString()} characters — paste into Google`
                  : aiBrief
                    ? `Full template loaded (${aiBrief.length.toLocaleString()} chars). Show template to read it all.`
                    : "Waiting for template…"}
            </p>
          )}

          <div className="mt-2 flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || briefLoading}
              onClick={() => void copyForAi()}
              className="rounded-sm border border-[var(--acid)] px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--acid)] hover:bg-[var(--acid)]/10 disabled:opacity-40"
            >
              {copied
                ? `Copied ${copiedCount.toLocaleString()} chars!`
                : briefLoading
                  ? "Loading…"
                  : "Copy for AI"}
            </button>
            <button
              type="button"
              disabled={busy || !templateFile}
              onClick={() => void openTemplateFile()}
              className="rounded-sm border border-[var(--line)] px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--chrome-dim)] hover:border-[var(--acid)] hover:text-[var(--acid)] disabled:opacity-40"
            >
              Open template file
            </button>
          <button
            type="button"
            disabled={busy}
            onClick={fixFormatting}
            className="rounded-sm border border-[var(--line)] px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--chrome-dim)] hover:border-[var(--acid)] hover:text-[var(--acid)] disabled:opacity-40"
          >
            Fix formatting
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={loadExample}
              className="rounded-sm border border-[var(--line)] px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--chrome-dim)] hover:border-[var(--acid)] hover:text-[var(--acid)] disabled:opacity-40"
            >
              Load example
            </button>
            <button
              type="button"
              disabled={busy || !script.trim()}
              onClick={() => void onGo()}
              className="rounded-sm border border-emerald-600 bg-emerald-700/25 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400 hover:bg-emerald-700/40 disabled:opacity-40"
            >
              {busy ? "Building…" : "Go"}
            </button>
          </div>
        </div>

        <div
          className="crash-resize-handle touch-none absolute bottom-0 right-0 z-10 h-4 w-4 cursor-se-resize"
          onPointerDown={startResize("se")}
          title="Drag to resize"
        />
        <div
          className="crash-resize-handle touch-none absolute bottom-0 left-4 right-4 z-10 h-2 cursor-s-resize"
          onPointerDown={startResize("s")}
        />
        <div
          className="crash-resize-handle touch-none absolute bottom-4 top-8 right-0 z-10 w-2 cursor-e-resize"
          onPointerDown={startResize("e")}
        />
      </div>
    </>,
    document.body,
  );
}
