"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  beatDraftFields,
  beatReady,
  COMFY_INTRO_BEAT_ID,
  COMFY_OUTRO_BEAT_ID,
  type ComfyBeatRow,
  type ComfyDraft,
} from "@/lib/crashComfyStack";
import type {
  CrashStoryBeat,
  CrashStoryDoc,
  CrashStoryScene,
  CrashStoryShot,
} from "@/lib/crashStoryTypes";
import type { CrashVoiceSlot } from "@/lib/crashVoice";
import { CRASH_VOICE_SAVED, dispatchStorySaved } from "@/lib/crashStyleSync";
import {
  plateDragHasType,
  readPlateDrag,
  type CrashPlateDragPayload,
} from "@/lib/crashPlateDrag";
import { MediaThumb } from "@/components/MediaThumb";
import type { ShowStyleId } from "@/lib/showStylePresets";
import { newId } from "@/lib/types";

function newEmptyStoryShot(index: number): CrashStoryShot {
  return {
    id: newId("shot"),
    title: `Shot ${index}`,
    summary: "",
    staging: "",
    plateFile: "",
    beats: [{ id: newId("beat"), speaker: "", text: "" }],
    sfx: [],
  };
}

function newEmptyStoryScene(index: number): CrashStoryScene {
  return {
    id: newId("scene"),
    title: `Scene ${index}`,
    placeName: "",
    worldThumbKey: "",
    shots: [newEmptyStoryShot(1)],
  };
}

export type TimelineLtxStatus = {
  step:
    | "resolving"
    | "uploading"
    | "converting"
    | "queued"
    | "running"
    | "pulling"
    | "done"
    | "error";
  message: string;
  url?: string;
  inFlight: boolean;
  verdict?: "pass" | "fail";
  error?: string;
  promptId?: string;
  comfyUrl?: string;
};

type UiLayout = {
  viewerH: number;
  v1H: number;
  zoom: number;
};

const LAYOUT_KEY = "crash-animate-ui-v2";
const DEFAULT_LAYOUT: UiLayout = { viewerH: 300, v1H: 100, zoom: 1.55 };

function readLayout(): UiLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return { ...DEFAULT_LAYOUT };
    const p = JSON.parse(raw) as Partial<UiLayout>;
    return {
      viewerH: clamp(Number(p.viewerH) || DEFAULT_LAYOUT.viewerH, 160, 560),
      v1H: clamp(Number(p.v1H) || DEFAULT_LAYOUT.v1H, 56, 180),
      zoom: clamp(Number(p.zoom) || DEFAULT_LAYOUT.zoom, 1.1, 2.2),
    };
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

