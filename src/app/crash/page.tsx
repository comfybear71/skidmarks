"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent } from "react";
import { Btn } from "@/components/ui";
import { CrashDeskToolbar } from "@/components/CrashDeskToolbar";
import { CrashImageGenCard } from "@/components/CrashImageGenCard";
import { CrashLabCollapseBtn } from "@/components/CrashLabCollapseBtn";
import { CrashScriptCard } from "@/components/CrashScriptCard";
import { CrashCharacterCard } from "@/components/CrashCharacterCard";
import { CrashSpxCard } from "@/components/CrashSpxCard";
import { CrashComfyCard } from "@/components/CrashComfyCard";
import { CrashStoryboardCard } from "@/components/CrashStoryboardCard";
import { CursorTourBanner } from "@/components/CursorTourBanner";
import { CursorCastGateModal } from "@/components/CursorCastGateModal";
import { CrashVoiceCard } from "@/components/CrashVoiceCard";
import { CrashSceneKitCard } from "@/components/CrashSceneKitCard";
import { useCrashDeskMode } from "@/hooks/useCrashDeskMode";
import { coldStartEmptyCrashDesk } from "@/lib/crashRestoreDesk";
import { bumpCrashLabZ } from "@/lib/crashLabZ";
import {
  CRASH_MORPH_MIN_H,
  CRASH_MORPH_MIN_W,
  CRASH_PANEL_TITLE_BAR,
  CRASH_PANEL_TITLE_COL,
  CRASH_PANEL_SUBTITLE_COL,
} from "@/lib/crashLabPanel";
import {
  CRASH_STRIP_H,
  forceCrashColdOpenStack,
  px,
  refreshDeskTop,
} from "@/lib/crashDeskLayout";

type Slot = {
  id: string;
  url: string;
};

type MorphResult = {
  runId: string;
  url: string;
  seconds: number;
  frames: number;
};

const TRAY_OPEN_W = 200;
const TRAY_MIN_W = 120;
const TRAY_COLLAPSE_AT = 72;
const MORPH_LAYOUT_VER_KEY = "crashlab-morph-layout-v11";
const CARD_MIN_W = CRASH_MORPH_MIN_W;
const CARD_MIN_H = CRASH_MORPH_MIN_H;
const TOOLS_KEY = "crashlab-morph-tools";

type SavedTools = {
  holdSec?: number;
  easing?: "linear" | "smoothstep" | "cosine";
  colourMatch?: boolean;
  faceAlign?: boolean;
  ghostOn?: boolean;
  ghostAmt?: number;
  toolsOpen?: boolean;
};

function loadTools(): SavedTools {
  try {
    const raw = localStorage.getItem(TOOLS_KEY);
    if (raw) return JSON.parse(raw) as SavedTools;
  } catch {
    /* ignore */
  }
  return {};
}

type CardGeom = { x: number; y: number; w: number; h: number };

/**
 * Crash Lab — Morph v1
 * Tray + result persist on disk. Thin drag handle collapses tray.
 */
