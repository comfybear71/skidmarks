"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Btn, Field, Select, TextArea, TextInput } from "@/components/ui";
import {
  clearLivePlateDrag,
  copyFinishedPlate,
  peekLivePlateDrag,
  plateDragHasType,
  readPlateDrag,
  writePlateDrag,
  type CrashPlateDragPayload,
} from "@/lib/crashPlateDrag";
import { writeStackFocusPanel } from "@/lib/crashDeskLayout";
import {
  CRASH_SCENE_KIT_EVENT,
  DEFAULT_CAST_SLOTS,
  DEFAULT_PLACE_SLOTS,
  DEFAULT_PLATE_SLOTS,
  hydrateSceneKitFromDisk,
  readSceneKitDraft,
  syncSceneKitStyleFromDesk,
  writeSceneKitDraft,
} from "@/lib/crashSceneKitFields";
import { defaultCrashVoicePrompt } from "@/lib/crashVoicePrompt";
import {
  CRASH_SCRIPT_FIELDS_EVENT,
  CRASH_STYLE_THUMB_SAVED,
  CRASH_VOICE_SAVED,
  CRASH_WORLD_THUMB_SAVED,
} from "@/lib/crashStyleSync";
import {
  getShowStylePreset,
  type ShowStyleId,
} from "@/lib/showStylePresets";
import { humanMediaLabel } from "@/lib/mediaMatch";
import { useScriptDeskWatch } from "@/hooks/useScriptDeskWatch";
import {
  crashDeskSceneKitFetchUrl,
  crashDeskStoryFetchUrl,
} from "@/lib/crashActiveEpisode";

type FaceThumb = { key: string; name?: string; brief?: string };
type PlaceThumb = { key: string; name?: string };

type DropTarget =
  | { zone: "arse" }
  | { zone: "place"; index: number }
  | { zone: "cast"; index: number }
  | { zone: "plate"; index: number };

/**
 * Scene kit — one board; Skidmarks = Asshole + Places + Cast.
 * Ensemble (Sunny Banks) = park cast on top + Places, no Asshole box.
 */
