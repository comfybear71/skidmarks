"use client";

import { useEffect, useRef } from "react";

/**
 * Scratch bench hotkeys (window-level).
 * Ctrl/Cmd+Enter → Draw
 * Ctrl/Cmd+Shift+Enter → Generate clip
 * Ctrl/Cmd+S → persist score / run log
 * Ctrl/Cmd+Backspace → clear pad (confirm)
 * Ctrl/Cmd+E → export CSV
 */
export function useScratchPadHotkeys(handlers: {
  onDraw: () => void;
  onGenerate: () => void;
  onArchive: () => void;
  onClearPad: () => void;
  onExportCsv: () => void;
  enabled?: boolean;
}) {
  const { enabled = true } = handlers;
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const h = ref.current;

      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) h.onGenerate();
        else h.onDraw();
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        h.onArchive();
        return;
      }
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        h.onExportCsv();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        if (window.confirm("Clear pad (cast, markers, prompt)?")) h.onClearPad();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
