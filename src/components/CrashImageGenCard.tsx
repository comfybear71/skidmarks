"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import { Btn } from "@/components/ui";
import { CrashLabCollapseBtn } from "@/components/CrashLabCollapseBtn";
import { CrashStyleVuMeter } from "@/components/CrashStyleVuMeter";
import { bumpCrashLabZ } from "@/lib/crashLabZ";
import {
  CRASH_GEN_MIN_H,
  CRASH_GEN_MIN_W,
  CRASH_PANEL_SUBTITLE_COL,
  CRASH_PANEL_TITLE_BAR,
  CRASH_PANEL_TITLE_COL,
} from "@/lib/crashLabPanel";
import { crashGenExamplePrompt, crashGenStylePickPrompt, pickStyleIdeaPrompt } from "@/lib/crashGenExamples";
import { requestAssist } from "@/lib/mobileAssistClient";
import { useCrashDeskMode } from "@/hooks/useCrashDeskMode";
import { usePanelPointerDrag } from "@/hooks/usePanelPointerDrag";
import {
  CRASH_STRIP_H,
  openCrashDeskGrid,
  px,
  readCrashDeskMode,
  writeCrashDeskMode,
  writeStackFocusPanel,
} from "@/lib/crashDeskLayout";
import { writePlateDrag } from "@/lib/crashPlateDrag";
import { PLATE_FACES_PER_PASS } from "@/lib/plateConstants";
import {
  animateStyleSync,
  CRASH_GEN_PLATE_SAVED,
  CRASH_NEW_STYLE_CHARACTER_EVENT,
  CRASH_NEW_STYLE_PLACE_EVENT,
  CRASH_SHOW_STYLE_CLEAR_EVENT,
  CRASH_SHOW_STYLE_EVENT,
  CRASH_STYLE_THUMB_SAVED,
  CRASH_WORLD_THUMB_SAVED,
  parseNewStyleCharacterDetail,
  parseNewStylePlaceDetail,
  parseStyleEventDetail,
} from "@/lib/crashStyleSync";
import {
  CRASH_CURSOR_IMAGE_GATE_EVENT,
  dispatchCursorImageGateDone,
  isCursorImageGateArmed,
  openCharacterSession,
  readCursorSmokeSession,
  resolveMainFromLookLine,
  type CursorImageGateDetail,
} from "@/lib/crashCursorSmoke";
import { isGenericCastName, readScriptDeskCharacterDraft } from "@/lib/crashScriptFields";
import {
  DEFAULT_SHOW_STYLE,
  getShowStylePreset,
  loadGenRealism,
  loadShowStyleIdOptional,
  saveGenRealism,
  type ShowStyleId,
} from "@/lib/showStylePresets";
import type { Character, Location } from "@/lib/types";
import { styleRealismLabel } from "@/lib/types";

const LAYOUT_VER_KEY = "crashlab-gen-layout-v11";
const CARD_MIN_W = CRASH_GEN_MIN_W;
const CARD_MIN_H = CRASH_GEN_MIN_H;
const DRAWER_W = 200;

type PlateThumb = { id: string; fileName: string; url: string };
type SmokeTake = { fileName: string; url: string };
const CURSOR_SMOKE_MAX_TAKES = 5;
type CastSlot = { id: string; file: File; url: string; name?: string };
type DrawerTab = "places" | "cast";

type LocPick = {
  key: string;
  name: string;
  locName: string;
  url: string;
};

type CharPick = {
  key: string;
  name: string;
  url: string;
  source: string;
};

type PresetSlotPick = {
  id: string;
  name: string;
  hint: string;
  hasImage: boolean;
  url: string | null;
};

async function urlToFile(src: string, baseName: string): Promise<File> {
  const res = await fetch(src);
  if (!res.ok) throw new Error("Could not load image");
  const blob = await res.blob();
  const mime = blob.type || "image/png";
  const ext = mime.includes("jpeg")
    ? ".jpg"
    : mime.includes("webp")
      ? ".webp"
      : ".png";
  const safe = baseName.replace(/[^\w.-]+/g, "_").slice(0, 40) || "still";
  return new File([blob], `${safe}${ext}`, { type: mime });
}

/**
 * Crash Lab — Skidmarks still generator.
 * Lock a BG → drop character stills → auto-plate each → thumbs under BG.
 */
