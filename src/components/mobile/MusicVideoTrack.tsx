"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MobileGenJob, MobileShotUnit } from "@/lib/mobileGenJob";
import type { CrashStoryDoc } from "@/lib/crashStoryTypes";
import {
  TRACK_ACID,
  TRACK_SECTION_LABELS,
  formatTrackClock,
  formatTrackClockPrecise,
  msToSec,
  secToMs,
  nextPlateHangWindow,
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
  lyricCuesFromSectionSheet,
  meaningfulLyricTags,
  shouldImportLyricSections,
  nextSectionNeedingStart,
  nextSectionStartMs,
  parseTrackClock,
  plateBarColor,
  sectionPeopleOnPlates,
  sectionColor,
  sectionNeedsStartHere,
  sectionTint,
  sectionTitle,
  sortPlateTimings,
  sortSectionMarkers,
  trackPlayheadScrollLeft,
  trackWaveCssWidth,
  trackWaveLayout,
  withSectionStartAt,
  withSectionTime,
  type LyricCue,
  type PlateTiming,
  type TrackSectionLabel,
} from "@/lib/musicVideoTrack";
import { decodeWaveformPeaks } from "@/lib/decodeWaveformPeaks";
import { clearPendingSong, songChipName } from "@/lib/musicVideoStart";
import {
  findSongCarrierBeatId,
  hasStuckSongCook,
  isMusicVideoSongJob,
  musicVideoCreditLine,
  needsTrackHang,
} from "@/lib/musicVideoSong";

import { probeBrowserAudioDurationSec } from "@/lib/scratchSongDrop";
import { lyricsPanelOpensAt } from "@/lib/musicVideoStart";
import { mobileLocationStillUrl } from "@/lib/mobileCandidateUrls";
import { mobileClipSrc } from "@/lib/mobilePlateClips";
import { hungClipFileForPlate, orderedJobClips } from "@/lib/orderedJobClips";
import { readApiJson } from "@/lib/studioFetchError";
import { ClipFrameThumb } from "./ClipFrameThumb";
import { DeskFold, MobilePrimaryButton } from "./MobileUi";
import { LyricsBox, SongDropRow, SongPlayer, usePendingSong } from "./MusicVideoStart";
import {
  EMPTY_STOCK_LOOK,
  parseStockLook,
  stockLookFoldLabel,
  stockLookIsOn,
  type StockLook,
} from "@/lib/stockLook";
import {
  askSongCookNotifyPermission,
  clearSongCookStop,
  requestSongCookStop,
  setSongCookFlag,
  songCookFlagOn,
  songCookStopRequested,
  waitForSongCut,
} from "@/lib/songCutCook";
import { SongCookAlertBanner } from "./SongCookAlertBanner";

/** Tall enough to read the bars and the plate lane on a phone. */
const TRACK_WAVE_HEIGHT = 78;

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
  onImportFromLyrics,
}: {
  job: MobileGenJob;
  lyricLines: ReturnType<typeof lyricLinesFrom>;
  lyricCues: LyricCue[];
  playheadMs: number;
  busy: string;
  onBusy: (v: string) => void;
  onJobChange: (job: MobileGenJob) => void;
  onSeek: (ms: number) => void;
  onImportFromLyrics?: () => void;
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
    <>
      <div className="m-track-marker-row">
        {onImportFromLyrics ? (
          <button
            type="button"
            className="m-track-btn"
            disabled={Boolean(busy)}
            onClick={() => onImportFromLyrics()}
          >
            Import from lyrics
          </button>
        ) : null}
        <button
          type="button"
          className="m-track-btn"
          disabled={Boolean(busy) || !lyricCues.length}
          onClick={() => void saveCues([])}
        >
          Clear all
        </button>
      </div>
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
    </>
  );
}

type WavePlateBlock = PlateTiming & { label: string };

/** One sideways scroller for the wave and the plate rail so a long song
 * does not crush onto one iPhone screen. Vertical flicks still move /m.
 * While the song plays, the strip follows the needle so it cannot walk
 * off the right edge — the wave moves right-to-left. */
