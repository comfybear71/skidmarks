"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  sceneIsFilled,
  type CrashStoryBeat,
  type CrashStoryBookend,
  type CrashStoryDoc,
  type CrashStoryScene,
  type CrashStoryShot,
  type CrashStorySfx,
} from "@/lib/crashStoryTypes";
import {
  plateDragHasType,
  readFinishedPlateClipboard,
  readPlateDrag,
  type CrashPlateDragPayload,
} from "@/lib/crashPlateDrag";
import type { CrashVoiceSlot } from "@/lib/crashVoice";
import type { CrashSpxItem } from "@/lib/crashSpx";
import {
  consumeSkipStoryPanelReload,
  CRASH_SPX_SAVED,
  CRASH_STORY_SAVED,
  CRASH_VOICE_SAVED,
  dispatchStorySaved,
} from "@/lib/crashStyleSync";
import { emptyStory } from "@/lib/crashStory";
import {
  CRASH_ACTIVE_EPISODE_EVENT,
  crashDeskStoryFetchUrl,
  preferPackedStory,
  readOpenStoryCache,
} from "@/lib/crashActiveEpisode";
import {
  SHOW_STYLE_PRESETS,
  type ShowStyleId,
} from "@/lib/showStylePresets";
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

type Props = {
  styleId: ShowStyleId | null;
};

/** Columns from Story panel width (floating card), not the browser window. */
function storyShotColumns(width: number): string {
  if (width >= 1100) return "repeat(4, minmax(0, 1fr))";
  if (width >= 820) return "repeat(3, minmax(0, 1fr))";
  if (width >= 520) return "repeat(2, minmax(0, 1fr))";
  return "minmax(0, 1fr)";
}

function storyBookendColumns(width: number): string {
  return width >= 520
    ? "repeat(2, minmax(0, 1fr))"
    : "minmax(0, 1fr)";
}

/** Sunny Banks fallback only — real dropdown prefers voice manifest + story. */
const CAST_NAMES = [
  "Nuggets",
  "Dazza",
  "Shazza",
  "Ranger Bazza",
  "The Unit 4s",
  "Nan",
];