function writeLayout(next: UiLayout): void {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

type Props = {
  styleId: ShowStyleId;
  story: CrashStoryDoc;
  onSaveStory: (
    next: CrashStoryDoc,
    opts?: { flush?: boolean },
  ) => void | Promise<void>;
  rows: ComfyBeatRow[];
  draft: ComfyDraft;
  onDraftChange: (next: ComfyDraft) => void;
  ltxByBeat: Record<string, TimelineLtxStatus>;
  ltxStartedAt: Record<string, number>;
  selectedBeatId: string | null;
  onSelectBeat: (beatId: string | null) => void;
  onSendLtx: (beatId: string) => void;
  onClearBeat: (beatId: string) => void;
  onVerdict: (beatId: string, verdict: "pass" | "fail") => void;
  onReorderShots: (fromShotId: string, toShotId: string) => void;
  /** Drop new plate on a clip — keep Fail for later Send all */
  onReplacePlateKeepFail: (
    shotId: string,
    plateFile: string,
  ) => void | Promise<void>;
  comfyReady: boolean;
  queueBusy: boolean;
  ltxInFlightCount: number;
  parallelMax: number;
};

function clipWidthPx(row: ComfyBeatRow, zoom: number): number {
  const n = Math.max(row.text.trim().length, row.speaker.trim().length, 8);
  const base = Math.max(96, Math.min(200, 64 + n * 1.8));
  return Math.round(base * zoom);
}

function statusTone(
  st: TimelineLtxStatus | undefined,
): "pending" | "running" | "done" | "fail" | "error" {
  if (!st) return "pending";
  if (st.inFlight) return "running";
  if (st.step === "error") return "error";
  if (st.step === "done" && st.verdict === "fail") return "fail";
  if (st.step === "done") return "done";
  return "pending";
}

function toneClass(tone: ReturnType<typeof statusTone>, selected: boolean): string {
  const ring = selected ? "ring-2 ring-[var(--acid)]" : "";
  switch (tone) {
    case "running":
      return `border-[var(--acid)]/70 bg-[var(--acid)]/20 ${ring}`;
    case "done":
      return `border-[var(--acid)]/50 bg-[var(--acid)]/10 ${ring}`;
    case "fail":
      return `border-[var(--magenta-hot)]/70 bg-[var(--magenta-hot)]/15 ${ring}`;
    case "error":
      return `border-[var(--magenta-hot)]/80 bg-[var(--magenta-hot)]/20 ${ring}`;
    default:
      return `border-[var(--line)] bg-[var(--void)]/40 ${ring}`;
  }
}

function shortStatus(st: TimelineLtxStatus | undefined): string {
  if (!st) return "—";
  if (st.inFlight) {
    if (st.step === "pulling") return "Pull";
    if (st.step === "running") return "Run";
    return "Q";
  }
  if (st.step === "done" && st.verdict === "fail") return "Fail";
  if (st.step === "done" && st.verdict === "pass") return "Pass";
  if (st.step === "done") return "Done";
  if (st.step === "error") return "Err";
  return "—";
}

/** Badge colours on V1 thumbs — readable at a glance. */
function statusBadgeClass(st: TimelineLtxStatus | undefined): string {
  if (!st) return "bg-black/55 text-white/70";
  if (st.inFlight) return "bg-[var(--acid)]/85 text-black font-medium";
  if (st.step === "error") {
    return "bg-[var(--magenta-hot)] text-white font-medium";
  }
  if (st.step === "done" && st.verdict === "fail") {
    return "bg-[var(--magenta-hot)] text-white font-medium";
  }
  if (st.step === "done" && st.verdict === "pass") {
    return "bg-[var(--acid)] text-black font-medium";
  }
  if (st.step === "done") {
    return "bg-sky-500/90 text-white font-medium";
  }
  return "bg-black/55 text-white/80";
}

type ClipLayout = { row: ComfyBeatRow; left: number; width: number };

function shotSpans(layout: ClipLayout[]): {
  key: string;
  shotId: string;
  label: string;
  sceneLabel: string;
  left: number;
  width: number;
  beatIds: string[];
  canDrag: boolean;
}[] {
  const spans: {
    key: string;
    shotId: string;
    label: string;
    sceneLabel: string;
    left: number;
    width: number;
    beatIds: string[];
    canDrag: boolean;
  }[] = [];
  for (const clip of layout) {
    const shotId = clip.row.shotId;
    const canDrag = !shotId.startsWith("__");
    const last = spans[spans.length - 1];
    if (last && last.shotId === shotId) {
      last.width = clip.left + clip.width - last.left;
      last.beatIds.push(clip.row.beatId);
    } else {
      spans.push({
        key: `${shotId}-sh`,
        shotId,
        label: clip.row.shotTitle || "Shot",
        sceneLabel: clip.row.sceneTitle || "",
        left: clip.left,
        width: clip.width,
        beatIds: [clip.row.beatId],
        canDrag,
      });
    }
  }
  return spans;
}

const SHOT_DRAG = "application/x-crash-animate-shot-id";

function normalizeSpeakerName(speaker: string): string {
  return speaker.trim().toLowerCase().replace(/\s+/g, " ");
}

function voiceNamesMatch(speaker: string, castName: string): boolean {
  const n = normalizeSpeakerName(speaker);
  const cn = normalizeSpeakerName(castName);
  if (!n || !cn) return false;
  if (n === cn) return true;
  if (cn.endsWith(` ${n}`) || cn.startsWith(`${n} `)) return true;
  if (n.endsWith(` ${cn}`) || n.startsWith(`${cn} `)) return true;
  if (n.length >= 4 && cn.includes(n)) return true;
  if (cn.length >= 4 && n.includes(cn)) return true;
  return false;
}

function findVoiceSlot(
  speaker: string,
  slots: CrashVoiceSlot[],
): CrashVoiceSlot | undefined {
  const n = normalizeSpeakerName(speaker);
  if (!n) return undefined;
  for (const slot of slots) {
    if (normalizeSpeakerName(slot.castName) === n) return slot;
  }
  for (const slot of slots) {
    if (voiceNamesMatch(speaker, slot.castName)) return slot;
  }
  return undefined;
}

function buildSpeakerOptions(
  story: CrashStoryDoc,
  slots: CrashVoiceSlot[],
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  function add(name: string) {
    const t = name.trim();
    if (!t) return;
    const k = normalizeSpeakerName(t);
    if (seen.has(k)) return;
    seen.add(k);
    names.push(t);
  }
  for (const scene of story.scenes) {
    for (const shot of scene.shots) {
      for (const beat of shot.beats) {
        if (beat.speaker.trim()) add(beat.speaker);
      }
    }
  }
  for (const slot of slots) add(slot.castName);
  return names;
}

function findShotInStory(
  story: CrashStoryDoc,
  shotId: string,
): { sceneId: string; sceneTitle: string; placeName: string; worldThumbKey: string; shot: CrashStoryShot; sceneIndex: number; shotIndex: number } | null {
  for (let si = 0; si < story.scenes.length; si += 1) {
    const scene = story.scenes[si]!;
    const shotIndex = scene.shots.findIndex((s) => s.id === shotId);
    if (shotIndex < 0) continue;
    return {
      sceneId: scene.id,
      sceneTitle: scene.title,
      placeName: scene.placeName,
      worldThumbKey: scene.worldThumbKey,
      shot: scene.shots[shotIndex]!,
      sceneIndex: si,
      shotIndex,
    };
  }
  return null;
}

function ResizeBar({
  onDrag,
  label,
}: {
  onDrag: (deltaY: number) => void;
  label: string;
}) {
  const startY = useRef(0);
  const dragging = useRef(false);

  return (
    <div
      role="separator"
      aria-label={label}
      title={label}
      className="group flex h-2.5 shrink-0 cursor-row-resize items-center justify-center hover:bg-[var(--acid)]/15"
      onPointerDown={(e) => {
        e.preventDefault();
        dragging.current = true;
        startY.current = e.clientY;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const dy = e.clientY - startY.current;
        startY.current = e.clientY;
        onDrag(dy);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      <span className="h-0.5 w-10 rounded-full bg-[var(--line)] group-hover:bg-[var(--acid)]" />
    </div>
  );
}

export function AnimateTimeline({
  styleId,
  story,
  onSaveStory,
  rows,
  draft,
  onDraftChange,
  ltxByBeat,
  ltxStartedAt,
  selectedBeatId,
  onSelectBeat,
  onSendLtx,
  onClearBeat,
  onVerdict,
  onReorderShots,
  onReplacePlateKeepFail,
  comfyReady,
  queueBusy,
  ltxInFlightCount,
  parallelMax,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [dragShotId, setDragShotId] = useState<string | null>(null);
  const [dropShotId, setDropShotId] = useState<string | null>(null);
  const [plateDropShotId, setPlateDropShotId] = useState<string | null>(null);
  const [plateDropBusy, setPlateDropBusy] = useState(false);
  const [layout, setLayout] = useState<UiLayout>(() =>
    typeof window !== "undefined" ? readLayout() : { ...DEFAULT_LAYOUT },
  );
  const [voiceSlots, setVoiceSlots] = useState<CrashVoiceSlot[]>([]);
  const [genBusy, setGenBusy] = useState(false);
  const [mp3BusyId, setMp3BusyId] = useState<string | null>(null);
  const [storyErr, setStoryErr] = useState("");
  const [editShot, setEditShot] = useState<CrashStoryShot | null>(null);
  const [places, setPlaces] = useState<{ key: string; name: string }[]>([]);
  const [plateOpen, setPlateOpen] = useState(false);

  const patchLayout = useCallback((partial: Partial<UiLayout>) => {
    setLayout((prev) => {
      const next = {
        viewerH: clamp(
          partial.viewerH ?? prev.viewerH,
          160,
          560,
        ),
        v1H: clamp(partial.v1H ?? prev.v1H, 48, 160),
        zoom: clamp(partial.zoom ?? prev.zoom, 0.9, 1.8),
      };
      writeLayout(next);
      return next;
    });
  }, []);

  useEffect(() => {
    let dead = false;
    async function loadPlaces() {
      try {
        const res = await fetch("/api/crash/world-cards");
        const data = (await res.json()) as {
          cards?: Array<{
            id: string;
            thumbs?: Array<{ key: string; name?: string }>;
          }>;
        };
        if (dead) return;
        const card = (data.cards || []).find((c) => c.id === styleId);
        const storyKeys = new Set(
          story.scenes
            .map((s) => s.worldThumbKey?.trim())
            .filter((k): k is string => Boolean(k)),
        );
        const list = (card?.thumbs || [])
          .map((t) => ({
            key: t.key,
            name: (t.name || "").trim() || t.key,
          }))
          .filter((t) => {
            if (!t.key) return false;
            // Always keep places already used in this story
            if (storyKeys.has(t.key)) return true;
            // Drop raw dump filenames from other packs / gens
            if (/^g:place_/i.test(t.name)) return false;
            if (t.name === t.key && /^g:place_/i.test(t.key)) return false;
            // Need a real label (Cafe strip, Kim flat lounge, …)
            return Boolean(t.name) && t.name !== t.key;
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        setPlaces(list);
      } catch {
        if (!dead) setPlaces([]);
      }
    }
    void loadPlaces();
    return () => {
      dead = true;
    };
  }, [styleId, story.scenes]);

  useEffect(() => {
    let dead = false;
    async function loadVoices() {
      try {
        const res = await fetch(
          `/api/crash/voice?styleId=${encodeURIComponent(styleId)}`,
        );
        const data = (await res.json()) as {
          slots?: Record<string, CrashVoiceSlot>;
        };
        if (dead) return;
        setVoiceSlots(Object.values(data.slots || {}));
      } catch {
        if (!dead) setVoiceSlots([]);
      }
    }
    void loadVoices();
    const onVoice = () => void loadVoices();
    window.addEventListener(CRASH_VOICE_SAVED, onVoice);
    return () => {
      dead = true;
      window.removeEventListener(CRASH_VOICE_SAVED, onVoice);
    };
  }, [styleId]);

  const speakerOptions = useMemo(
    () => buildSpeakerOptions(story, voiceSlots),
    [story, voiceSlots],
  );

  const layoutClips = useMemo(() => {
    let x = 0;
    return rows.map((row) => {
      const w = clipWidthPx(row, layout.zoom);
      const left = x;
      x += w + 3;
      return { row, left, width: w };
    });
  }, [rows, layout.zoom]);

  const shots = useMemo(() => shotSpans(layoutClips), [layoutClips]);

  const totalW = layoutClips.length
    ? layoutClips[layoutClips.length - 1]!.left +
      layoutClips[layoutClips.length - 1]!.width +
      24
    : 200;

  const selected = rows.find((r) => r.beatId === selectedBeatId) || null;
  const selectedStatus = selected ? ltxByBeat[selected.beatId] : undefined;
  const selectedFields = selected ? beatDraftFields(selected, draft) : null;
  const selectedReady = selected ? beatReady(selected) : null;
  const selectedElapsed =
    selected &&
    selectedStatus?.inFlight &&
    ltxStartedAt[selected.beatId]
      ? Math.floor((Date.now() - ltxStartedAt[selected.beatId]!) / 1000)
      : 0;

  const shotLoc = selected
    ? findShotInStory(story, selected.shotId)
    : null;

  useEffect(() => {
    if (!shotLoc) {
      setEditShot(null);
      return;
    }
    setEditShot(shotLoc.shot);
    setPlateOpen(false);
  }, [shotLoc?.shot.id, shotLoc?.sceneIndex, story.updatedAt]);

  // layoutClips in the dep array meant any legitimate reason for it to change
  // identity — zoom, a clip added or resized — re-ran this and snapped the
  // view back to the selection, fighting a scroll the user had made on
  // purpose after selecting. Reading layoutClips from a ref instead means
  // this only fires on an actual selection change, which is the one time
  // recentering is wanted.
  const layoutClipsRef = useRef(layoutClips);
  layoutClipsRef.current = layoutClips;

  useEffect(() => {
    if (!selectedBeatId || !scrollRef.current) return;
    const clip = layoutClipsRef.current.find((c) => c.row.beatId === selectedBeatId);
    if (!clip) return;
    const el = scrollRef.current;
    const mid = clip.left + clip.width / 2;
    el.scrollTo({
      left: Math.max(0, mid - el.clientWidth / 2),
      behavior: "smooth",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBeatId]);

  const fontPx = Math.round(11 * layout.zoom);
  const fontSm = Math.round(13 * layout.zoom);
  const trackInnerW = totalW - 40;
  const a1H = Math.round(36 * layout.zoom);
  const shH = Math.round(32 * layout.zoom);

  const editShotRef = useRef<CrashStoryShot | null>(null);
  editShotRef.current = editShot;

  function applyShotToStory(
    nextShot: CrashStoryShot,
    flush: boolean,
  ): Promise<void> | void {
    if (!shotLoc) return;
    const scenes = story.scenes.map((sc, i) => {
      if (i !== shotLoc.sceneIndex) return sc;
      const shotsNext = [...sc.shots];
      const idx = shotsNext.findIndex((s) => s.id === nextShot.id);
      if (idx >= 0) shotsNext[idx] = nextShot;
      else shotsNext[shotLoc.shotIndex] = nextShot;
      return { ...sc, shots: shotsNext };
    });
    setStoryErr("");
    return onSaveStory(
      {
        ...story,
        scenes,
        updatedAt: new Date().toISOString(),
      },
      { flush },
    );
  }

  function setScenePlace(worldKey: string, placeName: string) {
    if (!shotLoc) return;
    const scenes = story.scenes.map((sc, i) => {
      if (i !== shotLoc.sceneIndex) return sc;
      return {
        ...sc,
        worldThumbKey: worldKey,
        placeName: placeName || sc.placeName,
      };
    });
    setStoryErr("");
    void onSaveStory(
      {
        ...story,
        scenes,
        updatedAt: new Date().toISOString(),
      },
      { flush: true },
    );
  }

  async function resolveDroppedPlate(
    payload: CrashPlateDragPayload,
  ): Promise<string | null> {
    if (payload.kind === "cplate") return payload.fileName;
    if (payload.kind === "world") {
      setStoryErr("Drop a shot plate (cplate), not a world BG");
      return null;
    }
    try {
      const res = await fetch("/api/crash/gen/as-plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: payload.kind,
          styleId: payload.styleId || styleId,
          thumbKey: payload.kind === "cast" ? payload.thumbKey : undefined,
          fileName: payload.kind === "swap" ? payload.fileName : undefined,
          label: payload.label,
        }),
      });
      const data = (await res.json()) as { fileName?: string; error?: string };
      if (!res.ok || !data.fileName) {
        setStoryErr(data.error || "Could not use that still");
        return null;
      }
      return data.fileName;
    } catch {
      setStoryErr("Could not use that still");
      return null;
    }
  }

  async function onV1PlateDrop(shotId: string, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPlateDropShotId(null);
    if (shotId.startsWith("__") || plateDropBusy) return;
    const payload = readPlateDrag(e);
    if (!payload) return;
    setPlateDropBusy(true);
    setStoryErr("");
    try {
      const fileName = await resolveDroppedPlate(payload);
      if (!fileName) return;
      await onReplacePlateKeepFail(shotId, fileName);
      const first = rows.find((r) => r.shotId === shotId);
      if (first) onSelectBeat(first.beatId);
    } finally {
      setPlateDropBusy(false);
    }
  }

  function patchShot(
    mutator: (s: CrashStoryShot) => CrashStoryShot,
    flush = false,
  ) {
    if (!shotLoc) return;
    const base = editShotRef.current || shotLoc.shot;
    const nextShot = mutator(base);
    editShotRef.current = nextShot;
    setEditShot(nextShot);
    // Never call parent setState inside setState — save after this tick.
    queueMicrotask(() => {
      void applyShotToStory(nextShot, flush);
    });
  }

  function patchBeat(beatIndex: number, next: CrashStoryBeat) {
    if (!shotLoc) return;
    patchShot((shot) => {
      const beats = [...shot.beats];
      beats[beatIndex] = next;
      return { ...shot, beats };
    }, false);
  }

  async function genPlate() {
    if (!shotLoc || !editShot || genBusy) return;
    setGenBusy(true);
    setStoryErr("");
    try {
      const speakers = [
        ...new Set(
          editShot.beats.map((b) => b.speaker.trim()).filter(Boolean),
        ),
      ];
      const res = await fetch("/api/crash/story/gen-plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId,
          speakers,
          placeName: shotLoc.placeName || editShot.title,
          summary: editShot.summary,
          staging: editShot.staging || undefined,
          worldKey: shotLoc.worldThumbKey || undefined,
          note: editShot.title,
        }),
      });
      const data = (await res.json()) as { fileName?: string; error?: string };
      if (!res.ok || !data.fileName) {
        setStoryErr(data.error || "Gen plate failed");
        return;
      }
      const base = editShotRef.current || editShot;
      const nextShot = { ...base, plateFile: data.fileName };
      editShotRef.current = nextShot;
      setEditShot(nextShot);
      await applyShotToStory(nextShot, true);
      dispatchStorySaved();
    } catch {
      setStoryErr("Gen plate failed");
    } finally {
      setGenBusy(false);
    }
  }

  async function genMp3(beat: CrashStoryBeat) {
    if (!beat.text.trim()) {
      setStoryErr("Write a line first");
      return;
    }
    if (!shotLoc || mp3BusyId) return;
    setMp3BusyId(beat.id);
    setStoryErr("");
    try {
      // Flush line text to disk first so Story + Speak stay in sync.
      const base = editShotRef.current || editShot || shotLoc.shot;
      await applyShotToStory(base, true);

      const res = await fetch("/api/crash/story/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId,
          beatId: beat.id,
          speaker: beat.speaker,
          text: beat.text,
        }),
      });
      const data = (await res.json()) as {
        voiceFile?: string;
        error?: string;
        story?: CrashStoryDoc;
      };
      if (!res.ok || !data.voiceFile) {
        setStoryErr(data.error || "Gen mp3 failed");
        return;
      }
      const nextShot = {
        ...base,
        beats: base.beats.map((b) =>
          b.id === beat.id ? { ...b, voiceFile: data.voiceFile } : b,
        ),
      };
      editShotRef.current = nextShot;
      setEditShot(nextShot);
      // Server already wrote story.json — don't PUT over it (that killed new takes).
      if (data.story) {
        // Parent picks this up via CRASH_STORY_SAVED → load()
      }
      dispatchStorySaved({ fromStoryPanel: true });
    } catch (e) {
      setStoryErr(e instanceof Error ? e.message : "Gen mp3 failed");
    } finally {
      setMp3BusyId(null);
    }
  }

  function saveDoc(next: CrashStoryDoc, flush = true) {
    setStoryErr("");
    return onSaveStory(
      { ...next, updatedAt: new Date().toISOString() },
      { flush },
    );
  }

  function addShot() {
    const sceneIndex = shotLoc?.sceneIndex ?? Math.max(0, story.scenes.length - 1);
    if (sceneIndex < 0 || !story.scenes[sceneIndex]) {
      addScene();
      return;
    }
    const scene = story.scenes[sceneIndex];
    const nextShot = newEmptyStoryShot(scene.shots.length + 1);
    const scenes = story.scenes.map((sc, i) =>
      i === sceneIndex
        ? { ...sc, collapsed: false, shots: [...sc.shots, nextShot] }
        : sc,
    );
    void Promise.resolve(saveDoc({ ...story, scenes })).then(() => {
      const beatId = nextShot.beats[0]?.id;
      if (beatId) onSelectBeat(beatId);
    });
  }

  function addScene() {
    const next = newEmptyStoryScene(story.scenes.length + 1);
    const scenes = [...story.scenes, next];
    void Promise.resolve(saveDoc({ ...story, scenes })).then(() => {
      const beatId = next.shots[0]?.beats[0]?.id;
      if (beatId) onSelectBeat(beatId);
    });
  }

  function addLine() {
    if (!shotLoc || !editShot) return;
    const nextBeat: CrashStoryBeat = {
      id: newId("beat"),
      speaker: "",
      text: "",
    };
    patchShot((shot) => ({ ...shot, beats: [...shot.beats, nextBeat] }), true);
    onSelectBeat(nextBeat.id);
  }

  /** Title / credits are bookends — clear the plate link (files stay on disk). */
  function clearBookendCard() {
    const fallback =
      story.scenes[0]?.shots[0]?.beats[0]?.id || null;
    if (selectedBeatId === COMFY_INTRO_BEAT_ID) {
      const nextDoc: CrashStoryDoc = {
        ...story,
        intro: { ...story.intro, logoFile: "" },
      };
      void Promise.resolve(saveDoc(nextDoc)).then(() => {
        onSelectBeat(fallback);
      });
      return;
    }
    if (selectedBeatId === COMFY_OUTRO_BEAT_ID) {
      const nextDoc: CrashStoryDoc = {
        ...story,
        outro: { ...story.outro, logoFile: "" },
      };
      void Promise.resolve(saveDoc(nextDoc)).then(() => {
        onSelectBeat(fallback);
      });
    }
  }

  function removeShot() {
    if (
      selectedBeatId === COMFY_INTRO_BEAT_ID ||
      selectedBeatId === COMFY_OUTRO_BEAT_ID
    ) {
      clearBookendCard();
      return;
    }
    if (!shotLoc) return;
    const sceneIndex = shotLoc.sceneIndex;
    const scene = story.scenes[sceneIndex];
    if (!scene) return;
    const shotId = shotLoc.shot.id;
    const shotIndex = scene.shots.findIndex((s) => s.id === shotId);
    if (shotIndex < 0) return;

    let nextDoc: CrashStoryDoc;
    let selectBeatId: string | null = null;

    if (scene.shots.length > 1) {
      const shots = scene.shots.filter((s) => s.id !== shotId);
      const scenes = story.scenes.map((sc, i) =>
        i === sceneIndex ? { ...sc, shots } : sc,
      );
      nextDoc = { ...story, scenes };
      const neighbor = shots[Math.max(0, shotIndex - 1)] || shots[0];
      selectBeatId = neighbor?.beats[0]?.id || null;
    } else if (story.scenes.length > 1) {
      const scenes = story.scenes.filter((_, i) => i !== sceneIndex);
      nextDoc = { ...story, scenes };
      const neighbor =
        scenes[Math.max(0, sceneIndex - 1)] || scenes[0];
      selectBeatId = neighbor?.shots[0]?.beats[0]?.id || null;
    } else {
      const blank = newEmptyStoryShot(1);
      const scenes = story.scenes.map((sc, i) =>
        i === sceneIndex ? { ...sc, shots: [blank] } : sc,
      );
      nextDoc = { ...story, scenes };
      selectBeatId = blank.beats[0]?.id || null;
    }

    editShotRef.current = null;
    setEditShot(null);
    void Promise.resolve(saveDoc(nextDoc)).then(() => {
      onSelectBeat(selectBeatId);
    });
  }

  function removeLine() {
    if (!shotLoc || !editShot) return;
    if (editShot.beats.length <= 1) {
      setStoryErr("Last line — delete the shot instead");
      return;
    }
    const beatId = selectedBeatId;
    const bi =
      beatId != null
        ? editShot.beats.findIndex((b) => b.id === beatId)
        : editShot.beats.length - 1;
    if (bi < 0) return;
    const beats = editShot.beats.filter((_, i) => i !== bi);
    const neighbor = beats[Math.max(0, bi - 1)] || beats[0];
    patchShot((shot) => ({ ...shot, beats }), true);
    if (neighbor) onSelectBeat(neighbor.id);
  }

  const cutChrome = (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => addShot()}
        className="rounded-sm border border-[var(--acid)]/60 px-2 py-0.5 text-[11px] text-[var(--acid)] hover:bg-[var(--acid)]/10"
        title="Add a shot to this scene"
      >
        + Shot
      </button>
      <button
        type="button"
        onClick={() => addScene()}
        className="rounded-sm border border-[var(--chrome-dim)]/50 px-2 py-0.5 text-[11px] text-[var(--chrome)] hover:border-[var(--acid)] hover:text-[var(--acid)]"
        title="Add a new scene"
      >
        + Scene
      </button>
      {shotLoc && editShot ? (
        <button
          type="button"
          onClick={() => addLine()}
          className="rounded-sm border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--chrome-dim)] hover:text-[var(--chrome)]"
          title="Add a dialogue line to this shot"
        >
          + Line
        </button>
      ) : null}
      {shotLoc && editShot ? (
        <button
          type="button"
          onClick={() => removeShot()}
          className="rounded-sm border border-[var(--magenta-hot)]/50 px-2 py-0.5 text-[11px] text-[var(--magenta-hot)] hover:bg-[var(--magenta-hot)]/10"
          title="Remove this shot from the cut (plates stay on disk)"
        >
          − Shot
        </button>
      ) : null}
      {selectedBeatId === COMFY_INTRO_BEAT_ID ? (
        <button
          type="button"
          onClick={() => clearBookendCard()}
          className="rounded-sm border border-[var(--magenta-hot)]/50 px-2 py-0.5 text-[11px] text-[var(--magenta-hot)] hover:bg-[var(--magenta-hot)]/10"
          title="Remove title card from the cut (image stays on disk)"
        >
          − Title card
        </button>
      ) : null}
      {selectedBeatId === COMFY_OUTRO_BEAT_ID ? (
        <button
          type="button"
          onClick={() => clearBookendCard()}
          className="rounded-sm border border-[var(--magenta-hot)]/50 px-2 py-0.5 text-[11px] text-[var(--magenta-hot)] hover:bg-[var(--magenta-hot)]/10"
          title="Remove credits card from the cut (image stays on disk)"
        >
          − Credits card
        </button>
      ) : null}
      {shotLoc && editShot && editShot.beats.length > 1 ? (
        <button
          type="button"
          onClick={() => removeLine()}
          className="rounded-sm border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--chrome-dim)] hover:text-[var(--magenta-hot)]"
          title="Remove the selected dialogue line"
        >
          − Line
        </button>
      ) : null}
    </div>
  );

  if (rows.length === 0) {
    return (
      <div className="flex min-h-0 flex-col gap-2 p-1">
        <p className="text-[12px] text-[var(--mute)]">
          No beats yet — add a shot or scene, then write the line here.
        </p>
        {cutChrome}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden">
      {/* Size chrome */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="text-[11px] text-[var(--mute)]">Size</span>
        <button
          type="button"
          className="rounded-sm border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--chrome)] hover:border-[var(--acid)]"
          onClick={() => patchLayout({ zoom: layout.zoom - 0.1 })}
        >
          A−
        </button>
        <button
          type="button"
          className="rounded-sm border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--chrome)] hover:border-[var(--acid)]"
          onClick={() => patchLayout({ zoom: layout.zoom + 0.1 })}
        >
          A+
        </button>
        <span className="text-[11px] text-[var(--chrome-dim)]">
          {Math.round(layout.zoom * 100)}%
        </span>
        <button
          type="button"
          className="text-[10px] text-[var(--mute)] underline hover:text-[var(--acid)]"
          onClick={() => patchLayout({ ...DEFAULT_LAYOUT })}
        >
          Reset size
        </button>
      </div>

      {/* Viewer */}
      <div
        className="flex shrink-0 flex-col overflow-hidden rounded-sm border border-[var(--acid)]/40 bg-[var(--void)]/60"
        style={{ height: layout.viewerH }}
      >
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black/80">
          {selectedStatus?.url ? (
            <video
              key={selectedStatus.url}
              src={selectedStatus.url}
              controls
              playsInline
              className="h-full max-h-full w-full object-contain"
            />
          ) : selected?.plateFile ? (
            <MediaThumb
              stillSrc={`/api/crash/gen/file?name=${encodeURIComponent(selected.plateFile)}`}
              alt=""
              className="h-full max-h-full w-full object-contain"
            />
          ) : (
            <p className="px-3 text-center text-[13px] text-[var(--mute)]">
              Click a clip below — big preview lives here
            </p>
          )}
        </div>
        {selected && selectedReady ? (
          <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--line)] bg-[var(--panel-2)] px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-[var(--chrome)]"
                style={{ fontSize: fontPx }}
              >
                {selected.shotTitle}
                <span className="text-[var(--mute)]">
                  {" "}
                  · {selected.sceneTitle}
                  {selected.placeName ? ` · ${selected.placeName}` : ""}
                </span>
              </p>
              <p
                className="truncate text-[var(--acid)]"
                style={{ fontSize: fontSm }}
              >
                {selected.speaker || "—"}
                {selectedStatus?.inFlight && selectedElapsed > 0 ? (
                  <span className="ml-1 text-[var(--mute)]">
                    {selectedElapsed}s
                  </span>
                ) : null}
                <span className="ml-2 font-normal text-[var(--chrome-dim)]">
                  {selected.text || "(silent hold)"}
                </span>
              </p>
              {selectedStatus?.step === "error" &&
              (selectedStatus.error || selectedStatus.message) ? (
                <p
                  className="mt-0.5 break-words text-[var(--magenta-hot)]"
                  style={{ fontSize: fontSm }}
                >
                  {selectedStatus.error || selectedStatus.message}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              <button
                type="button"
                disabled={
                  !comfyReady ||
                  !selectedReady.ok ||
                  queueBusy ||
                  Boolean(selectedStatus?.inFlight) ||
                  ltxInFlightCount >= parallelMax
                }
                onClick={() => onSendLtx(selected.beatId)}
                className="rounded-sm border border-[var(--magenta-hot)]/60 bg-[var(--magenta-hot)]/15 px-2.5 py-1 text-[12px] font-medium text-[var(--magenta-hot)] disabled:opacity-40"
              >
                Send
              </button>
              {selectedStatus?.step === "done" && selectedStatus.url ? (
                <>
                  <button
                    type="button"
                    disabled={queueBusy}
                    onClick={() => onVerdict(selected.beatId, "pass")}
                    className={`rounded-sm border px-2.5 py-1 text-[12px] disabled:opacity-40 ${
                      selectedStatus.verdict === "pass"
                        ? "border-[var(--acid)] bg-[var(--acid)]/20 text-[var(--acid)]"
                        : "border-[var(--line)] text-[var(--chrome-dim)]"
                    }`}
                  >
                    Pass
                  </button>
                  <button
                    type="button"
                    disabled={queueBusy}
                    onClick={() => onVerdict(selected.beatId, "fail")}
                    className={`rounded-sm border px-2.5 py-1 text-[12px] disabled:opacity-40 ${
                      selectedStatus.verdict === "fail"
                        ? "border-[var(--magenta-hot)] bg-[var(--magenta-hot)]/20 text-[var(--magenta-hot)]"
                        : "border-[var(--line)] text-[var(--chrome-dim)]"
                    }`}
                  >
                    Fail · redo
                  </button>
                </>
              ) : null}
              <button
                type="button"
                disabled={queueBusy || Boolean(selectedStatus?.inFlight)}
                onClick={() => onClearBeat(selected.beatId)}
                className="rounded-sm border border-[var(--line)] px-2.5 py-1 text-[12px] text-[var(--chrome-dim)] disabled:opacity-40"
              >
                Clear LTX
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <ResizeBar
        label="Drag to resize preview"
        onDrag={(dy) => patchLayout({ viewerH: layout.viewerH + dy })}
      />

      {/* Timeline */}
      <div
        ref={scrollRef}
        className="crash-tray-scroll shrink-0 overflow-x-auto overflow-y-hidden rounded-sm border border-[var(--line)] bg-[var(--panel-2)]"
      >
        <div className="relative p-2" style={{ width: totalW }}>
          <div className="relative mb-1.5 h-5 border-b border-[var(--line)]">
            {layoutClips.map(({ row, left, width }, i) => (
              <div
                key={`r-${row.beatId}`}
                className="absolute top-0 flex h-full items-end border-l border-[var(--line)]/60 pl-0.5"
                style={{ left, width }}
              >
                <span
                  className="truncate text-[var(--mute)]"
                  style={{ fontSize: fontSm }}
                >
                  {i + 1}
                </span>
              </div>
            ))}
          </div>

          <div className="mb-1.5 flex items-stretch gap-1">
            <div
              className="sticky left-0 z-10 flex w-8 shrink-0 items-center justify-center rounded-sm bg-[var(--panel)] font-medium text-[var(--acid)]"
              style={{ fontSize: fontSm }}
            >
              V1
            </div>
            <div
              className="relative"
              style={{ width: trackInnerW, height: layout.v1H }}
            >
              {layoutClips.map(({ row, left, width }) => {
                const st = ltxByBeat[row.beatId];
                const tone = statusTone(st);
                const selectedClip = selectedBeatId === row.beatId;
                const plateSrc = row.plateFile
                  ? `/api/crash/gen/file?name=${encodeURIComponent(row.plateFile)}`
                  : null;
                // After plate drop we clear url but keep Fail — show new plate
                const videoSrc = st?.url || null;
                const plateHover = plateDropShotId === row.shotId;
                return (
                  <button
                    key={`v-${row.beatId}`}
                    type="button"
                    onClick={() =>
                      onSelectBeat(
                        selectedBeatId === row.beatId ? null : row.beatId,
                      )
                    }
                    onDragEnter={(e) => {
                      if (!plateDragHasType(e)) return;
                      e.preventDefault();
                      setPlateDropShotId(row.shotId);
                    }}
                    onDragOver={(e) => {
                      if (!plateDragHasType(e)) return;
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = "copy";
                      setPlateDropShotId(row.shotId);
                    }}
                    onDragLeave={() => {
                      setPlateDropShotId((cur) =>
                        cur === row.shotId ? null : cur,
                      );
                    }}
                    onDrop={(e) => void onV1PlateDrop(row.shotId, e)}
                    className={`absolute top-0 flex h-full flex-col overflow-hidden rounded-sm border text-left ${toneClass(tone, selectedClip)} ${
                      tone === "running" ? "animate-pulse" : ""
                    } ${
                      plateHover
                        ? "ring-2 ring-[var(--magenta-hot)] ring-offset-1 ring-offset-[var(--panel-2)]"
                        : ""
                    }`}
                    style={{ left, width }}
                    title={`${row.shotTitle} · ${row.speaker} — drop plate to replace (keeps Fail)`}
                  >
                    <div className="relative min-h-0 flex-1 bg-[var(--void)]/50">
                      {videoSrc ? (
                        <video
                          src={videoSrc}
                          muted
                          playsInline
                          preload="metadata"
                          className="pointer-events-none h-full w-full object-cover"
                        />
                      ) : plateSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={plateSrc}
                          alt=""
                          className="pointer-events-none h-full w-full object-cover"
                        />
                      ) : (
                        <span
                          className="flex h-full items-center justify-center text-[var(--mute)]"
                          style={{ fontSize: fontSm }}
                        >
                          no plate
                        </span>
                      )}
                      <span
                        className={`absolute bottom-0 left-0 right-0 truncate px-0.5 ${statusBadgeClass(st)}`}
                        style={{ fontSize: fontSm }}
                      >
                        {plateHover ? "Drop plate" : shortStatus(st)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-1.5 flex items-stretch gap-1">
            <div
              className="sticky left-0 z-10 flex w-8 shrink-0 items-center justify-center rounded-sm bg-[var(--panel)] font-medium text-[var(--chrome-dim)]"
              style={{ fontSize: fontSm }}
            >
              A1
            </div>
            <div className="relative" style={{ width: trackInnerW, height: a1H }}>
              {layoutClips.map(({ row, left, width }) => {
                const selectedClip = selectedBeatId === row.beatId;
                const hasAudio = Boolean(row.voiceFile?.trim());
                return (
                  <button
                    key={`a-${row.beatId}`}
                    type="button"
                    onClick={() =>
                      onSelectBeat(
                        selectedBeatId === row.beatId ? null : row.beatId,
                      )
                    }
                    className={`absolute top-0 flex h-full flex-col justify-center overflow-hidden rounded-sm border px-1 ${
                      selectedClip
                        ? "border-[var(--acid)] bg-[var(--acid)]/15"
                        : hasAudio
                          ? "border-[var(--line)] bg-[var(--void)]/50"
                          : "border-dashed border-[var(--line)] bg-transparent"
                    }`}
                    style={{ left, width }}
                    title={row.text || "(silent)"}
                  >
                    <span
                      className="truncate font-medium text-[var(--chrome)]"
                      style={{ fontSize: fontSm }}
                    >
                      {row.speaker || "—"}
                    </span>
                    <span
                      className={`mt-0.5 h-1.5 w-full rounded-sm ${
                        hasAudio ? "bg-[var(--acid)]/50" : "bg-[var(--line)]"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-stretch gap-1">
            <div
              className="sticky left-0 z-10 flex w-8 shrink-0 items-center justify-center rounded-sm bg-[var(--panel)] font-medium text-[var(--magenta-hot)]"
              style={{ fontSize: fontSm }}
            >
              SH
            </div>
            <div className="relative" style={{ width: trackInnerW, height: shH }}>
              {shots.map((sh) => {
                const active = selectedBeatId
                  ? sh.beatIds.includes(selectedBeatId)
                  : false;
                const isDropTarget =
                  dropShotId === sh.shotId &&
                  dragShotId &&
                  dragShotId !== sh.shotId;
                return (
                  <button
                    key={sh.key}
                    type="button"
                    draggable={sh.canDrag}
                    onClick={() => onSelectBeat(sh.beatIds[0] || null)}
                    onDragStart={(e) => {
                      if (!sh.canDrag) {
                        e.preventDefault();
                        return;
                      }
                      e.dataTransfer.setData(SHOT_DRAG, sh.shotId);
                      e.dataTransfer.effectAllowed = "move";
                      setDragShotId(sh.shotId);
                    }}
                    onDragEnd={() => {
                      setDragShotId(null);
                      setDropShotId(null);
                    }}
                    onDragOver={(e) => {
                      if (!sh.canDrag) return;
                      const types = Array.from(e.dataTransfer.types || []);
                      if (
                        !types.some(
                          (t) => t.toLowerCase() === SHOT_DRAG.toLowerCase(),
                        )
                      ) {
                        return;
                      }
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setDropShotId(sh.shotId);
                    }}
                    onDragLeave={() => {
                      setDropShotId((cur) =>
                        cur === sh.shotId ? null : cur,
                      );
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from =
                        e.dataTransfer.getData(SHOT_DRAG) || dragShotId;
                      setDragShotId(null);
                      setDropShotId(null);
                      if (!from || !sh.canDrag || from === sh.shotId) return;
                      onReorderShots(from, sh.shotId);
                    }}
                    className={`absolute top-0 flex h-full items-center overflow-hidden rounded-sm border px-1 text-left ${
                      sh.canDrag ? "cursor-grab active:cursor-grabbing" : ""
                    } ${
                      isDropTarget
                        ? "border-[var(--acid)] bg-[var(--acid)]/20"
                        : active
                          ? "border-[var(--magenta-hot)]/70 bg-[var(--magenta-hot)]/15"
                          : "border-[var(--line)] bg-[var(--void)]/35"
                    } ${dragShotId === sh.shotId ? "opacity-50" : ""}`}
                    style={{ left: sh.left, width: sh.width }}
                    title={
                      sh.canDrag
                        ? `Drag to move shot · ${sh.label}`
                        : sh.label
                    }
                  >
                    <span
                      className="truncate text-[var(--chrome)]"
                      style={{ fontSize: fontSm }}
                    >
                      {sh.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <ResizeBar
        label="Drag to resize timeline thumbs"
        onDrag={(dy) => patchLayout({ v1H: layout.v1H + dy })}
      />

      {/* Story desk for selected shot */}
      <div className="crash-tray-scroll min-h-0 flex-1 overflow-y-auto rounded-sm border border-[var(--magenta-hot)]/35 bg-[var(--panel-2)] p-2">
        {shotLoc && editShot ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-[var(--chrome)]">
                Cut · {editShot.title}
                <span className="font-normal text-[var(--mute)]">
                  {" "}
                  · {shotLoc.sceneTitle}
                  {shotLoc.placeName ? ` · ${shotLoc.placeName}` : ""}
                </span>
              </p>
              {cutChrome}
            </div>
            <div className="flex gap-2">
              {editShot.plateFile ? (
                <button
                  type="button"
                  title="Click to expand plate"
                  onClick={() => setPlateOpen(true)}
                  className="h-24 w-36 shrink-0 cursor-zoom-in overflow-hidden rounded-sm border border-[var(--acid)]/40 bg-[var(--void)]/40 hover:border-[var(--acid)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/crash/gen/file?name=${encodeURIComponent(editShot.plateFile)}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ) : (
                <div className="flex h-24 w-36 shrink-0 items-center justify-center rounded-sm border border-dashed border-[var(--line)] bg-[var(--void)]/40 text-[11px] text-[var(--mute)]">
                  no plate
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <label className="block text-[10px] uppercase text-[var(--mute)]">
                  Place
                </label>
                <select
                  value={shotLoc.worldThumbKey || ""}
                  onChange={(e) => {
                    const key = e.target.value;
                    const hit = places.find((p) => p.key === key);
                    setScenePlace(key, hit?.name || "");
                  }}
                  className="w-full rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-2 py-1.5 text-[13px] text-[var(--chrome)]"
                >
                  <option value="">— pick place —</option>
                  {shotLoc.worldThumbKey &&
                  !places.some((p) => p.key === shotLoc.worldThumbKey) ? (
                    <option value={shotLoc.worldThumbKey}>
                      {shotLoc.placeName || shotLoc.worldThumbKey}
                    </option>
                  ) : null}
                  {places.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  value={editShot.title}
                  onChange={(e) =>
                    void patchShot((s) => ({ ...s, title: e.target.value }))
                  }
                  className="w-full rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-2 py-1 text-[12px] text-[var(--chrome)]"
                  placeholder="Shot name (optional)"
                />
                <textarea
                  rows={4}
                  value={editShot.staging || ""}
                  onChange={(e) =>
                    void patchShot((s) => ({
                      ...s,
                      staging: e.target.value,
                    }))
                  }
                  className="min-h-[5rem] w-full resize-y rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-2 py-1.5 text-[12px] leading-snug text-[var(--chrome)] placeholder:text-[var(--mute)]"
                  placeholder="Staging / Gen plate prompt — who prominent · place roles…"
                />
                <button
                  type="button"
                  disabled={genBusy}
                  onClick={() => void genPlate()}
                  className="rounded-sm border border-[var(--magenta-hot)]/60 px-2.5 py-1 text-[12px] text-[var(--magenta-hot)] hover:bg-[var(--magenta-hot)]/10 disabled:opacity-40"
                >
                  {genBusy ? "Gen…" : "Gen plate"}
                </button>
              </div>
            </div>

            {plateOpen && editShot.plateFile ? (
              <div
                className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4"
                role="dialog"
                aria-label="Plate"
                onClick={() => setPlateOpen(false)}
              >
                <button
                  type="button"
                  className="absolute right-4 top-4 rounded-sm border border-white/40 px-3 py-1 text-[12px] text-white hover:bg-white/10"
                  onClick={() => setPlateOpen(false)}
                >
                  Close
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/crash/gen/file?name=${encodeURIComponent(editShot.plateFile)}`}
                  alt=""
                  className="max-h-[90vh] max-w-[95vw] object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ) : null}

            <ul className="space-y-2">
              {editShot.beats.map((beat, bi) => {
                const slot = beat.speaker.trim()
                  ? findVoiceSlot(beat.speaker, voiceSlots)
                  : undefined;
                const locked = Boolean(slot?.approvedAttemptId);
                const audioSrc = beat.voiceFile
                  // The GET handler in story/speak/route.ts only reads "f" or
                  // "voiceFile" — "t" was silently ignored, so this always fell
                  // back to guessing the filename was "<beatId>.mp3", which
                  // fails for anything not using that exact convention. Every
                  // other caller of this route already uses "f".
                  ? `/api/crash/story/speak?styleId=${encodeURIComponent(styleId)}&beatId=${encodeURIComponent(beat.id)}&f=${encodeURIComponent(beat.voiceFile)}`
                  : null;
                const isSel = beat.id === selectedBeatId;
                const mp3Busy = mp3BusyId === beat.id;
                return (
                  <li
                    key={beat.id}
                    className={`rounded-sm border p-1.5 ${
                      isSel
                        ? "border-[var(--acid)]/50 bg-[var(--acid)]/5"
                        : "border-[var(--line)]"
                    }`}
                  >
                    <div className="flex gap-2">
                      <div className="w-[120px] shrink-0 space-y-1">
                        <select
                          value={
                            speakerOptions.includes(beat.speaker)
                              ? beat.speaker
                              : beat.speaker || ""
                          }
                          onChange={(e) =>
                            void patchBeat(bi, {
                              ...beat,
                              speaker: e.target.value,
                            })
                          }
                          onFocus={() => onSelectBeat(beat.id)}
                          className="w-full rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-1 py-1 text-[12px] text-[var(--chrome)]"
                        >
                          <option value="">—</option>
                          {beat.speaker &&
                          !speakerOptions.includes(beat.speaker) ? (
                            <option value={beat.speaker}>{beat.speaker}</option>
                          ) : null}
                          {speakerOptions.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        {locked ? (
                          <button
                            type="button"
                            disabled={!beat.text.trim() || Boolean(mp3BusyId)}
                            onClick={() => void genMp3(beat)}
                            className="w-full rounded-sm border border-[var(--magenta-hot)] px-1 py-1 text-[11px] uppercase text-[var(--magenta-hot)] disabled:opacity-40"
                          >
                            {mp3Busy ? "Gen…" : "Gen mp3"}
                          </button>
                        ) : beat.speaker ? (
                          <span className="text-[11px] text-[var(--mute)]">
                            no voice lock
                          </span>
                        ) : null}
                        {audioSrc ? (
                          <audio
                            key={beat.voiceFile}
                            controls
                            src={audioSrc}
                            className="h-7 w-full"
                          />
                        ) : null}
                      </div>
                      <textarea
                        rows={3}
                        value={beat.text}
                        onFocus={() => onSelectBeat(beat.id)}
                        onChange={(e) =>
                          void patchBeat(bi, {
                            ...beat,
                            text: e.target.value,
                          })
                        }
                        className="min-h-[4.5rem] min-w-0 flex-1 resize-y rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-2 py-1.5 font-mono text-[12px] leading-snug text-[var(--chrome)]"
                        placeholder="Line…"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            {storyErr ? (
              <p className="text-[12px] text-[var(--magenta-hot)]">{storyErr}</p>
            ) : null}

            {selectedFields ? (
              <div className="border-t border-[var(--line)] pt-2">
                <button
                  type="button"
                  onClick={() => setPromptsOpen((v) => !v)}
                  className="text-[12px] text-[var(--chrome-dim)] hover:text-[var(--acid)]"
                >
                  LTX prompts {promptsOpen ? "▴" : "▾"}
                </button>
                {promptsOpen ? (
                  <div className="mt-1 space-y-1">
                    <label className="block text-[10px] uppercase text-[var(--mute)]">
                      IMAGE motion
                    </label>
                    <textarea
                      rows={3}
                      value={selectedFields.imageMotion}
                      onChange={(e) => {
                        if (!selected) return;
                        const imageMotion = e.target.value;
                        onDraftChange({
                          ...draft,
                          beats: {
                            ...draft.beats,
                            [selected.beatId]: {
                              imageMotion,
                              segmentText:
                                draft.beats[selected.beatId]?.segmentText ||
                                selectedFields.segmentText,
                            },
                          },
                        });
                      }}
                      className="w-full resize-y rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-2 py-1 text-[12px] text-[var(--chrome)]"
                    />
                    <label className="block text-[10px] uppercase text-[var(--mute)]">
                      SEGMENT TEXT
                    </label>
                    <textarea
                      rows={2}
                      value={selectedFields.segmentText}
                      onChange={(e) => {
                        if (!selected) return;
                        const segmentText = e.target.value;
                        onDraftChange({
                          ...draft,
                          beats: {
                            ...draft.beats,
                            [selected.beatId]: {
                              imageMotion:
                                draft.beats[selected.beatId]?.imageMotion ||
                                selectedFields.imageMotion,
                              segmentText,
                            },
                          },
                        });
                      }}
                      className="w-full resize-y rounded-sm border border-[var(--line)] bg-[var(--void)]/40 px-2 py-1 text-[12px] text-[var(--chrome)]"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[12px] text-[var(--mute)]">
              Select a shot on the timeline — plate, staging, lines, Speak open
              here.
            </p>
            {cutChrome}
          </div>
        )}
      </div>
    </div>
  );
}
