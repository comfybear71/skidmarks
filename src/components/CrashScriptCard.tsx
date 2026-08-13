"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { CrashLabCollapseBtn } from "@/components/CrashLabCollapseBtn";
import { Btn } from "@/components/ui";
import { StyleCharacterPanel } from "@/components/StyleCharacterPanel";
import { StyleWorldPanel } from "@/components/StyleWorldPanel";
import { StyleSwapPanel } from "@/components/StyleSwapPanel";
import { EpisodeRecipeFields } from "@/components/EpisodeRecipeFields";
import { ProductionFlowStepper, type ProductionStep } from "@/components/ProductionFlowStepper";
import { StylePresetCard } from "@/components/StylePresetCard";
import { StorySpineStepper, storyStageByN } from "@/components/StorySpineStepper";
import { useCrashDeskMode } from "@/hooks/useCrashDeskMode";
import { useScriptDeskWatch } from "@/hooks/useScriptDeskWatch";
import {
  CRASH_DESK_LAYOUT_VER,
  CRASH_STRIP_H,
  px,
} from "@/lib/crashDeskLayout";
import {
  CRASH_SCRIPT_MIN_H,
  CRASH_SCRIPT_MIN_W,
  CRASH_PANEL_SUBTITLE_COL,
  CRASH_PANEL_TITLE_BAR,
  CRASH_PANEL_TITLE_COL,
} from "@/lib/crashLabPanel";
import { bumpCrashLabZ } from "@/lib/crashLabZ";
import {
  dispatchNewStyleCharacter,
  dispatchNewStylePlace,
  CRASH_STYLE_THUMB_SAVED,
  CRASH_WORLD_THUMB_SAVED,
  CRASH_GEN_PLATE_SAVED,
  CRASH_SWAP_SAVED,
  CRASH_PRODUCTION_STEP_EVENT,
  CRASH_SCRIPT_FIELDS_EVENT,
  CRASH_SHOW_STYLE_CLEAR_EVENT,
  CRASH_SHOW_STYLE_EVENT,
  dispatchProductionStep,
  parseStyleEventDetail,
} from "@/lib/crashStyleSync";
import type { SwapResultLabel, SwapTargetRef } from "@/lib/swapCards";
import {
  clearShowStyleId,
  getShowStylePreset,
  loadShowStyleIdOptional,
  saveShowStyleId,
  SHOW_STYLE_PRESETS,
  SHOW_STYLE_STORAGE_KEY,
  type ShowStyleId,
} from "@/lib/showStylePresets";
import {
  CRASH_ACTIVE_EPISODE_EVENT,
  readActiveEpisode,
} from "@/lib/crashActiveEpisode";
import { resolveVoiceCast } from "@/lib/resolveVoiceCast";
import { normalizeScriptFields, type ScriptFillFields } from "@/lib/scriptBlueprint";
import { matchLabCharacter } from "@/lib/matchLabCharacter";
import {
  characterPromptWrongStyle,
  pickFreshStyleCharacterIdea,
} from "@/lib/styleCharacterRoster";
import type { StorySpineStageN } from "@/lib/storySpine";
import type { Character } from "@/lib/types";
import { pickFreshWorldPlaceIdea } from "@/lib/worldPlaceIdeas";
import type { WorldPlaceTypeId } from "@/lib/worldPlaceTypes";

const FIELDS_KEY = "crashlab-script-fields";
const LAYOUT_VER_KEY = "crashlab-script-layout-v11";
const STEP_KEY = "crashlab-production-step";
const CARD_MIN_W = CRASH_SCRIPT_MIN_W;
const CARD_MIN_H = CRASH_SCRIPT_MIN_H;
const CARD_DEFAULT_H = 680;

type CardGeom = { x: number; y: number; w: number; h: number };

type SavedFields = ScriptFillFields & {
  charId?: string;
  showStyle?: ShowStyleId;
  productionStep?: number;
  spineStep?: number;
  styleThumbKey?: string;
  styleCastKeys?: string[];
  activePlaceType?: WorldPlaceTypeId;
  styleWorldKey?: string;
  swapTargetKind?: "gen" | "world" | "upload";
  swapTargetGenFile?: string;
  swapTargetUploadFile?: string;
};

const EMPTY_FIELDS: ScriptFillFields = {
  character: "",
  location: "",
  fakeWin: "",
  losesIt: "",
  getsSmashed: "",
};

function loadFields(): SavedFields {
  try {
    const raw = localStorage.getItem(FIELDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedFields>;
      return {
        ...normalizeScriptFields(parsed),
        charId: parsed.charId || "",
        showStyle: parsed.showStyle,
        productionStep: parsed.productionStep,
        spineStep: parsed.spineStep,
        styleThumbKey: parsed.styleThumbKey,
        styleCastKeys: Array.isArray(parsed.styleCastKeys)
          ? parsed.styleCastKeys
          : undefined,
        activePlaceType: parsed.activePlaceType,
        styleWorldKey: parsed.styleWorldKey,
        swapTargetKind: parsed.swapTargetKind,
        swapTargetGenFile: parsed.swapTargetGenFile,
        swapTargetUploadFile: parsed.swapTargetUploadFile,
      };
    }
  } catch {
    /* ignore */
  }
  return { ...EMPTY_FIELDS };
}

function loadProductionStep(): ProductionStep {
  try {
    const n = Number(localStorage.getItem(STEP_KEY));
    if (n >= 1 && n <= 6) {
      // Migrate old 5-step flow (Voice=4, Story=5) → Swap inserted at 4
      if (n >= 4 && n <= 5 && !localStorage.getItem("crashlab-step-v6")) {
        localStorage.setItem("crashlab-step-v6", "1");
        return (n + 1) as ProductionStep;
      }
      return n as ProductionStep;
    }
  } catch {
    /* ignore */
  }
  return 1;
}

