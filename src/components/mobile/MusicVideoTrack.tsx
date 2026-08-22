"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MobileGenJob, MobileShotUnit } from "@/lib/mobileGenJob";
import type { CrashStoryDoc } from "@/lib/crashStoryTypes";
import {
  TRACK_ACID,
  TRACK_SECTION_LABELS,
  formatTrackClock,
  evenLineStartMs,
  evenLyricHoldMs,
  evenLyricIndexAt,
  activeLyricLineIndex,
  lyricCueFor,
  lyricHoldMs,
  lyricLinesFrom,
  lyricWords,
  withLyricCue,
  withoutLyricCue,
  plateTimingForShot,
  importSectionMarkersFromLyrics,
  meaningfulLyricTags,
  nextSectionNeedingStart,
  nextSectionStartMs,
  parseTrackClock,
  plateBarColor,
  sectionCastForMarker,
  sectionCastHint,
  sectionColor,
  sectionNeedsStartHere,
  sectionTint,
  sectionTitle,
  sortPlateTimings,
  sortSectionMarkers,
  withSectionStartAt,
  withSectionTime,
  type LyricCue,
  type TrackSectionLabel,
} from "@/lib/musicVideoTrack";
import { decodeWaveformPeaks } from "@/lib/decodeWaveformPeaks";
import { clearPendingSong, songChipName } from "@/lib/musicVideoStart";
import { findSongCarrierBeatId, musicVideoCreditLine } from "@/lib/musicVideoSong";

import { probeBrowserAudioDurationSec } from "@/lib/scratchSongDrop";
import { lyricsPanelOpensAt } from "@/lib/musicVideoStart";
import { mobileLocationStillUrl } from "@/lib/mobileCandidateUrls";
import { readApiJson } from "@/lib/studioFetchError";
import { MobilePrimaryButton } from "./MobileUi";
import { LyricsBox, SongDropRow, SongPlayer, usePendingSong } from "./MusicVideoStart";

/** Tall enough to read the bars and the plate lane on a phone. */
const TRACK_WAVE_HEIGHT = 62;