function normalizeSpeakerName(speaker: string): string {
  return speaker.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Client mirror of crashVoice.voiceNamesMatch / findCrashVoiceByName. */
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

function findVoiceSlotForSpeaker(
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

function collectStorySpeakers(story: CrashStoryDoc): string[] {
  const out: string[] = [];
  for (const scene of story.scenes) {
    for (const shot of scene.shots) {
      for (const beat of shot.beats) {
        if (beat.speaker.trim()) out.push(beat.speaker.trim());
      }
    }
  }
  return out;
}

function buildSpeakerOptions(
  styleId: ShowStyleId,
  voiceSlots: Record<string, CrashVoiceSlot>,
  story: CrashStoryDoc,
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
  // Story casing first (Andrew French), then locked voice cast, then Sunny fallback.
  for (const s of collectStorySpeakers(story)) add(s);
  for (const slot of Object.values(voiceSlots)) add(slot.castName);
  if (styleId === "sunny_banks") {
    for (const n of CAST_NAMES) add(n);
  }
  return names;
}

/** Prefer story casing when it matches a slot; else slot castName. */
function optionValueForSpeaker(
  speaker: string,
  options: string[],
): string {
  const n = normalizeSpeakerName(speaker);
  if (!n) return "";
  const hit = options.find((o) => normalizeSpeakerName(o) === n);
  if (hit) return hit;
  const fuzzy = options.find((o) => voiceNamesMatch(speaker, o));
  return fuzzy ?? speaker;
}

function inferSoloSpeaker(
  story: CrashStoryDoc,
  voiceSlots: Record<string, CrashVoiceSlot>,
): string | null {
  const fromStory = collectStorySpeakers(story);
  const uniq = new Map<string, string>();
  for (const s of fromStory) uniq.set(normalizeSpeakerName(s), s);
  if (uniq.size === 1) return [...uniq.values()][0];

  const locked = Object.values(voiceSlots).filter(
    (s) => s.approvedAttemptId && s.castName.trim(),
  );
  if (locked.length === 1) return locked[0].castName.trim();

  const blob = `${story.campaignLabel || ""} ${story.gagNote || ""}`.toLowerCase();
  const hits = locked.filter((s) =>
    blob.includes(normalizeSpeakerName(s.castName)),
  );
  if (hits.length === 1) return hits[0].castName.trim();
  return null;
}

function autofillEmptySpeakers(
  story: CrashStoryDoc,
  voiceSlots: Record<string, CrashVoiceSlot>,
): CrashStoryDoc | null {
  const fill = inferSoloSpeaker(story, voiceSlots);
  if (!fill) return null;
  let changed = false;
  const scenes = story.scenes.map((sc) => ({
    ...sc,
    shots: sc.shots.map((sh) => ({
      ...sh,
      beats: sh.beats.map((b) => {
        if (b.speaker.trim()) return b;
        changed = true;
        return { ...b, speaker: fill };
      }),
    })),
  }));
  return changed ? { ...story, scenes } : null;
}

function PlateDropZone({
  src,
  label,
  empty,
  accept,
  onDropPlate,
  onPastePlate,
}: {
  src: string | null;
  label: string;
  empty: string;
  /** world = scene place; shot = gen/cplate (+ cast/swap promoted) */
  accept: "world" | "shot";
  onDropPlate: (payload: CrashPlateDragPayload) => void | Promise<void>;
  onPastePlate?: (fileName: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  function accepts(payload: CrashPlateDragPayload): boolean {
    if (accept === "world") return payload.kind === "world";
    return (
      payload.kind === "cplate" ||
      payload.kind === "cast" ||
      payload.kind === "swap"
    );
  }

  function onDragOver(e: React.DragEvent) {
    if (!plateDragHasType(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }

  function onDragLeave() {
    setDragOver(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const payload = readPlateDrag(e);
    if (!payload || !accepts(payload)) return;
    void onDropPlate(payload);
  }

  function onPasteClick() {
    if (accept !== "shot" || !onPastePlate) return;
    const clip = readFinishedPlateClipboard();
    if (!clip?.fileName) return;
    onPastePlate(clip.fileName);
  }

  const ring = dragOver
    ? "border-[var(--acid)] bg-[var(--acid)]/10"
    : src
      ? "border-[var(--chrome-dim)]/50"
      : "border-dashed border-[var(--chrome-dim)]/45 bg-[var(--void)]/40";

  return (
    <>
      <div className="flex shrink-0 flex-col items-stretch gap-0.5">
        <button
          type="button"
          className={`flex h-10 w-14 items-center justify-center overflow-hidden rounded-sm border ${ring}`}
          title={
            src
              ? `${label} — click to expand`
              : `${empty} — or drop here`
          }
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => {
            if (src) setLightbox(true);
          }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none h-full w-full object-cover"
            />
          ) : (
            <span className="pointer-events-none px-0.5 text-center text-[9px] uppercase leading-tight tracking-wide text-[var(--chrome-dim)]">
              drop
            </span>
          )}
        </button>
        {accept === "shot" && onPastePlate ? (
          <button
            type="button"
            onClick={onPasteClick}
            className="text-[8px] uppercase tracking-wide text-[var(--acid)] hover:underline"
            title="Paste finished plate copied from Scene kit"
          >
            Paste
          </button>
        ) : null}
      </div>
      {lightbox && src ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-label={label}
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-sm border border-white/40 px-3 py-1 text-[12px] text-white hover:bg-white/10"
            onClick={() => setLightbox(false)}
          >
            Close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={label}
            className="max-h-[90vh] max-w-[95vw] object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}

function SfxRows({
  styleId,
  items,
  shelf,
  onChange,
}: {
  styleId: ShowStyleId;
  items: CrashStorySfx[];
  shelf: CrashSpxItem[];
  onChange: (next: CrashStorySfx[]) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;

  function patch(i: number, next: CrashStorySfx) {
    const sfx = [...items];
    sfx[i] = next;
    onChange(sfx);
  }

  const held = items.filter((r) => r.audioFile || r.spxId).length;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[10px] uppercase tracking-wide text-[var(--chrome-dim)] hover:text-[var(--magenta-hot)]"
      >
        SFX {held ? `${held}/` : ""}
        {items.length}
        {open ? " −" : " +"}
      </button>
      {open ? (
        <ul className="mt-0.5 space-y-0.5">
          {items.map((s, i) => (
            <SfxRow
              key={s.id}
              styleId={styleId}
              sfx={s}
              shelf={shelf}
              onChange={(next) => patch(i, next)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SfxRow({
  styleId,
  sfx,
  shelf,
  onChange,
}: {
  styleId: ShowStyleId;
  sfx: CrashStorySfx;
  shelf: CrashSpxItem[];
  onChange: (next: CrashStorySfx) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const shelfHit = sfx.spxId
    ? shelf.find((r) => r.id === sfx.spxId && r.kind === "sfx")
    : null;
  const audioSrc = shelfHit
    ? `/api/crash/spx/file?styleId=${encodeURIComponent(styleId)}&kind=sfx&file=${encodeURIComponent(shelfHit.fileName)}&t=${shelfHit.mtime}`
    : sfx.audioFile
      ? `/api/crash/story/sfx?styleId=${encodeURIComponent(styleId)}&sfxId=${encodeURIComponent(sfx.id)}&f=${encodeURIComponent(sfx.audioFile)}`
      : null;

  async function upload(file: File) {
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.set("styleId", styleId);
      fd.set("sfxId", sfx.id);
      fd.set("file", file);
      const res = await fetch("/api/crash/story/sfx", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange({ ...sfx, audioFile: data.audioFile, spxId: undefined });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-sm bg-[var(--void)]/30 px-1 py-0.5">
      <div className="flex flex-wrap items-center gap-1">
        <span className="min-w-0 flex-1 text-[10px] text-[var(--chrome)]">
          {sfx.label}
          {sfx.notes ? (
            <span className="text-[var(--chrome-dim)]"> — {sfx.notes}</span>
          ) : null}
        </span>
        {audioSrc ? <BeatAudioMini src={audioSrc} /> : null}
        {shelf.length ? (
          <div className="relative">
            <button
              type="button"
              disabled={busy}
              onClick={() => setPickOpen((o) => !o)}
              className="shrink-0 rounded-sm border border-[var(--acid)]/50 px-1.5 py-0.5 text-[8px] text-[var(--acid)] hover:bg-[var(--acid)]/10 disabled:opacity-40"
            >
              {shelfHit ? "Shelf ✓" : "Shelf"}
            </button>
            {pickOpen ? (
              <ul className="absolute right-0 top-full z-10 mt-0.5 max-h-24 w-44 overflow-y-auto rounded-sm border border-[var(--line)] bg-[var(--panel)] p-0.5 shadow-lg">
                {shelf.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="block w-full truncate rounded-sm px-1 py-0.5 text-left text-[8px] text-[var(--chrome)] hover:bg-[var(--panel-2)]"
                      onClick={() => {
                        onChange({
                          ...sfx,
                          spxId: row.id,
                          audioFile: undefined,
                        });
                        setPickOpen(false);
                      }}
                    >
                      {row.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="shrink-0 rounded-sm border border-[var(--magenta-hot)]/50 px-1.5 py-0.5 text-[8px] text-[var(--magenta-hot)] hover:bg-[var(--magenta-hot)]/10 disabled:opacity-40"
        >
          {busy ? "…" : audioSrc && !shelfHit ? "Replace" : "Upload"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.ogg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
      </div>
      {err ? <p className="mt-0.5 text-[8px] text-[var(--magenta-hot)]">{err}</p> : null}
    </li>
  );
}

import { BeatAudioMini } from "@/components/BeatAudioMini";

function BeatRow({
  styleId,
  beat,
  voiceSlots,
  speakerOptions,
  onChange,
}: {
  styleId: ShowStyleId;
  beat: CrashStoryBeat;
  voiceSlots: CrashVoiceSlot[];
  speakerOptions: string[];
  onChange: (next: CrashStoryBeat) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const selectValue = optionValueForSpeaker(beat.speaker, speakerOptions);
  const voiceSlot = beat.speaker.trim()
    ? findVoiceSlotForSpeaker(beat.speaker, voiceSlots)
    : undefined;
  const isNuggets = beat.speaker.toLowerCase().includes("nugget");
  const locked = Boolean(voiceSlot?.approvedAttemptId);
  const audioSrc = beat.voiceFile
    ? `/api/crash/story/speak?styleId=${encodeURIComponent(styleId)}&beatId=${encodeURIComponent(beat.id)}&t=${beat.voiceFile}`
    : null;

  async function genMp3() {
    if (!beat.text.trim()) {
      setErr("Write a line first");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/crash/story/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId,
          beatId: beat.id,
          speaker: beat.speaker || selectValue,
          text: beat.text,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gen failed");
      onChange({ ...beat, voiceFile: data.voiceFile });
      // Server already wrote story.json — wake Animate / Storyboard now.
      dispatchStorySaved({ fromStoryPanel: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gen failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="space-y-0.5">
      <div className="flex items-start gap-1">
        <div className="flex w-[96px] shrink-0 flex-col gap-0.5">
          <select
            value={selectValue}
            onChange={(e) => onChange({ ...beat, speaker: e.target.value })}
            className="w-full rounded-sm border border-[var(--chrome-dim)]/50 bg-[var(--panel-2)] px-1 py-0.5 text-[10px] text-[var(--chrome)]"
          >
            <option value="">—</option>
            {speakerOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {locked ? (
            <button
              type="button"
              disabled={busy || !beat.text.trim()}
              title="Generate mp3 for this line"
              className="w-full rounded-sm border border-[var(--magenta-hot)] bg-[var(--magenta)]/15 px-1 py-0.5 text-[10px] uppercase tracking-wide text-[var(--magenta-hot)] disabled:opacity-40"
              onClick={() => void genMp3()}
            >
              {busy ? "…" : "Gen mp3"}
            </button>
          ) : beat.speaker ? (
            <span
              className="text-[9px] text-[var(--chrome-dim)]"
              title="Lock voice in Voice panel"
            >
              no voice
            </span>
          ) : null}
          {audioSrc ? <BeatAudioMini src={audioSrc} /> : null}
        </div>
        <textarea
          rows={3}
          value={beat.text}
          onChange={(e) => onChange({ ...beat, text: e.target.value })}
          className={`min-h-[5rem] min-w-0 flex-1 resize-y rounded-sm border px-1.5 py-1 font-mono text-[10px] leading-snug text-[var(--chrome)] placeholder:text-[var(--chrome-dim)] ${
            isNuggets
              ? "border-[var(--magenta)]/60 bg-[var(--magenta)]/10 focus:border-[var(--magenta-hot)]"
              : "border-[var(--chrome-dim)]/55 bg-[var(--panel-2)] focus:border-[var(--acid)]"
          }`}
          placeholder={isNuggets ? "Gibberish…" : "Line…"}
        />
      </div>
      {err ? (
        <p className="text-[9px] text-[var(--magenta-hot)]">{err}</p>
      ) : null}
    </li>
  );
}

function BookendBlock({
  label,
  styleId,
  bookend,
  shelf,
  onChange,
}: {
  label: string;
  styleId: ShowStyleId;
  bookend: CrashStoryBookend;
  shelf: CrashSpxItem[];
  onChange: (next: CrashStoryBookend) => void;
}) {
  const isIntro = label === "Intro";
  const cardLabel = isIntro ? "Title card" : "End card";
  const logoSrc = bookend.logoFile
    ? `/api/crash/gen/file?name=${encodeURIComponent(bookend.logoFile)}`
    : null;

  function onDropLogo(payload: CrashPlateDragPayload) {
    if (payload.kind !== "cplate") return;
    onChange({ ...bookend, logoFile: payload.fileName });
  }

  return (
    <div className="flex h-full min-w-0 flex-col rounded-sm border border-[var(--chrome-dim)]/40 bg-[var(--panel)] p-1.5">
      <div className="flex gap-1.5">
        <div
          className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-dashed border-[var(--chrome-dim)]/50 bg-[var(--void)]/40"
          title={logoSrc ? cardLabel : `Drag ${cardLabel.toLowerCase()} from Image gen`}
          onDragOver={(e) => {
            if (!plateDragHasType(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const payload = readPlateDrag(e);
            if (payload) onDropLogo(payload);
          }}
        >
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt=""
              draggable={false}
              className="pointer-events-none h-full w-full object-contain"
            />
          ) : (
            <span className="pointer-events-none px-0.5 text-center text-[9px] uppercase leading-tight text-[var(--chrome-dim)]">
              {isIntro ? "logo" : "end"}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-wider text-[var(--magenta-hot)]">
            {label}
          </span>
          <input
            value={bookend.title}
            onChange={(e) => onChange({ ...bookend, title: e.target.value })}
            className="mt-0.5 w-full rounded-sm border border-[var(--chrome-dim)]/45 bg-[var(--panel-2)] px-1 py-0.5 text-[11px] font-medium text-[var(--chrome)] focus:border-[var(--acid)]"
          />
        </div>
      </div>
      <input
        value={bookend.notes}
        onChange={(e) => onChange({ ...bookend, notes: e.target.value })}
        placeholder="Note…"
        className="mt-1 w-full rounded-sm border border-[var(--chrome-dim)]/45 bg-[var(--panel-2)] px-1 py-0.5 text-[10px] text-[var(--chrome)] placeholder:text-[var(--chrome-dim)] focus:border-[var(--acid)]"
      />
      {logoSrc ? (
        <button
          type="button"
          className="mt-0.5 self-start rounded-sm border border-[var(--magenta-hot)]/50 px-1.5 py-0.5 text-[10px] text-[var(--magenta-hot)] hover:bg-[var(--magenta-hot)]/10"
          onClick={() => onChange({ ...bookend, logoFile: "" })}
          title="Unlink title/credits plate (file stays on disk)"
        >
          − {isIntro ? "Title card" : "Credits card"}
        </button>
      ) : null}
      <SfxRows
        styleId={styleId}
        items={bookend.sfx}
        shelf={shelf}
        onChange={(sfx) => onChange({ ...bookend, sfx })}
      />
    </div>
  );
}

function ShotBlock({
  shot,
  shotIndex,
  shotCount,
  styleId,
  placeName,
  worldThumbKey,
  shelf,
  voiceSlots,
  speakerOptions,
  onChange,
  onRemove,
  canRemove,
  onMove,
  onDropAt,
}: {
  shot: CrashStoryShot;
  shotIndex: number;
  shotCount: number;
  styleId: ShowStyleId;
  placeName: string;
  worldThumbKey: string;
  shelf: CrashSpxItem[];
  voiceSlots: CrashVoiceSlot[];
  speakerOptions: string[];
  onChange: (next: CrashStoryShot) => void;
  onRemove: () => void;
  canRemove: boolean;
  onMove: (dir: -1 | 1) => void;
  onDropAt: (fromIndex: number) => void;
}) {
  const [pickOpen, setPickOpen] = useState(false);
  const [pickBusy, setPickBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [genPlates, setGenPlates] = useState<
    { fileName: string; label: string }[]
  >([]);
  const [dropErr, setDropErr] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const canUp = shotIndex > 0;
  const canDown = shotIndex < shotCount - 1;

  const plateSrc = shot.plateFile
    ? `/api/crash/gen/file?name=${encodeURIComponent(shot.plateFile)}`
    : null;

  function patchBeat(i: number, next: CrashStoryBeat) {
    const beats = [...shot.beats];
    beats[i] = next;
    onChange({ ...shot, beats });
  }

  async function applyPlateFile(fileName: string) {
    onChange({ ...shot, plateFile: fileName });
    setDropErr("");
  }

  async function genPlateInPlace() {
    if (genBusy) return;
    setGenBusy(true);
    setDropErr("");
    try {
      const speakers = [
        ...new Set(
          shot.beats.map((b) => b.speaker.trim()).filter(Boolean),
        ),
      ];
      const res = await fetch("/api/crash/story/gen-plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId,
          speakers,
          placeName: placeName || shot.title,
          summary: shot.summary,
          staging: shot.staging || undefined,
          worldKey: worldThumbKey || undefined,
          note: shot.title,
        }),
      });
      const data = (await res.json()) as {
        fileName?: string;
        error?: string;
      };
      if (!res.ok || !data.fileName) {
        setDropErr(data.error || "Gen plate failed");
        return;
      }
      await applyPlateFile(data.fileName);
    } catch {
      setDropErr("Gen plate failed");
    } finally {
      setGenBusy(false);
    }
  }

  async function onDropShotPlate(payload: CrashPlateDragPayload) {
    setDropErr("");
    if (payload.kind === "cplate") {
      await applyPlateFile(payload.fileName);
      return;
    }
    if (payload.kind !== "cast" && payload.kind !== "swap") return;
    setPickBusy(true);
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
        setDropErr(data.error || "Could not use that still");
        return;
      }
      await applyPlateFile(data.fileName);
    } catch {
      setDropErr("Could not use that still");
    } finally {
      setPickBusy(false);
    }
  }

  async function openUsePlate() {
    setPickOpen((o) => !o);
    if (pickOpen) return;
    setPickBusy(true);
    try {
      const res = await fetch(
        `/api/crash/swap?styleId=${encodeURIComponent(styleId)}`,
      );
      const data = (await res.json()) as {
        genPlates?: { fileName: string; label: string }[];
      };
      setGenPlates(data.genPlates || []);
    } catch {
      setGenPlates([]);
    } finally {
      setPickBusy(false);
    }
  }

  return (
    <div
      className={`flex h-full min-w-0 flex-col rounded-sm border p-1.5 ${
        dragOver
          ? "border-[var(--acid)] bg-[var(--acid)]/10"
          : "border-[var(--chrome-dim)]/40 bg-[var(--panel)]"
      }`}
      onDragOver={(e) => {
        if (!isShotReorderDrag(e.dataTransfer)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!isShotReorderDrag(e.dataTransfer)) return;
        const raw = e.dataTransfer.getData(SHOT_REORDER_DRAG);
        if (!raw) return;
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        const from = Number(raw);
        if (!Number.isFinite(from) || from === shotIndex) return;
        onDropAt(from);
      }}
    >
      <div className="flex gap-1.5">
        <button
          type="button"
          draggable
          title="Drag to reorder shots"
          aria-label="Drag to reorder shots"
          className="mt-0.5 flex h-10 w-5 shrink-0 cursor-grab items-center justify-center rounded-sm border border-[var(--chrome-dim)]/45 text-[10px] leading-none text-[var(--chrome-dim)] active:cursor-grabbing hover:border-[var(--acid)] hover:text-[var(--acid)]"
          onDragStart={(e) => {
            e.dataTransfer.setData(SHOT_REORDER_DRAG, String(shotIndex));
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => setDragOver(false)}
        >
          ⋮⋮
        </button>
        <PlateDropZone
          src={plateSrc}
          label={shot.title}
          empty="Shot plate — drag from Image gen tray"
          accept="shot"
          onDropPlate={onDropShotPlate}
          onPastePlate={(fileName) => {
            void applyPlateFile(fileName);
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1">
            <span className="shrink-0 text-[10px] uppercase text-[var(--chrome-dim)]">
              {shotIndex + 1}
            </span>
            <input
              value={shot.title}
              onChange={(e) => onChange({ ...shot, title: e.target.value })}
              className="min-w-0 flex-1 rounded-sm border border-[var(--chrome-dim)]/45 bg-[var(--panel-2)] px-1 py-0.5 text-[11px] font-medium text-[var(--chrome)] focus:border-[var(--acid)]"
            />
            <div className="flex shrink-0 flex-col gap-0.5">
              <button
                type="button"
                title="Move shot up"
                disabled={!canUp}
                onClick={() => onMove(-1)}
                className="flex h-3.5 w-5 items-center justify-center rounded-sm border border-[var(--chrome-dim)]/50 text-[8px] leading-none text-[var(--chrome)] hover:border-[var(--acid)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                ↑
              </button>
              <button
                type="button"
                title="Move shot down"
                disabled={!canDown}
                onClick={() => onMove(1)}
                className="flex h-3.5 w-5 items-center justify-center rounded-sm border border-[var(--chrome-dim)]/50 text-[8px] leading-none text-[var(--chrome)] hover:border-[var(--acid)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                ↓
              </button>
            </div>
            <button
              type="button"
              disabled={!canRemove}
              title={
                canRemove
                  ? "Bin this shot from the story (plates stay on disk). Last shot in a scene bins the scene."
                  : "Keep at least one shot"
              }
              onClick={onRemove}
              className="shrink-0 rounded-sm border border-[var(--line)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--chrome-dim)] hover:border-[var(--magenta-hot)] hover:text-[var(--magenta-hot)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--line)] disabled:hover:text-[var(--chrome-dim)]"
            >
              Bin
            </button>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <input
              value={shot.staging || ""}
              onChange={(e) => onChange({ ...shot, staging: e.target.value })}
              className="min-w-0 flex-1 rounded-sm border border-[var(--chrome-dim)]/45 bg-[var(--panel-2)] px-1 py-0.5 text-[10px] text-[var(--chrome)] placeholder:text-[var(--chrome-dim)] focus:border-[var(--acid)]"
              placeholder="Staging — who prominent · place roles…"
              title="Baked into Gen plate: speaker prominence + who stands where"
            />
            <button
              type="button"
              disabled={genBusy || pickBusy}
              onClick={() => void genPlateInPlace()}
              className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--magenta-hot)] hover:underline disabled:opacity-40"
              title="Gen plate with speakers in the place. Staging + first speaker = prominent."
            >
              {genBusy ? "Gen…" : "Gen plate"}
            </button>
            <button
              type="button"
              onClick={() => void openUsePlate()}
              className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--acid)] hover:underline"
              title="Pick a plate from Image gen without drag"
            >
              {pickBusy ? "…" : "Use plate"}
            </button>
          </div>
          {dropErr ? (
            <p className="mt-0.5 text-[9px] text-[var(--fail)]">{dropErr}</p>
          ) : null}
          {pickOpen ? (
            <div className="mt-1 max-h-20 overflow-y-auto rounded-sm border border-[var(--line)] bg-[var(--void)]/50 p-1">
              {genPlates.length === 0 ? (
                <p className="text-[10px] text-[var(--chrome-dim)]">
                  No Image gen plates yet — plate first, then Use plate or drag.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {genPlates.map((p) => (
                    <li key={p.fileName}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-1 rounded-sm px-0.5 py-0.5 text-left hover:bg-[var(--acid)]/10"
                        onClick={() => {
                          void applyPlateFile(p.fileName);
                          setPickOpen(false);
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/crash/gen/file?name=${encodeURIComponent(p.fileName)}`}
                          alt=""
                          className="h-6 w-9 shrink-0 object-cover"
                        />
                        <span className="truncate text-[10px] text-[var(--chrome)]">
                          {p.label || p.fileName}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <ul className="mt-1 min-h-0 flex-1 space-y-1">
        {shot.beats.map((b, i) => (
          <BeatRow
            key={b.id}
            styleId={styleId}
            beat={b}
            voiceSlots={voiceSlots}
            speakerOptions={speakerOptions}
            onChange={(next) => patchBeat(i, next)}
          />
        ))}
      </ul>

      <div className="mt-1 border-t border-[var(--line)]/50 pt-1">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="text-[9px] uppercase tracking-wide text-[var(--mute)] hover:text-[var(--chrome)]"
        >
          More {moreOpen ? "▴" : "▾"}
        </button>
        {moreOpen ? (
          <div className="mt-1 space-y-1">
            <input
              value={shot.summary}
              onChange={(e) => onChange({ ...shot, summary: e.target.value })}
              className="w-full rounded-sm border border-[var(--chrome-dim)]/45 bg-[var(--panel-2)] px-1 py-0.5 text-[10px] text-[var(--chrome)] placeholder:text-[var(--chrome-dim)] focus:border-[var(--acid)]"
              placeholder="Extra note (optional)…"
            />
            <SfxRows
              styleId={styleId}
              items={shot.sfx}
              shelf={shelf}
              onChange={(sfx) => onChange({ ...shot, sfx })}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

const SCENE_REORDER_DRAG = "application/x-crash-story-scene-index";
const SHOT_REORDER_DRAG = "application/x-crash-story-shot-index";
const STORY_UNDO_MAX = 40;

function cloneStory(doc: CrashStoryDoc): CrashStoryDoc {
  return JSON.parse(JSON.stringify(doc)) as CrashStoryDoc;
}

function isSceneReorderDrag(dt: DataTransfer): boolean {
  return Array.from(dt.types || []).some(
    (t) => t.toLowerCase() === SCENE_REORDER_DRAG,
  );
}

function isShotReorderDrag(dt: DataTransfer): boolean {
  return Array.from(dt.types || []).some(
    (t) => t.toLowerCase() === SHOT_REORDER_DRAG,
  );
}

function SceneBlock({
  scene,
  sceneIndex,
  sceneCount,
  styleId,
  shelf,
  voiceSlots,
  speakerOptions,
  onChange,
  onMove,
  onDropAt,
  onBinScene,
}: {
  scene: CrashStoryScene;
  sceneIndex: number;
  sceneCount: number;
  styleId: ShowStyleId;
  shelf: CrashSpxItem[];
  voiceSlots: CrashVoiceSlot[];
  speakerOptions: string[];
  onChange: (next: CrashStoryScene) => void;
  onMove: (dir: -1 | 1) => void;
  onDropAt: (fromIndex: number) => void;
  onBinScene: () => void;
}) {
  const worldSrc = scene.worldThumbKey
    ? `/api/crash/world-cards/file?styleId=${encodeURIComponent(styleId)}&thumb=${encodeURIComponent(scene.worldThumbKey)}`
    : null;
  const filled = sceneIsFilled(scene);
  const collapsed = Boolean(scene.collapsed);
  const platesDone = scene.shots.filter((sh) => sh.plateFile?.trim()).length;
  const [dragOver, setDragOver] = useState(false);
  const canUp = sceneIndex > 0;
  const canDown = sceneIndex < sceneCount - 1;

  function patchShot(i: number, next: CrashStoryShot) {
    const shots = [...scene.shots];
    shots[i] = next;
    const nextScene = { ...scene, shots };
    onChange(nextScene);
  }

  function onDropWorld(payload: CrashPlateDragPayload) {
    if (payload.kind !== "world") return;
    onChange({
      ...scene,
      worldThumbKey: payload.thumbKey,
      placeName: payload.name?.trim() || scene.placeName,
    });
  }

  function toggleCollapsed() {
    onChange({ ...scene, collapsed: !collapsed });
  }

  function addShot() {
    const next = newEmptyStoryShot(scene.shots.length + 1);
    onChange({
      ...scene,
      collapsed: false,
      shots: [...scene.shots, next],
    });
  }

  function removeShot(i: number) {
    if (scene.shots.length > 1) {
      onChange({
        ...scene,
        shots: scene.shots.filter((_, j) => j !== i),
      });
      return;
    }
    // Last shot in this scene — bin the whole scene (or blank the only remaining scene).
    if (sceneCount > 1) {
      onBinScene();
      return;
    }
    onChange({
      ...scene,
      shots: [newEmptyStoryShot(1)],
    });
  }

  function reorderShots(from: number, to: number) {
    if (from === to) return;
    if (from < 0 || to < 0) return;
    if (from >= scene.shots.length || to >= scene.shots.length) return;
    const shots = [...scene.shots];
    const [moved] = shots.splice(from, 1);
    shots.splice(to, 0, moved);
    onChange({ ...scene, shots });
  }

  function nudgeShot(i: number, dir: -1 | 1) {
    reorderShots(i, i + dir);
  }

  return (
    <>
      <div
        className={`col-span-full flex items-center gap-1.5 border-b pb-1 ${
          dragOver
            ? "border-[var(--acid)] bg-[var(--acid)]/10"
            : "border-[var(--chrome-dim)]/40"
        }`}
        onDragOver={(e) => {
          if (!isSceneReorderDrag(e.dataTransfer)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!isSceneReorderDrag(e.dataTransfer)) return;
          const raw = e.dataTransfer.getData(SCENE_REORDER_DRAG);
          if (!raw) return;
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          const from = Number(raw);
          if (!Number.isFinite(from) || from === sceneIndex) return;
          onDropAt(from);
        }}
      >
        <button
          type="button"
          draggable
          title="Drag to reorder scenes"
          aria-label="Drag to reorder scenes"
          className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center rounded-sm border border-[var(--chrome-dim)]/45 text-[10px] leading-none text-[var(--chrome-dim)] active:cursor-grabbing hover:border-[var(--acid)] hover:text-[var(--acid)]"
          onDragStart={(e) => {
            e.dataTransfer.setData(SCENE_REORDER_DRAG, String(sceneIndex));
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => setDragOver(false)}
        >
          ⋮⋮
        </button>
        <PlateDropZone
          src={worldSrc}
          label={scene.placeName}
          empty="World plate — drag from World gallery"
          accept="world"
          onDropPlate={(payload) => {
            if (payload.kind === "world") onDropWorld(payload);
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[var(--chrome-dim)]">
              Scene {sceneIndex + 1}
            </span>
            {filled ? (
              <span className="text-[10px] text-[var(--acid)]">Ready ✓</span>
            ) : (
              <span className="text-[10px] text-[var(--chrome-dim)]">
                {platesDone}/{scene.shots.length} plates
              </span>
            )}
          </div>
          <input
            value={scene.placeName}
            onChange={(e) =>
              onChange({ ...scene, placeName: e.target.value })
            }
            className="mt-0.5 w-full rounded-sm border border-[var(--chrome-dim)]/45 bg-[var(--panel-2)] px-1 py-0.5 text-[12px] text-[var(--chrome)] placeholder:text-[var(--chrome-dim)] focus:border-[var(--acid)]"
            placeholder="Location name"
          />
        </div>
        <div className="flex shrink-0 flex-col gap-0.5">
          <button
            type="button"
            title="Move scene up"
            disabled={!canUp}
            onClick={() => onMove(-1)}
            className="flex h-4 w-6 items-center justify-center rounded-sm border border-[var(--chrome-dim)]/50 text-[9px] leading-none text-[var(--chrome)] hover:border-[var(--acid)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            ↑
          </button>
          <button
            type="button"
            title="Move scene down"
            disabled={!canDown}
            onClick={() => onMove(1)}
            className="flex h-4 w-6 items-center justify-center rounded-sm border border-[var(--chrome-dim)]/50 text-[9px] leading-none text-[var(--chrome)] hover:border-[var(--acid)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            ↓
          </button>
        </div>
        <button
          type="button"
          title="Add another shot to this scene"
          onClick={addShot}
          className="shrink-0 rounded-sm border border-[var(--acid)]/60 bg-[var(--acid)]/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--acid)] hover:bg-[var(--acid)]/20"
        >
          + Shot
        </button>
        <button
          type="button"
          disabled={sceneCount <= 1}
          title={
            sceneCount > 1
              ? "Bin this whole scene (plates stay on disk)"
              : "Keep at least one scene"
          }
          onClick={onBinScene}
          className="shrink-0 rounded-sm border border-[var(--line)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--chrome-dim)] hover:border-[var(--magenta-hot)] hover:text-[var(--magenta-hot)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--line)] disabled:hover:text-[var(--chrome-dim)]"
        >
          Bin
        </button>
        <button
          type="button"
          aria-expanded={!collapsed}
          title={collapsed ? "Open scene" : "Collapse scene"}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-[var(--chrome-dim)]/50 text-sm leading-none text-[var(--chrome)] hover:border-[var(--acid)]"
          onClick={toggleCollapsed}
        >
          {collapsed ? "+" : "−"}
        </button>
      </div>

      {collapsed ? (
        <p className="col-span-full text-[10px] text-[var(--chrome-dim)]">
          {scene.shots.length} shots ·{" "}
          <button
            type="button"
            className="text-[var(--acid)] hover:underline"
            onClick={toggleCollapsed}
          >
            Open
          </button>
        </p>
      ) : (
        <>
          {scene.shots.map((sh, i) => (
            <ShotBlock
              key={sh.id}
              shot={sh}
              shotIndex={i}
              shotCount={scene.shots.length}
              styleId={styleId}
              placeName={scene.placeName}
              worldThumbKey={scene.worldThumbKey}
              shelf={shelf}
              voiceSlots={voiceSlots}
              speakerOptions={speakerOptions}
              onChange={(next) => patchShot(i, next)}
              onRemove={() => removeShot(i)}
              canRemove
              onMove={(dir) => nudgeShot(i, dir)}
              onDropAt={(from) => reorderShots(from, i)}
            />
          ))}
          <div className="col-span-full flex justify-end pt-0.5">
            <button
              type="button"
              title="Add another shot to this scene"
              onClick={addShot}
              className="rounded-sm border border-[var(--acid)]/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--acid)] hover:bg-[var(--acid)]/10"
            >
              + Shot
            </button>
          </div>
        </>
      )}
    </>
  );
}

/** Sunny Banks story layout — scene · shots · beats · SFX · intro/outro. */
export function StyleStoryPanel({ styleId }: Props) {
  const [story, setStory] = useState<CrashStoryDoc | null>(null);
  const [voiceSlots, setVoiceSlots] = useState<Record<string, CrashVoiceSlot>>(
    {},
  );
  const [shelf, setShelf] = useState<CrashSpxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [panelW, setPanelW] = useState(0);
  const [undoAvail, setUndoAvail] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoStack = useRef<CrashStoryDoc[]>([]);
  const undoBurst = useRef(false);
  const skipUndoPush = useRef(false);
  const preset = SHOW_STYLE_PRESETS.find((p) => p.id === styleId);

  const storyReady = Boolean(story);
  useEffect(() => {
    if (!storyReady) return;
    const el = rootRef.current;
    if (!el) return;
    const apply = () => setPanelW(el.clientWidth);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [storyReady, styleId]);

  const load = useCallback(async () => {
    if (!styleId) return;
    setLoading(true);
    try {
      const storyUrl = crashDeskStoryFetchUrl(styleId);
      const voiceRes = await fetch(
        `/api/crash/voice?styleId=${encodeURIComponent(styleId)}`,
      );
      const voiceData = await voiceRes.json();
      const slots =
        voiceRes.ok && voiceData.slots
          ? (voiceData.slots as Record<string, CrashVoiceSlot>)
          : {};
      if (voiceRes.ok && voiceData.slots) setVoiceSlots(slots);
      if (!storyUrl) {
        const cached = readOpenStoryCache(styleId) as CrashStoryDoc | null;
        undoStack.current = [];
        undoBurst.current = false;
        setUndoAvail(0);
        setStory(cached?.styleId === styleId ? cached : emptyStory(styleId));
        return;
      }
      const storyRes = await fetch(storyUrl);
      const storyData = await storyRes.json();
      if (storyRes.ok && storyData.story) {
        const cached = readOpenStoryCache(styleId);
        const raw = preferPackedStory(storyData.story, cached) as CrashStoryDoc;
        const filled = autofillEmptySpeakers(raw, slots);
        undoStack.current = [];
        undoBurst.current = false;
        setUndoAvail(0);
        setStory(filled || raw);
      }
    } finally {
      setLoading(false);
    }
  }, [styleId]);

  const loadVoicesOnly = useCallback(async () => {
    if (!styleId) return;
    try {
      const voiceRes = await fetch(
        `/api/crash/voice?styleId=${encodeURIComponent(styleId)}`,
      );
      const voiceData = await voiceRes.json();
      if (voiceRes.ok && voiceData.slots) setVoiceSlots(voiceData.slots);
    } catch {
      /* ignore */
    }
  }, [styleId]);

  const loadShelf = useCallback(async () => {
    if (!styleId) return;
    try {
      const res = await fetch(
        `/api/crash/spx?styleId=${encodeURIComponent(styleId)}`,
      );
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        setShelf(
          (data.items as CrashSpxItem[]).filter((i) => i.kind === "sfx"),
        );
      }
    } catch {
      /* ignore */
    }
  }, [styleId]);

  useEffect(() => {
    void load();
    void loadShelf();
    const onSpx = () => void loadShelf();
    const onStory = () => {
      if (consumeSkipStoryPanelReload()) return;
      void load();
    };
    const onVoice = () => void loadVoicesOnly();
    window.addEventListener(CRASH_SPX_SAVED, onSpx);
    window.addEventListener(CRASH_STORY_SAVED, onStory);
    window.addEventListener(CRASH_VOICE_SAVED, onVoice);
    window.addEventListener(CRASH_ACTIVE_EPISODE_EVENT, onStory);
    return () => {
      window.removeEventListener(CRASH_SPX_SAVED, onSpx);
      window.removeEventListener(CRASH_STORY_SAVED, onStory);
      window.removeEventListener(CRASH_VOICE_SAVED, onVoice);
      window.removeEventListener(CRASH_ACTIVE_EPISODE_EVENT, onStory);
    };
  }, [load, loadShelf, loadVoicesOnly]);

  const scheduleSave = useCallback(
    (next: CrashStoryDoc) => {
      setStory((prev) => {
        if (
          prev &&
          !skipUndoPush.current &&
          !undoBurst.current
        ) {
          undoStack.current = [
            ...undoStack.current.slice(-(STORY_UNDO_MAX - 1)),
            cloneStory(prev),
          ];
          undoBurst.current = true;
          setUndoAvail(undoStack.current.length);
        }
        return next;
      });
      setSaveState("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/crash/story", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ story: next }),
          });
          if (res.ok) {
            setSaveState("saved");
            dispatchStorySaved({ fromStoryPanel: true });
          } else setSaveState("idle");
        } catch {
          setSaveState("idle");
        } finally {
          undoBurst.current = false;
          skipUndoPush.current = false;
        }
      }, 700);
    },
    [],
  );

  const voiceSlotList = Object.values(voiceSlots);
  const speakerOptions = story
    ? buildSpeakerOptions(styleId!, voiceSlots, story)
    : [];

  if (!styleId) {
    return (
      <p className="p-2 text-[10px] text-[var(--mute)]">
        Pick Sunny Banks on Script desk first.
      </p>
    );
  }

  if (loading && !story) {
    return (
      <p className="p-2 text-[10px] text-[var(--mute)]">Loading story…</p>
    );
  }

  if (!story) {
    return (
      <p className="p-2 text-[10px] text-[var(--magenta-hot)]">
        Could not load story.
      </p>
    );
  }

  const doc = story;

  function patchScene(i: number, next: CrashStoryScene) {
    const scenes = [...doc.scenes];
    scenes[i] = next;
    scheduleSave({ ...doc, scenes });
  }

  function reorderScenes(from: number, to: number) {
    if (from === to) return;
    if (from < 0 || to < 0) return;
    if (from >= doc.scenes.length || to >= doc.scenes.length) return;
    const scenes = [...doc.scenes];
    const [moved] = scenes.splice(from, 1);
    scenes.splice(to, 0, moved);
    undoBurst.current = false;
    scheduleSave({ ...doc, scenes });
  }

  function nudgeScene(i: number, dir: -1 | 1) {
    reorderScenes(i, i + dir);
  }

  function binScene(i: number) {
    if (doc.scenes.length <= 1) return;
    undoBurst.current = false;
    scheduleSave({
      ...doc,
      scenes: doc.scenes.filter((_, j) => j !== i),
    });
  }

  function undoStory() {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setUndoAvail(undoStack.current.length);
    skipUndoPush.current = true;
    undoBurst.current = false;
    scheduleSave(prev);
  }

  async function clearStory() {
    if (!styleId) return;
    const ok = window.confirm(
      `Clear this show’s story and start fresh?\n\nDialogue mp3s move to data/crash/story/${styleId}/_cleared/ — nothing is deleted.\nPlates stay in Image gen.`,
    );
    if (!ok) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setClearing(true);
    setClearMsg("");
    try {
      const res = await fetch("/api/crash/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true, styleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clear failed");
      setStory(data.story as CrashStoryDoc);
      setSaveState("idle");
      undoStack.current = [];
      undoBurst.current = false;
      setUndoAvail(0);
      const n = typeof data.movedCount === "number" ? data.movedCount : 0;
      setClearMsg(
        n > 0
          ? `Fresh · parked ${n} audio → ${data.parkedIn || "_cleared/"}`
          : "Fresh story ready",
      );
      dispatchStorySaved({ fromStoryPanel: true });
    } catch (e) {
      setClearMsg(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2"
    >
      <div className="flex shrink-0 items-start justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-[var(--chrome)]">
            {story.campaignLabel || preset?.label || styleId}
          </p>
          <p className="text-[10px] text-[var(--chrome-dim)]">{story.gagNote}</p>
          {clearMsg ? (
            <p className="mt-0.5 text-[10px] text-[var(--acid)]">{clearMsg}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[10px] uppercase text-[var(--chrome-dim)]">
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved"
                : ""}
          </span>
          <button
            type="button"
            disabled={undoAvail < 1 || clearing}
            title="Undo last Story change"
            onClick={undoStory}
            className="rounded-sm border border-[var(--chrome-dim)]/50 px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-[var(--chrome)] hover:border-[var(--acid)] hover:text-[var(--acid)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            disabled={clearing}
            title="Wipe story text/beats; park dialogue mp3s in _cleared/ (never deletes)"
            onClick={() => void clearStory()}
            className="rounded-sm border border-[var(--fail)]/50 px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-[var(--fail)] hover:bg-[var(--fail)]/10 disabled:opacity-40"
          >
            {clearing ? "…" : "Clear"}
          </button>
        </div>
      </div>

      <div className="crash-tray-scroll min-h-0 flex-1 overflow-y-auto pr-0.5">
        {/* Intro|Outro: stack when skinny, 2-up when the panel is wide */}
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: storyBookendColumns(panelW) }}
        >
          <BookendBlock
            label="Intro"
            styleId={styleId}
            shelf={shelf}
            bookend={story.intro}
            onChange={(intro) => scheduleSave({ ...doc, intro })}
          />
          <BookendBlock
            label="Outro"
            styleId={styleId}
            shelf={shelf}
            bookend={story.outro}
            onChange={(outro) => scheduleSave({ ...doc, outro })}
          />
        </div>

        {/* Shot grid follows Story panel width via ResizeObserver */}
        <div
          className="mt-1.5 grid gap-1.5"
          style={{ gridTemplateColumns: storyShotColumns(panelW) }}
        >
          {story.scenes.map((sc, i) => (
            <SceneBlock
              key={sc.id}
              scene={sc}
              sceneIndex={i}
              sceneCount={story.scenes.length}
              styleId={styleId}
              shelf={shelf}
              voiceSlots={voiceSlotList}
              speakerOptions={speakerOptions}
              onChange={(next) => patchScene(i, next)}
              onMove={(dir) => nudgeScene(i, dir)}
              onDropAt={(from) => reorderScenes(from, i)}
              onBinScene={() => binScene(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