export function CrashImageGenCard() {
  const { geom, deskReady, collapsed, mode, togglePanel, setGeom, hideOnNarrowStack } =
    useCrashDeskMode("imageGen", { minW: CARD_MIN_W, minH: CARD_MIN_H });
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [plating, setPlating] = useState(false);
  const [plateProgress, setPlateProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [url, setUrl] = useState("");
  const [lockedBg, setLockedBg] = useState<{
    fileName: string;
    url: string;
    placeName?: string;
  } | null>(null);
  const [plates, setPlates] = useState<PlateThumb[]>([]);
  const [castTray, setCastTray] = useState<CastSlot[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [charUrl, setCharUrl] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("places");
  const [attachMsg, setAttachMsg] = useState("");
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(
    null,
  );
  const [cardReady, setCardReady] = useState(false);
  const [showStyleId, setShowStyleId] = useState<ShowStyleId | null>(null);
  const [styleRealism, setStyleRealism] = useState(60);
  const [presetCast, setPresetCast] = useState<PresetSlotPick[]>([]);
  const [presetPlaces, setPresetPlaces] = useState<PresetSlotPick[]>([]);
  const [styleSyncLevel, setStyleSyncLevel] = useState(0);
  const [styleSyncLabel, setStyleSyncLabel] = useState("");
  const [styleSyncActive, setStyleSyncActive] = useState(false);
  const [worldGenMode, setWorldGenMode] = useState(false);
  /** CURSOR smoke — Approve/Reject/Alter instead of Add to cast. */
  const [cursorImageGate, setCursorImageGate] =
    useState<CursorImageGateDetail | null>(null);
  /** CURSOR smoke face takes — Generate again up to 5, then Approve one. */
  const [smokeTakes, setSmokeTakes] = useState<SmokeTake[]>([]);
  const worldPlaceTypeRef = useRef("natural_wild");
  const smokeTakesRef = useRef(smokeTakes);
  smokeTakesRef.current = smokeTakes;
  const [z, setZ] = useState(40);
  const dropInputRef = useRef<HTMLInputElement>(null);
  const lockedBgRef = useRef(lockedBg);
  const fileNameRef = useRef(fileName);
  const styleSyncAbortRef = useRef<AbortController | null>(null);
  const lastStylePromptRef = useRef("");
  const genScreenKindRef = useRef<"character" | "world" | null>(null);

  useEffect(() => {
    const style = loadShowStyleIdOptional();
    if (style) {
      const preset = getShowStylePreset(style);
      const idea = crashGenStylePickPrompt(style);
      setShowStyleId(style);
      setStyleRealism(preset.defaultRealism);
      setPrompt(idea);
      lastStylePromptRef.current = idea;
    } else {
      setShowStyleId(null);
      setStyleRealism(loadGenRealism(60));
    }
    setZ(bumpCrashLabZ());
    setCardReady(true);
    void (async () => {
      try {
        const [locRes, charRes] = await Promise.all([
          fetch("/api/locations"),
          fetch("/api/characters"),
        ]);
        const locData = await locRes.json();
        const charData = await charRes.json();
        if (locRes.ok && Array.isArray(locData.locations)) {
          setLocations(locData.locations as Location[]);
        }
        if (charRes.ok && Array.isArray(charData.characters)) {
          setCharacters(charData.characters as Character[]);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    lockedBgRef.current = lockedBg;
  }, [lockedBg]);

  useEffect(() => {
    fileNameRef.current = fileName;
  }, [fileName]);

  const applyStyleToGen = useCallback((id: ShowStyleId) => {
    const preset = getShowStylePreset(id);
    const realism = preset.defaultRealism;
    const idea = pickStyleIdeaPrompt(id, lastStylePromptRef.current);
    lastStylePromptRef.current = idea;
    setShowStyleId(id);
    setStyleRealism(realism);
    saveGenRealism(realism);
    setPrompt(idea);
    setAttachMsg(`${preset.label} — new Idea loaded`);
    setError("");
  }, []);

  function pushSmokeTake(nextFile: string, nextUrl: string) {
    setSmokeTakes((prev) => {
      if (prev.some((t) => t.fileName === nextFile)) return prev;
      if (prev.length >= CURSOR_SMOKE_MAX_TAKES) {
        setAttachMsg(
          `Already ${CURSOR_SMOKE_MAX_TAKES} takes — pick one and Approve`,
        );
        return prev;
      }
      const next = [...prev, { fileName: nextFile, url: nextUrl }];
      setAttachMsg(
        `Take ${next.length}/${CURSOR_SMOKE_MAX_TAKES} — Generate more, or Approve this one`,
      );
      return next;
    });
  }

  const loadNewStyleCharacter = useCallback((id: ShowStyleId, idea: string) => {
    const preset = getShowStylePreset(id);
    const promptText = idea.trim();
    if (!promptText) return;
    // Wipe Idea leftovers (Jum etc.) so CURSOR only shows the approved arsehole.
    lastStylePromptRef.current = promptText;
    setShowStyleId(id);
    setStyleRealism(preset.defaultRealism);
    saveGenRealism(preset.defaultRealism);
    setPrompt(promptText);
    setLockedBg(null);
    setPlates([]);
    setCastTray((list) => {
      for (const s of list) URL.revokeObjectURL(s.url);
      return [];
    });
    setDragOver(false);
    setFileName("");
    setUrl("");
    if (isCursorImageGateArmed()) {
      setSmokeTakes([]);
      setAttachMsg(
        `${preset.label} — CURSOR smoke: Generate up to ${CURSOR_SMOKE_MAX_TAKES}, then Approve`,
      );
    } else {
      setAttachMsg(
        `${preset.label} — from Script desk. Generate → Reject or Add to cast.`,
      );
    }
    setError("");
    setZ(bumpCrashLabZ());
  }, []);

  const scriptDeskGenerateRef = useRef<
    (id: ShowStyleId, promptText: string) => Promise<void>
  >(async () => {});

  scriptDeskGenerateRef.current = async (id: ShowStyleId, promptText: string) => {
    setWorldGenMode(false);
    const preset = getShowStylePreset(id);
    // CURSOR smoke: STACK + Image Gen only. Never Script desk / grid explode.
    if (cursorImageGate || isCursorImageGateArmed()) {
      if (readCrashDeskMode() !== "stack") writeCrashDeskMode("stack");
      writeStackFocusPanel("imageGen");
    } else {
      openCrashDeskGrid();
    }
    setZ(bumpCrashLabZ());
    loadNewStyleCharacter(id, promptText);

    styleSyncAbortRef.current?.abort();
    const ac = new AbortController();
    styleSyncAbortRef.current = ac;
    setStyleSyncLabel(preset.label);
    setStyleSyncActive(true);
    setStyleSyncLevel(0);

    try {
      await animateStyleSync(setStyleSyncLevel, ac.signal);
      if (!promptText.trim()) return;
      setBusy(true);
      setError("");
      setAttachMsg("");
      const res = await fetch("/api/crash/gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText.trim(),
          aspectRatio: "16:9",
          styleId: id,
          styleRealism: preset.defaultRealism,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generate failed");
      genScreenKindRef.current = "character";
      const nextUrl = `${data.url}&t=${Date.now()}`;
      setFileName(data.fileName);
      setUrl(nextUrl);
      if (isCursorImageGateArmed() || cursorImageGate) {
        pushSmokeTake(data.fileName, nextUrl);
      } else {
        setAttachMsg("Generated — Reject or Add to cast");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(String(e));
    } finally {
      setBusy(false);
      if (styleSyncAbortRef.current === ac) {
        setStyleSyncActive(false);
        setStyleSyncLevel(0);
        styleSyncAbortRef.current = null;
      }
    }
  };

  const scriptDeskGeneratePlaceRef = useRef<
    (id: ShowStyleId, promptText: string, placeType: string) => Promise<void>
  >(async () => {});

  scriptDeskGeneratePlaceRef.current = async (
    id: ShowStyleId,
    promptText: string,
    placeType: string,
  ) => {
    setWorldGenMode(true);
    worldPlaceTypeRef.current = placeType;
    const preset = getShowStylePreset(id);
    openCrashDeskGrid();
    setZ(bumpCrashLabZ());
    setShowStyleId(id);
    setStyleRealism(preset.defaultRealism);
    setPrompt(promptText);
    setFileName("");
    setUrl("");
    setPlates([]);
    setAttachMsg(`${preset.label} place — from Script desk World step.`);

    styleSyncAbortRef.current?.abort();
    const ac = new AbortController();
    styleSyncAbortRef.current = ac;
    setStyleSyncLabel(`${preset.label} · place`);
    setStyleSyncActive(true);
    setStyleSyncLevel(0);

    try {
      await animateStyleSync(setStyleSyncLevel, ac.signal);
      if (!promptText.trim()) return;
      setBusy(true);
      setError("");
      const res = await fetch("/api/crash/gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText.trim(),
          aspectRatio: "16:9",
          styleId: id,
          styleRealism: preset.defaultRealism,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generate failed");
      genScreenKindRef.current = "world";
      setFileName(data.fileName);
      setUrl(`${data.url}&t=${Date.now()}`);
      setAttachMsg("Generated — Reject or Add to World");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(String(e));
    } finally {
      setBusy(false);
      if (styleSyncAbortRef.current === ac) {
        setStyleSyncActive(false);
        setStyleSyncLevel(0);
        styleSyncAbortRef.current = null;
      }
    }
  };

  const runStyleSync = useCallback(
    async (id: ShowStyleId) => {
      applyStyleToGen(id);

      styleSyncAbortRef.current?.abort();
      const ac = new AbortController();
      styleSyncAbortRef.current = ac;

      const preset = getShowStylePreset(id);
      setStyleSyncLabel(preset.label);
      setStyleSyncActive(true);
      setStyleSyncLevel(0);
      // Don't bump z — stealing front covers Script desk and eats Style clicks.

      try {
        await animateStyleSync(setStyleSyncLevel, ac.signal);
      } catch {
        /* aborted — style already applied above */
      } finally {
        if (styleSyncAbortRef.current === ac) {
          setStyleSyncActive(false);
          setStyleSyncLevel(0);
          styleSyncAbortRef.current = null;
        }
      }
    },
    [applyStyleToGen],
  );

  useEffect(() => {
    const onStyle = (e: Event) => {
      const id = parseStyleEventDetail((e as CustomEvent).detail);
      if (!id) return;
      void runStyleSync(id);
    };
    const onClear = () => {
      styleSyncAbortRef.current?.abort();
      setStyleSyncActive(false);
      setStyleSyncLevel(0);
      setShowStyleId(null);
      setAttachMsg("Style cleared — pick a show in Script desk");
      setError("");
    };
    window.addEventListener(CRASH_SHOW_STYLE_EVENT, onStyle);
    window.addEventListener(CRASH_SHOW_STYLE_CLEAR_EVENT, onClear);
    const onNewCharacter = (e: Event) => {
      const detail = parseNewStyleCharacterDetail((e as CustomEvent).detail);
      if (!detail) return;
      if (detail.generate) {
        void scriptDeskGenerateRef.current(detail.id, detail.prompt);
        return;
      }
      openCrashDeskGrid();
      loadNewStyleCharacter(detail.id, detail.prompt);
    };
    window.addEventListener(CRASH_NEW_STYLE_CHARACTER_EVENT, onNewCharacter);
    const onNewPlace = (e: Event) => {
      const detail = parseNewStylePlaceDetail((e as CustomEvent).detail);
      if (!detail) return;
      if (detail.generate) {
        void scriptDeskGeneratePlaceRef.current(
          detail.id,
          detail.prompt,
          detail.placeType,
        );
        return;
      }
      openCrashDeskGrid();
      setWorldGenMode(true);
      worldPlaceTypeRef.current = detail.placeType;
      setShowStyleId(detail.id);
      setPrompt(detail.prompt);
    };
    window.addEventListener(CRASH_NEW_STYLE_PLACE_EVENT, onNewPlace);
    const onCursorImageGate = (e: Event) => {
      const d = (e as CustomEvent<CursorImageGateDetail>).detail;
      if (!d?.mainName) return;
      setCursorImageGate(d);
      setSmokeTakes([]);
      setAttachMsg(
        `CURSOR smoke — ${d.mainName}: Generate up to ${CURSOR_SMOKE_MAX_TAKES} → pick one → Approve`,
      );
    };
    window.addEventListener(CRASH_CURSOR_IMAGE_GATE_EVENT, onCursorImageGate);
    return () => {
      window.removeEventListener(CRASH_SHOW_STYLE_EVENT, onStyle);
      window.removeEventListener(CRASH_SHOW_STYLE_CLEAR_EVENT, onClear);
      window.removeEventListener(CRASH_NEW_STYLE_CHARACTER_EVENT, onNewCharacter);
      window.removeEventListener(CRASH_NEW_STYLE_PLACE_EVENT, onNewPlace);
      window.removeEventListener(CRASH_CURSOR_IMAGE_GATE_EVENT, onCursorImageGate);
      styleSyncAbortRef.current?.abort();
    };
  }, [runStyleSync, loadNewStyleCharacter]);

  useEffect(() => {
    if (!cardReady) return;
    saveGenRealism(styleRealism);
  }, [styleRealism, cardReady]);

  useEffect(() => {
    let cancelled = false;
    const styleKey = showStyleId ?? DEFAULT_SHOW_STYLE;
    void (async () => {
      try {
        const res = await fetch(
          `/api/crash/placeholders?styleId=${encodeURIComponent(styleKey)}`,
        );
        const data = await res.json();
        if (cancelled || !res.ok) return;
        setPresetCast(Array.isArray(data.cast) ? data.cast : []);
        setPresetPlaces(Array.isArray(data.places) ? data.places : []);
      } catch {
        if (!cancelled) {
          setPresetCast([]);
          setPresetPlaces([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showStyleId]);

  const stylePreset = showStyleId ? getShowStylePreset(showStyleId) : null;
  const activeStyleId = showStyleId ?? DEFAULT_SHOW_STYLE;
  const hasStockStill = Boolean(!lockedBg && fileName && url);

  function fillExamplePrompt() {
    // CURSOR smoke: don't pull random Jum — keep the Approved arsehole.
    if (cursorImageGate?.mainName) {
      const sess = readCursorSmokeSession();
      const resolved = resolveMainFromLookLine(
        cursorImageGate.mainName,
        sess?.notes,
        cursorImageGate.castNames,
      );
      const look = getShowStylePreset(activeStyleId).lookPrompt;
      const idea = resolved.notes
        ? `${resolved.mainName}, portrait, ${look}. ${resolved.notes}`
        : `${resolved.mainName}, portrait, ${look}`;
      lastStylePromptRef.current = idea;
      setPrompt(idea);
      setAttachMsg(`Idea locked to ${resolved.mainName}`);
      setError("");
      return;
    }
    const idea = showStyleId
      ? pickStyleIdeaPrompt(showStyleId, prompt)
      : crashGenExamplePrompt(activeStyleId, styleRealism, {
          lockedBg: Boolean(lockedBg),
          hasStock: Boolean(fileName && !lockedBg),
        });
    if (showStyleId) lastStylePromptRef.current = idea;
    setPrompt(idea);
    setAttachMsg("Idea filled — edit it, then Generate or Tweak");
    setError("");
  }

  async function draftPromptWithAi() {
    setAiBusy(true);
    setError("");
    try {
      const next = await requestAssist({
        kind: "image_prompt",
        text: prompt,
        styleId: activeStyleId,
      });
      setPrompt(next);
      setAttachMsg("AI drafted — edit it, then Generate or Tweak");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI assist failed");
    } finally {
      setAiBusy(false);
    }
  }

  function pullNewCharacterFromScriptDesk() {
    const draft = readScriptDeskCharacterDraft();
    if (!draft.styleId) {
      setError("Pick a show style in Script desk first.");
      return;
    }
    if (draft.styleCastKeys.length > 0) {
      setError(
        "Script desk — clear episode cast or go back to Characters to add a new face.",
      );
      return;
    }
    if (!draft.prompt) {
      setError("Script desk — spin an Idea in Develop character first.");
      return;
    }
    openCrashDeskGrid();
    loadNewStyleCharacter(draft.styleId, draft.prompt);
  }

  const bringFront = useCallback(() => {
    setZ(bumpCrashLabZ());
  }, []);

  const { startMove, startResize } = usePanelPointerDrag({
    geom,
    setGeom,
    minW: CARD_MIN_W,
    minH: CARD_MIN_H,
    bringFront,
    ignoreSelector: "button, a, input, textarea, select, img, [data-dropzone]",
  });

  function pushPlate(p: PlateThumb) {
    setPlates((list) => [...list, p]);
  }

  async function runGenerate(
    promptText: string,
    styleId: ShowStyleId,
    realism: number,
    skipConfirm = false,
  ) {
    if (!promptText.trim()) {
      setError("Write a prompt.");
      return;
    }
    if (
      !skipConfirm &&
      (lockedBg || plates.length) &&
      !window.confirm(
        "Generate makes a fresh picture from your prompt — it does not tweak what's on screen.\n\nYour saved style thumbs stay. Continue?",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setAttachMsg("");
    try {
      const res = await fetch("/api/crash/gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText.trim(),
          aspectRatio: "16:9",
          styleId,
          styleRealism: realism,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generate failed");
      genScreenKindRef.current = worldGenMode ? "world" : "character";
      const nextUrl = `${data.url}&t=${Date.now()}`;
      setFileName(data.fileName);
      setUrl(nextUrl);
      if (
        !worldGenMode &&
        (cursorImageGate || isCursorImageGateArmed())
      ) {
        pushSmokeTake(data.fileName, nextUrl);
      } else {
        setAttachMsg(
          worldGenMode
            ? "Generated — Reject or Add to World"
            : "Generated — Reject or Add to cast",
        );
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    const smoke =
      Boolean(cursorImageGate) || isCursorImageGateArmed();
    if (smoke && smokeTakesRef.current.length >= CURSOR_SMOKE_MAX_TAKES) {
      setError(`Max ${CURSOR_SMOKE_MAX_TAKES} takes — Approve one`);
      return;
    }
    await runGenerate(prompt, activeStyleId, styleRealism, smoke);
  }

  /** Put a ladder thumb back on screen for Tweak. */
  function useAsStock(p: PlateThumb) {
    if (lockedBg) return;
    setFileName(p.fileName);
    setUrl(p.url);
    setError("");
    setAttachMsg(`Back on screen (thumb) — Tweak character uses this one now`);
  }

  /** Same stock person — change expression, clothes, hat, fatter… */
  async function tweakFromStock() {
    if (!fileName || !url) {
      setError("Drop or Generate a stock still first.");
      return;
    }
    if (!prompt.trim()) {
      setError("Say what to change — worried face, red hat, fatter…");
      return;
    }
    setBusy(true);
    setError("");
    setAttachMsg("");
    try {
      const stock: PlateThumb = {
        id: fileName,
        fileName,
        url,
      };
      const res = await fetch("/api/crash/gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          refName: fileName,
          styleId: activeStyleId,
          styleRealism,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tweak failed");
      const next: PlateThumb = {
        id: data.id || data.fileName,
        fileName: data.fileName,
        url: `${data.url}&t=${Date.now()}`,
      };
      setPlates((list) => {
        const hasStock = list.some((p) => p.fileName === stock.fileName);
        const base = hasStock ? list : [...list, stock];
        return [...base, next];
      });
      setFileName(next.fileName);
      setUrl(next.url);
      setAttachMsg("Tweaked — ladder in thumbs. Tweak again or Send to Morph");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function lockBg() {
    if (!fileName || !url) {
      setError("Drop or generate a background first.");
      return;
    }
    setLockedBg({ fileName, url });
    setError("");
    setAttachMsg("BG locked — drop Kim (or any still) on it");
  }

  function clearCastTray() {
    setCastTray((list) => {
      for (const s of list) URL.revokeObjectURL(s.url);
      return [];
    });
  }

  function unlockBg() {
    setLockedBg(null);
    setDragOver(false);
    clearCastTray();
    setAttachMsg("");
  }

  function clearAll() {
    setLockedBg(null);
    setPlates([]);
    clearCastTray();
    setDragOver(false);
    setFileName("");
    setUrl("");
    setAttachMsg("");
    setError("");
  }

  function removePlate(id: string) {
    setPlates((list) => list.filter((p) => p.id !== id));
  }

  function downloadOne(p: PlateThumb) {
    const a = document.createElement("a");
    a.href = p.url;
    a.download = p.fileName;
    a.click();
  }

  /** Staggered — browsers block rapid multi-downloads. */
  async function downloadAll() {
    for (let i = 0; i < plates.length; i++) {
      downloadOne(plates[i]);
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  async function saveDownload() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "crash_gen.png";
    a.click();
  }

  function rejectStock() {
    setWorldGenMode(false);
    setError("");
    // CURSOR smoke: Reject = drop this take (keep tray). Cancel ends the gate.
    if (cursorImageGate || isCursorImageGateArmed()) {
      const cur = fileName;
      setSmokeTakes((prev) => {
        const next = prev.filter((t) => t.fileName !== cur);
        if (next.length) {
          const pick = next[next.length - 1];
          setFileName(pick.fileName);
          setUrl(pick.url);
          setAttachMsg(
            `Rejected take — ${next.length}/${CURSOR_SMOKE_MAX_TAKES} left. Generate more or Approve`,
          );
        } else {
          setFileName("");
          setUrl("");
          setAttachMsg(
            `No takes left — Generate again (up to ${CURSOR_SMOKE_MAX_TAKES}), or Cancel`,
          );
        }
        return next;
      });
      return;
    }
    setFileName("");
    setUrl("");
    setPlates([]);
    setAttachMsg("Rejected — hit Idea or edit prompt, then Generate again");
  }

  function cancelCursorImageGate() {
    setSmokeTakes([]);
    setFileName("");
    setUrl("");
    setCursorImageGate(null);
    setAttachMsg("CURSOR Image Gen cancelled");
    setError("");
    dispatchCursorImageGateDone({ ok: false });
  }

  function alterCursorImage() {
    setAttachMsg(
      `Alter — edit the prompt, Generate again (up to ${CURSOR_SMOKE_MAX_TAKES}), then Approve`,
    );
    setError("");
  }

  function selectSmokeTake(t: SmokeTake) {
    setFileName(t.fileName);
    setUrl(t.url);
    setAttachMsg(
      `Selected take — Approve, or Generate more (${smokeTakes.length}/${CURSOR_SMOKE_MAX_TAKES})`,
    );
    setError("");
  }

  async function addToStyleCast() {
    const styleId = showStyleId ?? loadShowStyleIdOptional();
    if (!fileName || !styleId) {
      setError(
        cursorImageGate
          ? "Generate a face first, then Approve."
          : "Generate a face first, then Add to Skidmarks.",
      );
      return;
    }
    if (worldGenMode || genScreenKindRef.current === "world") {
      setError(
        "That's a place on screen — hit Add to World, not Add to cast.",
      );
      return;
    }
    const p = prompt.trim().toLowerCase();
    if (
      p.includes("empty location") ||
      p.includes("no people") ||
      p.includes("photoreal empty")
    ) {
      setError(
        "Prompt is a location — spin a face Idea on Characters, Generate, then Add to cast.",
      );
      return;
    }
    setWorldGenMode(false);
    setBusy(true);
    setError("");
    const smokeMode = Boolean(cursorImageGate);
    try {
      const fromPrompt = prompt
        .split(/[,—–\-]/)[0]
        ?.trim()
        .replace(/^(portrait|a |an )/i, "")
        .trim();
      const sess = readCursorSmokeSession();
      const resolved = resolveMainFromLookLine(
        fromPrompt ||
          cursorImageGate?.mainName ||
          sess?.mainName ||
          "",
        sess?.notes || prompt.trim(),
        cursorImageGate?.castNames || sess?.castNames || [],
      );
      const namePrompt = resolved.notes
        ? `${resolved.mainName}, portrait. ${resolved.notes}`
        : `${resolved.mainName}, portrait`;

      const takeFiles = smokeMode
        ? smokeTakesRef.current.map((t) => t.fileName)
        : [];
      if (fileName && !takeFiles.includes(fileName)) {
        takeFiles.push(fileName);
      }
      if (!takeFiles.length && fileName) takeFiles.push(fileName);

      let approvedKey = "";
      let lastKey = "";
      let saved = 0;
      for (const genFile of takeFiles) {
        const res = await fetch("/api/crash/style-cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            genFileName: genFile,
            styleId,
            prompt: namePrompt,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Add to cast failed");
        const thumbKey =
          typeof data.thumbKey === "string" ? data.thumbKey : "";
        if (thumbKey) {
          saved += 1;
          lastKey = thumbKey;
          await fetch("/api/crash/style-cards/manifest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              styleId,
              thumbKey,
              name: resolved.mainName,
              brief: resolved.notes || resolved.mainName,
            }),
          }).catch(() => undefined);
          if (genFile === fileName) approvedKey = thumbKey;
        }
      }
      approvedKey = approvedKey || lastKey;
      if (!approvedKey) {
        throw new Error("Add failed — no face file saved");
      }

      openCharacterSession({
        styleId,
        gagLabel: sess?.gagLabel || "",
        mainName: resolved.mainName,
        castNames: resolved.castNames.length
          ? resolved.castNames
          : [resolved.mainName],
        notes: resolved.notes || prompt.trim(),
        imageApproved: true,
        imageThumbKey: approvedKey,
        imageLabel: resolved.mainName,
      });
      writeStackFocusPanel("character");
      setAttachMsg(
        smokeMode
          ? `Approved ${resolved.mainName} — ${saved} face${saved === 1 ? "" : "s"} on Character`
          : `Added ${resolved.mainName} — on Character`,
      );
      if (smokeMode) {
        setSmokeTakes([]);
        setCursorImageGate(null);
        dispatchCursorImageGateDone({
          ok: true,
          thumbKey: approvedKey,
          label: resolved.mainName,
        });
      }
      setFileName("");
      setUrl("");
      setPlates([]);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addToStyleWorld() {
    if (!fileName || !showStyleId) {
      setError("Generate a place first, then Add to World.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crash/world-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genFileName: fileName,
          styleId: showStyleId,
          prompt: prompt.trim(),
          placeType: worldPlaceTypeRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Add to World failed");
      window.dispatchEvent(new CustomEvent(CRASH_WORLD_THUMB_SAVED));
      const label = data.label?.name ? ` (${data.label.name})` : "";
      setAttachMsg(
        `Added to ${stylePreset?.label ?? "style"} World${label} — see World step`,
      );
      setWorldGenMode(false);
      setFileName("");
      setUrl("");
      setPlates([]);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  /** Drop a saved still onto the panel (before Lock). CURSOR smoke → adds a take. */
  async function loadBgFromFile(file: File) {
    setBusy(true);
    setError("");
    setAttachMsg("");
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/crash/gen/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const nextUrl = `${data.url}&t=${Date.now()}`;
      setFileName(data.fileName);
      setUrl(nextUrl);
      if (cursorImageGate || isCursorImageGateArmed()) {
        pushSmokeTake(data.fileName, nextUrl);
        setAttachMsg(
          `Dropped into takes — Generate more (up to ${CURSOR_SMOKE_MAX_TAKES}) or Approve this one`,
        );
      } else {
        setAttachMsg("Image loaded — edit prompt, hit Tweak");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function lockLocationAsBg(pick: LocPick) {
    setBusy(true);
    setError("");
    setAttachMsg("");
    try {
      const file = await urlToFile(pick.url, pick.name);
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/crash/gen/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const nextUrl = `${data.url}&t=${Date.now()}`;
      setFileName(data.fileName);
      setUrl(nextUrl);
      setLockedBg({
        fileName: data.fileName,
        url: nextUrl,
        placeName: pick.locName || pick.name,
      });
      setAttachMsg(`BG locked — ${pick.locName} / ${pick.name}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addCharacterToTray(pick: CharPick) {
    if (!lockedBg) {
      setError("Lock a place BG first, then add cast.");
      setDrawerTab("places");
      return;
    }
    try {
      const file = await urlToFile(pick.url, pick.name);
      addToCastTray([file], [pick.name]);
      setAttachMsg(`${pick.name} → cast tray`);
    } catch (e) {
      setError(String(e));
    }
  }

  function presetCastPrompt(slot: PresetSlotPick): string {
    return `${slot.name}. ${slot.hint}`;
  }

  async function onPresetCastClick(slot: PresetSlotPick) {
    if (slot.hasImage && slot.url && lockedBg) {
      try {
        const file = await urlToFile(slot.url, slot.name);
        addToCastTray([file], [slot.name]);
        setAttachMsg(`${slot.name} → cast tray`);
      } catch (e) {
        setError(String(e));
      }
      return;
    }
    if (slot.hasImage && slot.url && !lockedBg) {
      try {
        await loadBgFromFile(await urlToFile(slot.url, slot.name));
        setAttachMsg(`${slot.name} loaded — lock BG or gen from words`);
      } catch (e) {
        setError(String(e));
      }
      return;
    }
    setPrompt(presetCastPrompt(slot));
    setAttachMsg(`${slot.name} — example prompt filled. Edit it, then Generate.`);
  }

  async function onPresetPlaceClick(slot: PresetSlotPick) {
    if (slot.hasImage && slot.url) {
      setBusy(true);
      setError("");
      setAttachMsg("");
      try {
        const file = await urlToFile(slot.url, slot.name);
        const fd = new FormData();
        fd.set("file", file);
        const res = await fetch("/api/crash/gen/upload", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        const nextUrl = `${data.url}&t=${Date.now()}`;
        setFileName(data.fileName);
        setUrl(nextUrl);
        setLockedBg({ fileName: data.fileName, url: nextUrl, placeName: slot.name });
        setAttachMsg(`BG locked — ${slot.name}`);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    setPrompt(slot.hint);
    setAttachMsg(`${slot.name} — place prompt filled. Edit it, then Generate.`);
  }

  function SlotThumb({
    slot,
    accent,
    onClick,
    disabled,
    title,
  }: {
    slot: PresetSlotPick;
    accent: "acid" | "magenta";
    onClick: () => void;
    disabled?: boolean;
    title?: string;
  }) {
    const border =
      accent === "acid" ? "hover:border-[var(--acid)]" : "hover:border-[var(--magenta)]";
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        title={title}
        className={`flex w-full gap-1.5 rounded-sm border border-[var(--line)] bg-[var(--panel-2)] p-1 text-left ${border} disabled:opacity-50`}
      >
        {slot.hasImage && slot.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slot.url}
            alt=""
            className="h-12 w-16 shrink-0 rounded-sm object-cover"
          />
        ) : (
          <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-sm border border-dashed border-[var(--line)] bg-[var(--void)] text-[10px] text-[var(--mute)]">
            {slot.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="min-w-0 self-center">
          <span className="block truncate text-[10px] text-[var(--chrome)]">
            {slot.name}
          </span>
          <span className="block truncate text-[9px] text-[var(--mute)]">
            {slot.hasImage ? "Ready" : "Tap → prompt"}
          </span>
        </span>
      </button>
    );
  }

  const placePicks: LocPick[] = (() => {
    const out: LocPick[] = [];
    for (const loc of locations) {
      for (const room of loc.rooms || []) {
        const plate =
          room.plateAttempts.find((a) => a.id === room.approvedPlateId) ||
          room.plateAttempts.find((a) => a.status === "approved" && a.fileName);
        if (!plate?.fileName) continue;
        out.push({
          key: `${loc.id}-${room.id}-${plate.id}`,
          name: room.name || "Main",
          locName: loc.name,
          url: `/api/locations/${loc.id}/rooms/${room.id}/plates/${plate.id}`,
        });
      }
    }
    return out;
  })();

  const castPicks: CharPick[] = (() => {
    const out: CharPick[] = [];
    for (const c of characters) {
      const face =
        c.faceAttempts.find((a) => a.id === c.approvedFaceId) ||
        c.faceAttempts.find((a) => a.status === "approved" && a.fileName);
      if (!face?.fileName) continue;
      out.push({
        key: c.id,
        name: c.name,
        url: `/api/characters/${c.id}/faces/${face.id}`,
        source: "Lab",
      });
    }
    return out;
  })();

  function addToCastTray(files: File[], names?: string[]) {
    const next: CastSlot[] = files.map((file, i) => ({
      id: `cast_${Math.random().toString(36).slice(2, 9)}`,
      file,
      url: URL.createObjectURL(file),
      name:
        names?.[i]?.trim() ||
        file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
    }));
    setCastTray((list) => [...list, ...next]);
    setError("");
    const total = castTray.length + next.length;
    setAttachMsg(
      total === 1
        ? "1 cast in tray — drop more, or Plate together"
        : `${total} in tray — Plate together runs Grok in batches for you`,
    );
  }

  function removeCast(id: string) {
    setCastTray((list) => {
      const hit = list.find((s) => s.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      return list.filter((s) => s.id !== id);
    });
  }

  async function plateFromTray() {
    if (!castTray.length) {
      setError("Drop cast stills into the tray first.");
      return;
    }
    const files = castTray.map((s) => s.file);
    const names = castTray.map((s) => s.name).filter(Boolean) as string[];
    await plateCharacters(files, names);
    clearCastTray();
  }

  async function resolvePlateLabels(
    castNames: string[],
    styleId: ShowStyleId,
  ): Promise<{ castNames: string[]; placeName: string }> {
    let names = castNames.map((n) => n.trim()).filter(Boolean);
    const needsCastFix =
      !names.length || names.some((n) => isGenericCastName(n));
    const draft = readScriptDeskCharacterDraft();

    if (needsCastFix && draft.styleCastKeys.length) {
      try {
        const res = await fetch("/api/crash/style-cards");
        const data = await res.json();
        const card = (
          data.cards as
            | { id: string; thumbs?: { key: string; name?: string }[] }[]
            | undefined
        )?.find((c) => c.id === styleId);
        const fromDesk = draft.styleCastKeys
          .slice(0, 3)
          .map((key) => card?.thumbs?.find((t) => t.key === key)?.name?.trim())
          .filter((n): n is string => Boolean(n));
        if (fromDesk.length) names = fromDesk;
      } catch {
        /* keep tray names */
      }
    }

    let placeName = lockedBg?.placeName?.trim() || "";
    if (!placeName && draft.styleWorldKey) {
      try {
        const res = await fetch("/api/crash/world-cards");
        const data = await res.json();
        const card = (
          data.cards as
            | { id: string; thumbs?: { key: string; name?: string }[] }[]
            | undefined
        )?.find((c) => c.id === styleId);
        const hit = card?.thumbs?.find((t) => t.key === draft.styleWorldKey);
        if (hit?.name) placeName = hit.name.trim().slice(0, 48);
      } catch {
        /* ignore */
      }
    }

    return { castNames: names, placeName };
  }

  async function plateCharacters(files: File[], castNames: string[] = []) {
    if (!lockedBg || !files.length) return;
    setPlating(true);
    setPlateProgress({ done: 0, total: files.length });
    setError("");
    setAttachMsg("");
    try {
      const styleId = (showStyleId ?? activeStyleId) as ShowStyleId;
      const labels = await resolvePlateLabels(castNames, styleId);
      let currentBgName = lockedBg.fileName;
      let chainPass = false;
      let finalThumb: PlateThumb | null = null;
      const total = files.length;

      for (let i = 0; i < files.length; i += PLATE_FACES_PER_PASS) {
        const batch = files.slice(i, i + PLATE_FACES_PER_PASS);
        const isLast = i + PLATE_FACES_PER_PASS >= files.length;

        setPlateProgress({ done: i, total });

        const fd = new FormData();
        fd.set("bgName", currentBgName);
        if (prompt.trim()) fd.set("note", prompt.trim());
        fd.set("styleId", styleId);
        fd.set("styleRealism", String(styleRealism));
        if (chainPass) fd.set("chainPass", "1");
        if (!isLast) fd.set("skipMeta", "1");
        if (isLast) {
          if (labels.castNames.length) {
            fd.set("castNames", JSON.stringify(labels.castNames));
          }
          fd.set("totalPeople", String(total));
        }
        if (labels.placeName) fd.set("placeName", labels.placeName);
        if (batch.length === 1) {
          fd.set("character", batch[0]);
        } else {
          for (const f of batch) fd.append("characters", f);
        }

        const res = await fetch("/api/crash/gen/plate", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Plate failed");

        currentBgName = data.fileName;
        chainPass = true;

        if (isLast) {
          finalThumb = {
            id: data.id || data.fileName,
            fileName: data.fileName,
            url: `${data.url}&t=${Date.now()}`,
          };
        }

        setPlateProgress({ done: Math.min(i + batch.length, total), total });
      }

      if (finalThumb) {
        pushPlate(finalThumb);
        window.dispatchEvent(
          new CustomEvent(CRASH_GEN_PLATE_SAVED, {
            detail: { fileName: finalThumb.fileName },
          }),
        );
      }

      setAttachMsg(
        total > 1
          ? `ONE plate with ${total} people — save that thumb`
          : prompt.trim()
            ? "Plated with your tweak (face / clothes / hat)"
            : "Plated · still added",
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setPlating(false);
      setPlateProgress(null);
    }
  }

  async function sendToMorph() {
    if (!plates.length) {
      setError("Plate at least one still first.");
      return;
    }
    setBusy(true);
    setError("");
    setAttachMsg("");
    try {
      const res = await fetch("/api/crash/morph/draft/from-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileNames: plates.map((p) => p.fileName),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      window.dispatchEvent(
        new CustomEvent("crash-morph-refresh", { detail: data.items }),
      );
      setAttachMsg(
        `Sent ${data.added || plates.length} to Morph tray`,
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function plateFromUrl() {
    if (!lockedBg || !charUrl.trim()) {
      setError("Paste an image link first.");
      return;
    }
    setPlating(true);
    setError("");
    setAttachMsg("");
    try {
      const res = await fetch("/api/crash/gen/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bgName: lockedBg.fileName,
          characterUrl: charUrl.trim(),
          note: prompt.trim() || undefined,
          styleId: activeStyleId,
          styleRealism,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Plate failed");
      const thumb: PlateThumb = {
        id: data.id || data.fileName,
        fileName: data.fileName,
        url: `${data.url}&t=${Date.now()}`,
      };
      pushPlate(thumb);
      window.dispatchEvent(
        new CustomEvent(CRASH_GEN_PLATE_SAVED, {
          detail: { fileName: data.fileName },
        }),
      );
      setCharUrl("");
      setAttachMsg(
        prompt.trim()
          ? "Plated from link with tweak"
          : "Plated from link",
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setPlating(false);
    }
  }

  function isImageFile(f: File): boolean {
    if (f.type.startsWith("image/")) return true;
    return /\.(png|jpe?g|webp|gif)$/i.test(f.name || "");
  }

  function onDropFiles(files: FileList | File[]) {
    const list = Array.from(files).filter(isImageFile);
    if (!list.length) {
      setError("Drop an image file (jpg/png/webp).");
      return;
    }
    if (!lockedBg) {
      void loadBgFromFile(list[0]);
      return;
    }
    // Always stage into cast tray — Plate together makes ONE still
    addToCastTray(list);
  }

  function onDragOver(e: ReactDragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function onDragLeave(e: ReactDragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function onDrop(e: ReactDragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files?.length) onDropFiles(e.dataTransfer.files);
  }

  const showPreview = lockedBg?.url || url;

  if (hideOnNarrowStack) return null;

  return (
    <div
      className="fixed"
      style={{
        left: px(geom.x),
        top: px(geom.y),
        width: px(geom.w),
        height: px(collapsed ? CRASH_STRIP_H : geom.h),
        zIndex: z,
      }}
      onPointerDown={bringFront}
    >
      {drawerOpen && !collapsed ? (
        <aside
          className="absolute bottom-0 right-full mr-1 flex w-[200px] flex-col overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--panel)] shadow-lg"
          style={{ height: px(geom.h), width: px(DRAWER_W) }}
        >
          <div className="flex shrink-0 border-b border-[var(--line)] bg-[var(--panel-2)]">
            <button
              type="button"
              className={`flex-1 px-2 py-1.5 text-[10px] uppercase tracking-wider ${
                drawerTab === "places"
                  ? "bg-[var(--acid)] text-[var(--void)]"
                  : "text-[var(--chrome-dim)] hover:text-[var(--chrome)]"
              }`}
              onClick={() => setDrawerTab("places")}
            >
              Places
            </button>
            <button
              type="button"
              className={`flex-1 px-2 py-1.5 text-[10px] uppercase tracking-wider ${
                drawerTab === "cast"
                  ? "bg-[var(--acid)] text-[var(--void)]"
                  : "text-[var(--chrome-dim)] hover:text-[var(--chrome)]"
              }`}
              onClick={() => setDrawerTab("cast")}
            >
              Cast
            </button>
          </div>
          <div className="crash-tray-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-1.5">
            {drawerTab === "places" ? (
              <>
                {presetPlaces.length > 0 ? (
                  <div className="space-y-1">
                    <p className="px-0.5 text-[9px] uppercase tracking-wider text-[var(--acid-deep)]">
                      Preset places
                    </p>
                    {presetPlaces.map((p) => (
                      <SlotThumb
                        key={p.id}
                        slot={p}
                        accent="acid"
                        disabled={busy || plating}
                        title={
                          p.hasImage
                            ? "Lock as BG"
                            : "Fill prompt with this place"
                        }
                        onClick={() => void onPresetPlaceClick(p)}
                      />
                    ))}
                  </div>
                ) : null}
                {placePicks.length > 0 ? (
                  <div className="space-y-1">
                    <p className="px-0.5 text-[9px] uppercase tracking-wider text-[var(--chrome-dim)]">
                      Location Lab
                    </p>
                    {placePicks.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        disabled={busy || plating}
                        onClick={() => void lockLocationAsBg(p)}
                        className="flex w-full gap-1.5 rounded-sm border border-[var(--line)] bg-[var(--panel-2)] p-1 text-left hover:border-[var(--acid)] disabled:opacity-50"
                        title="Lock as BG"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt=""
                          className="h-12 w-16 shrink-0 rounded-sm object-cover"
                        />
                        <span className="min-w-0 self-center">
                          <span className="block truncate text-[10px] text-[var(--chrome)]">
                            {p.locName}
                          </span>
                          <span className="block truncate text-[9px] text-[var(--mute)]">
                            {p.name}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : presetPlaces.length === 0 ? (
                  <p className="p-2 text-[10px] text-[var(--mute)]">
                    No places yet — Location Lab, or pick a preset above.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                {stylePreset?.characterMode === "ensemble" && presetCast.length > 0 ? (
                  <div className="space-y-1">
                    <p className="px-0.5 text-[9px] uppercase tracking-wider text-[var(--magenta-hot)]">
                      Preset cast
                    </p>
                    {presetCast.map((c) => (
                      <SlotThumb
                        key={c.id}
                        slot={c}
                        accent="magenta"
                        disabled={busy || plating}
                        title={
                          c.hasImage && lockedBg
                            ? "Add to cast tray"
                            : c.hasImage
                              ? "Load still"
                              : "Fill prompt with this character"
                        }
                        onClick={() => void onPresetCastClick(c)}
                      />
                    ))}
                  </div>
                ) : null}
                {stylePreset?.characterMode === "arsehole" && castPicks.length > 0 ? (
                  <div className="space-y-1">
                    <p className="px-0.5 text-[9px] uppercase tracking-wider text-[var(--magenta-hot)]">
                      Arseholes (Lab)
                    </p>
                    {castPicks.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        disabled={busy || plating}
                        onClick={() => void addCharacterToTray(c)}
                        className="flex w-full gap-1.5 rounded-sm border border-[var(--line)] bg-[var(--panel-2)] p-1 text-left hover:border-[var(--magenta)] disabled:opacity-50"
                        title={
                          lockedBg ? "Add to cast tray" : "Lock a place BG first"
                        }
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={c.url}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-sm object-cover"
                        />
                        <span className="min-w-0 self-center">
                          <span className="block truncate text-[10px] text-[var(--chrome)]">
                            {c.name}
                          </span>
                          <span className="block truncate text-[9px] text-[var(--mute)]">
                            {c.source}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {stylePreset?.characterMode === "ensemble" && castPicks.length > 0 ? (
                  <div className="space-y-1">
                    <p className="px-0.5 text-[9px] uppercase tracking-wider text-[var(--chrome-dim)]">
                      Lab faces
                    </p>
                    {castPicks.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        disabled={busy || plating}
                        onClick={() => void addCharacterToTray(c)}
                        className="flex w-full gap-1.5 rounded-sm border border-[var(--line)] bg-[var(--panel-2)] p-1 text-left hover:border-[var(--magenta)] disabled:opacity-50"
                        title={
                          lockedBg ? "Add to cast tray" : "Lock a place BG first"
                        }
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={c.url}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-sm object-cover"
                        />
                        <span className="min-w-0 self-center">
                          <span className="block truncate text-[10px] text-[var(--chrome)]">
                            {c.name}
                          </span>
                          <span className="block truncate text-[9px] text-[var(--mute)]">
                            {c.source}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {stylePreset?.characterMode === "arsehole" &&
                castPicks.length === 0 ? (
                  <p className="p-2 text-[10px] text-[var(--mute)]">
                    No locked arseholes yet — approve faces in Character Lab.
                  </p>
                ) : null}
                {stylePreset?.characterMode === "ensemble" &&
                presetCast.length === 0 &&
                castPicks.length === 0 ? (
                  <p className="p-2 text-[10px] text-[var(--mute)]">
                    No cast yet — pick a style in Script desk, or use presets above.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </aside>
      ) : null}

      <div
        className="relative flex flex-col overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--panel)] shadow-lg"
        style={{
          width: px(geom.w),
          height: px(collapsed ? CRASH_STRIP_H : geom.h),
        }}
      >
      {styleSyncActive && !collapsed ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--void)]/70">
          <CrashStyleVuMeter level={styleSyncLevel} label={styleSyncLabel} />
        </div>
      ) : null}
      <div
        className={`${CRASH_PANEL_TITLE_BAR} touch-none`}
        onPointerDown={startMove}
      >
        {!collapsed ? (
          <button
            type="button"
            aria-expanded={drawerOpen}
            aria-label={drawerOpen ? "Close library" : "Open library"}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-[var(--line)] bg-[var(--panel)] text-sm leading-none text-[var(--chrome)] hover:border-[var(--acid)]"
            onClick={(e) => {
              e.stopPropagation();
              setDrawerOpen((o) => !o);
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {drawerOpen ? "−" : "<"}
          </button>
        ) : null}
        <h2 className={`${CRASH_PANEL_TITLE_COL} text-[var(--pipeline)]`}>
          Image gen
        </h2>
        <span className={CRASH_PANEL_SUBTITLE_COL}>
          {stylePreset?.label ?? "No style"}
        </span>
        {!collapsed ? (
          <span className="text-[9px] text-[var(--chrome-dim)]">
            {lockedBg ? "BG locked" : "Tweak = uses picture on screen"}
          </span>
        ) : null}
        <CrashLabCollapseBtn
          collapsed={collapsed}
          deskStacked={mode === "stack" || mode === "free"}
          freeFlow={mode === "free"}
          onToggle={togglePanel}
        />
      </div>

      {!collapsed ? (
      <>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden p-2">
        <div className="shrink-0 overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--panel-2)]">
          <textarea
            className="crash-prompt-scroll block min-h-[56px] w-full resize-y border-0 bg-transparent px-2 py-1.5 text-[11px] text-[var(--chrome)] outline-none focus:ring-0"
            placeholder={
              lockedBg
                ? "Optional tweak when you drop Kim — worried brows, red hat, fatter…"
                : fileName
                  ? "Same woman as attached — keep age, hair, clothes… then the gentle change"
                  : "Who / where / what’s happening — positive only"
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={busy || plating}
          />
          <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-2 py-1">
            <span className="flex items-center gap-1">
            <button
              type="button"
              className="flex items-center gap-0.5 rounded-sm border border-[var(--acid)] bg-[var(--panel)] px-1.5 py-0.5 text-[9px] text-[var(--acid)] hover:bg-[var(--acid)]/10 disabled:opacity-40"
              disabled={busy || plating}
              onClick={fillExamplePrompt}
              title="Idea prompt for this style + slider position"
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
            <button
              type="button"
              className="rounded-sm border border-[var(--magenta)] bg-[var(--panel)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[var(--magenta)] hover:bg-[var(--magenta)]/10 disabled:opacity-40"
              disabled={busy || plating || aiBusy}
              onClick={() => void draftPromptWithAi()}
              title="Draft this box — press again for a different take"
            >
              {aiBusy ? "…" : "AI"}
            </button>
            </span>
            <button
              type="button"
              className="rounded-sm border border-[var(--magenta-hot)] bg-[var(--panel)] px-1.5 py-0.5 text-[9px] text-[var(--magenta-hot)] hover:bg-[var(--magenta-hot)]/10 disabled:opacity-40"
              disabled={busy || plating || Boolean(lockedBg)}
              onClick={pullNewCharacterFromScriptDesk}
              title="Load Develop character idea from Script desk"
            >
              New character
            </button>
          </div>
        </div>
        <div className="shrink-0 px-0.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[9px] uppercase tracking-wider text-[var(--chrome-dim)]">
              Cartoon ←→ photo
            </label>
            <span className="text-[9px] text-[var(--mute)]">
              {styleRealism} · {styleRealismLabel(styleRealism)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={styleRealism}
            onChange={(e) => setStyleRealism(Number(e.target.value))}
            disabled={busy || plating}
            className="w-full accent-[var(--acid)]"
          />
          <p className="mt-0.5 text-[8px] leading-tight text-[var(--mute)]">
            Moves the look in the prompt
          </p>
        </div>
        {!lockedBg ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Btn
              tone="ok"
              className="!px-3 !py-1 !text-[12px]"
              disabled={
                busy ||
                plating ||
                !prompt.trim() ||
                Boolean(
                  cursorImageGate &&
                    smokeTakes.length >= CURSOR_SMOKE_MAX_TAKES,
                )
              }
              onClick={() => void generate()}
              title={
                cursorImageGate && smokeTakes.length >= CURSOR_SMOKE_MAX_TAKES
                  ? `Max ${CURSOR_SMOKE_MAX_TAKES} takes — Approve one`
                  : "Fresh still from your prompt + slider"
              }
            >
              {busy
                ? "Generating…"
                : cursorImageGate
                  ? `Generate (${smokeTakes.length}/${CURSOR_SMOKE_MAX_TAKES})`
                  : "Generate"}
            </Btn>
            <Btn
              tone="magenta"
              className="!px-3 !py-1 !text-[12px] disabled:opacity-35"
              disabled={busy || plating || !hasStockStill || !prompt.trim()}
              onClick={() => void tweakFromStock()}
              title={
                hasStockStill
                  ? "Same person on screen — gentle change from prompt"
                  : "Generate or drop an image first"
              }
            >
              {busy ? "Working…" : "Tweak"}
            </Btn>
          </div>
        ) : (
          <p className="shrink-0 text-[9px] text-[var(--mute)]">
            Drop cast into tray → Plate together = ONE group still. Tweak box =
            staging / face notes.
          </p>
        )}

        {error ? (
          <p className="shrink-0 text-[11px] text-[var(--magenta-hot)]">{error}</p>
        ) : null}
        {attachMsg ? (
          <p className="shrink-0 text-[11px] text-[var(--acid-deep)]">{attachMsg}</p>
        ) : null}
        {cursorImageGate && smokeTakes.length > 0 ? (
          <div className="shrink-0 space-y-1">
            <p className="text-[8px] uppercase tracking-wider text-[var(--magenta-hot)]">
              Takes · {smokeTakes.length}/{CURSOR_SMOKE_MAX_TAKES} — click to
              pick, then Approve
            </p>
            <div className="flex flex-wrap gap-1">
              {smokeTakes.map((t, i) => {
                const on = t.fileName === fileName;
                return (
                  <button
                    key={t.fileName}
                    type="button"
                    disabled={busy}
                    title={`Take ${i + 1}`}
                    onClick={() => selectSmokeTake(t)}
                    className={`overflow-hidden rounded-sm border ${
                      on
                        ? "border-[var(--acid)] ring-1 ring-[var(--acid)]"
                        : "border-[var(--line)] opacity-85 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.url}
                      alt={`Take ${i + 1}`}
                      className="h-14 w-20 object-cover"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {showPreview ? (
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
            <div
              data-dropzone
              className={`relative flex min-h-0 flex-1 items-center justify-center rounded-sm border ${
                dragOver
                  ? "border-[var(--acid)] bg-[var(--acid)]/10"
                  : lockedBg
                    ? "border-[var(--magenta)] border-dashed"
                    : "border-[var(--line)] border-dashed"
              }`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lockedBg?.url || url}
                alt={lockedBg ? "Locked BG" : "Gen"}
                draggable={Boolean(!lockedBg && fileName)}
                className={`max-h-full max-w-full object-contain ${
                  !lockedBg && fileName
                    ? "cursor-grab active:cursor-grabbing"
                    : ""
                }`}
                style={{ width: "auto", height: "auto" }}
                onDragStart={(e) => {
                  if (lockedBg || !fileName) return;
                  e.stopPropagation();
                  writePlateDrag(e, {
                    kind: "cplate",
                    styleId: activeStyleId,
                    fileName,
                    label: "Gen still",
                  });
                }}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[10px] text-[var(--acid)]">
                {plating
                  ? plateProgress
                    ? `Plating ${plateProgress.done} of ${plateProgress.total}…`
                    : "Plating…"
                  : busy
                    ? "Loading…"
                    : dragOver
                      ? lockedBg
                        ? "Drop into cast tray"
                        : "Drop to load BG"
                      : lockedBg
                        ? castTray.length
                          ? `${castTray.length} in tray — Plate together`
                          : "Drop cast stills into tray (not one-by-one auto)"
                        : "Drop image here — then Tweak, or Lock BG"}
              </div>
              <input
                ref={dropInputRef}
                type="file"
                accept="image/*"
                multiple={Boolean(lockedBg)}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) onDropFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1.5">
              {!lockedBg ? (
                <>
                  <button
                    type="button"
                    className="text-[11px] text-[var(--chrome-dim)] hover:text-[var(--chrome)]"
                    onClick={() => dropInputRef.current?.click()}
                    disabled={busy}
                  >
                    Drop / pick BG…
                  </button>
                  <Btn
                    tone="ok"
                    className="!px-2 !py-0.5 !text-[11px]"
                    onClick={() => void saveDownload()}
                    disabled={busy || !url}
                  >
                    Save file
                  </Btn>
                  {showStyleId && url ? (
                    <>
                      <button
                        type="button"
                        className="text-[11px] text-[var(--chrome-dim)] hover:text-[var(--fail)]"
                        onClick={rejectStock}
                        disabled={busy}
                      >
                        Reject
                      </button>
                      {cursorImageGate && !worldGenMode ? (
                        <>
                          <button
                            type="button"
                            className="text-[11px] text-[var(--chrome-dim)] hover:text-[var(--acid)]"
                            onClick={alterCursorImage}
                            disabled={busy}
                          >
                            Alter
                          </button>
                          <button
                            type="button"
                            className="text-[11px] text-[var(--chrome-dim)] hover:text-[var(--magenta-hot)]"
                            onClick={cancelCursorImageGate}
                            disabled={busy}
                            title="Stop CURSOR Image Gen step"
                          >
                            Cancel
                          </button>
                        </>
                      ) : null}
                      {worldGenMode ? (
                        <Btn
                          tone="accent"
                          className="!px-2 !py-0.5 !text-[11px]"
                          onClick={() => void addToStyleWorld()}
                          disabled={busy || !fileName}
                        >
                          Add to World
                        </Btn>
                      ) : (
                        <Btn
                          tone="accent"
                          className="!px-2 !py-0.5 !text-[11px]"
                          onClick={() => void addToStyleCast()}
                          disabled={busy || !fileName}
                        >
                          {cursorImageGate
                            ? "Approve"
                            : `Add to ${stylePreset?.label ?? "cast"}`}
                        </Btn>
                      )}
                    </>
                  ) : null}
                  <Btn
                    tone="magenta"
                    className="!px-2 !py-0.5 !text-[11px]"
                    onClick={lockBg}
                    disabled={busy || !fileName}
                  >
                    Lock BG
                  </Btn>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="text-[11px] text-[var(--chrome-dim)] hover:text-[var(--chrome)]"
                    onClick={() => dropInputRef.current?.click()}
                    disabled={plating}
                  >
                    Pick image…
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-[var(--magenta-hot)] hover:underline"
                    onClick={unlockBg}
                    disabled={plating}
                  >
                    Unlock BG
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-[var(--chrome-dim)] hover:text-[var(--fail)]"
                    onClick={clearAll}
                    disabled={plating}
                  >
                    Clear
                  </button>
                </>
              )}
            </div>

            {lockedBg && castTray.length > 0 ? (
              <div className="flex w-full shrink-0 flex-col gap-1 rounded-sm border border-[var(--acid)]/40 bg-[var(--panel-2)] p-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--acid)]">
                    Cast tray {castTray.length}
                    {plating && plateProgress
                      ? ` · plating ${plateProgress.done}/${plateProgress.total}`
                      : ""}
                  </span>
                  <Btn
                    tone="accent"
                    className="!px-2 !py-0.5 !text-[11px]"
                    disabled={plating || !castTray.length}
                    onClick={() => void plateFromTray()}
                  >
                    {plating
                      ? plateProgress
                        ? `Plating ${plateProgress.done}/${plateProgress.total}…`
                        : "Plating…"
                      : castTray.length > 1
                        ? `Plate ${castTray.length} together`
                        : "Plate this one"}
                  </Btn>
                  <button
                    type="button"
                    className="ml-auto text-[10px] text-[var(--chrome-dim)] hover:text-[var(--fail)]"
                    onClick={clearCastTray}
                    disabled={plating}
                  >
                    Clear tray
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {castTray.map((s, i) => (
                    <div
                      key={s.id}
                      className="relative h-14 w-14 overflow-hidden rounded-sm border border-[var(--line)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute left-0.5 top-0.5 rounded-sm bg-black/70 px-1 text-[9px] text-[var(--acid)]">
                        {i + 1}
                      </span>
                      <button
                        type="button"
                        className="absolute right-0 top-0 bg-black/70 px-1 text-[10px] text-[var(--fail)]"
                        onClick={() => removeCast(s.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {lockedBg ? (
              <div className="flex w-full shrink-0 gap-1">
                <input
                  type="text"
                  className="min-w-0 flex-1 rounded-sm border border-[var(--line)] bg-[var(--panel-2)] px-1.5 py-0.5 text-[10px] text-[var(--chrome)]"
                  placeholder="Or paste image URL /api/… link"
                  value={charUrl}
                  onChange={(e) => setCharUrl(e.target.value)}
                  disabled={plating}
                />
                <button
                  type="button"
                  className="shrink-0 text-[10px] text-[var(--magenta-hot)] hover:underline disabled:opacity-40"
                  disabled={plating || !charUrl.trim()}
                  onClick={() => void plateFromUrl()}
                >
                  Plate link
                </button>
              </div>
            ) : null}

            {plates.length > 0 ? (
              <div className="flex shrink-0 items-start gap-1.5">
                <div className="crash-tray-scroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
                  {plates.map((p, i) => (
                    <div key={p.id} className="w-[110px] shrink-0">
                      <div className="relative overflow-hidden rounded-sm border border-[var(--line)] bg-black">
                        <span className="pointer-events-none absolute left-0 top-0 z-[1] bg-black/75 px-1 text-[10px] leading-tight text-[var(--acid)]">
                          {i + 1}
                        </span>
                        <button
                          type="button"
                          className={`block w-full ${
                            !lockedBg && p.fileName === fileName
                              ? "ring-1 ring-[var(--acid)]"
                              : ""
                          }`}
                          title={
                            lockedBg
                              ? "Click to enlarge · right-click to save"
                              : "Click to put back on screen for Tweak · right-click save"
                          }
                          onClick={() => {
                            if (!lockedBg) useAsStock(p);
                            else
                              setPreview({
                                src: p.url,
                                title: `Plate ${i + 1}`,
                              });
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            downloadOne(p);
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            draggable
                            src={p.url}
                            alt=""
                            className="aspect-video w-full cursor-grab object-contain active:cursor-grabbing"
                            onDragStart={(e) => {
                              e.stopPropagation();
                              writePlateDrag(e, {
                                kind: "cplate",
                                styleId: activeStyleId,
                                fileName: p.fileName,
                                label: `Plate ${i + 1}`,
                              });
                            }}
                          />
                        </button>
                        <button
                          type="button"
                          className="absolute right-0 top-0 z-[1] flex h-4 w-4 items-center justify-center bg-black/70 text-[11px] leading-none text-[var(--chrome)] hover:bg-[var(--fail)] hover:text-white"
                          title="Delete"
                          onClick={() => removePlate(p.id)}
                        >
                          X
                        </button>
                      </div>
                      <button
                        type="button"
                        className="mt-0.5 w-full text-center text-[9px] leading-none text-[var(--acid)] hover:underline"
                        onClick={() =>
                          lockedBg ? downloadOne(p) : useAsStock(p)
                        }
                      >
                        {lockedBg ? "Save" : "Use"}
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-5 shrink-0 text-[10px] leading-none text-[var(--acid)] hover:underline"
                  onClick={() => void downloadAll()}
                  title="Save all plates"
                >
                  Save all
                </button>
              </div>
            ) : null}

            {plates.length > 0 ? (
              <button
                type="button"
                className="w-full shrink-0 rounded-sm border border-[var(--acid)] bg-[var(--acid)] px-2 py-0.5 text-[11px] font-semibold text-[var(--void)] disabled:opacity-40"
                disabled={busy || plating}
                onClick={() => void sendToMorph()}
              >
                Send to Morph →
              </button>
            ) : null}
          </div>
        ) : (
          <div
            data-dropzone
            className={`flex min-h-[100px] flex-1 items-center justify-center rounded-sm border border-dashed text-[10px] ${
              dragOver
                ? "border-[var(--acid)] bg-[var(--acid)]/10 text-[var(--acid)]"
                : "border-[var(--line)] text-[var(--chrome-dim)]"
            }`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {busy
              ? "Generating…"
              : dragOver
                ? "Drop to load — then Tweak"
                : "Generate, or drop an image here"}
            <input
              ref={dropInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) onDropFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        )}
      </div>
      <div
        className="crash-resize-handle touch-none absolute bottom-0 right-0 h-3 w-3 cursor-se-resize"
        onPointerDown={startResize("se")}
      />
      <div
        className="crash-resize-handle touch-none absolute bottom-0 left-3 right-3 h-1.5 cursor-s-resize"
        onPointerDown={startResize("s")}
      />
      <div
        className="crash-resize-handle touch-none absolute bottom-3 top-3 right-0 w-1.5 cursor-e-resize"
        onPointerDown={startResize("e")}
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