/** Same hex at an alpha — canvas has no colour-mix(). */
function hexTint(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/**
 * The line as one ribbon sliding through. Every word is on screen; the one
 * crossing the centre is big and lit, its neighbours smaller and dimmer, the
 * rest fading out to either side.
 *
 * The slide is measured, not guessed: words are different widths, so the row
 * is offset by the real position of the centre word. Done in a layout effect
 * against the DOM so nothing re-renders to move it.
 */
function LyricRibbon({
  words,
  lineStartMs,
  lineHoldMs,
  audioRef,
}: {
  words: string[];
  lineStartMs: number;
  lineHoldMs: number;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const centresRef = useRef<number[]>([]);
  const halfStageRef = useRef(0);

  // Words are different widths, so where each one sits is measured off the
  // real elements. The stage's half-width is measured too: translateX(50%)
  // resolves against the strip's own width, not the stage's, which threw the
  // whole line off screen.
  useLayoutEffect(() => {
    const row = rowRef.current;
    const stage = stageRef.current;
    if (!row || !stage) return;
    const measure = () => {
      halfStageRef.current = stage.clientWidth / 2;
      centresRef.current = Array.from(row.children).map((child) => {
        const el = child as HTMLElement;
        return el.offsetLeft + el.offsetWidth / 2;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [words]);

  // Driven off the song clock every frame, written straight onto the DOM.
  // Stepping the strip once per word lurched; a marquee drifts.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const row = rowRef.current;
      const audio = audioRef.current;
      const centres = centresRef.current;
      if (!row || !audio || !centres.length) return;

      const perWordMs = lineHoldMs / words.length;
      if (!Number.isFinite(perWordMs) || perWordMs <= 0) return;

      // Fractional position along the line. Runs a word past each end so the
      // line drifts in and out instead of starting and stopping hard.
      const pos = (audio.currentTime * 1000 - lineStartMs) / perWordMs;
      const at = Math.max(-1.4, Math.min(words.length + 0.4, pos));

      const i = Math.floor(at);
      const frac = at - i;
      const centreOf = (n: number) => centres[Math.max(0, Math.min(centres.length - 1, n))]!;
      const under = centreOf(i) + (centreOf(i + 1) - centreOf(i)) * frac;
      row.style.transform = `translateX(${(halfStageRef.current - under).toFixed(2)}px)`;

      for (let k = 0; k < centres.length; k++) {
        const el = row.children[k] as HTMLElement | undefined;
        if (!el) continue;
        // One word is at full size, full light and sharp: the one on the
        // centre. The rest fall away on the same arc, blurring as they go so
        // they read as distance rather than just small text.
        const away = Math.abs(k - at);
        const near = Math.max(0, 1 - away / 2.8);
        const lit = Math.pow(near, 1.6);
        el.style.transform = `scale(${(0.42 + lit * 1.08).toFixed(3)})`;
        el.style.opacity = lit.toFixed(3);
        el.style.filter = lit > 0.93 ? "none" : `blur(${((1 - lit) * 3).toFixed(2)}px)`;
        el.style.textShadow =
          lit > 0.8 ? `0 0 ${(lit * 26).toFixed(0)}px rgba(255,255,255,0.42)` : "none";
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [words, lineStartMs, lineHoldMs, audioRef]);

  return (
    <div className="m-track-marquee" ref={stageRef}>
      <div ref={rowRef} className="m-track-ribbon">
        {words.map((word, i) => (
          <span key={`${i}-${word}`} className="m-track-ribbon-word">
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}

/** m:ss box. Commits on blur or Enter; a typo just snaps back. */
function TimeField({
  value,
  label,
  onCommit,
  onBadTime,
}: {
  value: number;
  label: string;
  onCommit: (ms: number) => void;
  onBadTime?: (msg: string) => void;
}) {
  // Draft only exists while the box is being typed in; the rest of the time
  // the value is read straight off the marker. No effect syncing the two.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? formatTrackClock(value);

  function commit() {
    const typed = draft;
    if (typed === null) return;
    const ms = parseTrackClock(typed);
    if (ms !== null) {
      setDraft(null);
      onCommit(ms);
      return;
    }
    onBadTime?.("Could not read that time — try 1:30 or 90");
  }

  return (
    <div className="m-track-time-wrap">
      <input
        className="m-track-time"
        value={text}
        aria-label={label}
        inputMode="decimal"
        spellCheck={false}
        onFocus={(e) => {
          setDraft(formatTrackClock(value));
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
      />
      {draft !== null ? (
        <button
          type="button"
          className="m-track-time-set"
          onMouseDown={(e) => e.preventDefault()}
          onClick={commit}
        >
          Set
        </button>
      ) : null}
    </div>
  );
}

async function trackAction(
  action: string,
  body: Record<string, unknown>,
): Promise<MobileGenJob | null> {
  const res = await fetch("/api/crash/mobile/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  const raw = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
  if (!res.ok) throw new Error(raw.error?.trim() || `Request failed (${res.status})`);
  return raw.job || null;
}

/** Pin sung lines to the playhead — saved as lyricCues on the job. */
function LyricPinPanel({
  job,
  lyricLines,
  lyricCues,
  playheadMs,
  busy,
  onBusy,
  onJobChange,
  onSeek,
}: {
  job: MobileGenJob;
  lyricLines: ReturnType<typeof lyricLinesFrom>;
  lyricCues: LyricCue[];
  playheadMs: number;
  busy: string;
  onBusy: (v: string) => void;
  onJobChange: (job: MobileGenJob) => void;
  onSeek: (ms: number) => void;
}) {
  const activeLine = activeLyricLineIndex(lyricCues, playheadMs);

  async function saveCues(next: LyricCue[]) {
    onBusy("lyrics");
    try {
      const updated = await trackAction("set-lyric-cues", {
        jobId: job.id,
        lyricCues: next,
      });
      if (updated) onJobChange(updated);
    } finally {
      onBusy("");
    }
  }

  if (!lyricLines.length) {
    return (
      <p className="m-track-lyric-hint">Paste lyrics first — then play the song and pin each line here.</p>
    );
  }

  return (
    <ul className="m-track-lyric-list">
      {lyricLines.map((line) => {
        const cue = lyricCueFor(lyricCues, line.index);
        const isNow = activeLine === line.index;
        return (
          <li
            key={line.index}
            className={`m-track-lyric${cue ? " is-pinned" : ""}${isNow ? " is-now" : ""}`}
          >
            <button
              type="button"
              className="m-track-lyric-text"
              onClick={() => {
                if (cue) onSeek(cue.atMs);
              }}
            >
              {line.text}
            </button>
            {cue ? (
              <button
                type="button"
                className="m-track-lyric-at"
                aria-label={`Pinned at ${formatTrackClock(cue.atMs)}`}
                onClick={() => onSeek(cue.atMs)}
              >
                {formatTrackClock(cue.atMs)}
              </button>
            ) : null}
            <MobilePrimaryButton
              size="chip"
              tone="ghost"
              disabled={Boolean(busy)}
              onClick={() => {
                if (cue) {
                  void saveCues(withoutLyricCue(lyricCues, line.index));
                  return;
                }
                void saveCues(withLyricCue(lyricCues, line.index, playheadMs));
              }}
            >
              {cue ? "×" : "Pin"}
            </MobilePrimaryButton>
          </li>
        );
      })}
    </ul>
  );
}

function WaveformCanvas({
  peaks,
  durationMs,
  playheadMs,
  markers,
  plateTimings,
  rangeStartMs,
  rangeEndMs,
  lyricCues,
  onSeek,
  onSelectRange,
}: {
  peaks: number[];
  durationMs: number;
  playheadMs: number;
  markers: { id: string; label: string; startMs: number; endMs: number }[];
  plateTimings: { plateId: string; startMs: number; endMs: number; label: string }[];
  /** The drag you are holding — drawn so you can see what Use range will take. */
  rangeStartMs: number;
  rangeEndMs: number;
  lyricCues: LyricCue[];
  onSeek: (ms: number) => void;
  onSelectRange: (startMs: number, endMs: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drag = useRef<{ startMs: number; moved: boolean } | null>(null);
  const [cssWidth, setCssWidth] = useState(0);

  // A fixed-width canvas stretched by CSS is why this looked soft. Draw at the
  // element's real size times the device ratio, and follow it when it changes.
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const measure = () => setCssWidth(canvas.clientWidth || 0);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !peaks.length || !cssWidth || !durationMs) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const cssHeight = canvas.clientHeight || TRACK_WAVE_HEIGHT;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = cssWidth;
    const h = cssHeight;
    const xAt = (ms: number) => (ms / durationMs) * w;

    const rulerH = 13;
    const laneH = 20;
    const waveTop = rulerH;
    const waveH = h - rulerH - laneH;
    const mid = waveTop + waveH / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#08080a";
    ctx.fillRect(0, 0, w, h);

    // Section bands sit behind everything, with their name on the ruler.
    ctx.font = "600 9px ui-sans-serif, system-ui, sans-serif";
    ctx.textBaseline = "top";
    for (const m of markers) {
      const x0 = xAt(m.startMs);
      const x1 = xAt(m.endMs);
      const bandW = Math.max(2, x1 - x0);
      ctx.fillStyle = sectionTint(m.label, 0.13);
      ctx.fillRect(x0, waveTop, bandW, waveH);
      ctx.fillStyle = sectionTint(m.label, 0.85);
      ctx.fillRect(x0, waveTop, 1.5, waveH);
      if (bandW > 34) {
        ctx.fillStyle = sectionColor(m.label);
        ctx.fillText(sectionTitle(m.label).toUpperCase(), x0 + 5, 2);
      }
    }

    // The range you are about to hand to Use range.
    if (rangeEndMs > rangeStartMs) {
      const rx0 = xAt(rangeStartMs);
      const rx1 = xAt(rangeEndMs);
      const rw = Math.max(2, rx1 - rx0);
      ctx.fillStyle = "rgba(200, 255, 46, 0.12)";
      ctx.fillRect(rx0, waveTop, rw, waveH);
      ctx.fillStyle = TRACK_ACID;
      ctx.fillRect(rx0, waveTop, 1.5, waveH);
      ctx.fillRect(rx0 + rw - 1.5, waveTop, 1.5, waveH);
    }

    // Mirrored bars read better than a hairline trace at this height, and they
    // survive a phone-width canvas without turning to mush.
    const barW = 2;
    const gap = 1;
    const step = barW + gap;
    const cols = Math.max(1, Math.floor(w / step));
    const grad = ctx.createLinearGradient(0, waveTop, 0, waveTop + waveH);
    grad.addColorStop(0, "rgba(200, 255, 46, 0.95)");
    grad.addColorStop(0.5, TRACK_ACID);
    grad.addColorStop(1, "rgba(200, 255, 46, 0.95)");
    ctx.fillStyle = grad;
    for (let i = 0; i < cols; i++) {
      const from = Math.floor((i / cols) * peaks.length);
      const to = Math.max(from + 1, Math.floor(((i + 1) / cols) * peaks.length));
      let peak = 0;
      for (let k = from; k < to && k < peaks.length; k++) {
        const v = Math.abs(peaks[k] || 0);
        if (v > peak) peak = v;
      }
      const half = Math.max(0.6, peak * (waveH / 2) * 0.94);
      ctx.fillRect(i * step, mid - half, barW, half * 2);
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.09)";
    ctx.fillRect(0, mid - 0.5, w, 1);

    // Plate lane along the bottom — this is the video, laid out on the song.
    const laneY = waveTop + waveH + 3;
    const laneBoxH = laneH - 6;
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.fillRect(0, laneY, w, laneBoxH);
    for (const p of plateTimings) {
      const x0 = xAt(p.startMs);
      const bw = Math.max(3, xAt(p.endMs) - x0);
      const r = Math.min(4, bw / 2);
      // The bar wears its section's colour: chorus plates read as chorus.
      const barColor = plateBarColor(markers, p);
      ctx.beginPath();
      ctx.roundRect(x0 + 0.5, laneY, Math.max(2, bw - 1), laneBoxH, r);
      ctx.fillStyle = hexTint(barColor, 0.38);
      ctx.fill();
      ctx.strokeStyle = hexTint(barColor, 0.9);
      ctx.lineWidth = 1;
      ctx.stroke();
      if (bw > 40) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, laneY, bw - 4, laneBoxH);
        ctx.clip();
        ctx.fillStyle = "rgba(12, 14, 18, 0.95)";
        ctx.fillText(p.label, x0 + 5, laneY + 3);
        ctx.restore();
      }
    }

    // Minute and half-minute ticks, so a 4-minute song reads at a glance.
    const totalSec = durationMs / 1000;
    const tickEvery = totalSec > 240 ? 60 : totalSec > 90 ? 30 : 15;
    for (let sec = tickEvery; sec < totalSec; sec += tickEvery) {
      const x = xAt(sec * 1000);
      const major = sec % 60 === 0;
      ctx.fillStyle = major ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.14)";
      ctx.fillRect(x, rulerH - (major ? 6 : 3), 1, major ? 6 : 3);
    }

    for (const cue of lyricCues) {
      const x = xAt(cue.atMs);
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(x, waveTop, 1, 7);
    }

    // Playhead last, with a head you can actually see against the bars.
    const ph = xAt(playheadMs);
    ctx.fillStyle = "#fff";
    ctx.fillRect(ph - 0.5, rulerH - 4, 1, h - rulerH + 4);
    ctx.beginPath();
    ctx.moveTo(ph - 4, rulerH - 8);
    ctx.lineTo(ph + 4, rulerH - 8);
    ctx.lineTo(ph, rulerH - 2);
    ctx.closePath();
    ctx.fill();
  }, [
    peaks,
    durationMs,
    playheadMs,
    markers,
    plateTimings,
    rangeStartMs,
    rangeEndMs,
    lyricCues,
    cssWidth,
  ]);

  function msFromEvent(clientX: number): number {
    const canvas = ref.current;
    if (!canvas || !durationMs) return 0;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    return Math.round((x / rect.width) * durationMs);
  }

  return (
    <canvas
      ref={ref}
      className="m-track-wave"
      style={{ height: `${TRACK_WAVE_HEIGHT}px` }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const ms = msFromEvent(e.clientX);
        drag.current = { startMs: ms, moved: false };
        onSeek(ms);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const ms = msFromEvent(e.clientX);
        if (Math.abs(ms - drag.current.startMs) > 150) {
          drag.current.moved = true;
          onSelectRange(Math.min(drag.current.startMs, ms), Math.max(drag.current.startMs, ms));
        }
        onSeek(ms);
      }}
      onPointerUp={(e) => {
        const held = drag.current;
        drag.current = null;
        if (!held) return;
        const endMs = msFromEvent(e.clientX);
        const startMs = Math.min(held.startMs, endMs);
        const end = Math.max(held.startMs, endMs);
        if (end - startMs > 200) onSelectRange(startMs, end);
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    />
  );
}

export function MusicVideoTrack({
  job,
  story,
  plated,
  onJobChange,
  compact = false,
  busy: startBusy = false,
  canStart = false,
  onStart,
  onOpenPlate,
  castOptions = [],
  placeOptions = [],
  onCreatePlate,
}: {
  job: MobileGenJob;
  story: CrashStoryDoc | null;
  plated: MobileShotUnit[];
  onJobChange: (job: MobileGenJob) => void;
  /** Collapsed: the wave and the player only — no editing tools. */
  compact?: boolean;
  busy?: boolean;
  /** Not locked yet — the Start button belongs in this same UI. */
  canStart?: boolean;
  onStart?: (lyrics: string) => void;
  /** Tap a plate — opens its Position and LTX prompts. */
  onOpenPlate?: (shotId: string) => void;
  /** Cast and places for the + picker — thumbnails built by the tree. */
  castOptions?: { name: string; faceUrl: string }[];
  placeOptions?: { sceneId: string; name: string; thumbUrl: string }[];
  /** One person, one place, one plate. */
  onCreatePlate?: (sceneId: string, speaker: string) => void;
}) {
  const song = job.scratchSong;
  const parked = usePendingSong(job.id);
  const beatId =
    (song?.carrierBeatId || "").trim() ||
    findSongCarrierBeatId(story, song?.fileName, plated[0]?.shotId);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [playheadMs, setPlayheadMs] = useState(0);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [markerLabel, setMarkerLabel] = useState<TrackSectionLabel>("verse");
  const [lyricsOpen, setLyricsOpen] = useState(() => lyricsPanelOpensAt(job.lyrics || ""));
  const [marqueeOpen, setMarqueeOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickWho, setPickWho] = useState("");
  const [pickWhere, setPickWhere] = useState("");
  const [rangeStartMs, setRangeStartMs] = useState(0);
  const [rangeEndMs, setRangeEndMs] = useState(15000);
  const [localPeaks, setLocalPeaks] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobRef = useRef("");

  // Plain arithmetic — memoising it only confused the compiler about which
  // song field it depends on.
  const durationMs = song?.durationSec
    ? Math.round(song.durationSec * 1000)
    : parked?.durationSec
      ? Math.round(parked.durationSec * 1000)
      : job.trackDraft?.songDurationSec
        ? Math.round(job.trackDraft.songDurationSec * 1000)
        : 0;
  const effectiveDurationMs = durationMs || audioDurationMs;
  const lyricTagsReady = meaningfulLyricTags(job.lyrics || "").length > 0;

  const peaks =
    song?.waveformPeaks ||
    job.trackDraft?.waveformPeaks ||
    (localPeaks.length ? localPeaks : []);

  const markers = song?.sectionMarkers || job.trackDraft?.sectionMarkers || [];
  const sortedMarkers = useMemo(() => sortSectionMarkers(markers), [markers]);
  const nextPinSection = useMemo(
    () => (effectiveDurationMs > 0 ? nextSectionNeedingStart(sortedMarkers, effectiveDurationMs) : null),
    [sortedMarkers, effectiveDurationMs],
  );
  const leadSinger = (job.speakers?.[0] || job.artist || "").trim();

  const lyricCues = useMemo<LyricCue[]>(
    () => song?.lyricCues || job.trackDraft?.lyricCues || [],
    [song?.lyricCues, job.trackDraft?.lyricCues],
  );
  const lyricLines = useMemo(() => lyricLinesFrom(job.lyrics || ""), [job.lyrics]);
  // Lines are pasted, not pinned — spread them across the song, then split
  // each line's slot between its words. The whole line rides through as one
  // ribbon; the word crossing the centre is the one that grows and lights up.
  const usePinnedMarquee = lyricCues.length > 0;
  const activeLyric = usePinnedMarquee
    ? activeLyricLineIndex(lyricCues, playheadMs)
    : evenLyricIndexAt(lyricLines.length, playheadMs, effectiveDurationMs);
  const ribbon = useMemo(() => {
    if (activeLyric === null) return null;
    const text = lyricLines.find((l) => l.index === activeLyric)?.text || "";
    const words = lyricWords(text);
    if (!words.length) return null;
    const cue = usePinnedMarquee ? lyricCueFor(lyricCues, activeLyric) : null;
    if (usePinnedMarquee && !cue) return null;
    const lineStartMs = cue
      ? cue.atMs
      : evenLineStartMs(activeLyric, lyricLines.length, effectiveDurationMs);
    const lineHoldMs = cue
      ? lyricHoldMs(lyricCues, activeLyric)
      : evenLyricHoldMs(lyricLines.length, effectiveDurationMs);
    return {
      lineIndex: activeLyric,
      words,
      lineStartMs,
      lineHoldMs,
    };
  }, [activeLyric, lyricLines, effectiveDurationMs, lyricCues, usePinnedMarquee]);

  const plateRows = useMemo(() => {
    return plated.map((row, i) => {
      const title =
        story?.scenes.flatMap((sc) => sc.shots).find((sh) => sh.id === row.shotId)?.title ||
        `Plate ${i + 1}`;
      const timing = plateTimingForShot(song, job.trackDraft, row.shotId);
      return { ...row, title, timing };
    });
  }, [plated, story, song, job.trackDraft]);

  const plateBlocks = sortPlateTimings(song?.plateTimings || job.trackDraft?.plateTimings || []).map(
    (t) => {
      const row = plateRows.find((p) => p.shotId === t.plateId);
      return { ...t, label: row?.title || t.plateId };
    },
  );

  const audioSrc = useMemo(() => {
    if (song?.fileName && job.folderName) {
      if (beatId) {
        return (
          `/api/crash/mobile/beat-audio?styleId=${encodeURIComponent(job.styleId)}` +
          `&folderName=${encodeURIComponent(job.folderName)}` +
          `&beatId=${encodeURIComponent(beatId)}` +
          `&fileName=${encodeURIComponent(song.fileName)}`
        );
      }
      return `/api/crash/mobile/song/audio?jobId=${encodeURIComponent(job.id)}`;
    }
    if (parked?.file) {
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
      blobRef.current = URL.createObjectURL(parked.file as File);
      return blobRef.current;
    }
    // Saved before Lock — survives a refresh, unlike the parked File.
    if (job.trackDraft?.songFile) {
      return `/api/crash/mobile/track/song?jobId=${encodeURIComponent(job.id)}`;
    }
    return "";
  }, [song?.fileName, beatId, job.folderName, job.styleId, job.id, parked?.file, job.trackDraft?.songFile]);

  useEffect(() => {
    return () => {
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    };
  }, []);

  const decodeAndSave = useCallback(
    async (file: File) => {
      setBusy("peaks");
      try {
        const waveformPeaks = await decodeWaveformPeaks(file);
        setLocalPeaks(waveformPeaks);
        const durationSec = await probeBrowserAudioDurationSec(file);
        if (job.folderName && song?.fileName) {
          const updated = await trackAction("save-track", {
            jobId: job.id,
            waveformPeaks,
          });
          if (updated) onJobChange(updated);
        } else {
          const updated = await trackAction("save-draft", {
            jobId: job.id,
            waveformPeaks,
          });
          if (updated) onJobChange(updated);
        }
        if (!durationSec && durationMs) {
          /* duration already from attach */
        }
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Couldn't read the waveform");
      } finally {
        setBusy("");
      }
    },
    [job.id, job.folderName, song?.fileName, durationMs, onJobChange],
  );

  useEffect(() => {
    if (peaks.length || busy === "peaks") return;
    const file = (parked?.file || null) as File | null;
    if (file) void decodeAndSave(file);
    else if (audioSrc && (song?.fileName || job.trackDraft?.songFile) && !song?.waveformPeaks?.length) {
      void fetch(audioSrc)
        .then((r) => r.blob())
        .then((blob) =>
          decodeAndSave(
            new File([blob], song?.fileName || job.trackDraft?.songFile || "song.mp3", {
              type: "audio/mpeg",
            }),
          ),
        )
        .catch(() => undefined);
    }
  }, [audioSrc, parked?.file, peaks.length, busy, decodeAndSave, song?.fileName, song?.waveformPeaks, job.trackDraft?.songFile]);

  async function saveMarkers(next: typeof markers) {
    setBusy("markers");
    setNote("");
    try {
      const action = song?.fileName ? "save-track" : "save-draft";
      const updated = await trackAction(action, {
        jobId: job.id,
        sectionMarkers: sortSectionMarkers(next),
      });
      if (updated) onJobChange(updated);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't save markers");
    } finally {
      setBusy("");
    }
  }

  async function schedulePlate(shotId: string, startMs: number, endMs: number, sortIndex: number) {
    if (!song?.fileName) {
      setNote("Start the video and attach the song before timing plates.");
      return;
    }
    setBusy(`time-${shotId}`);
    setNote("");
    try {
      const updated = await trackAction("set-plate-timing", {
        jobId: job.id,
        plateId: shotId,
        startMs,
        endMs,
        sortIndex,
      });
      if (updated) onJobChange(updated);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't schedule that plate");
    } finally {
      setBusy("");
    }
  }

  async function dropSong() {
    // The browser copy and the saved one both have to go, or the x looks dead:
    // clearing only the parked file left trackDraft.songFile pointing at it and
    // the player carried on as if nothing happened.
    clearPendingSong(job.id);
    setLocalPeaks([]);
    setPlayheadMs(0);
    if (job.trackDraft?.songFile) {
      setBusy("song");
      try {
        const updated = await trackAction("drop-song", { jobId: job.id });
        if (updated) onJobChange(updated);
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Couldn't drop that song");
      } finally {
        setBusy("");
      }
    }
    // Once the song is a real attached take on the episode, removing it is the
    // song desk's job — this desk never deletes media.
    if (song?.fileName) {
      setNote("Song dropped here. The attached take stays on the episode.");
    }
  }

  return (
    <div className="m-track">
      {/* One UI, empty or full. No separate "add the song" screen: the same
          title row, player slot, wave, sections and plates are always here —
          they just have nothing in them until a song lands. */}
      <>
          {/* Title line owns the card: name left, Lyrics and drop right.
              Lyrics stay shut — that box is for entering them, not reading. */}
          <div className="m-track-song-top">
            <span className="m-track-song-name">
              {musicVideoCreditLine(job) || songChipName(song?.fileName || parked?.file.name || "")}
            </span>
            <button
              type="button"
              className={`m-mv-lyr-toggle${lyricsOpen ? " is-open" : ""}`}
              aria-expanded={lyricsOpen}
              onClick={() => {
                setLyricsOpen((v) => !v);
                if (!lyricsOpen) setMarqueeOpen(false);
              }}
            >
              Lyrics <span className="m-mv-lyr-caret">{lyricsOpen ? "▾" : "▸"}</span>
            </button>
            <button
              type="button"
              className={`m-mv-lyr-toggle${marqueeOpen ? " is-open" : ""}`}
              aria-expanded={marqueeOpen}
              onClick={() => {
                setMarqueeOpen((v) => !v);
                if (!marqueeOpen) setLyricsOpen(false);
              }}
            >
              Marquee <span className="m-mv-lyr-caret">{marqueeOpen ? "▾" : "▸"}</span>
            </button>
            <button
              type="button"
              className="m-mv-x"
              aria-label="Drop this song"
              onClick={() => void dropSong()}
            >
              ×
            </button>
          </div>
          {lyricsOpen ? <LyricsBox job={job} onJobChange={onJobChange} /> : null}
          {!compact && marqueeOpen ? (
            <LyricPinPanel
              job={job}
              lyricLines={lyricLines}
              lyricCues={lyricCues}
              playheadMs={playheadMs}
              busy={busy}
              onBusy={setBusy}
              onJobChange={onJobChange}
              onSeek={(ms) => {
                setPlayheadMs(ms);
                if (audioRef.current) audioRef.current.currentTime = ms / 1000;
              }}
            />
          ) : null}

          {/* Nothing playing, nothing shown — the strip is for the line, not
              for instructions about the line. */}
          {!compact && playing && ribbon ? (
            <LyricRibbon
              key={ribbon.lineIndex}
              words={ribbon.words}
              lineStartMs={ribbon.lineStartMs}
              lineHoldMs={ribbon.lineHoldMs}
              audioRef={audioRef}
            />
          ) : null}

          <div className="m-track-toolbar">
            {audioSrc ? (
              <SongPlayer
                src={audioSrc}
                audioRef={audioRef}
                onTime={(sec) => setPlayheadMs(Math.round(sec * 1000))}
                onDuration={(sec) => setAudioDurationMs(Math.round(sec * 1000))}
                onPlayingChange={setPlaying}
              />
            ) : (
              <SongDropRow jobId={job.id} onSaved={onJobChange} />
            )}
          </div>

          {peaks.length ? (
            <WaveformCanvas
              peaks={peaks}
              durationMs={effectiveDurationMs || 1}
              playheadMs={playheadMs}
              markers={sortedMarkers}
              plateTimings={plateBlocks}
              rangeStartMs={rangeStartMs}
              rangeEndMs={rangeEndMs}
              lyricCues={lyricCues}
              onSeek={(ms) => {
                setPlayheadMs(ms);
                if (audioRef.current) audioRef.current.currentTime = ms / 1000;
              }}
              onSelectRange={(startMs, endMs) => {
                setRangeStartMs(startMs);
                setRangeEndMs(endMs);
              }}
            />
          ) : (
            <div className="m-track-wave-placeholder">
              {busy === "peaks" ? "Reading waveform…" : "Waveform…"}
            </div>
          )}

          {/* Plates outrank the section list, so they sit above it: one
              horizontal strip, right under the wave. */}
          {!compact ? (
            <div className="m-track-rail">
              <div className="m-track-rail-scroll">
                {plateRows.map((row) => (
                  <button
                    type="button"
                    key={row.shotId}
                    className={`m-track-rail-cell${row.timing ? " is-timed" : ""}`}
                    onClick={() => onOpenPlate?.(row.shotId)}
                    title={row.title}
                  >
                    {row.plateFile ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mobileLocationStillUrl(job, row.plateFile)} alt="" />
                    ) : (
                      <span className="m-track-rail-empty" />
                    )}
                    <span className="m-track-rail-label">{row.title}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className={`m-track-rail-add${pickOpen ? " is-open" : ""}`}
                  onClick={() => setPickOpen((v) => !v)}
                  aria-expanded={pickOpen}
                  aria-label="Add a plate"
                >
                  +
                </button>
              </div>
            </div>
          ) : null}

          {/* One person, one place, one plate — picked here rather than three
              scrolls down inside a Locations card. */}
          {!compact && pickOpen ? (
            <div className="m-plate-pick">
              <div className="m-plate-pick-row">
                {castOptions.map((who) => (
                  <button
                    type="button"
                    key={who.name}
                    className={`m-plate-pick-cell${pickWho === who.name ? " is-on" : ""}`}
                    onClick={() => setPickWho(who.name)}
                  >
                    {who.faceUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={who.faceUrl} alt="" />
                    ) : (
                      <span className="m-plate-pick-blank" />
                    )}
                    <span className="m-plate-pick-name">{who.name}</span>
                  </button>
                ))}
              </div>
              <div className="m-plate-pick-row">
                {placeOptions.map((place) => (
                  <button
                    type="button"
                    key={place.sceneId}
                    className={`m-plate-pick-cell${pickWhere === place.sceneId ? " is-on" : ""}`}
                    onClick={() => setPickWhere(place.sceneId)}
                  >
                    {place.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={place.thumbUrl} alt="" />
                    ) : (
                      <span className="m-plate-pick-blank" />
                    )}
                    <span className="m-plate-pick-name">{place.name}</span>
                  </button>
                ))}
              </div>
              <div className="m-plate-pick-actions">
                <MobilePrimaryButton
                  size="chip"
                  disabled={!pickWho || !pickWhere}
                  onClick={() => {
                    onCreatePlate?.(pickWhere, pickWho);
                    setPickOpen(false);
                    setPickWho("");
                    setPickWhere("");
                  }}
                >
                  {job.folderName ? `Add ${pickWho || "plate"}` : "Start the video & add"}
                </MobilePrimaryButton>
                <button type="button" className="m-track-btn" onClick={() => setPickOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {/* Once the markers are set this is just a record — fold it away. */}
          {!compact && markers.length ? (
            <button
              type="button"
              className={`m-track-fold${sectionsOpen ? " is-open" : ""}`}
              aria-expanded={sectionsOpen}
              onClick={() => setSectionsOpen((v) => !v)}
            >
              Sections <span className="m-track-fold-n">{markers.length}</span>
              <span className="m-track-fold-caret">{sectionsOpen ? "▾" : "▸"}</span>
            </button>
          ) : null}

          {!compact && (sectionsOpen || !markers.length) ? (
          <>
          <p className="m-track-lyric-hint">
            <strong>Play the song</strong>, then tap the green <strong>Start here</strong> on each
            section as it begins. Typing times is optional — tap <strong>Set</strong> after a time
            if you do.
          </p>
          {nextPinSection ? (
            <div className="m-track-next-pin">
              <span>
                Next: <strong>{sectionTitle(nextPinSection.label)}</strong> at{" "}
                {formatTrackClock(playheadMs)}
              </span>
              <button
                type="button"
                className="m-track-here-btn is-waiting"
                disabled={Boolean(busy)}
                onClick={() =>
                  void saveMarkers(
                    withSectionStartAt(sortedMarkers, nextPinSection.id, playheadMs, effectiveDurationMs),
                  )
                }
              >
                Start {sectionTitle(nextPinSection.label)} here
              </button>
            </div>
          ) : null}
          <div className="m-track-marker-row">
            <button
              type="button"
              className="m-track-btn"
              disabled={Boolean(busy) || !lyricTagsReady}
              onClick={() => {
                const dur = effectiveDurationMs || 130_000;
                const next = importSectionMarkersFromLyrics({
                  lyrics: job.lyrics || "",
                  durationMs: dur,
                });
                if (!next.length) {
                  setNote("Add [Intro] / [Verse] / [Chorus] tags in Lyrics first.");
                  return;
                }
                setNote(
                  markers.length
                    ? "Replaced sections from lyrics — play and tap Start here on each row."
                    : "",
                );
                void saveMarkers(next);
              }}
            >
              Import from lyrics
            </button>
            {markers.length ? (
              <button
                type="button"
                className="m-track-btn"
                disabled={Boolean(busy)}
                onClick={() => void saveMarkers([])}
              >
                Clear sections
              </button>
            ) : null}
            <select
              className="m-track-select"
              value={markerLabel}
              style={{
                borderColor: sectionTint(markerLabel, 0.6),
                color: sectionColor(markerLabel),
              }}
              onChange={(e) => setMarkerLabel(e.target.value as TrackSectionLabel)}
            >
              {TRACK_SECTION_LABELS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="m-track-btn"
              disabled={Boolean(busy) || rangeEndMs <= rangeStartMs}
              onClick={() => {
                const startMs = nextSectionStartMs(markers);
                const endMs = Math.max(startMs + 1000, effectiveDurationMs || startMs + 1000);
                void saveMarkers([
                  ...markers,
                  { id: `marker_${Date.now()}`, label: markerLabel, startMs, endMs },
                ]);
              }}
            >
              Add section
            </button>
          </div>
          </>
          ) : null}

          {!compact && sectionsOpen && sortedMarkers.length ? (
            <ul className="m-track-marker-list">
              {sortedMarkers.map((m) => {
                const waiting = effectiveDurationMs > 0 && sectionNeedsStartHere(m, effectiveDurationMs);
                const cast = sectionCastForMarker(m, sortedMarkers, leadSinger, job.speakers || []);
                return (
                <li key={m.id} style={{ borderLeftColor: sectionColor(m.label) }}>
                  <div className="m-track-section-top">
                    <span className="m-track-marker-name">
                      <i className="m-track-swatch" style={{ background: sectionColor(m.label) }} />
                      {sectionTitle(m.label)}
                    </span>
                    <span className="m-track-section-cast">{cast}</span>
                  </div>
                  <div className="m-track-section-row">
                    <button
                      type="button"
                      className={`m-track-here-btn${waiting ? " is-waiting" : ""}`}
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void saveMarkers(
                          withSectionStartAt(sortedMarkers, m.id, playheadMs, effectiveDurationMs),
                        )
                      }
                    >
                      {waiting ? "Start here ▶" : "Start here"}
                    </button>
                    <TimeField
                      value={m.startMs}
                      label={`${sectionTitle(m.label)} start`}
                      onBadTime={(msg) => setNote(msg)}
                      onCommit={(ms) =>
                        void saveMarkers(
                          withSectionTime(sortedMarkers, m.id, "start", ms, effectiveDurationMs),
                        )
                      }
                    />
                    <span className="m-track-dash">–</span>
                    <TimeField
                      value={m.endMs}
                      label={`${sectionTitle(m.label)} end`}
                      onBadTime={(msg) => setNote(msg)}
                      onCommit={(ms) =>
                        void saveMarkers(
                          withSectionTime(sortedMarkers, m.id, "end", ms, effectiveDurationMs),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="m-track-x"
                      aria-label={`Remove ${sectionTitle(m.label)}`}
                      onClick={() => void saveMarkers(sortedMarkers.filter((x) => x.id !== m.id))}
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
              })}
            </ul>
          ) : null}

          {compact ? null : job.folderName && plateRows.length ? (
            <div className="m-track-plates">
              <div className="m-track-plates-head">Plates on the track</div>
              {plateRows.map((row, i) => (
                <div key={row.shotId} className="m-track-plate-row">
                  {row.plateFile ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mobileLocationStillUrl(job, row.plateFile)}
                      alt=""
                      className="m-track-plate-thumb"
                    />
                  ) : (
                    <span className="m-track-plate-thumb m-track-plate-thumb--empty" />
                  )}
                  <div className="m-track-plate-meta">
                    <div className="m-track-plate-title">{row.title}</div>
                    {row.timing ? (
                      <div className="m-track-plate-time">
                        {formatTrackClock(row.timing.startMs)} –{" "}
                        {formatTrackClock(row.timing.endMs)}
                      </div>
                    ) : (
                      <div className="m-track-plate-time m-track-plate-time--open">Unscheduled</div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="m-track-btn"
                    disabled={Boolean(busy) || !row.plateFile}
                    onClick={() =>
                      void schedulePlate(row.shotId, rangeStartMs, rangeEndMs, i)
                    }
                  >
                    {busy === `time-${row.shotId}` ? "…" : "Use range"}
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {/* Same UI before and after Start: this is a button in it, not a
              different screen in front of it. */}
          {!compact && canStart ? (
            <MobilePrimaryButton disabled={startBusy} onClick={() => onStart?.(job.lyrics || "")}>
              {startBusy ? "Starting…" : "Start the video"}
            </MobilePrimaryButton>
          ) : null}
      </>
      {note ? <p className="m-track-err">{note}</p> : null}
    </div>
  );
}