export default function CrashLabPage() {
  // Before any child panel reads last GRID/FREE — cold open is STACK.
  forceCrashColdOpenStack();
  // Refresh / cold load: no episode on the desk. He opens one himself.
  coldStartEmptyCrashDesk();

  const { geom, deskReady, collapsed: morphCollapsed, mode: morphMode, togglePanel: toggleMorph, setGeom } =
    useCrashDeskMode("morph");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [busy, setBusy] = useState(false);
  const [morphing, setMorphing] = useState(false);
  const [progress, setProgress] = useState({
    label: "",
    pct: 0,
    step: 0,
    total: 0,
  });
  const [error, setError] = useState("");
  const [result, setResult] = useState<MorphResult | null>(null);
  const [keptPath, setKeptPath] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [trayW, setTrayW] = useState(TRAY_OPEN_W);
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(
    null,
  );
  const [toolsOpen, setToolsOpen] = useState(false);
  const [holdSec, setHoldSec] = useState(0.25);
  const [easing, setEasing] = useState<"linear" | "smoothstep" | "cosine">(
    "smoothstep",
  );
  const [colourMatch, setColourMatch] = useState(true);
  const [faceAlign, setFaceAlign] = useState(false);
  const [ghostOn, setGhostOn] = useState(false);
  const [ghostAmt, setGhostAmt] = useState(0.15);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [cardReady, setCardReady] = useState(true);
  const [morphZ, setMorphZ] = useState(40);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startX: number; startW: number; moved: boolean } | null>(
    null,
  );
  const moveRef = useRef<{
    mode: "move" | "resize";
    edge?: string;
    startX: number;
    startY: number;
    orig: CardGeom;
  } | null>(null);

  const trayOpen = trayW >= TRAY_COLLAPSE_AT;

  useEffect(() => {
    setMorphZ(bumpCrashLabZ());
    setCardReady(true);
    const t = loadTools();
    if (typeof t.holdSec === "number") setHoldSec(t.holdSec);
    if (t.easing) setEasing(t.easing);
    if (typeof t.colourMatch === "boolean") setColourMatch(t.colourMatch);
    if (typeof t.faceAlign === "boolean") setFaceAlign(t.faceAlign);
    if (typeof t.ghostOn === "boolean") setGhostOn(t.ghostOn);
    if (typeof t.ghostAmt === "number") setGhostAmt(t.ghostAmt);
    if (typeof t.toolsOpen === "boolean") setToolsOpen(t.toolsOpen);
  }, []);

  useEffect(() => {
    if (!cardReady) return;
    try {
      localStorage.setItem(
        TOOLS_KEY,
        JSON.stringify({
          holdSec,
          easing,
          colourMatch,
          faceAlign,
          ghostOn,
          ghostAmt,
          toolsOpen,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [
    cardReady,
    holdSec,
    easing,
    colourMatch,
    faceAlign,
    ghostOn,
    ghostAmt,
    toolsOpen,
  ]);

  const applyItems = useCallback((items: { id: string; url: string }[]) => {
    setSlots(items.map((i) => ({ id: i.id, url: i.url })));
  }, []);

  // Restore tray + last morph after refresh
  useEffect(() => {
    (async () => {
      try {
        const [draftRes, lastRes] = await Promise.all([
          fetch("/api/crash/morph/draft"),
          fetch("/api/crash/morph"),
        ]);
        const draft = await draftRes.json();
        if (draftRes.ok && Array.isArray(draft.items)) applyItems(draft.items);
        const lastData = await lastRes.json();
        const last = lastData?.last;
        if (lastRes.ok && last?.runId) {
          setResult({
            runId: last.runId,
            url: `${last.url}${last.url.includes("?") ? "&" : "?"}t=restore`,
            seconds: last.seconds ?? 0,
            frames: last.frames ?? 0,
          });
        }
      } catch {
        /* ignore */
      }
    })();
  }, [applyItems]);

  // Restore tray when Image gen sends plates
  useEffect(() => {
    const onRefresh = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (Array.isArray(detail)) {
        applyItems(detail);
        return;
      }
      void (async () => {
        try {
          const res = await fetch("/api/crash/morph/draft");
          const data = await res.json();
          if (res.ok && Array.isArray(data.items)) applyItems(data.items);
        } catch {
          /* ignore */
        }
      })();
    };
    window.addEventListener("crash-morph-refresh", onRefresh);
    return () => window.removeEventListener("crash-morph-refresh", onRefresh);
  }, [applyItems]);

  // Stop browser opening dropped files in a new tab — but don't steal drops from our cards
  useEffect(() => {
    const block = (e: DragEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("[data-dropzone], [data-morph-drop]")) return;
      e.preventDefault();
    };
    window.addEventListener("dragover", block);
    window.addEventListener("drop", block);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", block);
    };
  }, []);

  // Tray rail + whole-card move/resize
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startX;
        if (Math.abs(dx) > 3) dragRef.current.moved = true;
        const next = dragRef.current.startW + dx;
        if (next < TRAY_COLLAPSE_AT) setTrayW(0);
        else setTrayW(Math.min(320, Math.max(TRAY_MIN_W, next)));
        return;
      }
      if (!moveRef.current) return;
      const { mode, edge, startX, startY, orig } = moveRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (mode === "move") {
        setGeom({
          ...orig,
          x: Math.max(0, orig.x + dx),
          y: Math.max(0, orig.y + dy),
        });
        return;
      }
      let { x, y, w, h } = orig;
      if (edge?.includes("e")) w = Math.max(CARD_MIN_W, orig.w + dx);
      if (edge?.includes("s")) h = Math.max(CARD_MIN_H, orig.h + dy);
      if (edge?.includes("w")) {
        w = Math.max(CARD_MIN_W, orig.w - dx);
        x = orig.x + (orig.w - w);
      }
      if (edge?.includes("n")) {
        h = Math.max(CARD_MIN_H, orig.h - dy);
        y = orig.y + (orig.h - h);
      }
      setGeom({ x: Math.max(0, x), y: Math.max(0, y), w, h });
    };
    const onUp = () => {
      dragRef.current = null;
      moveRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function bringMorphFront() {
    setMorphZ(bumpCrashLabZ());
  }

  function startCardMove(e: ReactMouseEvent) {
    if ((e.target as HTMLElement).closest("button, a, input, video")) return;
    bringMorphFront();
    e.preventDefault();
    moveRef.current = {
      mode: "move",
      startX: e.clientX,
      startY: e.clientY,
      orig: geom,
    };
  }

  function startCardResize(edge: string) {
    return (e: ReactMouseEvent) => {
      bringMorphFront();
      e.preventDefault();
      e.stopPropagation();
      moveRef.current = {
        mode: "resize",
        edge,
        startX: e.clientX,
        startY: e.clientY,
        orig: geom,
      };
    };
  }

  async function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => {
      if (f.type.startsWith("image/")) return true;
      return /\.(png|jpe?g|webp|gif)$/i.test(f.name || "");
    });
    if (!files.length) {
      setError("Need image files (jpg/png/webp).");
      return;
    }

    files.sort((a, b) => {
      const na = a.name.match(/(\d+)/);
      const nb = b.name.match(/(\d+)/);
      if (na && nb) {
        const d = Number(na[1]) - Number(nb[1]);
        if (d !== 0) return d;
      }
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f, f.name || "step.png"));
      const res = await fetch("/api/crash/morph/draft", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      applyItems(data.items || []);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addFromUriList(uriText: string) {
    const urls = uriText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s) || s.startsWith("/"));
    if (!urls.length) return;
    setBusy(true);
    setError("");
    try {
      const buffers: File[] = [];
      for (const u of urls) {
        const abs = u.startsWith("http") ? u : `${window.location.origin}${u}`;
        const res = await fetch(abs);
        if (!res.ok) continue;
        const blob = await res.blob();
        if (!blob.type.startsWith("image/") && blob.size < 100) continue;
        const name =
          u.split("/").pop()?.split("?")[0] || `step_${buffers.length}.png`;
        buffers.push(new File([blob], name, { type: blob.type || "image/png" }));
      }
      if (!buffers.length) throw new Error("No images from that drop");
      await addFiles(buffers);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  function onMorphDrop(e: ReactDragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      void addFiles(e.dataTransfer.files);
      return;
    }
    const uri = e.dataTransfer.getData("text/uri-list");
    if (uri) void addFromUriList(uri);
    else {
      const plain = e.dataTransfer.getData("text/plain");
      if (plain) void addFromUriList(plain);
    }
  }

  async function removeAt(id: string) {
    try {
      const res = await fetch("/api/crash/morph/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remove: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Remove failed");
      applyItems(data.items || []);
    } catch (e) {
      setError(String(e));
    }
  }

  async function move(id: string, dir: -1 | 1) {
    const i = slots.findIndex((s) => s.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= slots.length) return;
    const ids = slots.map((s) => s.id);
    const tmp = ids[i];
    ids[i] = ids[j];
    ids[j] = tmp;
    try {
      const res = await fetch("/api/crash/morph/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reorder failed");
      applyItems(data.items || []);
    } catch (e) {
      setError(String(e));
    }
  }

  async function clearAll() {
    try {
      const res = await fetch("/api/crash/morph/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clear failed");
      applyItems([]);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }

  async function runMorph() {
    if (slots.length < 2) {
      setError("Need at least 2 images.");
      return;
    }
    setBusy(true);
    setMorphing(true);
    setProgress({
      label: `Starting morph (${slots.length} images)…`,
      pct: 0,
      step: 0,
      total: Math.max(slots.length - 1, 1),
    });
    setError("");
    setResult(null);
    setKeptPath("");

    const poll = window.setInterval(async () => {
      try {
        const res = await fetch("/api/crash/morph/progress");
        const data = await res.json();
        if (data?.label) {
          setProgress({
            label: String(data.label),
            pct: Number(data.pct) || 0,
            step: Number(data.step) || 0,
            total: Number(data.total) || 0,
          });
        }
      } catch {
        /* ignore */
      }
    }, 400);

    try {
      const form = new FormData();
      form.set(
        "tools",
        JSON.stringify({
          hold: holdSec,
          easing,
          colourMatch,
          faceAlign,
          ghost: ghostOn ? ghostAmt : 0,
        }),
      );
      if (audioFile) form.set("audio", audioFile);
      const res = await fetch("/api/crash/morph", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Morph failed");
      setResult({
        runId: data.runId,
        url: `${data.url}&t=${Date.now()}`,
        seconds: data.seconds,
        frames: data.frames,
      });
      setProgress({ label: "Done", pct: 100, step: 1, total: 1 });
    } catch (e) {
      setError(String(e));
    } finally {
      window.clearInterval(poll);
      setBusy(false);
      setMorphing(false);
    }
  }

  async function saveKeep() {
    if (!result) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crash/morph/keep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: result.runId, label: "morph" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setKeptPath(data.path || "saved");
      const a = document.createElement("a");
      a.href = result.url;
      a.download = `morph_${result.runId}.mp4`;
      a.click();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function toggleTray() {
    setTrayW((w) => (w >= TRAY_COLLAPSE_AT ? 0 : TRAY_OPEN_W));
  }

  // Cold open STACK already forced above. Episode stays closed until Open.
  useEffect(() => {
    refreshDeskTop();
  }, []);

  return (
    <div className="relative min-h-[70vh]">
      <CrashDeskToolbar />
      <CursorTourBanner />
      <CursorCastGateModal />
      <CrashImageGenCard />
      <CrashScriptCard />
      <CrashCharacterCard />
      <CrashVoiceCard />
      <CrashSceneKitCard />
      <CrashComfyCard />
      <CrashStoryboardCard />
      <CrashSpxCard />
      <div
        className="fixed flex flex-col overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--panel)] shadow-lg"
        style={{
          left: px(geom.x),
          top: px(geom.y),
          width: px(geom.w),
          height: px(morphCollapsed ? CRASH_STRIP_H : geom.h),
          zIndex: morphZ,
        }}
        onMouseDown={bringMorphFront}
      >
        {/* Title bar — drag the whole card */}
        <div
          className={CRASH_PANEL_TITLE_BAR}
          onMouseDown={startCardMove}
        >
          <h2 className={`${CRASH_PANEL_TITLE_COL} text-[var(--chrome)]`}>
            Crash Lab
          </h2>
          <span className={CRASH_PANEL_SUBTITLE_COL}>Morph → mp4</span>
          <CrashLabCollapseBtn
            collapsed={morphCollapsed}
            deskStacked={morphMode === "stack" || morphMode === "free"}
            freeFlow={morphMode === "free"}
            onToggle={toggleMorph}
          />
        </div>

        {!morphCollapsed ? (
        <>
        <div className="crash-panel-body relative min-h-0 flex-1 overflow-auto p-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div className={`flex min-h-[140px] gap-0 ${trayOpen ? "" : "justify-center"}`}>
            {trayOpen ? (
              <div
                className="min-w-0 shrink-0"
                style={{ width: trayW }}
                data-morph-drop
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(false);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={onMorphDrop}
              >
                <div
                  className={`crash-tray-scroll mb-1.5 max-h-[min(280px,40vh)] overflow-y-auto rounded-sm border p-1 ${
                    dragOver
                      ? "border-[var(--acid)] bg-[var(--acid)]/10"
                      : "border-[var(--line)]"
                  }`}
                >
                  {slots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1">
                      {slots.map((s, i) => (
                        <div
                          key={s.id}
                          className="relative overflow-hidden rounded-sm border border-[var(--line)]"
                        >
                          <span className="pointer-events-none absolute left-0 top-0 z-[1] bg-black/75 px-1 text-[10px] leading-tight text-[var(--acid)]">
                            {i + 1}
                          </span>
                          <button
                            type="button"
                            className="block w-full"
                            title="Click to enlarge"
                            onClick={() =>
                              setPreview({
                                src: s.url,
                                title: `Step ${i + 1}`,
                              })
                            }
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={s.url}
                              alt={`Step ${i + 1}`}
                              className="h-[56px] w-full object-cover"
                            />
                          </button>
                          <div className="flex items-center justify-between gap-0.5 bg-[var(--panel-2)] px-0.5 text-[9px] text-[var(--chrome-dim)]">
                            <span>{i + 1}</span>
                            <span className="flex gap-0.5">
                              <button
                                type="button"
                                className="hover:text-[var(--acid)]"
                                onClick={() => void move(s.id, -1)}
                                disabled={i === 0 || busy}
                              >
                                ←
                              </button>
                              <button
                                type="button"
                                className="hover:text-[var(--acid)]"
                                onClick={() => void move(s.id, 1)}
                                disabled={i === slots.length - 1 || busy}
                              >
                                →
                              </button>
                              <button
                                type="button"
                                className="hover:text-[var(--magenta-hot)]"
                                onClick={() => void removeAt(s.id)}
                                disabled={busy}
                              >
                                X
                              </button>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-1 py-6 text-center text-[10px] text-[var(--chrome-dim)]">
                      No images
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Btn
                    tone="accent"
                    className="!px-2 !py-0.5 !text-[11px]"
                    onClick={() => void runMorph()}
                    disabled={busy || slots.length < 2}
                  >
                    {morphing ? "Morphing…" : busy ? "Working…" : "Morph"}
                  </Btn>
                  {slots.length > 0 ? (
                    <Btn
                      tone="ghost"
                      className="!px-2 !py-0.5 !text-[11px]"
                      onClick={() => void clearAll()}
                      disabled={busy}
                    >
                      Clear
                    </Btn>
                  ) : null}
                  <button
                    type="button"
                    style={{ fontSize: 9, lineHeight: 1 }}
                    className={`ml-auto max-w-[45%] truncate text-right ${
                      dragOver
                        ? "text-[var(--acid)]"
                        : "text-[var(--chrome-dim)] hover:text-[var(--chrome)]"
                    }`}
                    onClick={() => inputRef.current?.click()}
                    title="Click or drop to add images"
                  >
                    {busy
                      ? "Working…"
                      : slots.length === 0
                        ? "Add / drop images"
                        : `${slots.length} images`}
                  </button>
                </div>

                <div className="mt-1.5 rounded-sm border border-[var(--line)]">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-1.5 py-1 text-left text-[10px] text-[var(--chrome-dim)] hover:text-[var(--chrome)]"
                    onClick={() => setToolsOpen((o) => !o)}
                  >
                    <span>
                      {toolsOpen ? "+" : "-"} Tools
                      <span className="ml-1 text-[var(--mute)]">
                        hold · ease · colour
                      </span>
                    </span>
                  </button>
                  {toolsOpen ? (
                    <div className="space-y-1.5 border-t border-[var(--line)] px-1.5 py-1.5 text-[10px] text-[var(--chrome)]">
                      <label className="flex items-center justify-between gap-2">
                        <span>Hold (sec)</span>
                        <input
                          type="number"
                          min={0}
                          max={3}
                          step={0.05}
                          value={holdSec}
                          disabled={busy}
                          onChange={(e) =>
                            setHoldSec(Math.max(0, Number(e.target.value) || 0))
                          }
                          className="w-14 rounded-sm border border-[var(--line)] bg-[var(--panel-2)] px-1 py-0.5 text-[10px]"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-2">
                        <span>Easing</span>
                        <select
                          value={easing}
                          disabled={busy}
                          onChange={(e) =>
                            setEasing(
                              e.target.value as
                                | "linear"
                                | "smoothstep"
                                | "cosine",
                            )
                          }
                          className="rounded-sm border border-[var(--line)] bg-[var(--panel-2)] px-1 py-0.5 text-[10px]"
                        >
                          <option value="smoothstep">Smooth</option>
                          <option value="cosine">Cosine</option>
                          <option value="linear">Linear</option>
                        </select>
                      </label>
                      <label className="flex items-center justify-between gap-2">
                        <span>Colour match</span>
                        <input
                          type="checkbox"
                          checked={colourMatch}
                          disabled={busy}
                          onChange={(e) => setColourMatch(e.target.checked)}
                        />
                      </label>
                      <label className="flex items-center justify-between gap-2">
                        <span>Face align</span>
                        <input
                          type="checkbox"
                          checked={faceAlign}
                          disabled={busy}
                          onChange={(e) => setFaceAlign(e.target.checked)}
                          title="May fight stylised plates — try if jittery"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-2">
                        <span>Ghost trail</span>
                        <input
                          type="checkbox"
                          checked={ghostOn}
                          disabled={busy}
                          onChange={(e) => setGhostOn(e.target.checked)}
                        />
                      </label>
                      {ghostOn ? (
                        <label className="flex items-center justify-between gap-2">
                          <span>Ghost amt</span>
                          <input
                            type="range"
                            min={0.05}
                            max={0.4}
                            step={0.05}
                            value={ghostAmt}
                            disabled={busy}
                            onChange={(e) =>
                              setGhostAmt(Number(e.target.value))
                            }
                            className="w-24"
                          />
                        </label>
                      ) : null}
                      <div className="flex items-center justify-between gap-2">
                        <span>Audio</span>
                        <button
                          type="button"
                          className="truncate text-[10px] text-[var(--magenta-hot)] hover:underline disabled:opacity-40"
                          disabled={busy}
                          onClick={() => audioInputRef.current?.click()}
                        >
                          {audioFile ? audioFile.name.slice(0, 18) : "Add mp3…"}
                        </button>
                      </div>
                      {audioFile ? (
                        <button
                          type="button"
                          className="text-[9px] text-[var(--mute)] hover:text-[var(--fail)]"
                          onClick={() => setAudioFile(null)}
                        >
                          Clear audio
                        </button>
                      ) : null}
                      <input
                        ref={audioInputRef}
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a"
                        className="hidden"
                        onChange={(e) => {
                          setAudioFile(e.target.files?.[0] || null);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div
              role="separator"
              aria-orientation="vertical"
              title={trayOpen ? "Drag left to close · click to toggle" : "Click or drag to open"}
              className={`flex w-1.5 shrink-0 cursor-col-resize items-center justify-center hover:bg-[var(--line)]/50 ${
                trayOpen ? "mx-0.5" : "absolute left-0 top-8 bottom-0 z-10"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dragRef.current = {
                  startX: e.clientX,
                  startW: trayOpen ? trayW : 0,
                  moved: false,
                };
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (dragRef.current?.moved) return;
                toggleTray();
              }}
            >
              <span className="h-10 w-px bg-[var(--line)]" />
            </div>

            <div
              className={`min-w-0 overflow-auto ${
                trayOpen ? "flex-1" : "flex w-full flex-col items-center"
              }`}
            >
              {morphing ? (
                <div className="mb-1.5 rounded-sm border border-[var(--acid)] bg-[var(--panel-2)] p-2">
                  <p className="text-[11px] text-[var(--acid)]">
                    {progress.label || "Morphing…"}
                  </p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-sm bg-[var(--void)]">
                    <div
                      className="h-full bg-[var(--acid)] transition-[width] duration-300"
                      style={{ width: `${Math.min(100, Math.max(2, progress.pct))}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {error ? (
                <p className="mb-1 text-[11px] text-[var(--magenta-hot)]">{error}</p>
              ) : null}

              {result ? (
                <div className={`space-y-1 ${trayOpen ? "" : "flex flex-col items-center"}`}>
                  <p className="text-[9px] text-[var(--chrome-dim)]">
                    {result.frames} frames · ~{result.seconds}s
                    {keptPath ? ` · saved` : ""}
                  </p>
                  <video
                    key={result.url}
                    src={result.url}
                    controls
                    className="block h-auto max-h-[min(280px,50%)] w-auto max-w-full object-contain rounded-sm border border-[var(--line)] bg-black"
                  />
                  <div
                    className={`flex w-full flex-wrap items-center gap-1.5 ${
                      trayOpen ? "justify-end" : "justify-center"
                    }`}
                  >
                    <Btn
                      tone="ok"
                      className="!px-2 !py-0.5 !text-[11px]"
                      onClick={() => void saveKeep()}
                      disabled={busy}
                    >
                      Save mp4
                    </Btn>
                  </div>
                  {keptPath ? (
                    <p className="break-all text-[9px] text-[var(--acid-deep)]">{keptPath}</p>
                  ) : null}
                </div>
              ) : !morphing ? (
                <div className="flex h-[100px] max-w-[140px] items-center justify-center rounded-sm border border-dashed border-[var(--line)] text-[10px] text-[var(--chrome-dim)]">
                  Result
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Resize grips */}
        <div
          className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize"
          onMouseDown={startCardResize("se")}
        />
        <div
          className="absolute bottom-0 left-0 h-3 w-3 cursor-sw-resize"
          onMouseDown={startCardResize("sw")}
        />
        <div
          className="absolute top-0 right-0 h-3 w-3 cursor-ne-resize"
          onMouseDown={startCardResize("ne")}
        />
        <div
          className="absolute top-0 left-0 h-3 w-3 cursor-nw-resize"
          onMouseDown={startCardResize("nw")}
        />
        <div
          className="absolute bottom-0 left-3 right-3 h-1.5 cursor-s-resize"
          onMouseDown={startCardResize("s")}
        />
        <div
          className="absolute top-0 left-3 right-3 h-1.5 cursor-n-resize"
          onMouseDown={startCardResize("n")}
        />
        <div
          className="absolute bottom-3 top-3 left-0 w-1.5 cursor-w-resize"
          onMouseDown={startCardResize("w")}
        />
        <div
          className="absolute bottom-3 top-3 right-0 w-1.5 cursor-e-resize"
          onMouseDown={startCardResize("e")}
        />
        </>
        ) : null}
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