export function CrashSceneKitPanel() {
  const desk = useScriptDeskWatch();
  const [styleIdState, setStyleId] = useState<ShowStyleId | null>(null);
  const styleId = styleIdState ?? desk.showStyleId;
  const parkSeedSig = useRef("");
  const placeSeedSig = useRef("");
  const [arseholeKey, setArseholeKey] = useState("");
  const [castKeys, setCastKeys] = useState<string[]>([]);
  const [castSlotCount, setCastSlotCount] = useState(DEFAULT_CAST_SLOTS);
  const [worldKeys, setWorldKeys] = useState<string[]>([]);
  const [placeSlotCount, setPlaceSlotCount] = useState(DEFAULT_PLACE_SLOTS);
  const [plateFiles, setPlateFiles] = useState<string[]>([]);
  const [plateSlotCount, setPlateSlotCount] = useState(DEFAULT_PLATE_SLOTS);
  const [activePlaceIndex, setActivePlaceIndex] = useState(0);
  const [faces, setFaces] = useState<FaceThumb[]>([]);
  /** Full manifest labels by key — strip can drop same-size dupes; labels still resolve. */
  const [faceLabels, setFaceLabels] = useState<
    Record<string, { name?: string; brief?: string }>
  >({});
  const [placeLabels, setPlaceLabels] = useState<PlaceThumb[]>([]);
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  /** Cast thumbKeys staged on each place slot — drag more people to rebuild the shot. */
  const [placeCastStaging, setPlaceCastStaging] = useState<
    Record<number, string[]>
  >({});
  const [plateTweak, setPlateTweak] = useState("");
  const plateTweakRef = useRef("");
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [activeCastKey, setActiveCastKey] = useState("");
  const [kitBoardOpen, setKitBoardOpen] = useState(true);
  const [castDeskOpen, setCastDeskOpen] = useState(true);
  const [bioEdit, setBioEdit] = useState("");
  const [nameEdit, setNameEdit] = useState("");
  const [bioBusy, setBioBusy] = useState(false);
  const [voicePromptLine, setVoicePromptLine] = useState("");
  const [voicePlaySrc, setVoicePlaySrc] = useState("");
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(
    null,
  );
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const leftBoardRef = useRef<HTMLDivElement | null>(null);
  const [castBoardH, setCastBoardH] = useState(0);

  useEffect(() => {
    if (!kitBoardOpen) return;
    const el = leftBoardRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      setCastBoardH(Math.max(220, Math.round(el.getBoundingClientRect().height)));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [
    kitBoardOpen,
    styleId,
    arseholeKey,
    worldKeys,
    placeSlotCount,
    plateFiles,
    plateSlotCount,
    tick,
  ]);

  const applyDraft = useCallback((d: ReturnType<typeof readSceneKitDraft>) => {
    setStyleId(d.styleId);
    setArseholeKey(d.arseholeKey);
    setCastKeys(d.castKeys);
    setCastSlotCount(d.castSlotCount);
    setWorldKeys(d.worldKeys);
    setPlaceSlotCount(d.placeSlotCount);
    setPlateFiles(d.plateFiles || []);
    setPlateSlotCount(d.plateSlotCount || DEFAULT_PLATE_SLOTS);
    setActivePlaceIndex(d.activePlaceIndex);
  }, []);

  useLayoutEffect(() => {
    applyDraft(readSceneKitDraft());
  }, [applyDraft]);

  const loadDraft = useCallback(() => {
    syncSceneKitStyleFromDesk();
    applyDraft(readSceneKitDraft());
  }, [applyDraft]);

  const loadThumbs = useCallback(async (sid: ShowStyleId | null) => {
    if (!sid) {
      setFaces([]);
      setFaceLabels({});
      setPlaceLabels([]);
      return;
    }
    try {
      const [facesRes, placesRes, labelsRes] = await Promise.all([
        fetch("/api/crash/style-cards"),
        fetch("/api/crash/world-cards"),
        fetch(
          `/api/crash/style-cards/manifest?styleId=${encodeURIComponent(sid)}`,
        ),
      ]);
      const facesData = await facesRes.json();
      const placesData = await placesRes.json();
      const labelsData = await labelsRes.json();
      const faceCard = Array.isArray(facesData.cards)
        ? facesData.cards.find((c: { id?: string }) => c.id === sid)
        : null;
      const placeCard = Array.isArray(placesData.cards)
        ? placesData.cards.find((c: { id?: string }) => c.id === sid)
        : null;
      setFaces(Array.isArray(faceCard?.thumbs) ? faceCard.thumbs : []);
      setPlaceLabels(Array.isArray(placeCard?.thumbs) ? placeCard.thumbs : []);
      setFaceLabels(
        labelsData?.labels && typeof labelsData.labels === "object"
          ? (labelsData.labels as Record<
              string,
              { name?: string; brief?: string }
            >)
          : {},
      );
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      syncSceneKitStyleFromDesk();
      // Disk kit is source of truth after restore / wipe
      const restored = await hydrateSceneKitFromDisk();
      if (!cancelled && restored) {
        applyDraft(restored);
        return;
      }
      if (!cancelled) applyDraft(readSceneKitDraft());
    })();
    return () => {
      cancelled = true;
    };
  }, [applyDraft]);

  useEffect(() => {
    void loadThumbs(styleId);
  }, [styleId, tick, loadThumbs]);

  useEffect(() => {
    const onKit = () => loadDraft();
    const onFields = () => {
      syncSceneKitStyleFromDesk();
      loadDraft();
    };
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(CRASH_SCENE_KIT_EVENT, onKit);
    window.addEventListener(CRASH_SCRIPT_FIELDS_EVENT, onFields);
    window.addEventListener(CRASH_STYLE_THUMB_SAVED, bump);
    window.addEventListener(CRASH_WORLD_THUMB_SAVED, bump);
    window.addEventListener(CRASH_VOICE_SAVED, bump);
    return () => {
      window.removeEventListener(CRASH_SCENE_KIT_EVENT, onKit);
      window.removeEventListener(CRASH_SCRIPT_FIELDS_EVENT, onFields);
      window.removeEventListener(CRASH_STYLE_THUMB_SAVED, bump);
      window.removeEventListener(CRASH_WORLD_THUMB_SAVED, bump);
      window.removeEventListener(CRASH_VOICE_SAVED, bump);
    };
  }, [loadDraft]);

  const faceDisplayName = useCallback(
    (key: string) => {
      if (!key) return "";
      const fromStrip = faces.find((f) => f.key === key)?.name?.trim();
      const fromManifest = faceLabels[key]?.name?.trim();
      const n = fromStrip || fromManifest || "";
      if (!n || n.toLowerCase() === "file") return "";
      return n;
    },
    [faces, faceLabels],
  );

  /** Strip can drop same-size dupes — always fall back to manifest / filename. */
  const faceName = useCallback(
    (key: string) => {
      if (!key) return "?";
      const labeled = faceDisplayName(key);
      if (labeled) return labeled;
      const raw = faceLabels[key]?.name?.trim();
      if (raw && raw.toLowerCase() !== "file") return raw;
      const base = key.replace(/^g:/, "").replace(/\.[^.]+$/, "");
      return base || "?";
    },
    [faceDisplayName, faceLabels],
  );

  const placeName = useCallback(
    (key: string) => placeLabels.find((p) => p.key === key)?.name || "?",
    [placeLabels],
  );

  const stylePreset = styleId ? getShowStylePreset(styleId) : null;
  const isEnsemble = stylePreset?.characterMode === "ensemble";

  /** Gallery keys for fixed park cast (Sunny Banks etc.) — name match. */
  const parkCastKeys = useMemo(() => {
    if (!styleId || !isEnsemble || !stylePreset) return [] as string[];
    const byName = new Map<string, string>();
    for (const [key, lab] of Object.entries(faceLabels)) {
      const n = lab.name?.trim().toLowerCase();
      if (n) byName.set(n, key);
    }
    for (const f of faces) {
      const n = f.name?.trim().toLowerCase();
      if (n && !byName.has(n)) byName.set(n, f.key);
    }
    const keys: string[] = [];
    for (const c of stylePreset.presetCast) {
      const k = byName.get(c.name.trim().toLowerCase());
      if (k && !keys.includes(k)) keys.push(k);
    }
    return keys;
  }, [styleId, isEnsemble, stylePreset, faceLabels, faces]);

  /** Keep park faces + Crash Lab specials (Kylie etc.) on the board. */
  useEffect(() => {
    if (!styleId || !isEnsemble) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/crash/show-cast/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ styleId }),
        });
        const data = await res.json();
        if (!res.ok || cancelled) return;
        const park = Array.isArray(data.parkKeys)
          ? (data.parkKeys as string[]).filter(Boolean)
          : parkCastKeys;
        const guests = Array.isArray(data.guestKeys)
          ? (data.guestKeys as string[]).filter(Boolean)
          : [];
        const synced = [
          ...park,
          ...guests.filter((k) => !park.includes(k)),
        ];
        if (!synced.length) return;
        const sig = `${styleId}:${synced.join("|")}`;
        const frontOk = synced.every((k, i) => castKeys[i] === k);
        const minSlots = Math.max(
          DEFAULT_CAST_SLOTS,
          synced.length + 1,
          castSlotCount,
        );
        if (frontOk && castSlotCount >= synced.length + 1) {
          parkSeedSig.current = sig;
          setTick((n) => n + 1);
          return;
        }
        if (frontOk && parkSeedSig.current === sig) return;
        const extras = castKeys.filter(
          (k) => k && !synced.includes(k),
        );
        const merged = [...synced, ...extras];
        const nextSlots = Math.max(minSlots, merged.length + 1);
        parkSeedSig.current = sig;
        setCastKeys(merged);
        setCastSlotCount(nextSlots);
        writeSceneKitDraft({
          castKeys: merged,
          castSlotCount: nextSlots,
        });
        setTick((n) => n + 1);
      } catch {
        /* keep local park seed fallback below */
        if (cancelled || parkCastKeys.length === 0) return;
        const guestsLocal = castKeys.filter(
          (k) => k && !parkCastKeys.includes(k),
        );
        const merged = [...parkCastKeys, ...guestsLocal];
        const frontOk = parkCastKeys.every((k, i) => castKeys[i] === k);
        if (frontOk && castSlotCount >= parkCastKeys.length + 1) return;
        setCastKeys(merged);
        setCastSlotCount(
          Math.max(DEFAULT_CAST_SLOTS, merged.length + 1, castSlotCount),
        );
        writeSceneKitDraft({
          castKeys: merged,
          castSlotCount: Math.max(
            DEFAULT_CAST_SLOTS,
            merged.length + 1,
            castSlotCount,
          ),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    styleId,
    isEnsemble,
    parkCastKeys,
    castKeys,
    castSlotCount,
  ]);

  /** Sunny Banks — fill Places with all World gallery stills (12). */
  useEffect(() => {
    if (!styleId || !isEnsemble) return;
    const galleryKeys = placeLabels
      .map((p) => String(p.key || "").trim())
      .filter(Boolean);
    if (galleryKeys.length === 0) return;
    const sig = `${styleId}:${galleryKeys.join("|")}`;
    const allPresent = galleryKeys.every((k) => worldKeys.includes(k));
    const slotOk = placeSlotCount >= galleryKeys.length;
    if (allPresent && slotOk) {
      placeSeedSig.current = sig;
      return;
    }
    if (allPresent && placeSeedSig.current === sig) return;
    const extras = worldKeys.filter((k) => k && !galleryKeys.includes(k));
    const merged = [...galleryKeys, ...extras];
    const nextSlots = Math.max(placeSlotCount, merged.length, galleryKeys.length);
    placeSeedSig.current = sig;
    setWorldKeys(merged);
    setPlaceSlotCount(nextSlots);
    writeSceneKitDraft({
      worldKeys: merged,
      placeSlotCount: nextSlots,
    });
  }, [styleId, isEnsemble, placeLabels, worldKeys, placeSlotCount]);

  const arseholeTitle = useMemo(() => {
    const n = faceDisplayName(arseholeKey);
    if (n) return n;
    return arseholeKey ? "rename this face" : "drop face";
  }, [arseholeKey, faceDisplayName]);

  const filledPlaces = worldKeys.filter(Boolean).length;
  const filledShotPlates = plateFiles.filter(Boolean).length;
  const kitReady = isEnsemble
    ? Boolean(filledPlaces)
    : Boolean(arseholeKey && filledPlaces);

  function clearPlateSlot(index: number) {
    const next = padPlateFiles(plateFiles, plateSlotCount);
    next[index] = "";
    setPlateFiles(next);
    writeSceneKitDraft({ plateFiles: next });
    setStatus(`Shot plate ${index + 1} cleared`);
  }

  /** Remove an empty finished-plate slot entirely. Keeps at least 1 slot. */
  function removePlateSlot(index: number) {
    if (plateSlotCount <= 1) {
      setStatus("Need at least one plate slot");
      return;
    }
    const pad = padPlateFiles(plateFiles, plateSlotCount);
    pad.splice(index, 1);
    const nextCount = Math.max(1, plateSlotCount - 1);
    const next = pad.slice(0, nextCount);
    setPlateFiles(next);
    setPlateSlotCount(nextCount);
    writeSceneKitDraft({ plateFiles: next, plateSlotCount: nextCount });
    setStatus(`Removed plate slot ${index + 1}`);
  }

  function addPlateSlot() {
    const n = plateSlotCount + 1;
    setPlateSlotCount(n);
    writeSceneKitDraft({ plateSlotCount: n });
  }

  async function pullStoryPlates() {
    if (!styleId || busy) return;
    setBusy(true);
    setStatus("");
    try {
      const storyUrl = crashDeskStoryFetchUrl(styleId);
      if (!storyUrl) throw new Error("Open an episode first");
      const res = await fetch(storyUrl);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Story load failed");
      const doc = data.story || data;
      const seen = new Set<string>();
      const files: string[] = [];
      for (const sc of doc.scenes || []) {
        for (const sh of sc.shots || []) {
          const f = String(sh.plateFile || "").trim();
          if (!f || seen.has(f)) continue;
          seen.add(f);
          files.push(f);
        }
      }
      const count = Math.max(1, files.length);
      const next = padPlateFiles(files, count);
      setPlateFiles(next);
      setPlateSlotCount(count);
      writeSceneKitDraft({ plateFiles: next, plateSlotCount: count });
      setStatus(`Pulled ${files.length} finished plates from Story`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Pull failed");
    } finally {
      setBusy(false);
    }
  }

  function copyPlateSlot(index: number) {
    const fileName = padPlateFiles(plateFiles, plateSlotCount)[index] || "";
    if (!fileName) {
      setStatus(`Slot ${index + 1} empty`);
      return;
    }
    copyFinishedPlate({
      fileName,
      label: humanMediaLabel(fileName),
      slot: index + 1,
    });
    setStatus(
      `Copied plate ${index + 1} — Paste on a Story shot (same picture, different line)`,
    );
  }

  async function promoteGenToCast(
    sid: ShowStyleId,
    genFileName: string,
  ): Promise<string> {
    const res = await fetch("/api/crash/style-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genFileName, styleId: sid }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save face");
    setTick((n) => n + 1);
    return String(data.thumbKey || "");
  }

  async function promoteGenToWorld(
    sid: ShowStyleId,
    genFileName: string,
  ): Promise<string> {
    const res = await fetch("/api/crash/world-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        genFileName,
        styleId: sid,
        placeType: "social_public",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save place");
    setTick((n) => n + 1);
    return String(data.thumbKey || "");
  }

  function padWorldKeys(keys: string[], count: number): string[] {
    const next = [...keys];
    while (next.length < count) next.push("");
    return next.slice(0, Math.max(count, keys.length));
  }

  function padCastKeys(keys: string[], count: number): string[] {
    const next = [...keys];
    while (next.length < count) next.push("");
    return next.slice(0, Math.max(count, keys.length));
  }

  function padPlateFiles(files: string[], count: number): string[] {
    const next = [...files];
    while (next.length < count) next.push("");
    return next.slice(0, Math.max(count, files.length));
  }

  function firstEmptyPlateSlot(files: string[]): number {
    const i = files.findIndex((f) => !f);
    return i >= 0 ? i : files.length;
  }

  /**
   * Cast onto a place (or onto a shot-plate slot) → new cplate.
   * overwrite false = never clobber a filled plate; pick first empty.
   * plateSlot set = land in that slot (empty plate drop).
   */
  async function makeShotPlateFromCast(opts: {
    castKey: string;
    label?: string;
    placeIndex: number;
    plateSlot?: number;
  }): Promise<void> {
    if (!styleId) throw new Error("Pick a show style first");
    const worldKey =
      padWorldKeys(worldKeys, placeSlotCount)[opts.placeIndex] || "";
    if (!worldKey) {
      throw new Error(
        "Pick a place first (click it), then drop cast onto the place — or onto an empty shot-plate slot",
      );
    }
    const castKey = opts.castKey.trim();
    if (!castKey) throw new Error("Face missing");
    const prev = placeCastStaging[opts.placeIndex] || [];
    const staged = prev.includes(castKey) ? prev : [...prev, castKey];
    setPlaceCastStaging((s) => ({ ...s, [opts.placeIndex]: staged }));
    setActivePlaceIndex(opts.placeIndex);
    setStatus(
      `Making shot plate — ${staged.length} cast on ${placeName(worldKey) || "place"}…`,
    );
    const res = await fetch("/api/crash/swap/plate-cast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        styleId,
        worldKey,
        castKeys: staged,
        note: plateTweakRef.current.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Shot plate failed");
    const fileName = String(data.fileName || "").trim();
    if (!fileName) throw new Error("No plate file returned");
    const nextPlates = padPlateFiles(plateFiles, plateSlotCount);
    let slot: number;
    if (typeof opts.plateSlot === "number") {
      slot = opts.plateSlot;
    } else if (!nextPlates[opts.placeIndex]) {
      slot = opts.placeIndex;
    } else {
      slot = firstEmptyPlateSlot(nextPlates);
    }
    while (nextPlates.length <= slot) nextPlates.push("");
    nextPlates[slot] = fileName;
    const nextCount = Math.max(plateSlotCount, nextPlates.length);
    setPlateFiles(nextPlates);
    setPlateSlotCount(nextCount);
    writeSceneKitDraft({
      plateFiles: nextPlates,
      plateSlotCount: nextCount,
      activePlaceIndex: opts.placeIndex,
    });
    setTick((n) => n + 1);
    const names = Array.isArray(data.castNames)
      ? (data.castNames as string[]).join(" + ")
      : opts.label || faceName(castKey);
    setStatus(
      `Shot plate ${slot + 1} — ${names} @ ${placeName(worldKey) || "place"}. Drag more cast onto the place to add them.`,
    );
  }

  async function applyDrop(target: DropTarget, payload: CrashPlateDragPayload) {
    if (!styleId) {
      setStatus("Pick a show style first");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      if (target.zone === "plate") {
        if (payload.kind === "cast") {
          await makeShotPlateFromCast({
            castKey: payload.thumbKey,
            label: payload.label,
            placeIndex: activePlaceIndex,
            plateSlot: target.index,
          });
          return;
        }
        let fileName = "";
        if (payload.kind === "cplate") fileName = payload.fileName;
        else if (payload.kind === "swap") fileName = payload.fileName;
        else throw new Error("Drop a finished shot plate (cplate) here");
        if (!fileName.trim()) throw new Error("Plate missing");
        const next = padPlateFiles(plateFiles, plateSlotCount);
        next[target.index] = fileName.trim();
        setPlateFiles(next);
        writeSceneKitDraft({ plateFiles: next });
        setStatus(`Plate ${target.index + 1} set — Copy then Paste on Story`);
        return;
      }

      if (target.zone === "place") {
        // Cast / arse face onto a filled place → build shot plate
        if (payload.kind === "cast") {
          await makeShotPlateFromCast({
            castKey: payload.thumbKey,
            label: payload.label,
            placeIndex: target.index,
          });
          return;
        }
        if (payload.kind === "cplate") {
          throw new Error(
            "Places = empty BG only — drop a world/place card, or drag cast onto a place to make a shot",
          );
        }
        let key = "";
        if (payload.kind === "world") key = payload.thumbKey;
        else {
          throw new Error("Drop a place / world card here (or cast onto a filled place)");
        }
        if (!key) throw new Error("Place missing");
        const next = padWorldKeys(worldKeys, placeSlotCount);
        next[target.index] = key;
        setWorldKeys(next);
        setActivePlaceIndex(target.index);
        setPlaceCastStaging((s) => {
          const n = { ...s };
          delete n[target.index];
          return n;
        });
        writeSceneKitDraft({
          worldKeys: next,
          activePlaceIndex: target.index,
        });
        setStatus(`${placeName(key) || "Place"} in slot ${target.index + 1}`);
        return;
      }

      let key = "";
      let label = "";
      if (payload.kind === "cast") {
        key = payload.thumbKey;
        label = payload.label || "";
      } else if (payload.kind === "cplate") {
        key = await promoteGenToCast(styleId, payload.fileName);
        label = payload.label || "";
      } else {
        throw new Error("Drop a face from Character / Image Gen");
      }
      if (!key) throw new Error("Face missing");

      if (target.zone === "arse") {
        setArseholeKey(key);
        writeSceneKitDraft({ arseholeKey: key });
        setStatus(
          `${label || faceName(key) || "Arsehole"} locked in Asshole slot`,
        );
        return;
      }

      if (key === arseholeKey) {
        setStatus("That’s the Asshole — use the top slot");
        return;
      }
      const next = padCastKeys(castKeys, castSlotCount);
      next[target.index] = key;
      setCastKeys(next);
      writeSceneKitDraft({ castKeys: next });
      setStatus(
        `${label || faceName(key) || "Cast"} in cast slot ${target.index + 1}`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setDropTarget(null);
    }
  }

  function onDragOver(target: DropTarget, e: ReactDragEvent) {
    const types = Array.from(e.dataTransfer.types || []);
    const hasFile = types.includes("Files");
    if (!hasFile && !plateDragHasType(e) && !peekLivePlateDrag()) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setDropTarget(target);
  }

  async function uploadFaceFile(file: File): Promise<{
    key: string;
    label: string;
  }> {
    if (!styleId) throw new Error("Pick a show style first");
    if (!file.type.startsWith("image/") && !/\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
      throw new Error("Drop an image file (png/jpg/webp)");
    }
    const label = file.name.replace(/\.[^.]+$/, "") || "Face";
    const fd = new FormData();
    fd.set("file", file);
    fd.set("styleId", styleId);
    fd.set("name", label);
    fd.set("brief", label);
    const res = await fetch("/api/crash/style-cards/upload", {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    const key = typeof data.thumbKey === "string" ? data.thumbKey : "";
    if (!key) throw new Error("Upload returned no face");
    await fetch("/api/crash/style-cards/manifest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        styleId,
        thumbKey: key,
        name: label,
        brief: label,
      }),
    }).catch(() => undefined);
    window.dispatchEvent(new CustomEvent(CRASH_STYLE_THUMB_SAVED));
    setTick((n) => n + 1);
    return { key, label };
  }

  async function uploadPlaceFile(file: File): Promise<{
    key: string;
    label: string;
  }> {
    if (!styleId) throw new Error("Pick a show style first");
    if (
      !file.type.startsWith("image/") &&
      !/\.(png|jpe?g|webp|gif)$/i.test(file.name)
    ) {
      throw new Error("Drop an image file (png/jpg/webp)");
    }
    // Already in gallery under this filename? Reuse — don't duplicate.
    const base = file.name.replace(/^.*[\\/]/, "");
    const existing = placeLabels.find(
      (p) =>
        p.key === `g:${base}` ||
        p.key.endsWith(`/${base}`) ||
        p.key.slice(2) === base,
    );
    if (existing) {
      return { key: existing.key, label: existing.name || base };
    }
    const label = base.replace(/\.[^.]+$/, "") || "Place";
    const fd = new FormData();
    fd.set("file", file);
    fd.set("styleId", styleId);
    fd.set("name", label);
    fd.set("brief", label);
    fd.set("placeType", "social_public");
    const res = await fetch("/api/crash/world-cards/upload", {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Place upload failed");
    const key = typeof data.thumbKey === "string" ? data.thumbKey : "";
    if (!key) throw new Error("Upload returned no place");
    setTick((n) => n + 1);
    await loadThumbs(styleId);
    return {
      key,
      label: data.label?.name || label,
    };
  }

  function onDropZone(target: DropTarget, e: ReactDragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);

    // Cast/place drag always wins over native <img> file dump (browser attaches
    // the picture as Files — that was wiping places with the face portrait).
    const payload = readPlateDrag(e) || peekLivePlateDrag();
    if (payload) {
      clearLivePlateDrag();
      void applyDrop(target, payload);
      return;
    }

    const file = e.dataTransfer.files?.[0];
    if (file && target.zone === "place") {
      clearLivePlateDrag();
      void (async () => {
        setBusy(true);
        setStatus("Adding place…");
        try {
          const { key, label } = await uploadPlaceFile(file);
          const next = padWorldKeys(worldKeys, placeSlotCount);
          next[target.index] = key;
          setWorldKeys(next);
          setActivePlaceIndex(target.index);
          setPlaceCastStaging((s) => {
            const n = { ...s };
            delete n[target.index];
            return n;
          });
          writeSceneKitDraft({
            worldKeys: next,
            activePlaceIndex: target.index,
          });
          setStatus(`${label} in place slot ${target.index + 1}`);
        } catch (err) {
          setStatus(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      })();
      return;
    }

    if (file && target.zone !== "place") {
      clearLivePlateDrag();
      void (async () => {
        setBusy(true);
        setStatus("Uploading face…");
        try {
          const { key, label } = await uploadFaceFile(file);
          if (target.zone === "arse") {
            setArseholeKey(key);
            writeSceneKitDraft({ arseholeKey: key });
            setStatus(`${label} locked in Asshole slot`);
            return;
          }
          if (key === arseholeKey) {
            setStatus("That’s the Asshole — use the top slot");
            return;
          }
          const next = padCastKeys(castKeys, castSlotCount);
          next[target.index] = key;
          setCastKeys(next);
          writeSceneKitDraft({ castKeys: next });
          setStatus(`${label} in cast slot ${target.index + 1}`);
        } catch (err) {
          setStatus(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      })();
      return;
    }

    clearLivePlateDrag();
    setStatus(
      target.zone === "place"
        ? "Drop a place PNG, or drag cast onto a filled place to make a shot"
        : "Drop a face file, or drag from Character / Image Gen",
    );
  }

  function clearPlaceSlot(index: number) {
    const next = padWorldKeys(worldKeys, placeSlotCount);
    next[index] = "";
    setWorldKeys(next);
    setPlaceCastStaging((s) => {
      const n = { ...s };
      delete n[index];
      return n;
    });
    writeSceneKitDraft({ worldKeys: next });
    setStatus(`Place slot ${index + 1} cleared`);
  }

  /** Pack / disk wins — fixes stale browser kit missing a place after refresh. */
  async function reloadPlacesFromPack() {
    setBusy(true);
    setStatus("Reloading places from pack…");
    try {
      const packUrl = styleId ? crashDeskSceneKitFetchUrl(styleId) : null;
      const restored = await hydrateSceneKitFromDisk(packUrl);
      if (!restored) {
        throw new Error(
          packUrl
            ? "Could not read pack scene kit"
            : "Open an episode first — Reload places reads that pack",
        );
      }
      applyDraft(restored);
      setTick((n) => n + 1);
      const n = restored.worldKeys.filter(Boolean).length;
      setStatus(`Places reloaded — ${n} location${n === 1 ? "" : "s"}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /** Remove a place slot entirely (empty unused drops). Keeps at least 1 slot. */
  function removePlaceSlot(index: number) {
    if (placeSlotCount <= 1) {
      setStatus("Need at least one place slot");
      return;
    }
    const pad = padWorldKeys(worldKeys, placeSlotCount);
    pad.splice(index, 1);
    const nextCount = Math.max(1, placeSlotCount - 1);
    const nextKeys = pad.slice(0, nextCount);
    const nextActive = Math.min(
      activePlaceIndex >= index
        ? Math.max(0, activePlaceIndex - 1)
        : activePlaceIndex,
      nextCount - 1,
    );
    setWorldKeys(nextKeys);
    setPlaceSlotCount(nextCount);
    setActivePlaceIndex(nextActive);
    writeSceneKitDraft({
      worldKeys: nextKeys,
      placeSlotCount: nextCount,
      activePlaceIndex: nextActive,
    });
    setStatus(`Removed place slot ${index + 1}`);
  }

  /** Drop trailing empty place slots in one go. */
  function trimEmptyPlaceSlots() {
    const pad = padWorldKeys(worldKeys, placeSlotCount);
    let lastFilled = -1;
    for (let i = 0; i < pad.length; i++) {
      if (pad[i]) lastFilled = i;
    }
    const nextCount = Math.max(1, lastFilled + 1);
    if (nextCount >= placeSlotCount) {
      setStatus("No empty place slots to trim");
      return;
    }
    const nextKeys = pad.slice(0, nextCount);
    const nextActive = Math.min(activePlaceIndex, nextCount - 1);
    setWorldKeys(nextKeys);
    setPlaceSlotCount(nextCount);
    setActivePlaceIndex(nextActive);
    writeSceneKitDraft({
      worldKeys: nextKeys,
      placeSlotCount: nextCount,
      activePlaceIndex: nextActive,
    });
    setStatus(`Trimmed to ${nextCount} place slot${nextCount === 1 ? "" : "s"}`);
  }

  function clearArse() {
    setArseholeKey("");
    writeSceneKitDraft({ arseholeKey: "" });
    setStatus("Asshole slot cleared");
  }

  function clearCastSlot(index: number) {
    if (isEnsemble && index < parkCastKeys.length) {
      setStatus("Park cast stays — clear guest slots only");
      return;
    }
    const gone = castKeys[index] || "";
    const next = padCastKeys(castKeys, castSlotCount);
    next[index] = "";
    setCastKeys(next);
    writeSceneKitDraft({ castKeys: next });
    if (gone && gone === activeCastKey) {
      setActiveCastKey("");
      setBioEdit("");
    }
    setStatus(`Cast slot ${index + 1} cleared`);
  }

  /** Remove a cast slot entirely. Keeps at least 1. */
  function removeCastSlot(index: number) {
    if (isEnsemble && index < parkCastKeys.length) {
      setStatus("Park cast stays — remove guest slots only");
      return;
    }
    const minSlots = isEnsemble ? Math.max(1, parkCastKeys.length) : 1;
    if (castSlotCount <= minSlots) {
      setStatus(
        isEnsemble
          ? "Keep park cast — add guests with +"
          : "Need at least one cast slot",
      );
      return;
    }
    const pad = padCastKeys(castKeys, castSlotCount);
    const gone = pad[index] || "";
    pad.splice(index, 1);
    const nextCount = Math.max(1, castSlotCount - 1);
    const nextKeys = pad.slice(0, nextCount);
    setCastKeys(nextKeys);
    setCastSlotCount(nextCount);
    writeSceneKitDraft({ castKeys: nextKeys, castSlotCount: nextCount });
    if (gone && gone === activeCastKey) {
      setActiveCastKey("");
      setBioEdit("");
    }
    setStatus(`Removed cast slot ${index + 1}`);
  }

  /** Drop trailing empty cast slots. */
  function trimEmptyCastSlots() {
    const pad = padCastKeys(castKeys, castSlotCount);
    let lastFilled = -1;
    for (let i = 0; i < pad.length; i++) {
      if (pad[i]) lastFilled = i;
    }
    const minKeep = isEnsemble
      ? Math.max(parkCastKeys.length + 1, 1)
      : 1;
    const nextCount = Math.max(minKeep, lastFilled + 1);
    if (nextCount >= castSlotCount) {
      setStatus("No empty cast slots to trim");
      return;
    }
    const nextKeys = pad.slice(0, nextCount);
    setCastKeys(nextKeys);
    setCastSlotCount(nextCount);
    writeSceneKitDraft({ castKeys: nextKeys, castSlotCount: nextCount });
    setStatus(`Trimmed to ${nextCount} cast slot${nextCount === 1 ? "" : "s"}`);
  }

  function addPlaceSlot() {
    const n = placeSlotCount + 1;
    setPlaceSlotCount(n);
    writeSceneKitDraft({ placeSlotCount: n });
  }

  function addCastSlot() {
    const n = castSlotCount + 1;
    setCastSlotCount(n);
    writeSceneKitDraft({ castSlotCount: n });
  }

  function selectPlace(index: number) {
    setActivePlaceIndex(index);
    writeSceneKitDraft({ activePlaceIndex: index });
  }

  function selectCast(key: string) {
    if (!key) return;
    setActiveCastKey(key);
    setCastDeskOpen(true);
    const face = faces.find((f) => f.key === key);
    const label = faceDisplayName(key) || face?.name || "";
    setNameEdit(label === "?" ? "" : label);
    setBioEdit(face?.brief?.trim() || "");
    setTick((n) => n + 1);
  }

  async function saveCastFace() {
    if (!styleId || !activeCastKey) return;
    const name = nameEdit.trim() || faceName(activeCastKey).trim();
    if (
      !name ||
      name === "?" ||
      /^file$/i.test(name) ||
      /^face_/i.test(name)
    ) {
      setStatus("Type a name for this face first");
      return;
    }
    setBioBusy(true);
    try {
      const res = await fetch("/api/crash/style-cards/manifest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId,
          thumbKey: activeCastKey,
          name,
          brief: bioEdit.trim() || name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setFaceLabels((prev) => ({
        ...prev,
        [activeCastKey]: { name, brief: bioEdit.trim() || name },
      }));
      setTick((n) => n + 1);
      setStatus(`Saved — ${name}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBioBusy(false);
    }
  }

  useEffect(() => {
    if (!activeCastKey) {
      setBioEdit("");
      setNameEdit("");
      setVoicePromptLine("");
      setVoicePlaySrc("");
      return;
    }
    const face = faces.find((f) => f.key === activeCastKey);
    const label = faceDisplayName(activeCastKey) || face?.name || "";
    setNameEdit(label === "?" ? "" : label);
    setBioEdit(face?.brief?.trim() || "");
  }, [activeCastKey, faces, tick, faceDisplayName]);

  useEffect(() => {
    if (!styleId || !activeCastKey) {
      setVoicePromptLine("");
      setVoicePlaySrc("");
      return;
    }
    const label = faceName(activeCastKey);
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/crash/voice?styleId=${encodeURIComponent(styleId)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        const slot = data.slots?.[activeCastKey] as
          | {
              voiceDescription?: string;
              approvedAttemptId?: string;
              approvedVoiceId?: string;
              keeperSaved?: boolean;
              attempts?: { id: string; fileName?: string; status?: string }[];
            }
          | undefined;
        setVoicePromptLine(
          slot?.voiceDescription?.trim() || defaultCrashVoicePrompt(label),
        );
        // Locked = Play (green) + Stop (red) — same sample as Voice panel
        const approvedId = String(slot?.approvedAttemptId || "").trim();
        const locked = Boolean(
          approvedId || String(slot?.approvedVoiceId || "").trim(),
        );
        setVoicePlaySrc(
          locked && approvedId
            ? `/api/crash/voice/file?styleId=${encodeURIComponent(styleId)}&castKey=${encodeURIComponent(activeCastKey)}&attemptId=${encodeURIComponent(approvedId)}`
            : "",
        );
      } catch {
        if (!cancelled) {
          setVoicePromptLine(defaultCrashVoicePrompt(label));
          setVoicePlaySrc("");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [styleId, activeCastKey, faceName, tick]);

  function playCastVoice() {
    const el = voiceAudioRef.current;
    if (!el || !voicePlaySrc) return;
    void el.play().catch(() => {});
  }

  function onCastWheel(e: ReactWheelEvent) {
    e.stopPropagation();
  }


  if (!styleId) {
    return (
      <div className="space-y-2 p-1 text-sm text-[var(--mute)]">
        <p>Pick a show style on Script desk first.</p>
        <Btn tone="accent" onClick={() => writeStackFocusPanel("script")}>
          Open Script desk
        </Btn>
      </div>
    );
  }

  const arseSrc = arseholeKey
    ? `/api/crash/style-cards/file?styleId=${encodeURIComponent(styleId)}&thumb=${encodeURIComponent(arseholeKey)}&v=${tick}`
    : "";

  const worldPad = padWorldKeys(worldKeys, placeSlotCount);
  const castPad = padCastKeys(castKeys, castSlotCount);
  const filledCast = castPad.filter(Boolean);
  const activeCastFace =
    faces.find((f) => f.key === activeCastKey) || null;
  const activeCastSrc = activeCastKey
    ? `/api/crash/style-cards/file?styleId=${encodeURIComponent(styleId)}&thumb=${encodeURIComponent(activeCastKey)}&v=${tick}`
    : "";

  return (
    <div className="space-y-3 p-1 pb-4">
      {kitReady ? (
        <p className="text-xs text-[var(--acid)]">
          Ready · {isEnsemble ? "park cast" : "arsehole"} · {filledCast.length}{" "}
          cast · {filledPlaces} places
        </p>
      ) : null}

      {/* ONE section: Asshole + Places + Cast — collapse together */}
      <div className="rounded-sm border border-[var(--line)] p-2">
        <button
          type="button"
          className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
          onClick={() => setKitBoardOpen((o) => !o)}
          aria-expanded={kitBoardOpen}
        >
          <div>
            <h4 className="display text-base">
              <span className="mr-2 text-[var(--acid)]">
                {kitBoardOpen ? "-" : "+"}
              </span>
              {isEnsemble ? "Cast · Places" : "Asshole · Places · Cast"}
            </h4>
            <p className="text-xs text-[var(--mute)]">
              {kitBoardOpen
                ? isEnsemble
                  ? "Park cast on top — drop guests in empty slots · places below"
                  : "Scene kit board — collapse to work Cast face below"
                : isEnsemble
                  ? `${filledCast.length} cast · ${filledPlaces} places`
                  : `${arseholeKey ? "arsehole" : "no arsehole"} · ${filledCast.length} cast · ${filledPlaces} places`}
            </p>
          </div>
          <span className="rounded-sm border border-[var(--line)] px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--mute)]">
            {kitBoardOpen ? "Collapse" : "Expand"}
          </span>
        </button>

        {kitBoardOpen ? (
          <div
            className={`mt-3 grid items-start gap-3 ${
              isEnsemble ? "" : "lg:grid-cols-12"
            }`}
          >
            {isEnsemble ? (
              <div className="rounded-sm border border-[var(--line)] p-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--acid)]">
                      Cast — park + guests
                    </p>
                    <p className="text-[9px] text-[var(--mute)]">
                      Park faces always here · + / empty slots = special cast for
                      this episode · drag onto a place → shot plate
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={trimEmptyCastSlots}
                    className="rounded-sm border border-[var(--line)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--chrome-dim)] hover:border-[var(--magenta-hot)] hover:text-[var(--magenta-hot)] disabled:opacity-40"
                    title="Remove empty guest slots at the end"
                  >
                    Trim empty
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                  {castPad.map((key, index) => {
                    const hot =
                      dropTarget?.zone === "cast" &&
                      dropTarget.index === index;
                    const picked = Boolean(key) && key === activeCastKey;
                    const isPark = index < parkCastKeys.length;
                    const src = key
                      ? `/api/crash/style-cards/file?styleId=${encodeURIComponent(styleId!)}&thumb=${encodeURIComponent(key)}&v=${tick}`
                      : "";
                    const label = key ? faceName(key) : "";
                    return (
                      <div
                        key={`cast-${index}`}
                        className={`relative rounded-sm border p-1 ${
                          hot
                            ? "border-[var(--acid)] bg-[var(--acid)]/10"
                            : picked
                              ? "border-[var(--acid)]"
                              : isPark
                                ? "border-[var(--acid)]/40"
                                : "border-[var(--line)]"
                        }`}
                        onDragOver={(e) =>
                          onDragOver({ zone: "cast", index }, e)
                        }
                        onDragLeave={() => setDropTarget(null)}
                        onDrop={(e) =>
                          onDropZone({ zone: "cast", index }, e)
                        }
                      >
                        {key && !isPark ? (
                          <button
                            type="button"
                            className="absolute right-1 top-1 z-10 rounded-sm bg-black/70 px-1.5 py-0.5 text-[11px] leading-none text-[var(--fail)] hover:bg-black"
                            title="Clear guest face"
                            onClick={() => clearCastSlot(index)}
                          >
                            X
                          </button>
                        ) : !key && castSlotCount > parkCastKeys.length ? (
                          <button
                            type="button"
                            className="absolute right-1 top-1 z-10 rounded-sm bg-black/70 px-1.5 py-0.5 text-[11px] leading-none text-[var(--fail)] hover:bg-black"
                            title="Remove this empty slot"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCastSlot(index);
                            }}
                          >
                            −
                          </button>
                        ) : null}
                        {src ? (
                          <button
                            type="button"
                            className="block w-full text-left"
                            title="Click → Cast face below · drag onto a place → shot plate"
                            onClick={() => selectCast(key)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt={label}
                              draggable
                              className="mb-1 aspect-[3/4] w-full cursor-grab rounded-sm object-cover active:cursor-grabbing"
                              onDragStart={(e) => {
                                e.stopPropagation();
                                if (!styleId || !key) return;
                                writePlateDrag(e, {
                                  kind: "cast",
                                  styleId,
                                  thumbKey: key,
                                  label: label || "Cast",
                                });
                              }}
                            />
                            <span className="block truncate text-[10px]">
                              {label && label !== "?" ? label : "Cast"}
                              {isPark ? "" : " · guest"}
                            </span>
                          </button>
                        ) : (
                          <div className="flex aspect-[3/4] flex-col items-center justify-center text-[10px] text-[var(--mute)]">
                            drop guest
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={addCastSlot}
                    className="flex aspect-[3/4] flex-col items-center justify-center rounded-sm border border-dashed border-[var(--line)] text-lg text-[var(--acid)] hover:border-[var(--acid)] disabled:opacity-40"
                    title="Add a special / guest cast slot"
                  >
                    +
                  </button>
                </div>
              </div>
            ) : null}

            <div
              ref={leftBoardRef}
              className={`space-y-3 ${isEnsemble ? "" : "lg:col-span-8"}`}
            >
              {!isEnsemble ? (
              <div
                className={`rounded-sm border p-2 ${
                  dropTarget?.zone === "arse"
                    ? "border-[var(--acid)] bg-[var(--acid)]/10"
                    : "border-[var(--magenta)]"
                }`}
                onDragOver={(e) => onDragOver({ zone: "arse" }, e)}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => onDropZone({ zone: "arse" }, e)}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold uppercase tracking-wider text-[var(--magenta-hot)]">
                    Asshole — {arseholeTitle}
                  </p>
                  {arseholeKey ? (
                    <button
                      type="button"
                      className="px-1 text-sm leading-none text-[var(--fail)]"
                      title="Clear"
                      onClick={clearArse}
                    >
                      X
                    </button>
                  ) : null}
                </div>
                {arseSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={arseSrc}
                    alt={arseholeTitle}
                    draggable
                    title="Drag onto a place to make a shot plate"
                    className="mx-auto max-h-56 w-full max-w-md cursor-grab rounded-sm object-contain active:cursor-grabbing"
                    onDragStart={(e) => {
                      if (!styleId || !arseholeKey) return;
                      writePlateDrag(e, {
                        kind: "cast",
                        styleId,
                        thumbKey: arseholeKey,
                        label: arseholeTitle,
                      });
                    }}
                  />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-[var(--panel-2)] text-[10px] text-[var(--mute)]">
                    drop face
                  </div>
                )}
              </div>
              ) : null}

              <div className="rounded-sm border border-[var(--line)] p-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--mute)]">
                      Places (this episode)
                    </p>
                    <p className="text-[9px] text-[var(--mute)]">
                      Drop place first · then drag cast onto the place → shot plate
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void reloadPlacesFromPack()}
                      className="rounded-sm border border-[var(--acid)]/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--acid)] hover:border-[var(--acid)] disabled:opacity-40"
                      title="Reload places from the open CURSOR / episode pack"
                    >
                      Reload places
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={trimEmptyPlaceSlots}
                      className="rounded-sm border border-[var(--line)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--chrome-dim)] hover:border-[var(--magenta-hot)] hover:text-[var(--magenta-hot)] disabled:opacity-40"
                      title="Remove empty drop-place slots at the end"
                    >
                      Trim empty
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {worldPad.map((key, index) => {
                    const active = index === activePlaceIndex && Boolean(key);
                    const hot =
                      dropTarget?.zone === "place" &&
                      dropTarget.index === index;
                    const src = key
                      ? `/api/crash/world-cards/file?styleId=${encodeURIComponent(styleId)}&thumb=${encodeURIComponent(key)}&v=${tick}`
                      : "";
                    const label = key ? placeName(key) : "";
                    const stagedN = (placeCastStaging[index] || []).length;
                    return (
                      <div
                        key={`place-${index}`}
                        className={`relative rounded-sm border p-1 ${
                          hot
                            ? "border-[var(--acid)] bg-[var(--acid)]/10"
                            : active
                              ? "border-[var(--acid)]"
                              : "border-[var(--line)]"
                        }`}
                        onDragOver={(e) =>
                          onDragOver({ zone: "place", index }, e)
                        }
                        onDragLeave={() => setDropTarget(null)}
                        onDrop={(e) =>
                          onDropZone({ zone: "place", index }, e)
                        }
                      >
                        {key ? (
                          <button
                            type="button"
                            className="absolute right-1 top-1 z-10 rounded-sm bg-black/70 px-1.5 py-0.5 text-[11px] leading-none text-[var(--fail)] hover:bg-black"
                            title="Clear place image (slot stays)"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearPlaceSlot(index);
                            }}
                          >
                            X
                          </button>
                        ) : placeSlotCount > 1 ? (
                          <button
                            type="button"
                            className="absolute right-1 top-1 z-10 rounded-sm bg-black/70 px-1.5 py-0.5 text-[11px] leading-none text-[var(--fail)] hover:bg-black"
                            title="Remove this empty slot"
                            onClick={(e) => {
                              e.stopPropagation();
                              removePlaceSlot(index);
                            }}
                          >
                            −
                          </button>
                        ) : null}
                        {src ? (
                          <button
                            type="button"
                            className="block w-full"
                            title="Click = active place · drop cast here to make shot plate"
                            onClick={() => selectPlace(index)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt={label}
                              className="aspect-video w-full rounded-sm object-cover"
                            />
                          </button>
                        ) : (
                          <div className="flex aspect-video flex-col items-center justify-center bg-[var(--panel-2)] text-[10px] text-[var(--mute)]">
                            drop place
                          </div>
                        )}
                        <p className="mt-0.5 truncate text-[10px]">
                          {label || (key ? "Place" : `Slot ${index + 1}`)}
                          {stagedN > 0
                            ? ` · ${stagedN} cast`
                            : key
                              ? " · drop cast"
                              : ""}
                        </p>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={addPlaceSlot}
                    className="flex aspect-video flex-col items-center justify-center rounded-sm border border-dashed border-[var(--line)] text-lg text-[var(--acid)] hover:border-[var(--acid)] disabled:opacity-40"
                    title="Add another place slot"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="rounded-sm border border-[var(--line)] p-2">
                <p className="text-[10px] uppercase tracking-wider text-[var(--mute)]">
                  Staging / tweak
                </p>
                <p className="mb-1 text-[9px] text-[var(--mute)]">
                  Type the tweak BEFORE you drop — who sits where, who is
                  nearest camera. Plate is baked with that tweak (not paste
                  faces on empty BG).
                </p>
                <TextArea
                  rows={2}
                  value={plateTweak}
                  disabled={busy}
                  placeholder="e.g. Clive and Moira seated on the wet bus-shelter bench"
                  onChange={(e) => {
                    const v = e.target.value;
                    plateTweakRef.current = v;
                    setPlateTweak(v);
                  }}
                />
              </div>

              <div className="rounded-sm border border-[var(--acid)]/40 p-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--acid)]">
                      Shot plates — finished
                    </p>
                    <p className="text-[10px] text-[var(--mute)]">
                      Drag cast onto a place to build these · or drop a finished
                      plate · Copy → Paste on Story
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void pullStoryPlates()}
                    className="rounded-sm border border-[var(--line)] px-2 py-0.5 text-[10px] uppercase text-[var(--chrome-dim)] hover:border-[var(--acid)] hover:text-[var(--acid)] disabled:opacity-40"
                    title="Fill slots from unique plates already on Story shots"
                  >
                    Pull from Story
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {padPlateFiles(plateFiles, plateSlotCount).map(
                    (fileName, index) => {
                      const hot =
                        dropTarget?.zone === "plate" &&
                        dropTarget.index === index;
                      const src = fileName
                        ? `/api/crash/gen/file?name=${encodeURIComponent(fileName)}&v=${tick}`
                        : "";
                      return (
                        <div
                          key={`plate-${index}`}
                          className={`relative rounded-sm border p-1 ${
                            hot
                              ? "border-[var(--acid)] bg-[var(--acid)]/10"
                              : "border-[var(--line)]"
                          }`}
                          onDragOver={(e) =>
                            onDragOver({ zone: "plate", index }, e)
                          }
                          onDragLeave={() => setDropTarget(null)}
                          onDrop={(e) =>
                            onDropZone({ zone: "plate", index }, e)
                          }
                        >
                          {fileName ? (
                            <button
                              type="button"
                              className="absolute right-1 top-1 z-10 rounded-sm bg-black/70 px-1.5 py-0.5 text-[11px] leading-none text-[var(--fail)] hover:bg-black"
                              title="Clear slot"
                              onClick={(e) => {
                                e.stopPropagation();
                                clearPlateSlot(index);
                              }}
                            >
                              X
                            </button>
                          ) : plateSlotCount > 1 ? (
                            <button
                              type="button"
                              className="absolute right-1 top-1 z-10 rounded-sm bg-black/70 px-1.5 py-0.5 text-[11px] leading-none text-[var(--fail)] hover:bg-black"
                              title="Remove this empty slot"
                              onClick={(e) => {
                                e.stopPropagation();
                                removePlateSlot(index);
                              }}
                            >
                              −
                            </button>
                          ) : null}
                          {src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={src}
                              alt={`Plate ${index + 1}`}
                              draggable
                              title="Drag onto a Story shot · click Copy below"
                              className="aspect-video w-full cursor-grab rounded-sm object-cover active:cursor-grabbing"
                              onDragStart={(e) => {
                                if (!styleId) return;
                                writePlateDrag(e, {
                                  kind: "cplate",
                                  styleId,
                                  fileName,
                                  label: humanMediaLabel(fileName),
                                });
                              }}
                              onClick={() =>
                                setLightbox({
                                  src,
                                  label: humanMediaLabel(fileName),
                                })
                              }
                            />
                          ) : (
                            <div className="flex aspect-video flex-col items-center justify-center bg-[var(--panel-2)] px-1 text-center text-[10px] text-[var(--mute)]">
                              drop cast
                            </div>
                          )}
                          <div className="mt-0.5 flex items-center justify-between gap-1">
                            <p className="truncate text-[10px]" title={fileName}>
                              {humanMediaLabel(fileName)}
                            </p>
                            {fileName ? (
                              <button
                                type="button"
                                className="shrink-0 text-[10px] uppercase text-[var(--acid)] hover:underline"
                                onClick={() => copyPlateSlot(index)}
                              >
                                Copy
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    },
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={addPlateSlot}
                    className="flex aspect-video flex-col items-center justify-center rounded-sm border border-dashed border-[var(--line)] text-lg text-[var(--acid)] hover:border-[var(--acid)] disabled:opacity-40"
                    title="Add another plate slot"
                  >
                    +
                  </button>
                </div>
                {filledShotPlates ? (
                  <p className="mt-1 text-[10px] text-[var(--mute)]">
                    {filledShotPlates} filled
                  </p>
                ) : null}
              </div>
            </div>

            {!isEnsemble ? (
            <div
              className="flex flex-col overflow-hidden rounded-sm border border-[var(--line)] p-2 lg:col-span-4"
              style={
                castBoardH
                  ? { height: castBoardH, maxHeight: castBoardH }
                  : { minHeight: "14rem" }
              }
            >
              <div className="mb-1 flex shrink-0 flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wider text-[var(--acid)]">
                  Cast
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={trimEmptyCastSlots}
                  className="rounded-sm border border-[var(--line)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--chrome-dim)] hover:border-[var(--magenta-hot)] hover:text-[var(--magenta-hot)] disabled:opacity-40"
                  title="Remove empty drop-face slots at the end"
                >
                  Trim empty
                </button>
              </div>
              <div
                className="crash-cast-scroll min-h-0 flex-1 overflow-y-scroll overscroll-contain pr-1"
                style={{ maxHeight: castBoardH ? castBoardH - 28 : undefined }}
                onWheel={onCastWheel}
              >
                <div className="grid grid-cols-2 gap-2 pb-2">
{castPad.map((key, index) => {
                    const hot =
                      dropTarget?.zone === "cast" &&
                      dropTarget.index === index;
                    const picked = Boolean(key) && key === activeCastKey;
                    const src = key
                      ? `/api/crash/style-cards/file?styleId=${encodeURIComponent(styleId)}&thumb=${encodeURIComponent(key)}&v=${tick}`
                      : "";
                    const label = key ? faceName(key) : "";
                    return (
                      <div
                        key={`cast-${index}`}
                        className={`relative rounded-sm border p-1 ${
                          hot
                            ? "border-[var(--acid)] bg-[var(--acid)]/10"
                            : picked
                              ? "border-[var(--acid)]"
                              : "border-[var(--line)]"
                        }`}
                        onDragOver={(e) =>
                          onDragOver({ zone: "cast", index }, e)
                        }
                        onDragLeave={() => setDropTarget(null)}
                        onDrop={(e) =>
                          onDropZone({ zone: "cast", index }, e)
                        }
                      >
                        {key ? (
                          <button
                            type="button"
                            className="absolute right-1 top-1 z-10 rounded-sm bg-black/70 px-1.5 py-0.5 text-[11px] leading-none text-[var(--fail)] hover:bg-black"
                            title="Clear cast face (slot stays)"
                            onClick={() => clearCastSlot(index)}
                          >
                            X
                          </button>
                        ) : castSlotCount > 1 ? (
                          <button
                            type="button"
                            className="absolute right-1 top-1 z-10 rounded-sm bg-black/70 px-1.5 py-0.5 text-[11px] leading-none text-[var(--fail)] hover:bg-black"
                            title="Remove this empty slot"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCastSlot(index);
                            }}
                          >
                            −
                          </button>
                        ) : null}
                        {src ? (
                          <button
                            type="button"
                            className="block w-full text-left"
                            title="Click → Cast face below · drag onto a place → shot plate"
                            onClick={() => selectCast(key)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt={label}
                              draggable
                              className="mb-1 aspect-[3/4] w-full cursor-grab rounded-sm object-cover active:cursor-grabbing"
                              onDragStart={(e) => {
                                e.stopPropagation();
                                if (!styleId || !key) return;
                                writePlateDrag(e, {
                                  kind: "cast",
                                  styleId,
                                  thumbKey: key,
                                  label: label || "Cast",
                                });
                              }}
                            />
                            <span className="block truncate text-[10px]">
                              {label && label !== "?" ? label : "Cast"}
                            </span>
                          </button>
                        ) : (
                          <div className="flex aspect-[3/4] flex-col items-center justify-center text-[10px] text-[var(--mute)]">
                            drop face
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={addCastSlot}
                    className="flex aspect-[3/4] flex-col items-center justify-center rounded-sm border border-dashed border-[var(--line)] text-lg text-[var(--acid)] hover:border-[var(--acid)] disabled:opacity-40"
                    title="Add another cast slot"
                  >
                    +
                  </button>
                </div>
                <p className="pb-1 text-[10px] text-[var(--mute)]">
                  Click a face → Cast face below
                </p>
              </div>
            </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Cast face — dropdown + title + image + voice for that person */}
      <div className="rounded-sm border border-[var(--line)] p-3">
        <button
          type="button"
          className="mb-1 flex w-full flex-wrap items-start justify-between gap-2 text-left"
          onClick={() => setCastDeskOpen((o) => !o)}
          aria-expanded={castDeskOpen}
        >
          <div>
            <h4 className="display text-lg">
              <span className="mr-2 text-[var(--acid)]">
                {castDeskOpen ? "-" : "+"}
              </span>
              Cast face
            </h4>
            <p className="text-xs text-[var(--mute)]">
              {castDeskOpen
                ? "Episodic cast — name them here (not Script desk mains)"
                : activeCastFace?.name
                  ? `${activeCastFace.name} — expand`
                  : "Expand to pick a cast face"}
            </p>
          </div>
          <span className="rounded-sm border border-[var(--line)] px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--mute)]">
            {castDeskOpen ? "Collapse" : "Expand"}
          </span>
        </button>

        {castDeskOpen ? (
          <div className="mt-3 max-w-xl space-y-3">
            <Field label="Character">
              <Select
                value={activeCastKey}
                onChange={(e) => selectCast(e.target.value)}
              >
                <option value=""> - pick cast - </option>
                {filledCast.map((key) => (
                  <option key={key} value={key}>
                    {faceName(key)}
                  </option>
                ))}
              </Select>
            </Field>

            {activeCastKey ? (
              <>
                <Field label="Name (editable)">
                  <TextInput
                    value={nameEdit}
                    onChange={(e) => setNameEdit(e.target.value)}
                    placeholder="Character name"
                  />
                </Field>

                {activeCastSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    draggable
                    src={activeCastSrc}
                    alt={faceName(activeCastKey)}
                    title="Drag to Voice panel"
                    className="mx-auto max-h-[22rem] w-full cursor-grab rounded-sm object-contain active:cursor-grabbing"
                    onDragStart={(e) => {
                      e.stopPropagation();
                      writePlateDrag(e, {
                        kind: "cast",
                        styleId,
                        thumbKey: activeCastKey,
                        label: faceName(activeCastKey),
                      });
                    }}
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center bg-[var(--panel-2)] text-xs text-[var(--mute)]">
                    No image
                  </div>
                )}

                <Field label="Bio (this character — editable)">
                  <TextArea
                    rows={3}
                    value={bioEdit}
                    onChange={(e) => setBioEdit(e.target.value)}
                    placeholder="Who they are in this show…"
                  />
                  <div className="mt-2">
                    <Btn
                      tone="default"
                      disabled={bioBusy}
                      onClick={() => void saveCastFace()}
                    >
                      {bioBusy ? "Saving…" : "Save name + bio"}
                    </Btn>
                  </div>
                </Field>

                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--mute)]">
                    Voice prompt
                  </p>
                  <p className="text-xs text-[var(--chrome)]">{voicePromptLine}</p>
                  {voicePlaySrc ? (
                    <>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          className="text-xs text-[var(--acid)] underline hover:text-[var(--acid-deep)]"
                          onClick={playCastVoice}
                        >
                          Play voice
                        </button>
                        <button
                          type="button"
                          className="text-xs text-[var(--fail)] underline hover:opacity-80"
                          onClick={() => {
                            const el = voiceAudioRef.current;
                            if (!el) return;
                            el.pause();
                            el.currentTime = 0;
                          }}
                        >
                          Stop
                        </button>
                      </div>
                      <audio
                        ref={voiceAudioRef}
                        src={voicePlaySrc}
                        preload="none"
                        className="hidden"
                      />
                    </>
                  ) : (
                    <p className="mt-1 text-[10px] text-[var(--mute)]">
                      No locked voice yet — Gen in Voice panel
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-[var(--mute)]">
                Pick someone from the list (or click a face in Cast above).
              </p>
            )}
          </div>
        ) : null}
      </div>

      {status ? (
        <p className="text-xs text-[var(--magenta-hot)]">{status}</p>
      ) : null}

      {lightbox ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-label={lightbox.label}
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-sm border border-white/40 px-3 py-1 text-[12px] text-white hover:bg-white/10"
            onClick={() => setLightbox(null)}
          >
            Close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.src}
            alt={lightbox.label}
            className="max-h-[90vh] max-w-[95vw] object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