function characterBlurb(c: Character): string {
  const bits = [c.name.trim()];
  if (c.pastNote?.trim()) bits.push(c.pastNote.trim());
  if (c.lookNote?.trim()) bits.push(`Look: ${c.lookNote.trim()}`);
  return bits.join(" — ");
}

export function CrashScriptCard() {
  const { geom, deskReady, collapsed, mode, togglePanel, setGeom } = useCrashDeskMode("script");
  const deskWatch = useScriptDeskWatch();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [fields, setFields] = useState<ScriptFillFields>(EMPTY_FIELDS);
  const [charId, setCharId] = useState("");
  const [showStyleId, setShowStyleId] = useState<ShowStyleId | null>(null);
  const [productionStep, setProductionStep] = useState<ProductionStep>(1);
  const [spineStep, setSpineStep] = useState<StorySpineStageN>(1);
  const [cardReady, setCardReady] = useState(false);
  const [z, setZ] = useState(40);
  const [expandedStyleId, setExpandedStyleId] = useState<ShowStyleId | "">("");
  const [styleThumbs, setStyleThumbs] = useState<
    Record<string, { key: string; name?: string; brief?: string }[]>
  >({});
  const [thumbVersion, setThumbVersion] = useState(0);
  const [selectedCastKeys, setSelectedCastKeys] = useState<string[]>([]);
  const [worldUnlocked, setWorldUnlocked] = useState(false);
  const [worldThumbs, setWorldThumbs] = useState<
    Record<
      string,
      { key: string; name?: string; brief?: string; placeType?: WorldPlaceTypeId }[]
    >
  >({});
  const [worldThumbVersion, setWorldThumbVersion] = useState(0);
  const [activePlaceType, setActivePlaceType] =
    useState<WorldPlaceTypeId>("natural_wild");
  const [selectedWorldKey, setSelectedWorldKey] = useState("");
  const [swapResults, setSwapResults] = useState<Record<string, SwapResultLabel>>({});
  const [swapVersion, setSwapVersion] = useState(0);
  const [swapTargetKind, setSwapTargetKind] = useState<"gen" | "world" | "upload">("gen");
  const [swapTargetGenFile, setSwapTargetGenFile] = useState("");
  const [swapTargetUploadFile, setSwapTargetUploadFile] = useState("");
  const [genPlates, setGenPlates] = useState<
    { fileName: string; mtime: number; label?: string }[]
  >([]);
  const [swapEngine, setSwapEngine] = useState({ configured: false, hint: "" });
  const [swapBusyKey, setSwapBusyKey] = useState("");
  const [swapError, setSwapError] = useState("");
  const [swapUnlocked, setSwapUnlocked] = useState(false);
  const moveRef = useRef<{
    mode: "move" | "resize";
    edge?: string;
    startX: number;
    startY: number;
    orig: CardGeom;
  } | null>(null);

  const preset = useMemo(
    () => (showStyleId ? getShowStylePreset(showStyleId) : null),
    [showStyleId],
  );
  const selectedChar = useMemo(
    () => characters.find((c) => c.id === charId) || null,
    [characters, charId],
  );
  const stage = storyStageByN(spineStep);

  useLayoutEffect(() => {
    const saved = loadFields();
    setFields(normalizeScriptFields(saved));
    setCharId(saved.charId || "");
    const castKeys =
      Array.isArray(saved.styleCastKeys) && saved.styleCastKeys.length
        ? saved.styleCastKeys
        : saved.styleThumbKey
          ? [saved.styleThumbKey]
          : [];
    setSelectedCastKeys(castKeys);
    setWorldUnlocked(
      Boolean(saved.productionStep && saved.productionStep >= 3) ||
        castKeys.length > 0,
    );
    setActivePlaceType(
      (saved.activePlaceType as WorldPlaceTypeId) || "natural_wild",
    );
    setSelectedWorldKey(saved.styleWorldKey || "");
    setSwapTargetKind(saved.swapTargetKind || "gen");
    setSwapTargetGenFile(saved.swapTargetGenFile || "");
    setSwapTargetUploadFile(saved.swapTargetUploadFile || "");
    setSwapUnlocked(
      Boolean(saved.productionStep && saved.productionStep >= 4) ||
        Boolean(saved.styleWorldKey),
    );
    const epStyle = readActiveEpisode()?.styleId;
    const style =
      epStyle ??
      loadShowStyleIdOptional() ??
      saved.showStyle ??
      null;
    setShowStyleId(style);
    try {
      if (style) localStorage.setItem(SHOW_STYLE_STORAGE_KEY, style);
    } catch {
      /* ignore */
    }
    setProductionStep(
      saved.productionStep
        ? (() => {
            const n = saved.productionStep as number;
            if (n >= 4 && n <= 5 && !localStorage.getItem("crashlab-step-v6")) {
              localStorage.setItem("crashlab-step-v6", "1");
              return (n + 1) as ProductionStep;
            }
            return n as ProductionStep;
          })()
        : loadProductionStep(),
    );
    if (saved.spineStep && saved.spineStep >= 1 && saved.spineStep <= 9) {
      setSpineStep(saved.spineStep as StorySpineStageN);
    }
    setZ(bumpCrashLabZ());
    setCardReady(true);
  }, []);

  useLayoutEffect(() => {
    if (!showStyleId && deskWatch.showStyleId) {
      setShowStyleId(deskWatch.showStyleId);
    }
  }, [deskWatch.showStyleId, showStyleId]);

  useEffect(() => {
    if (!cardReady) return;
    window.dispatchEvent(
      new CustomEvent(CRASH_PRODUCTION_STEP_EVENT, { detail: productionStep }),
    );
  }, [productionStep, cardReady]);

  useEffect(() => {
    const onStyle = (e: Event) => {
      const id = parseStyleEventDetail((e as CustomEvent).detail);
      if (id) setShowStyleId(id);
    };
    const onClear = () => {
      const ep = readActiveEpisode();
      if (ep?.styleId) {
        setShowStyleId(ep.styleId);
        return;
      }
      setShowStyleId(null);
    };
    const onEp = () => {
      const ep = readActiveEpisode();
      if (ep?.styleId) setShowStyleId(ep.styleId);
    };
    window.addEventListener(CRASH_SHOW_STYLE_EVENT, onStyle);
    window.addEventListener(CRASH_SHOW_STYLE_CLEAR_EVENT, onClear);
    window.addEventListener(CRASH_ACTIVE_EPISODE_EVENT, onEp);
    return () => {
      window.removeEventListener(CRASH_SHOW_STYLE_EVENT, onStyle);
      window.removeEventListener(CRASH_SHOW_STYLE_CLEAR_EVENT, onClear);
      window.removeEventListener(CRASH_ACTIVE_EPISODE_EVENT, onEp);
    };
  }, []);

  useEffect(() => {
    const onStep = (e: Event) => {
      const n = Number((e as CustomEvent).detail);
      if (n >= 1 && n <= 6) {
        setProductionStep(n as ProductionStep);
        if (n >= 4) setSwapUnlocked(true);
        if (n >= 3) setWorldUnlocked(true);
      }
    };
    const onFields = () => {
      const saved = loadFields();
      setFields(normalizeScriptFields(saved));
      // Keep cast tray in sync — Voice Remove was getting overwritten by stale keys.
      const castKeys =
        Array.isArray(saved.styleCastKeys) && saved.styleCastKeys.length
          ? saved.styleCastKeys
          : saved.styleThumbKey
            ? [saved.styleThumbKey]
            : [];
      setSelectedCastKeys(castKeys);
      if (saved.spineStep && saved.spineStep >= 1 && saved.spineStep <= 9) {
        setSpineStep(saved.spineStep as StorySpineStageN);
      }
    };
    window.addEventListener(CRASH_PRODUCTION_STEP_EVENT, onStep);
    window.addEventListener(CRASH_SCRIPT_FIELDS_EVENT, onFields);
    return () => {
      window.removeEventListener(CRASH_PRODUCTION_STEP_EVENT, onStep);
      window.removeEventListener(CRASH_SCRIPT_FIELDS_EVENT, onFields);
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/crash/style-cards");
        const data = await res.json();
        if (!res.ok || !Array.isArray(data.cards)) return;
        const map: Record<string, { key: string; name?: string; brief?: string }[]> =
          {};
        for (const c of data.cards as {
          id: string;
          thumbs?: { key: string; name?: string; brief?: string }[];
        }[]) {
          map[c.id] = (c.thumbs ?? []).map((t) => ({
            key: t.key,
            name: t.name,
            brief: t.brief,
          }));
        }
        setStyleThumbs(map);
      } catch {
        /* ignore */
      }
    })();
    const onThumb = () => {
      setThumbVersion((v) => v + 1);
      void (async () => {
        try {
          const res = await fetch("/api/crash/style-cards");
          const data = await res.json();
          if (!res.ok || !Array.isArray(data.cards)) return;
          const map: Record<
            string,
            { key: string; name?: string; brief?: string }[]
          > = {};
          for (const c of data.cards as {
            id: string;
            thumbs?: { key: string; name?: string; brief?: string }[];
          }[]) {
            map[c.id] = (c.thumbs ?? []).map((t) => ({
              key: t.key,
              name: t.name,
              brief: t.brief,
            }));
          }
          setStyleThumbs(map);
        } catch {
          /* ignore */
        }
      })();
    };
    window.addEventListener(CRASH_STYLE_THUMB_SAVED, onThumb);
    return () => window.removeEventListener(CRASH_STYLE_THUMB_SAVED, onThumb);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/crash/world-cards");
        const data = await res.json();
        if (!res.ok || !Array.isArray(data.cards)) return;
        const map: Record<
          string,
          { key: string; name?: string; brief?: string; placeType?: WorldPlaceTypeId }[]
        > = {};
        for (const c of data.cards as {
          id: string;
          thumbs?: {
            key: string;
            name?: string;
            brief?: string;
            placeType?: WorldPlaceTypeId;
          }[];
        }[]) {
          map[c.id] = (c.thumbs ?? []).map((t) => ({
            key: t.key,
            name: t.name,
            brief: t.brief,
            placeType: t.placeType,
          }));
        }
        setWorldThumbs(map);
      } catch {
        /* ignore */
      }
    })();
    const onWorldThumb = () => {
      setWorldThumbVersion((v) => v + 1);
      void (async () => {
        try {
          const res = await fetch("/api/crash/world-cards");
          const data = await res.json();
          if (!res.ok || !Array.isArray(data.cards)) return;
          const map: Record<
            string,
            { key: string; name?: string; brief?: string; placeType?: WorldPlaceTypeId }[]
          > = {};
          for (const c of data.cards as {
            id: string;
            thumbs?: {
              key: string;
              name?: string;
              brief?: string;
              placeType?: WorldPlaceTypeId;
            }[];
          }[]) {
            map[c.id] = (c.thumbs ?? []).map((t) => ({
              key: t.key,
              name: t.name,
              brief: t.brief,
              placeType: t.placeType,
            }));
          }
          setWorldThumbs(map);
        } catch {
          /* ignore */
        }
      })();
    };
    window.addEventListener(CRASH_WORLD_THUMB_SAVED, onWorldThumb);
    return () => window.removeEventListener(CRASH_WORLD_THUMB_SAVED, onWorldThumb);
  }, []);

  const refreshSwap = useCallback(async (styleId: ShowStyleId) => {
    try {
      const res = await fetch(
        `/api/crash/swap?styleId=${encodeURIComponent(styleId)}`,
      );
      const data = await res.json();
      if (!res.ok) return;
      setSwapEngine({
        configured: Boolean(data.engine?.configured),
        hint: String(data.engine?.hint || ""),
      });
      setGenPlates(Array.isArray(data.genPlates) ? data.genPlates : []);
      setSwapResults(
        data.swaps && typeof data.swaps === "object" ? data.swaps : {},
      );
      setSwapVersion((v) => v + 1);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!showStyleId) return;
    void refreshSwap(showStyleId);
  }, [showStyleId, productionStep, refreshSwap]);

  useEffect(() => {
    const onSwap = () => {
      if (showStyleId) void refreshSwap(showStyleId);
    };
    const onGenPlate = (e: Event) => {
      const fileName = (e as CustomEvent<{ fileName?: string }>).detail?.fileName;
      if (fileName) {
        setSwapTargetKind("gen");
        setSwapTargetGenFile(fileName);
      }
      if (showStyleId) void refreshSwap(showStyleId);
    };
    window.addEventListener(CRASH_SWAP_SAVED, onSwap);
    window.addEventListener(CRASH_GEN_PLATE_SAVED, onGenPlate);
    return () => {
      window.removeEventListener(CRASH_SWAP_SAVED, onSwap);
      window.removeEventListener(CRASH_GEN_PLATE_SAVED, onGenPlate);
    };
  }, [showStyleId, refreshSwap]);

  useEffect(() => {
    if (!cardReady || productionStep !== 3 || !showStyleId) return;
    if (!fields.location.trim()) {
      seedWorldIdea(showStyleId, activePlaceType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardReady, productionStep, showStyleId, activePlaceType]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/characters");
        const data = await res.json();
        if (res.ok && Array.isArray(data.characters)) {
          setCharacters(data.characters as Character[]);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!cardReady) return;
    try {
      const lockedStyle =
        showStyleId ??
        readActiveEpisode()?.styleId ??
        loadShowStyleIdOptional() ??
        undefined;
      localStorage.setItem(
        FIELDS_KEY,
        JSON.stringify({
          ...fields,
          charId,
          showStyle: lockedStyle,
          productionStep,
          spineStep,
          styleCastKeys: selectedCastKeys.length ? selectedCastKeys : undefined,
          styleThumbKey: selectedCastKeys[0] || undefined,
          activePlaceType,
          styleWorldKey: selectedWorldKey || undefined,
          swapTargetKind,
          swapTargetGenFile: swapTargetGenFile || undefined,
          swapTargetUploadFile: swapTargetUploadFile || undefined,
        }),
      );
      localStorage.setItem(STEP_KEY, String(productionStep));
    } catch {
      /* ignore */
    }
  }, [
    fields,
    charId,
    showStyleId,
    productionStep,
    spineStep,
    selectedCastKeys,
    activePlaceType,
    selectedWorldKey,
    swapTargetKind,
    swapTargetGenFile,
    swapTargetUploadFile,
    cardReady,
  ]);

  /** New-character mode: fix stale wrong-style text when no cast picked. */
  useEffect(() => {
    if (!cardReady || productionStep !== 2 || !showStyleId || selectedCastKeys.length)
      return;
    const text = fields.character.trim();
    if (!text || characterPromptWrongStyle(showStyleId, text)) {
      const usedNames = (styleThumbs[showStyleId] ?? [])
        .map((t) => t.name)
        .filter(Boolean) as string[];
      const idea = pickFreshStyleCharacterIdea(showStyleId, usedNames, text || undefined);
      patchField("character", idea);
    }
    // Only when step / style / selection changes — not on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardReady, productionStep, showStyleId, selectedCastKeys, styleThumbs]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
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
      moveRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const bringFront = useCallback(() => {
    setZ(bumpCrashLabZ());
  }, []);

  const startMove = useCallback(
    (e: ReactMouseEvent) => {
      if ((e.target as HTMLElement).closest("button, select, textarea, input, a"))
        return;
      bringFront();
      e.preventDefault();
      moveRef.current = {
        mode: "move",
        startX: e.clientX,
        startY: e.clientY,
        orig: geom,
      };
    },
    [geom, bringFront],
  );

  function startResize(edge: string) {
    return (e: ReactMouseEvent) => {
      bringFront();
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

  function patchField<K extends keyof ScriptFillFields>(key: K, value: string) {
    setFields((f) => normalizeScriptFields({ ...f, [key]: value }));
  }

  function seedCharacterIdea(styleId: ShowStyleId, avoid?: string) {
    const usedNames = (styleThumbs[styleId] ?? [])
      .map((t) => t.name)
      .filter(Boolean) as string[];
    const idea = pickFreshStyleCharacterIdea(styleId, usedNames, avoid);
    patchField("character", idea);
  }

  function clearCastSelection() {
    setSelectedCastKeys([]);
    setCharId("");
  }

  function beginNewCharacter() {
    if (!showStyleId) return;
    clearCastSelection();
    seedCharacterIdea(showStyleId);
  }

  function spinCharacterIdea() {
    if (!showStyleId) return;
    clearCastSelection();
    seedCharacterIdea(showStyleId, fields.character);
  }

  function generateStyleCharacter() {
    if (!showStyleId || selectedCastKeys.length) return;
    const prompt = fields.character.trim();
    if (!prompt) return;
    dispatchNewStyleCharacter(showStyleId, prompt, [], true);
  }

  async function uploadCharacterImage(file: File, name: string, brief: string) {
    if (!showStyleId) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("styleId", showStyleId);
    fd.set("name", name);
    fd.set("brief", brief);
    const res = await fetch("/api/crash/style-cards/upload", {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    window.dispatchEvent(new CustomEvent(CRASH_STYLE_THUMB_SAVED));
    setThumbVersion((v) => v + 1);
    if (data.label?.name) {
      setStyleThumbs((prev) => {
        const rows = prev[showStyleId] ?? [];
        return {
          ...prev,
          [showStyleId]: [
            ...rows,
            {
              key: data.thumbKey,
              name: data.label.name,
              brief: data.label.brief,
            },
          ],
        };
      });
    }
  }

  function toggleCast(entry: { key: string; name: string; brief: string }) {
    setSelectedCastKeys((prev) => {
      const next = prev.includes(entry.key)
        ? prev.filter((k) => k !== entry.key)
        : [...prev, entry.key];
      if (next.length === 1) {
        const lab = matchLabCharacter(characters, entry.name);
        setCharId(lab?.id || "");
      } else if (!next.includes(entry.key) && next.length === 0) {
        setCharId("");
      } else if (next.length === 1) {
        const thumb = (showStyleId ? styleThumbs[showStyleId] : [])?.find(
          (t) => t.key === next[0],
        );
        if (thumb?.name) {
          const lab = matchLabCharacter(characters, thumb.name);
          setCharId(lab?.id || "");
        }
      }
      return next;
    });
  }

  function selectAllCast() {
    if (!showStyleId) return;
    const keys = (styleThumbs[showStyleId] ?? [])
      .filter((t) => t.name?.trim())
      .map((t) => t.key);
    setSelectedCastKeys(keys);
  }

  function seedWorldIdea(styleId: ShowStyleId, placeType: WorldPlaceTypeId, avoid?: string) {
    const usedNames = (worldThumbs[styleId] ?? [])
      .filter((t) => t.placeType === placeType)
      .map((t) => t.name)
      .filter(Boolean) as string[];
    const idea = pickFreshWorldPlaceIdea(styleId, placeType, usedNames, avoid);
    patchField("location", idea);
  }

  function spinWorldIdea() {
    if (!showStyleId) return;
    seedWorldIdea(showStyleId, activePlaceType, fields.location);
  }

  function generateWorldPlace() {
    if (!showStyleId) return;
    const prompt = fields.location.trim();
    if (!prompt) return;
    dispatchNewStylePlace(showStyleId, prompt, activePlaceType, true);
  }

  function pickPlaceType(id: WorldPlaceTypeId) {
    setActivePlaceType(id);
    if (showStyleId) seedWorldIdea(showStyleId, id);
  }

  function pickWorldThumb(entry: {
    key: string;
    name?: string;
    brief?: string;
    placeType?: WorldPlaceTypeId;
  }) {
    setSelectedWorldKey(entry.key);
    if (entry.placeType) setActivePlaceType(entry.placeType);
    if (entry.name) {
      patchField("location", entry.brief ? `${entry.name} — ${entry.brief}` : entry.name);
    }
  }

  function buildSwapTarget(): SwapTargetRef | null {
    if (!showStyleId) return null;
    if (swapTargetKind === "gen" && swapTargetGenFile) {
      return { kind: "gen", fileName: swapTargetGenFile };
    }
    if (swapTargetKind === "world" && selectedWorldKey) {
      return { kind: "world", styleId: showStyleId, thumbKey: selectedWorldKey };
    }
    if (swapTargetKind === "upload" && swapTargetUploadFile) {
      return { kind: "upload", fileName: swapTargetUploadFile };
    }
    return null;
  }

  function runSwap(cast: { key: string; name?: string }) {
    if (!showStyleId || !cast.name) return;
    const target = buildSwapTarget();
    if (!target) return;
    setSwapBusyKey(cast.key);
    setSwapError("");
    void (async () => {
      try {
        const res = await fetch("/api/crash/swap/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            styleId: showStyleId,
            castKey: cast.key,
            castName: cast.name,
            sourceKey: cast.key,
            target,
            castOrder: episodeCast.map((c) => c.key),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Swap failed");
        if (res.ok && data.label) {
          setSwapResults((prev) => ({ ...prev, [cast.key]: data.label }));
          setSwapVersion((v) => v + 1);
        }
        window.dispatchEvent(new CustomEvent(CRASH_SWAP_SAVED));
      } catch (e) {
        setSwapError(e instanceof Error ? e.message : "Swap failed — click Run swap again");
      } finally {
        setSwapBusyKey("");
      }
    })();
  }

  function retirePlate(fileName: string) {
    if (!showStyleId || !fileName) return;
    void (async () => {
      try {
        const res = await fetch("/api/crash/gen/retire-plate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Remove failed");
        if (swapTargetGenFile === fileName) setSwapTargetGenFile("");
        await refreshSwap(showStyleId);
      } catch (e) {
        setSwapError(e instanceof Error ? e.message : "Could not remove plate");
      }
    })();
  }

  function importSwap(
    cast: { key: string; name?: string },
    file: File,
  ) {
    if (!showStyleId || !cast.name) return;
    const target = buildSwapTarget();
    if (!target) return;
    setSwapBusyKey(cast.key);
    void (async () => {
      try {
        const fd = new FormData();
        fd.set("mode", "import");
        fd.set("styleId", showStyleId);
        fd.set("file", file);
        fd.set("castKey", cast.key);
        fd.set("castName", cast.name!);
        fd.set("sourceKey", cast.key);
        fd.set("targetKind", target.kind);
        if (target.kind === "world") {
          fd.set("targetThumbKey", target.thumbKey);
        } else if (target.kind === "gen") {
          fd.set("targetGenFile", target.fileName);
        } else {
          fd.set("targetUploadFile", target.fileName);
        }
        const res = await fetch("/api/crash/swap/import", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Import failed");
        if (res.ok && data.label) {
          setSwapResults((prev) => ({ ...prev, [cast.key]: data.label }));
          setSwapVersion((v) => v + 1);
        }
        window.dispatchEvent(new CustomEvent(CRASH_SWAP_SAVED));
      } catch (e) {
        console.error(e);
      } finally {
        setSwapBusyKey("");
      }
    })();
  }

  async function uploadSwapTarget(file: File) {
    if (!showStyleId) return;
    const fd = new FormData();
    fd.set("mode", "target");
    fd.set("styleId", showStyleId);
    fd.set("file", file);
    const res = await fetch("/api/crash/swap/import", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    setSwapTargetUploadFile(data.fileName || "");
    setSwapTargetKind("upload");
  }

  function continueToVoice() {
    setSwapUnlocked(true);
    setProductionStep(5);
  }

  function continueToStory() {
    setProductionStep(6);
  }

  function buildWorld() {
    if (!selectedCastKeys.length || !showStyleId) return;
    setWorldUnlocked(true);
    seedWorldIdea(showStyleId, activePlaceType);
    setProductionStep(3);
  }

  function onProductionStepSelect(step: ProductionStep) {
    if (step === 3 && !worldUnlocked && selectedCastKeys.length === 0) return;
    if (step === 4 && !worldUnlocked && selectedCastKeys.length === 0) return;
    if (step === 4 && showStyleId !== "deepfake") return;
    setProductionStep(step);
    if (step >= 3) setWorldUnlocked(true);
    if (step >= 4) setSwapUnlocked(true);
  }

  function pickStyle(id: ShowStyleId) {
    // Re-click selected → Characters. Switching shows stays on Style so the
    // highlight / Locked line updates (no “click did nothing” feel).
    if (showStyleId === id) {
      saveShowStyleId(id);
      setProductionStep(2);
      return;
    }
    const firstPick = !showStyleId;
    setShowStyleId(id);
    saveShowStyleId(id);
    setExpandedStyleId("");
    clearCastSelection();
    seedCharacterIdea(id);
    if (firstPick) setProductionStep(2);
  }

  function clearStyleSelection() {
    clearShowStyleId();
    setShowStyleId(null);
    setExpandedStyleId("");
    clearCastSelection();
    setProductionStep(1);
    setWorldUnlocked(false);
  }

  function toggleStyleExpand(id: ShowStyleId) {
    if (showStyleId !== id) {
      setShowStyleId(id);
      saveShowStyleId(id);
      setExpandedStyleId(id);
      clearCastSelection();
      seedCharacterIdea(id);
      setProductionStep(2);
      return;
    }
    setExpandedStyleId((cur) => (cur === id ? "" : id));
  }

  function editThumb(thumbKey: string, name: string, brief: string) {
    if (!showStyleId) return;
    void (async () => {
      try {
        const res = await fetch("/api/crash/style-cards/manifest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            styleId: showStyleId,
            thumbKey,
            name,
            brief: brief || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) return;
        setThumbVersion((v) => v + 1);
        setStyleThumbs((prev) => {
          const rows = prev[showStyleId] ?? [];
          const exists = rows.some((r) => r.key === thumbKey);
          const row = {
            key: thumbKey,
            name: data.label.name,
            brief: data.label.brief,
          };
          return {
            ...prev,
            [showStyleId]: exists
              ? rows.map((r) => (r.key === thumbKey ? row : r))
              : [...rows, row],
          };
        });
      } catch {
        /* ignore */
      }
    })();
  }

  function removeThumb(thumbKey: string) {
    if (!showStyleId) return;
    void (async () => {
      try {
        const res = await fetch("/api/crash/style-cards/thumb", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ styleId: showStyleId, thumbKey }),
        });
        if (!res.ok) return;
        setSelectedCastKeys((prev) => prev.filter((k) => k !== thumbKey));
        setThumbVersion((v) => v + 1);
        setStyleThumbs((prev) => ({
          ...prev,
          [showStyleId]: (prev[showStyleId] ?? []).filter((r) => r.key !== thumbKey),
        }));
        window.dispatchEvent(new CustomEvent(CRASH_STYLE_THUMB_SAVED));
      } catch {
        /* ignore */
      }
    })();
  }

  const maxDone = Math.max(
    productionStep - 1,
    swapUnlocked ? 3 : worldUnlocked ? 2 : selectedCastKeys.length > 0 ? 2 : 0,
  );

  const episodeCast = useMemo(() => {
    if (!showStyleId) return [];
    const rows = styleThumbs[showStyleId] ?? [];
    return selectedCastKeys
      .map((key) => rows.find((r) => r.key === key))
      .filter(Boolean) as { key: string; name?: string; brief?: string }[];
  }, [showStyleId, selectedCastKeys, styleThumbs]);

  const voiceCast = useMemo(() => {
    return resolveVoiceCast({
      swapResults,
      targetGenFile: swapTargetGenFile,
    });
  }, [swapResults, swapTargetGenFile]);

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
      onMouseDown={bringFront}
    >
      <div
        className="relative flex h-full flex-col overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--panel)] shadow-lg"
        style={{ width: px(geom.w), height: collapsed ? px(CRASH_STRIP_H) : "100%" }}
      >
        <div className={CRASH_PANEL_TITLE_BAR} onMouseDown={startMove}>
          <h2 className={`${CRASH_PANEL_TITLE_COL} text-[var(--magenta-hot)]`}>
            Script desk
          </h2>
          <span className={CRASH_PANEL_SUBTITLE_COL}>
            {preset?.label ?? "Pick style"}
          </span>
          <CrashLabCollapseBtn
            collapsed={collapsed}
            deskStacked={mode === "stack" || mode === "free"}
            freeFlow={mode === "free"}
            onToggle={togglePanel}
          />
        </div>

        {!collapsed ? (
          <>
            <ProductionFlowStepper
              current={productionStep}
              maxDone={maxDone}
              onSelect={onProductionStepSelect}
              showSwap={preset?.id === "deepfake"}
            />

            <div className="crash-panel-body crash-tray-scroll min-h-0 flex-1 overflow-y-auto p-2 pb-3">
              {productionStep === 1 ? (
                <div className="space-y-3 p-1">
                  <p className="text-[9px] uppercase tracking-wider text-[var(--mute)]">
                    What show are you making?
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {SHOW_STYLE_PRESETS.map((s) => (
                      <StylePresetCard
                        key={s.id}
                        preset={s}
                        selected={showStyleId === s.id}
                        expanded={expandedStyleId === s.id}
                        thumbKeys={(styleThumbs[s.id] ?? []).map((t) => t.key)}
                        thumbVersion={thumbVersion}
                        onSelect={pickStyle}
                        onToggleExpand={toggleStyleExpand}
                      />
                    ))}
                  </div>
                  {showStyleId ? (
                    <p className="text-[9px] text-[var(--acid)]">
                      Locked: <span className="text-[var(--chrome)]">{preset?.label}</span>
                      {" · "}
                      <button
                        type="button"
                        className="text-[var(--mute)] underline-offset-2 hover:underline"
                        onClick={clearStyleSelection}
                      >
                        Clear selection
                      </button>
                    </p>
                  ) : (
                    <p className="text-[9px] text-[var(--mute)]">
                      Click a show — opens Characters next.
                    </p>
                  )}
                </div>
              ) : null}

              {productionStep === 2 ? (
                !preset ? (
                  <p className="text-[10px] text-[var(--mute)]">
                    Pick a show on Style first.
                  </p>
                ) : (
                  <StyleCharacterPanel
                    preset={preset}
                    thumbs={styleThumbs[preset.id] ?? []}
                    thumbVersion={thumbVersion}
                    characters={characters}
                    selectedCastKeys={selectedCastKeys}
                    characterNotes={fields.character}
                    onToggleCharacter={toggleCast}
                    onSelectAllCast={selectAllCast}
                    onClearCast={clearCastSelection}
                    onCharacterNotesChange={(v) => patchField("character", v)}
                    onEditThumb={editThumb}
                    onRemoveThumb={removeThumb}
                    onSpinIdea={spinCharacterIdea}
                    onGenerateCharacter={generateStyleCharacter}
                    onUploadCharacter={uploadCharacterImage}
                    onBuildWorld={buildWorld}
                  />
                )
              ) : null}

              {productionStep === 3 ? (
                !preset ? (
                  <p className="text-[10px] text-[var(--mute)]">
                    Pick a show on Style first.
                  </p>
                ) : (
                  <StyleWorldPanel
                    preset={preset}
                    episodeCast={episodeCast}
                    thumbVersion={thumbVersion}
                    worldThumbs={worldThumbs[preset.id] ?? []}
                    worldThumbVersion={worldThumbVersion}
                    activePlaceType={activePlaceType}
                    selectedWorldKey={selectedWorldKey}
                    locationNotes={fields.location}
                    onPickPlaceType={pickPlaceType}
                    onPickWorldThumb={pickWorldThumb}
                    onLocationNotesChange={(v) => patchField("location", v)}
                    onSpinIdea={spinWorldIdea}
                    onGeneratePlace={generateWorldPlace}
                  />
                )
              ) : null}

              {productionStep === 4 ? (
                !preset ? (
                  <p className="text-[10px] text-[var(--mute)]">
                    Pick a show on Style first.
                  </p>
                ) : preset.id === "deepfake" ? (
                  <StyleSwapPanel
                    preset={preset}
                    episodeCast={episodeCast}
                    thumbVersion={thumbVersion}
                    selectedWorldKey={selectedWorldKey}
                    worldThumbVersion={worldThumbVersion}
                    targetKind={swapTargetKind}
                    targetGenFile={swapTargetGenFile}
                    targetUploadFile={swapTargetUploadFile}
                    genPlates={genPlates}
                    swapResults={swapResults}
                    swapVersion={swapVersion}
                    engine={swapEngine}
                    swapBusyKey={swapBusyKey}
                    onTargetKindChange={setSwapTargetKind}
                    onTargetGenFileChange={setSwapTargetGenFile}
                    onUploadTarget={uploadSwapTarget}
                    onRunSwap={runSwap}
                    onImportSwap={importSwap}
                    onContinueVoice={continueToVoice}
                    onRetirePlate={retirePlate}
                    swapError={swapError}
                  />
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] text-[var(--chrome-dim)]">
                      Face swap step is for <span className="text-[var(--chrome)]">Deep fake</span>{" "}
                      shows. {preset.label} skips to Voice.
                    </p>
                    <Btn tone="accent" className="!text-[10px]" onClick={continueToVoice}>
                      Continue to Voice →
                    </Btn>
                  </div>
                )
              ) : null}

              {productionStep === 5 ? (
                !preset ? (
                  <p className="text-[10px] text-[var(--mute)]">
                    Pick a show on Style first.
                  </p>
                ) : showStyleId === "deepfake" ? (
                  <div className="space-y-2 py-2">
                    <p className="text-[10px] text-[var(--acid)]">
                      Voice panel is on the right →
                    </p>
                    <p className="text-[9px] text-[var(--mute)]">
                      Describe each swapped face · Gen voice · Keep. Not Character Lab.
                    </p>
                    <Btn
                      tone="accent"
                      className="!text-[10px]"
                      onClick={() => dispatchProductionStep(6)}
                    >
                      Continue to Story →
                    </Btn>
                  </div>
                ) : (
                <div className="space-y-2">
                  <p className="text-[9px] uppercase tracking-wider text-[var(--mute)]">
                    Voice — ElevenLabs locks
                  </p>
                  {preset.characterMode === "arsehole" && selectedChar ? (
                    <div className="rounded-sm border border-[var(--line)] bg-[var(--panel-2)] p-2">
                      <p className="text-[11px] text-[var(--chrome)]">
                        {selectedChar.name}
                      </p>
                      <p className="text-[9px] text-[var(--mute)]">
                        {selectedChar.approvedVoiceAttemptId
                          ? "Voice locked ✓"
                          : "Voice not locked yet"}
                      </p>
                      <Link
                        href={`/lab/${selectedChar.id}`}
                        className="mt-1 inline-block text-[9px] text-[var(--acid)] underline"
                      >
                        Character Lab → Gen voice
                      </Link>
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {preset.presetCast.map((pc) => {
                        const lab = matchLabCharacter(characters, pc.name);
                        return (
                          <li
                            key={pc.id}
                            className="flex flex-wrap items-center justify-between gap-1 rounded-sm border border-[var(--line)] px-2 py-1"
                          >
                            <span className="text-[10px] text-[var(--chrome)]">
                              {pc.name}
                            </span>
                            {lab ? (
                              <Link
                                href={`/lab/${lab.id}`}
                                className="text-[9px] text-[var(--acid)] underline"
                              >
                                Voice →
                              </Link>
                            ) : (
                              <span className="text-[8px] text-[var(--mute)]">
                                create in Lab first
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <p className="text-[9px] text-[var(--chrome-dim)]">
                    ElevenLabs voice_id locks live on each character in Character
                    Lab.
                  </p>
                </div>
                )
              ) : null}

              {productionStep === 6 ? (
                !preset ? (
                  <p className="text-[10px] text-[var(--mute)]">
                    Pick a show on Style first.
                  </p>
                ) : (
                <div className="space-y-2">
                  {showStyleId === "deepfake" ? (
                    <p className="text-[10px] text-[var(--acid)]">
                      Story + SPX panels on the right → (Voice stays open too)
                    </p>
                  ) : null}
                  <p className="text-[9px] uppercase tracking-wider text-[var(--mute)]">
                    Story
                  </p>
                  <p className="text-[10px] text-[var(--chrome-dim)]">
                    {preset.storyNote}
                  </p>
                  {showStyleId ? (
                    <EpisodeRecipeFields styleId={showStyleId} />
                  ) : null}
                  {preset.hasStorySpine ? (
                    <>
                      <StorySpineStepper
                        current={spineStep}
                        maxDone={Math.max(0, spineStep - 1)}
                        onSelect={setSpineStep}
                      />
                      <div className="rounded-sm border border-[var(--line)] bg-[var(--panel-2)] p-2">
                        <p className="text-[10px] text-[var(--acid-deep)]">
                          Stage {stage.n} · {stage.title}
                        </p>
                        <p className="text-[9px] text-[var(--mute)]">{stage.note}</p>
                      </div>
                      {(
                        [
                          ["fakeWin", "Fake win"],
                          ["losesIt", "Loses it"],
                          ["getsSmashed", "Gets smashed"],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key}>
                          <label className="text-[8px] uppercase text-[var(--mute)]">
                            {label}
                          </label>
                          <textarea
                            rows={1}
                            value={fields[key]}
                            onChange={(e) => patchField(key, e.target.value)}
                            className="mt-0.5 w-full rounded-sm border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 text-[10px]"
                          />
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-[10px] text-[var(--mute)]">
                      Script template for {preset.label} comes next — not the
                      Skidmarks 9-stage spine.
                    </p>
                  )}
                </div>
                )
              ) : null}
            </div>

            <div
              className="absolute bottom-0 right-0 z-30 h-5 w-5 cursor-se-resize"
              title="Drag to resize"
              onMouseDown={startResize("se")}
            >
              <span className="pointer-events-none absolute bottom-0.5 right-0.5 block h-2.5 w-2.5 border-b-2 border-r-2 border-[var(--chrome-dim)]" />
            </div>
            <div
              className="absolute bottom-0 left-0 right-5 z-20 h-2 cursor-s-resize"
              onMouseDown={startResize("s")}
            />
            <div
              className="absolute bottom-2 top-2 right-0 z-20 w-2 cursor-e-resize"
              onMouseDown={startResize("e")}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