function TrackScroll({
  durationMs,
  playheadMs,
  follow,
  children,
}: {
  durationMs: number;
  playheadMs: number;
  follow: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [viewW, setViewW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setViewW(el.clientWidth || 0);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const innerW = trackWaveCssWidth(durationMs, viewW);
  useEffect(() => {
    const el = ref.current;
    if (!el || !follow || !innerW || !viewW) return;
    el.scrollLeft = trackPlayheadScrollLeft({
      playheadMs,
      durationMs,
      viewW,
      innerW,
    });
  }, [follow, playheadMs, durationMs, viewW, innerW]);
  return (
    <div className="m-track-scroll" ref={ref}>
      <div
        className="m-track-scroll-inner"
        style={innerW ? { width: `${innerW}px` } : undefined}
      >
        {children}
      </div>
    </div>
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
  plateTimings: WavePlateBlock[];
  /** The drag you are holding — drawn so you can see what Add to timeline will take. */
  rangeStartMs: number;
  rangeEndMs: number;
  lyricCues: LyricCue[];
  onSeek: (ms: number) => void;
  onSelectRange: (startMs: number, endMs: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drag = useRef<{
    startMs: number;
    startX: number;
    moved: boolean;
    pointerType: string;
  } | null>(null);
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
    const layout = trackWaveLayout(w, h);
    const xAt = (ms: number) => (ms / durationMs) * w;
    const { waveTop, waveH, laneY, laneBoxH } = layout;
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

    // The range you are about to hand to Add to timeline.
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
      ctx.fillRect(x, layout.rulerH - (major ? 6 : 3), 1, major ? 6 : 3);
    }

    for (const cue of lyricCues) {
      const x = xAt(cue.atMs);
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(x, waveTop, 1, 7);
    }

    // Playhead last, with a head you can actually see against the bars.
    const ph = xAt(playheadMs);
    ctx.fillStyle = "#fff";
    ctx.fillRect(ph - 0.5, layout.rulerH - 4, 1, h - layout.rulerH + 4);
    ctx.beginPath();
    ctx.moveTo(ph - 4, layout.rulerH - 8);
    ctx.lineTo(ph + 4, layout.rulerH - 8);
    ctx.lineTo(ph, layout.rulerH - 2);
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
        const ms = msFromEvent(e.clientX);
        drag.current = {
          startMs: ms,
          startX: e.clientX,
          moved: false,
          pointerType: e.pointerType,
        };
        // Touch: let the scroller take the swipe. Mouse: seek + range.
        if (e.pointerType !== "touch") {
          e.currentTarget.setPointerCapture(e.pointerId);
          onSeek(ms);
        }
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        if (drag.current.pointerType === "touch") {
          if (Math.abs(e.clientX - drag.current.startX) > 8) drag.current.moved = true;
          return;
        }
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
        if (held.pointerType === "touch") {
          if (!held.moved) onSeek(endMs);
          return;
        }
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
  onExpand,
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
  /** Collapsed + still needs the add-plate picker — open Plates first. */
  onExpand?: () => void;
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
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [pickedId, setPickedId] = useState("");
  const [startDraft, setStartDraft] = useState("0");
  const [lengthDraft, setLengthDraft] = useState("15");
  const [freeLookOpen, setFreeLookOpen] = useState(() => stockLookIsOn(job.stockLook));
  const [freeLook, setFreeLook] = useState<StockLook>(() => parseStockLook(job.stockLook));
  const [openSectionId, setOpenSectionId] = useState("");
  const [playing, setPlaying] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickWho, setPickWho] = useState("");
  const [pickWhere, setPickWhere] = useState("");
  const [rangeStartMs, setRangeStartMs] = useState(0);
  const [rangeEndMs, setRangeEndMs] = useState(15000);
  const [rangeChosen, setRangeChosen] = useState(false);
  const [localPeaks, setLocalPeaks] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const jobRef = useRef(job);
  jobRef.current = job;
  const cookLock = useRef(false);
  const cookCancel = useRef(false);
  const blobRef = useRef("");
  const lyricImportTried = useRef(false);

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

  const savedPlateBlocks = sortPlateTimings(
    song?.plateTimings || job.trackDraft?.plateTimings || [],
  ).map((t) => {
    const row = plateRows.find((p) => p.shotId === t.plateId);
    return { ...t, label: row?.title || t.plateId };
  });
  const plateBlocks = savedPlateBlocks;
  const filmItems = useMemo(() => {
    const hungIds = new Set(plateBlocks.map((b) => b.plateId));
    const hung = plateBlocks.map((block) => {
      const row = plateRows.find((p) => p.shotId === block.plateId);
      return {
        shotId: block.plateId,
        title: row?.title || block.label,
        plateFile: row?.plateFile || "",
        timing: row?.timing || block,
        onSong: true,
      };
    });
    const waiting = plateRows
      .filter((row) => !hungIds.has(row.shotId))
      .map((row) => ({
        shotId: row.shotId,
        title: row.title,
        plateFile: row.plateFile,
        timing: row.timing,
        onSong: Boolean(row.timing),
      }));
    return [...hung, ...waiting];
  }, [plateBlocks, plateRows]);
  const picked =
    filmItems.find((item) => item.shotId === pickedId) || filmItems[0] || null;

  useEffect(() => {
    if (pickedId && filmItems.some((item) => item.shotId === pickedId)) return;
    const first = filmItems[0]?.shotId || "";
    if (first) setPickedId(first);
  }, [filmItems, pickedId]);

  useEffect(() => {
    if (picked?.timing) {
      setStartDraft(String(msToSec(picked.timing.startMs)));
      setLengthDraft(String(msToSec(picked.timing.endMs - picked.timing.startMs)));
      return;
    }
    if (picked) {
      setStartDraft(String(msToSec(nextPlateHangWindow(song?.plateTimings).startMs)));
    }
  }, [picked?.shotId, picked?.timing?.endMs, picked?.timing?.startMs, picked, song?.plateTimings]);

  const zipClips = useMemo(() => orderedJobClips(job), [job]);
  const zipHref = zipClips.length
    ? `/api/crash/mobile/clips/zip?jobId=${encodeURIComponent(job.id)}`
    : "";

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

  useEffect(() => {
    setFreeLook(parseStockLook(job.stockLook));
  }, [job.stockLook?.theme, job.stockLook?.colour, job.stockLook?.types]);

  async function saveFreeLook(next: StockLook) {
    setFreeLook(next);
    setBusy("look");
    setNote("");
    try {
      const updated = await trackAction("set-stock-look", {
        jobId: job.id,
        stockLook: next,
      });
      if (updated) onJobChange(updated);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't save the free look");
    } finally {
      setBusy("");
    }
  }

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

  /** Sections from the lyric tags, and Marquee pins inside those windows. */
  async function importFromLyrics(replaceMarkers: boolean) {
    const dur = effectiveDurationMs || 130_000;
    const lyrics = job.lyrics || "";
    const next =
      replaceMarkers || !markers.length
        ? importSectionMarkersFromLyrics({
            lyrics,
            durationMs: dur,
          })
        : markers;
    if (!next.length) {
      setNote("Add [Intro] / [Verse] / [Chorus] tags in Lyrics first.");
      return;
    }
    const lyricCues = lyricCuesFromSectionSheet({
      lyrics,
      durationMs: dur,
      markers: next,
    });
    setBusy("markers");
    setNote("");
    try {
      if (replaceMarkers || !markers.length) {
        const action = song?.fileName ? "save-track" : "save-draft";
        const updated = await trackAction(action, {
          jobId: job.id,
          sectionMarkers: sortSectionMarkers(next),
          lyricCues,
        });
        if (updated) onJobChange(updated);
      } else {
        const updated = await trackAction("set-lyric-cues", {
          jobId: job.id,
          lyricCues,
        });
        if (updated) onJobChange(updated);
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't import from lyrics");
    } finally {
      setBusy("");
    }
  }

  async function hangStillsOnWave() {
    if (!song?.fileName) {
      setNote("Drop the song first.");
      return;
    }
    setBusy("hang");
    setNote("");
    try {
      const res = await fetch("/api/crash/mobile/song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hang-plates", jobId: job.id }),
      });
      const raw = (await res.json().catch(() => ({}))) as {
        job?: MobileGenJob;
        error?: string;
      };
      if (raw.job) onJobChange(raw.job);
      if (!res.ok) throw new Error(raw.error?.trim() || "Couldn't add those stills");
      setNote("On the song. Tap a still, set start and length, then Send.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't add those stills");
    } finally {
      setBusy("");
    }
  }

  function hungShotIds() {
    return new Set(
      (jobRef.current.scratchSong?.plateTimings || [])
        .map((t) => (t.plateId || "").trim())
        .filter(Boolean),
    );
  }

  function waitingCutForPlate(shotId: string) {
    const id = shotId.trim();
    return (jobRef.current.scratchSong?.cuts || []).find((c) => {
      if ((c.shotId || "").trim() !== id) return false;
      if (c.status === "done" && c.clipFile) return false;
      return true;
    });
  }

  function doneCutForPlate(shotId: string) {
    const id = shotId.trim();
    return (jobRef.current.scratchSong?.cuts || []).find(
      (c) => (c.shotId || "").trim() === id && c.status === "done" && Boolean(c.clipFile),
    );
  }

  async function songPost(action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch("/api/crash/mobile/song", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, jobId: job.id, ...extra }),
    });
    const raw = (await res.json().catch(() => ({}))) as {
      job?: MobileGenJob;
      error?: string;
    };
    if (raw.job) onJobChange(raw.job);
    if (!res.ok) throw new Error(raw.error?.trim() || `Request failed (${res.status})`);
    return raw;
  }

  async function addPlateToTimeline(shotId: string) {
    if (!song?.fileName) {
      setNote("Drop the song first.");
      return;
    }
    const typed = Number(lengthDraft);
    const durSec = Number.isFinite(typed) && typed > 0 ? typed : 15;
    const typedStart = Number(startDraft);
    const win =
      Number.isFinite(typedStart) && typedStart >= 0
        ? { startMs: secToMs(typedStart), endMs: secToMs(typedStart) + secToMs(durSec) }
        : rangeChosen && rangeEndMs > rangeStartMs
          ? { startMs: rangeStartMs, endMs: rangeEndMs }
          : {
              startMs: nextPlateHangWindow(song.plateTimings).startMs,
              endMs:
                nextPlateHangWindow(song.plateTimings).startMs + secToMs(durSec),
            };
    await schedulePlate(shotId, win.startMs, win.endMs, plateBlocks.length);
    setPickedId(shotId);
    setNote("On the song. Set how long, then Send.");
  }

  async function sendOneCutBody(cutId: string) {
    const id = cutId.trim();
    if (!id) {
      setNote("Add this still to the timeline first.");
      return;
    }
    askSongCookNotifyPermission();
    setBusy(`send-${id}`);
    setNote("");
    try {
      await songPost("run", { cutId: id, beatId });
      await waitForSongCut({
        jobId: job.id,
        cutId: id,
        setJob: onJobChange,
        cancelled: () => cookCancel.current || songCookStopRequested(job.id),
      });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't send that cut");
    } finally {
      setBusy("");
    }
  }

  async function sendPlate(shotId: string) {
    if (!hungShotIds().has(shotId.trim())) {
      setNote("Add this still to the timeline first.");
      return;
    }
    const cut = waitingCutForPlate(shotId);
    if (!cut?.id) {
      setNote("Add this still to the timeline first.");
      return;
    }
    if (cookLock.current) return;
    cookLock.current = true;
    cookCancel.current = false;
    clearSongCookStop(job.id);
    try {
      await sendOneCutBody(cut.id);
    } finally {
      cookLock.current = false;
    }
  }

  async function redoPlate(shotId: string) {
    const cut = doneCutForPlate(shotId) || waitingCutForPlate(shotId);
    if (!cut?.id) {
      setNote("Nothing to redo on that still.");
      return;
    }
    requestSongCookStop(job.id);
    cookCancel.current = true;
    cookLock.current = false;
    setBusy(`redo-${cut.id}`);
    setNote("");
    try {
      await songPost("redo-cut", { cutId: cut.id });
      setNote("Clip parked. Still stays on the song. Send again when you want.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't redo that cut");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    if (!song?.fileName) return;
    if (!needsTrackHang(song, job.shots)) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/crash/mobile/song", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "hang-plates", jobId: job.id }),
        });
        const raw = (await res.json().catch(() => ({}))) as {
          job?: MobileGenJob;
          error?: string;
        };
        if (cancelled) return;
        if (raw.job) onJobChange(raw.job);
      } catch {
        /* wave stays as-is; Add still hangs */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job.id, job.shots, onJobChange, song]);

  useEffect(() => {
    if (lyricImportTried.current) return;
    if (busy) return;
    if (
      !shouldImportLyricSections({
        lyrics: job.lyrics || "",
        markers,
        durationMs: effectiveDurationMs,
      })
    ) {
      return;
    }
    lyricImportTried.current = true;
    void importFromLyrics(true);
  }, [busy, effectiveDurationMs, job.lyrics, markers]);

  async function movePlate(shotId: string, direction: "earlier" | "later") {
    if (!song?.fileName) {
      setNote("Hang the stills on the song first.");
      return;
    }
    setBusy(`move-${shotId}`);
    setNote("");
    try {
      const updated = await trackAction("move-plate", {
        jobId: job.id,
        plateId: shotId,
        direction,
      });
      if (updated) onJobChange(updated);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't move that plate");
    } finally {
      setBusy("");
    }
  }

  async function stopSend() {
    cookCancel.current = true;
    cookLock.current = false;
    requestSongCookStop(job.id);
    setBusy("stop");
    setNote("");
    try {
      const res = await fetch("/api/crash/mobile/song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unstick-all", jobId: job.id }),
      });
      const raw = (await res.json().catch(() => ({}))) as {
        job?: MobileGenJob;
        error?: string;
      };
      if (raw.job) onJobChange(raw.job);
      if (!res.ok) throw new Error(raw.error?.trim() || "Couldn't stop send");
      setSongCookFlag(job.id, false);
      setNote("Stopped. Move plates, then Send when you like the order.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't stop send");
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

  async function setPickedLength() {
    if (!picked?.shotId) {
      setNote("Tap a still first.");
      return;
    }
    if (!picked.onSong && !picked.timing) {
      await addPlateToTimeline(picked.shotId);
      return;
    }
    const durationSec = Number(lengthDraft);
    const startSec = Number(startDraft);
    if (!Number.isFinite(startSec) || startSec < 0) {
      setNote("Type where this still starts on the song.");
      return;
    }
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      setNote("Type how many seconds this still covers.");
      return;
    }
    setBusy(`len-${picked.shotId}`);
    setNote("");
    try {
      const updated = await trackAction("set-plate-duration", {
        jobId: job.id,
        plateId: picked.shotId,
        startSec,
        durationSec,
      });
      if (updated) onJobChange(updated);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't set that length");
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
          <SongCookAlertBanner
            cuts={song?.cuts || []}
            cooking={songCookFlagOn(job.id)}
          />
          <div className="m-track-stop-row">
            {needsTrackHang(song, job.shots) && song?.fileName ? (
              <MobilePrimaryButton
                size="chip"
                disabled={busy === "hang"}
                onClick={() => void hangStillsOnWave()}
              >
                {busy === "hang" ? "Adding…" : "Put stills on the song"}
              </MobilePrimaryButton>
            ) : null}
            {(songCookFlagOn(job.id) ||
              hasStuckSongCook(song?.cuts || []) ||
              busy.startsWith("send-") ||
              (song?.cuts || []).some((c) => c.status === "running")) ? (
              <MobilePrimaryButton
                size="chip"
                tone="ghost"
                disabled={busy === "stop"}
                onClick={() => void stopSend()}
              >
                {busy === "stop" ? "Stopping…" : "Stop send"}
              </MobilePrimaryButton>
            ) : null}
          </div>
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
              onImportFromLyrics={() => void importFromLyrics(false)}
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
            {zipHref ? (
              <a className="m-track-btn" href={zipHref} download>
                Download clips zip
              </a>
            ) : null}
          </div>

          <TrackScroll
            durationMs={effectiveDurationMs}
            playheadMs={playheadMs}
            follow={playing}
          >
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
                setRangeChosen(true);
              }}
            />
          ) : (
            <div className="m-track-wave-placeholder">
              {busy === "peaks" ? "Reading waveform…" : "Waveform…"}
            </div>
          )}

          {/* Same order and widths as the coloured bars on the wave.
              Compact still shows the rail so hung clips keep their own thumbs.
              + stays up even with no plates yet — that is how a band
              member gets onto the song. */}
          {(filmItems.length || !compact || Boolean(onCreatePlate)) ? (
            <div className="m-track-rail">
              <div className="m-track-film">
                {filmItems.map((cell) => {
                  const durSec = cell.timing
                    ? msToSec(cell.timing.endMs - cell.timing.startMs)
                    : 0;
                  const on = picked?.shotId === cell.shotId;
                  return (
                    <button
                      type="button"
                      key={cell.shotId}
                      className={`m-track-film-cell${cell.onSong ? " is-on-song" : ""}${on ? " is-on" : ""}`}
                      onClick={() => setPickedId(cell.shotId)}
                      title={cell.title}
                    >
                      {hungClipFileForPlate(job, cell.shotId) || cell.plateFile ? (
                        <ClipFrameThumb
                          clipSrc={
                            hungClipFileForPlate(job, cell.shotId)
                              ? mobileClipSrc(job, hungClipFileForPlate(job, cell.shotId))
                              : ""
                          }
                          stillSrc={
                            cell.plateFile ? mobileLocationStillUrl(job, cell.plateFile) : ""
                          }
                        />
                      ) : (
                        <span className="m-track-rail-empty" />
                      )}
                      <span className="m-track-rail-label">{cell.title}</span>
                      <span className="m-track-film-len">
                        {cell.onSong && durSec > 0 ? `${durSec}s` : "off"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className={`m-track-rail-add${pickOpen ? " is-open" : ""}`}
                onClick={() => {
                  if (compact) onExpand?.();
                  setPickOpen((v) => !v);
                }}
                aria-expanded={pickOpen}
                aria-label="Add a still"
              >
                +
              </button>
            </div>
          ) : null}
          {picked ? (
            <div className="m-track-pick">
              <div className="m-track-pick-name">{picked.title}</div>
              <div className="m-track-pick-clock">
                {picked.timing
                  ? `${formatTrackClockPrecise(picked.timing.startMs)} – ${formatTrackClockPrecise(picked.timing.endMs)}`
                  : "Not on the song yet"}
              </div>
              <label className="m-track-pick-len">
                Starts at
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  inputMode="decimal"
                  value={startDraft}
                  disabled={Boolean(busy)}
                  onChange={(e) => setStartDraft(e.target.value)}
                />
                seconds
              </label>
              <label className="m-track-pick-len">
                How long
                <input
                  type="number"
                  min={1}
                  max={180}
                  step={0.5}
                  inputMode="decimal"
                  value={lengthDraft}
                  disabled={Boolean(busy)}
                  onChange={(e) => setLengthDraft(e.target.value)}
                />
                seconds
                <button
                  type="button"
                  className="m-track-btn"
                  disabled={Boolean(busy)}
                  onClick={() => void setPickedLength()}
                >
                  Set
                </button>
              </label>
              <div className="m-track-pick-tools">
                {picked.onSong || picked.timing ? (
                  <>
                    <button
                      type="button"
                      className="m-track-btn"
                      disabled={
                        Boolean(busy) ||
                        plateBlocks.findIndex((b) => b.plateId === picked.shotId) <= 0
                      }
                      onClick={() => void movePlate(picked.shotId, "earlier")}
                    >
                      Move left
                    </button>
                    <button
                      type="button"
                      className="m-track-btn"
                      disabled={
                        Boolean(busy) ||
                        plateBlocks.findIndex((b) => b.plateId === picked.shotId) >=
                          plateBlocks.length - 1
                      }
                      onClick={() => void movePlate(picked.shotId, "later")}
                    >
                      Move right
                    </button>
                    {waitingCutForPlate(picked.shotId)?.id ? (
                      <button
                        type="button"
                        className="m-track-btn"
                        disabled={Boolean(busy) || busy.startsWith("send-")}
                        onClick={() => void sendPlate(picked.shotId)}
                      >
                        {busy === `send-${waitingCutForPlate(picked.shotId)?.id}`
                          ? "Sending…"
                          : "Send"}
                      </button>
                    ) : null}
                    {doneCutForPlate(picked.shotId)?.id ||
                    waitingCutForPlate(picked.shotId)?.clipFile ||
                    waitingCutForPlate(picked.shotId)?.status === "error" ? (
                      <>
                        <button
                          type="button"
                          className="m-track-btn"
                          disabled={busy.startsWith("redo-")}
                          onClick={() => void redoPlate(picked.shotId)}
                        >
                          {busy.startsWith("redo-") ? "…" : "Redo"}
                        </button>
                        <button
                          type="button"
                          className="m-track-btn"
                          aria-label="Park this clip"
                          disabled={busy.startsWith("redo-")}
                          onClick={() => void redoPlate(picked.shotId)}
                        >
                          X
                        </button>
                      </>
                    ) : null}
                  </>
                ) : (
                  <button
                    type="button"
                    className="m-track-btn"
                    disabled={Boolean(busy) || !picked.plateFile}
                    onClick={() => void addPlateToTimeline(picked.shotId)}
                  >
                    Add
                  </button>
                )}
                {onOpenPlate ? (
                  <button
                    type="button"
                    className="m-track-btn"
                    onClick={() => onOpenPlate(picked.shotId)}
                  >
                    Open
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          </TrackScroll>

          {/* One person, one place, one plate — picked here rather than three
              scrolls down inside a Locations card. */}
          {pickOpen ? (
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
                  disabled={
                    !pickWho ||
                    !pickWhere ||
                    (!job.folderName && !isMusicVideoSongJob(job))
                  }
                  onClick={() => {
                    onCreatePlate?.(pickWhere, pickWho);
                    setPickOpen(false);
                    setPickWho("");
                    setPickWhere("");
                  }}
                >
                  {job.folderName
                    ? `Add ${pickWho || "plate"}`
                    : isMusicVideoSongJob(job)
                      ? "Start the video & add"
                      : "Lock first"}
                </MobilePrimaryButton>
                <button type="button" className="m-track-btn" onClick={() => setPickOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {/* Once the markers are set this is just a record — fold it away. */}
          {!compact && !markers.length ? (
            <>
              <p className="m-track-lyric-hint">
                <strong>Play the song</strong>, then tap the green <strong>Start here</strong> on each
                section as it begins. Typing times is optional — tap <strong>Set</strong> after a time
                if you do.
              </p>
              <div className="m-track-marker-row">
                <button
                  type="button"
                  className="m-track-btn"
                  disabled={Boolean(busy) || !lyricTagsReady}
                  onClick={() => void importFromLyrics(true)}
                >
                  Import from lyrics
                </button>
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

          {!compact && markers.length ? (
            <DeskFold
              label="Sections"
              count={markers.length}
              open={sectionsOpen}
              onToggle={() => setSectionsOpen((v) => !v)}
            >
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
                  onClick={() => void importFromLyrics(true)}
                >
                  Import from lyrics
                </button>
                <button
                  type="button"
                  className="m-track-btn"
                  disabled={Boolean(busy)}
                  onClick={() => void saveMarkers([])}
                >
                  Clear sections
                </button>
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
              <ul className="m-track-marker-list">
                {sortedMarkers.map((m) => {
                  const waiting = effectiveDurationMs > 0 && sectionNeedsStartHere(m, effectiveDurationMs);
                  const cast = sectionPeopleOnPlates(m, plateBlocks);
                  const rowOpen = openSectionId === m.id;
                  return (
                    <li key={m.id} style={{ borderLeftColor: sectionColor(m.label) }}>
                      <button
                        type="button"
                        className="m-track-section-top"
                        aria-expanded={rowOpen}
                        onClick={() => setOpenSectionId((cur) => (cur === m.id ? "" : m.id))}
                      >
                        <span className="m-track-marker-name">
                          <i className="m-track-swatch" style={{ background: sectionColor(m.label) }} />
                          {sectionTitle(m.label)}
                        </span>
                        <span className="m-track-section-cast">{cast}</span>
                        <span className="m-track-section-clock">
                          {formatTrackClock(m.startMs)} – {formatTrackClock(m.endMs)}
                        </span>
                        <span className="m-desk-fold-caret">{rowOpen ? "▾" : "▸"}</span>
                      </button>
                      {rowOpen ? (
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
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </DeskFold>
          ) : null}

          {!compact ? (
            <DeskFold
              label="Free look"
              count={stockLookFoldLabel(freeLook)}
              open={freeLookOpen}
              onToggle={() => setFreeLookOpen((v) => !v)}
            >
              <p className="m-track-lyric-hint">
                One topic for the whole free film — nature, space, first world war, polar
                bears, anything Mixkit / Pexels still has on a Free license. Colour and
                type ride every Support search. Hero / LTX stay off this path.
              </p>
              <label className="m-free-look-field">
                Theme
                <input
                  value={freeLook.theme}
                  placeholder="nature · space · first world war · polar bears"
                  disabled={Boolean(busy)}
                  onChange={(e) => setFreeLook((cur) => ({ ...cur, theme: e.target.value }))}
                  onBlur={(e) => void saveFreeLook({ ...freeLook, theme: e.target.value })}
                />
              </label>
              <label className="m-free-look-field">
                Colour
                <input
                  value={freeLook.colour}
                  placeholder="green forest · black sky · mud brown grain"
                  disabled={Boolean(busy)}
                  onChange={(e) => setFreeLook((cur) => ({ ...cur, colour: e.target.value }))}
                  onBlur={(e) => void saveFreeLook({ ...freeLook, colour: e.target.value })}
                />
              </label>
              <label className="m-free-look-field">
                Type
                <input
                  value={freeLook.types}
                  placeholder="aerial river · stars nebula · trenches archival"
                  disabled={Boolean(busy)}
                  onChange={(e) => setFreeLook((cur) => ({ ...cur, types: e.target.value }))}
                  onBlur={(e) => void saveFreeLook({ ...freeLook, types: e.target.value })}
                />
              </label>
              <div className="m-free-look-actions">
                <button
                  type="button"
                  className="m-track-btn"
                  disabled={Boolean(busy)}
                  onClick={() => void saveFreeLook(freeLook)}
                >
                  {busy === "look" ? "…" : "Save look"}
                </button>
                {stockLookIsOn(freeLook) ? (
                  <button
                    type="button"
                    className="m-track-btn"
                    disabled={Boolean(busy)}
                    onClick={() => void saveFreeLook(EMPTY_STOCK_LOOK)}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </DeskFold>
          ) : null}

          {/* Same UI before and after Start: this is a button in it, not a
              different screen in front of it. */}
          {canStart ? (
            <MobilePrimaryButton disabled={startBusy} onClick={() => onStart?.(job.lyrics || "")}>
              {startBusy ? "Starting…" : "Start the video"}
            </MobilePrimaryButton>
          ) : null}
      </>
      {note ? <p className="m-track-err">{note}</p> : null}
    </div>
  );
}
