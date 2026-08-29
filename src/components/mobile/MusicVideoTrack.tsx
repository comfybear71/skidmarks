"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MobileGenJob, MobileShotUnit } from "@/lib/mobileGenJob";
import type { CrashStoryDoc, CrashStoryShot } from "@/lib/crashStoryTypes";
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
  songFromTrackDraft,
  cookDurationFromHungBar,
  cutForHungPlate,
  hangIdForSend,
  hangPlateShotId,
  isRealPlateHang,
  resolvePlateTimings,
  stretchPlateEdge,
  hitPlateEdge,
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
  plateRailBox,
  slidePlateIntoGap,
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
  musicVideoCreditLine,
  needsDoneClipHang,
  addPlateIsSingingHang,
} from "@/lib/musicVideoSong";
import { isSupportShot } from "@/lib/stockFootage";

import { probeBrowserAudioDurationSec } from "@/lib/scratchSongDrop";
import { lyricsPanelOpensAt } from "@/lib/musicVideoStart";
import { mobileLocationStillUrl } from "@/lib/mobileCandidateUrls";
import { mobileClipSrc } from "@/lib/mobilePlateClips";
import { hungClipFileForPlate, orderedJobClips } from "@/lib/orderedJobClips";
import { readApiJson } from "@/lib/studioFetchError";
import { candidateLookPrompt } from "@/lib/mobileJobReady";
import { muteMvEmptyFrame, muteMvPadNames, shotSpeakersOnCard } from "@/lib/mobilePlateLines";
import {
  buildMuteMvMotionLock,
  buildScratchSongLtxMotion,
  composeMuteMvMotion,
  extractMuteMvMotionSlot,
  imageMotionLooksMuteLock,
  readMvH3Camera,
  readMvH3LastFrame,
  readMvH3Resolution,
  readMvMotionSlot,
  readMvMuteAction,
  readMvNobodyInShot,
  resolveMvSendEngine,
  storedMotionNeedsRebuild,
  writeMvMotionSlot,
} from "@/lib/mobileImageMotion";
import { MINIMAX_H3_ID, withMinimaxH3CameraCommand } from "@/lib/minimaxH3";
import { readHangLengthDraft, writeHangLengthDraft } from "@/lib/hangLengthDraft";
import { clampHangLengthSec } from "@/lib/scratchSongWindow";
import type { ShowStyleId } from "@/lib/showStylePresets";
import { ClipFrameThumb } from "./ClipFrameThumb";
import { DeskFold, MobilePrimaryButton } from "./MobileUi";
import { LyricsBox, SongDropRow, SongPlayer, usePendingSong } from "./MusicVideoStart";
import { PlateLenSlider } from "./PlateLenSlider";

import {
  askSongCookNotifyPermission,
  clearSongCookStop,
  refreshMobileJob,
  requestSongCookStop,
  setSongCookFlag,
  songCookFlagOn,
  songCookStopRequested,
  waitForSongCut,
} from "@/lib/songCutCook";
import {
  formatScratchCookNote,
  parseScratchCook,
  scratchCookButtonLabel,
  type ScratchCookEngine,
} from "@/lib/scratchCookProgress";
import { SongCookAlertBanner } from "./SongCookAlertBanner";

/** Tall enough to read the bars and the plate lane on a phone. */
const TRACK_WAVE_HEIGHT = 78;

function muteLockEmptyFrame(
  jobId: string,
  shot:
    | Pick<
        CrashStoryShot,
        "id" | "staging" | "summary" | "castNames" | "footageRole" | "nobodyInShot"
      >
    | null
    | undefined,
  roster: string[],
): boolean {
  if (!shot) return false;
  const padNames = muteMvPadNames({
    roster,
    staging: shot.staging,
    summary: shot.summary,
    castNames: shot.castNames,
  });
  return muteMvEmptyFrame({
    footageRole: shot.footageRole,
    nobodyInShot: Boolean(shot.nobodyInShot) || readMvNobodyInShot(jobId, shot.id),
    staging: shot.staging,
    summary: shot.summary,
    castNames: shot.castNames,
    padNames,
  });
}

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
  selectedPlateId,
  rangeStartMs,
  rangeEndMs,
  lyricCues,
  onSeek,
  onSelectRange,
  onStretchLive,
  onStretchCommit,
}: {
  peaks: number[];
  durationMs: number;
  playheadMs: number;
  markers: { id: string; label: string; startMs: number; endMs: number }[];
  plateTimings: WavePlateBlock[];
  selectedPlateId?: string;
  /** The drag you are holding — drawn so you can see what Add to timeline will take. */
  rangeStartMs: number;
  rangeEndMs: number;
  lyricCues: LyricCue[];
  onSeek: (ms: number) => void;
  onSelectRange: (startMs: number, endMs: number) => void;
  onStretchLive?: (
    timings: PlateTiming[] | null,
    clockMs: number,
    label: string,
    plateId?: string,
  ) => void;
  onStretchCommit?: (timings: PlateTiming[]) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drag = useRef<{
    startMs: number;
    startX: number;
    moved: boolean;
    pointerType: string;
  } | null>(null);
  const stretch = useRef<{
    plateId: string;
    edge: "start" | "end";
    base: WavePlateBlock[];
  } | null>(null);
  const [cssWidth, setCssWidth] = useState(0);
  const [hoverEdge, setHoverEdge] = useState(false);

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
      // Visible drag handles — this is how length is set, not a typed box.
      const selected = p.plateId === selectedPlateId;
      const grip = selected ? 5 : 3;
      ctx.fillStyle = selected ? "#fff" : "rgba(255,255,255,0.72)";
      ctx.fillRect(x0, laneY, grip, laneBoxH);
      ctx.fillRect(x0 + Math.max(2, bw - grip), laneY, grip, laneBoxH);
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
    selectedPlateId,
  ]);

  function msFromEvent(clientX: number): number {
    const canvas = ref.current;
    if (!canvas || !durationMs) return 0;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    return Math.round((x / rect.width) * durationMs);
  }

  function xyFromEvent(e: { clientX: number; clientY: number }) {
    const canvas = ref.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
    };
  }

  function edgeAt(e: { clientX: number; clientY: number }) {
    const canvas = ref.current;
    if (!canvas || !durationMs) return null;
    const { x, y } = xyFromEvent(e);
    return hitPlateEdge({
      timings: plateTimings,
      durationMs,
      width: canvas.clientWidth || 0,
      height: canvas.clientHeight || TRACK_WAVE_HEIGHT,
      x,
      y,
    });
  }

  function applyStretch(ms: number) {
    const held = stretch.current;
    if (!held) return null;
    const next = stretchPlateEdge(held.base, held.plateId, held.edge, ms, durationMs);
    const row = next.find((t) => t.plateId === held.plateId);
    const clockMs = held.edge === "start" ? row?.startMs ?? ms : row?.endMs ?? ms;
    const label = held.base.find((t) => t.plateId === held.plateId)?.label || "";
    onStretchLive?.(next, clockMs, label, held.plateId);
    onSeek(clockMs);
    return next;
  }

  return (
    <canvas
      ref={ref}
      className="m-track-wave"
      style={{
        height: `${TRACK_WAVE_HEIGHT}px`,
        cursor: hoverEdge || stretch.current ? "ew-resize" : undefined,
      }}
      onPointerDown={(e) => {
        const hit = edgeAt(e);
        if (hit && onStretchCommit) {
          e.currentTarget.setPointerCapture(e.pointerId);
          stretch.current = {
            plateId: hit.plateId,
            edge: hit.edge,
            base: plateTimings.map((t) => ({ ...t })),
          };
          drag.current = null;
          applyStretch(msFromEvent(e.clientX));
          return;
        }
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
        const hit = stretch.current
          ? { plateId: stretch.current.plateId, edge: stretch.current.edge }
          : edgeAt(e);
        setHoverEdge(Boolean(hit));
        if (stretch.current) {
          applyStretch(msFromEvent(e.clientX));
          return;
        }
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
        if (stretch.current) {
          const next = applyStretch(msFromEvent(e.clientX));
          stretch.current = null;
          if (next) onStretchCommit?.(next);
          else onStretchLive?.(null, 0, "");
          return;
        }
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
        if (stretch.current) {
          stretch.current = null;
          onStretchLive?.(null, 0, "");
        }
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
  onBindSendStill,
  onSendStillBusy,
  onSendStillNote,
  onSendStillLabel,
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
  /** Plate-row Send — same cook, not a second generate. */
  onBindSendStill?: (send: (shotId: string) => Promise<void>) => void;
  onSendStillBusy?: (busy: boolean) => void;
  /** Human line on the JACK GHOST card while Send is running or if it failed. */
  onSendStillNote?: (note: string) => void;
  /** Short Send-button face — Queued… / 0:45 / Failed. */
  onSendStillLabel?: (label: string) => void;
}) {
  const song = songFromTrackDraft(job.trackDraft, job.scratchSong) ?? job.scratchSong;
  const parked = usePendingSong(job.id);
  const hasSong = Boolean((song?.fileName || "").trim());
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
  const [motionSaving, setMotionSaving] = useState(false);
  const [openSectionId, setOpenSectionId] = useState("");
  const [playing, setPlaying] = useState(false);
  const [rangeStartMs, setRangeStartMs] = useState(0);
  const [rangeEndMs, setRangeEndMs] = useState(15000);
  const [rangeChosen, setRangeChosen] = useState(false);
  const [stretchTimings, setStretchTimings] = useState<PlateTiming[] | null>(null);
  const [stretchReadout, setStretchReadout] = useState("");
  const [lenDraft, setLenDraft] = useState("");
  const [localPeaks, setLocalPeaks] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const jobRef = useRef(job);
  jobRef.current = job;
  const sendPlateRef = useRef<(shotId: string) => Promise<void>>(async () => {});
  const sendNoteRef = useRef(onSendStillNote);
  sendNoteRef.current = onSendStillNote;
  const sendLabelRef = useRef(onSendStillLabel);
  sendLabelRef.current = onSendStillLabel;
  const cookLock = useRef(false);
  const sendPostedRef = useRef(false);
  const cookCancel = useRef(false);
  const cookWatchLive = useRef(false);
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
      const live = stretchTimings?.find((t) => t.plateId === row.shotId) || null;
      const timing = live || plateTimingForShot(song, job.trackDraft, row.shotId);
      return { ...row, title, timing };
    });
  }, [plated, story, song, job.trackDraft, stretchTimings]);

  const savedPlateBlocks = sortPlateTimings(
    resolvePlateTimings(song, job.trackDraft),
  )
    .filter((x) => isRealPlateHang(x))
    .map((x) => {
      const row = plateRows.find((p) => p.shotId === hangPlateShotId(x.plateId));
      return { ...x, label: row?.title || x.plateId };
    });
  const plateBlocks: WavePlateBlock[] = (stretchTimings || savedPlateBlocks).map((t) => {
    const row = plateRows.find((p) => p.shotId === hangPlateShotId(t.plateId));
    const saved = savedPlateBlocks.find((b) => b.plateId === t.plateId);
    return { ...t, label: row?.title || saved?.label || t.plateId };
  });
  // Hung stills sit on the wave. Unhung stills stay in STILLS — TRACK
  // must not grow a second shelf of JACK GHOST / Plate 5 / off cards.
  const filmItems = useMemo(() => {
    return plateBlocks
      .filter((block) => isRealPlateHang(block))
      .map((block) => {
        const row = plateRows.find((p) => p.shotId === hangPlateShotId(block.plateId));
        return {
          shotId: block.plateId,
          title: row?.title || block.label,
          plateFile: row?.plateFile || "",
          timing: block,
          onSong: true,
        };
      });
  }, [plateBlocks, plateRows]);
  const picked =
    filmItems.find((item) => item.shotId === pickedId) || filmItems[0] || null;
  const pickedOnSong = Boolean(picked && isRealPlateHang(picked.timing));
  const pickedClock =
    picked?.timing ||
    plateBlocks.find((b) => b.plateId === picked?.shotId) ||
    null;
  const pickedStory = useMemo(() => {
    const id = hangPlateShotId((picked?.shotId || "").trim());
    if (!id || !story) return null;
    for (const scene of story.scenes || []) {
      const shot = scene.shots.find((sh) => sh.id === id);
      if (shot) return { shot, sceneId: scene.id, beat: shot.beats[0] || null };
    }
    return null;
  }, [picked?.shotId, story]);
  const pickedBeatId =
    (pickedStory?.beat?.id || "").trim() ||
    findSongCarrierBeatId(story, song?.fileName, picked?.shotId);
  const pickedSpeaker = (pickedStory?.beat?.speaker || "").trim();
  const pickedSpeakers = useMemo(
    () =>
      pickedStory
        ? shotSpeakersOnCard({
            shotId: pickedStory.shot.id,
            title: pickedStory.shot.title,
            staging: pickedStory.shot.staging,
            summary: pickedStory.shot.summary,
            plateFile: pickedStory.shot.plateFile,
            jobSpeakers: job.speakers || [],
            beats: pickedStory.shot.beats,
          })
        : [],
    [pickedStory, job.speakers],
  );
  const pickedLook =
    candidateLookPrompt(job.castCandidates || {}, pickedSpeaker) ||
    job.roster?.find((c) => c.name.trim().toLowerCase() === pickedSpeaker.toLowerCase())
      ?.appearance ||
    "";
  const pickedEmptyFrame = muteLockEmptyFrame(
    job.id,
    pickedStory?.shot,
    job.speakers || [],
  );
  const motionLock = useMemo(
    () =>
      buildMuteMvMotionLock({
        styleId: (job.styleId || "music_video") as ShowStyleId,
        speaker: pickedSpeaker || picked?.title || "The performer",
        lookLock: pickedLook,
        shotSpeakers: pickedSpeakers.length ? pickedSpeakers : undefined,
        staging: pickedStory?.shot.staging || "",
        emptyFrame: pickedEmptyFrame,
      }),
    [
      job.styleId,
      pickedSpeaker,
      picked?.title,
      pickedLook,
      pickedSpeakers,
      pickedStory?.shot.staging,
      pickedEmptyFrame,
    ],
  );

  useEffect(() => {
    if (pickedId && filmItems.some((item) => item.shotId === pickedId)) return;
    const first = filmItems[0]?.shotId || "";
    if (first) setPickedId(first);
  }, [filmItems, pickedId]);

  const pickedLenSec =
    pickedClock && pickedClock.endMs > pickedClock.startMs
      ? msToSec(pickedClock.endMs - pickedClock.startMs)
      : 0;

  useEffect(() => {
    if (pickedOnSong && pickedLenSec > 0) setLenDraft(String(pickedLenSec));
  }, [picked?.shotId, pickedLenSec, pickedOnSong]);

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

  /** He taps Put stills / Hang. TRACK open must not POST hang-plates. */
  async function hangStillsOnWave() {
    if (!hasSong) {
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
      pending?: boolean;
    };
    if (raw.job) {
      onJobChange(raw.job);
      jobRef.current = raw.job;
    }
    if (!res.ok) throw new Error(raw.error?.trim() || `Request failed (${res.status})`);
    return raw;
  }

  function liveMotionSlot() {
    if (!pickedBeatId) return "";
    const live = readMvMotionSlot(job.id, pickedBeatId);
    if (live !== null) return live;
    return extractMuteMvMotionSlot(pickedStory?.beat?.imageMotion || "", motionLock);
  }

  function composedMotionBody() {
    return composeMuteMvMotion(motionLock, liveMotionSlot());
  }

  function storyShotFor(shotId: string) {
    const id = hangPlateShotId(shotId.trim()) || shotId.trim();
    if (!id || !story) return null;
    for (const scene of story.scenes || []) {
      const shot = scene.shots.find((sh) => sh.id === id);
      if (shot) return shot;
    }
    return null;
  }

  function beatIdForShot(shotId: string) {
    const shot = storyShotFor(shotId);
    return (
      (shot?.beats[0]?.id || "").trim() ||
      findSongCarrierBeatId(story, song?.fileName, shotId) ||
      beatId
    );
  }

  function sendEmptyFrameFor(shotId: string): boolean {
    return muteLockEmptyFrame(job.id, storyShotFor(shotId), job.speakers || []);
  }

  function singingHangForShot(shotId: string): boolean {
    const shot = storyShotFor(shotId);
    const empty = sendEmptyFrameFor(shotId);
    return addPlateIsSingingHang({
      mute: readMvMuteAction(job.id, shotId),
      emptyFrame: empty,
      nobodyInShot: empty || readMvNobodyInShot(job.id, shotId) || Boolean(shot?.nobodyInShot),
      support: isSupportShot(shot),
    });
  }

  function songRunEmptyExtras(shotId: string): Record<string, unknown> {
    const still = hangPlateShotId(shotId) || shotId;
    const empty = sendEmptyFrameFor(still);
    return {
      ...(readMvMuteAction(job.id, still) || empty ? { mute: true } : {}),
      ...(empty ? { emptyFrame: true, nobodyInShot: true } : {}),
    };
  }

  function motionBodyForSend(shotId: string): string {
    const targetBeatId = beatIdForShot(shotId);
    const shot = storyShotFor(shotId);
    const emptyFrame = sendEmptyFrameFor(shotId);
    const speaker = emptyFrame ? "" : (shot?.beats[0]?.speaker || "").trim();
    const speakers = emptyFrame
      ? []
      : shot
        ? shotSpeakersOnCard({
            shotId: shot.id,
            title: shot.title,
            staging: shot.staging,
            summary: shot.summary,
            plateFile: shot.plateFile,
            jobSpeakers: job.speakers || [],
            beats: shot.beats,
          })
        : [];
    const look = emptyFrame
      ? ""
      : candidateLookPrompt(job.castCandidates || {}, speaker) ||
        job.roster?.find((c) => c.name.trim().toLowerCase() === speaker.toLowerCase())
          ?.appearance ||
        "";
    const muteOn = Boolean(
      readMvMuteAction(job.id, hangPlateShotId(shotId) || shotId) || emptyFrame,
    );
    const stored = shot?.beats[0]?.imageMotion || "";
    const cut = waitingCutForPlate(shotId) || doneCutForPlate(shotId);
    const sendEngine = resolveMvSendEngine({
      jobId: job.id,
      shotId: hangPlateShotId(shotId) || shotId,
      beatId: targetBeatId,
    });
    let body = stored;
    if (muteOn) {
      const lock = buildMuteMvMotionLock({
        styleId: (job.styleId || "music_video") as ShowStyleId,
        speaker: emptyFrame ? "" : speaker || shot?.title || "The performer",
        lookLock: look,
        shotSpeakers: speakers.length ? speakers : undefined,
        staging: shot?.staging || "",
        emptyFrame,
      });
      const live = targetBeatId ? readMvMotionSlot(job.id, targetBeatId) : null;
      const slot = live !== null ? live : extractMuteMvMotionSlot(stored, lock);
      if (targetBeatId) writeMvMotionSlot(job.id, targetBeatId, slot);
      body = composeMuteMvMotion(lock, slot);
    } else if (
      imageMotionLooksMuteLock(stored) ||
      !stored.trim() ||
      storedMotionNeedsRebuild(
        stored,
        shot?.staging || "",
        speaker || shot?.title || "",
      )
    ) {
      body = buildScratchSongLtxMotion({
        styleId: (job.styleId || "music_video") as ShowStyleId,
        speaker: speaker || shot?.title || "The performer",
        lookLock: look,
        staging: shot?.staging || "",
        performance: cut?.performance,
        startSec: cut?.startSec,
      });
    }
    if (sendEngine === "h3") {
      body = withMinimaxH3CameraCommand(
        body,
        readMvH3Camera(job.id, hangPlateShotId(shotId) || shotId),
      );
    }
    return body;
  }

  async function persistMotionFor(shotId: string) {
    const targetBeatId = beatIdForShot(shotId);
    const body = motionBodyForSend(shotId);
    if (!targetBeatId || !body.trim()) return body;
    const res = await fetch("/api/crash/mobile/beat-motion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, beatId: targetBeatId, imageMotion: body }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      job?: MobileGenJob;
    };
    if (data.job) {
      onJobChange(data.job);
      jobRef.current = data.job;
    }
    if (!res.ok) throw new Error(data.error || "Couldn't keep Image motion");
    return body;
  }

  async function persistPickedMotion() {
    if (!picked?.shotId) return "";
    return persistMotionFor(picked.shotId);
  }

  function paintPlateSend(msg: string, label?: string) {
    sendNoteRef.current?.(msg);
    if (label !== undefined) sendLabelRef.current?.(label);
  }

  function paintCookWatch(
    live: MobileGenJob,
    shotId: string,
    startedMs: number,
    engine: ScratchCookEngine,
  ) {
    const cook = parseScratchCook(live.scratchCook);
    const mute = Boolean(
      cook?.mute || readMvMuteAction(job.id, hangPlateShotId(shotId) || shotId),
    );
    const cutErr = (live.scratchSong?.cuts || []).find(
      (c) => (c.error || "").trim() && (c.status === "error" || cook?.step === "error"),
    );
    if (cook?.step === "error" || (cutErr?.error || "").trim()) {
      const msg = (cook?.message || cutErr?.error || live.error || "Clip failed").trim();
      paintPlateSend(msg, scratchCookButtonLabel(cook, true));
      return;
    }
    const now = Date.now();
    const cutRunning = (live.scratchSong?.cuts || []).some((c) => c.status === "running");
    paintPlateSend(
      formatScratchCookNote(cook, {
        nowMs: now,
        startedMs,
        engine,
        mute,
        posted: sendPostedRef.current,
        cutRunning,
      }),
      scratchCookButtonLabel(cook, true, { nowMs: now, startedMs }),
    );
  }

  async function watchPlateCook(
    shotId: string,
    startedMs: number,
    engine: ScratchCookEngine,
  ) {
    cookWatchLive.current = true;
    paintCookWatch(jobRef.current, shotId, startedMs, engine);
    while (cookWatchLive.current) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!cookWatchLive.current) return;
      const live = await refreshMobileJob(job.id);
      if (!cookWatchLive.current) return;
      if (live) {
        onJobChange(live);
        jobRef.current = live;
        paintCookWatch(live, shotId, startedMs, engine);
      } else {
        paintCookWatch(jobRef.current, shotId, startedMs, engine);
      }
    }
  }

  async function pollI2v(cutId: string, shotId: string, targetBeatId: string) {
    for (let i = 0; i < 80; i++) {
      if (cookCancel.current || songCookStopRequested(job.id)) return;
      const raw = await songPost("clip-poll", {
        cutId,
        beatId: targetBeatId || beatId,
        shotId,
      });
      if (!raw.pending) return;
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    throw new Error("Still cooking. The episode is still there — tap Send again.");
  }

  async function sendI2v(cutId: string, shotId: string, targetBeatId: string) {
    const timing = plateTimingForShot(
      jobRef.current.scratchSong,
      jobRef.current.trackDraft,
      shotId,
    );
    const cook = cookDurationFromHungBar(timing, "h3");
    if ("error" in cook) {
      cookWatchLive.current = false;
      setNote(cook.error);
      paintPlateSend(cook.error, "Failed");
      return;
    }
    if (cook.note) {
      setNote(cook.note);
      paintPlateSend(cook.note);
    }
    askSongCookNotifyPermission();
    setBusy(`send-${cutId}`);
    sendPostedRef.current = true;
    try {
      const raw = await songPost("run", {
        cutId,
        beatId: targetBeatId || beatId,
        clipEngine: MINIMAX_H3_ID,
        durationSec: cook.durationSec,
        endPlateFile: readMvH3LastFrame(job.id, hangPlateShotId(shotId) || shotId) || undefined,
        resolution: readMvH3Resolution(job.id, hangPlateShotId(shotId) || shotId),
        h3Camera: readMvH3Camera(job.id, hangPlateShotId(shotId) || shotId) || undefined,
        ...songRunEmptyExtras(shotId),
      });
      if (raw.pending) await pollI2v(cutId, shotId, targetBeatId);
      if (cookCancel.current || songCookStopRequested(job.id)) return;
      paintPlateSend("", "Send");
    } finally {
      setBusy("");
    }
  }

  async function addPlateToTimeline(shotId: string) {
    if (!hasSong) {
      setNote("Drop the song first.");
      return;
    }
    const existing = plateTimingForShot(song, job.trackDraft, shotId);
    if (existing && isRealPlateHang(existing)) {
      const before = resolvePlateTimings(song, job.trackDraft).filter((t) =>
        isRealPlateHang(t),
      ).length;
      setBusy(`add-${shotId}`);
      try {
        const res = await fetch("/api/crash/mobile/song", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add-plate",
            jobId: job.id,
            shotId,
            durationSec: readHangLengthDraft(job.id, shotId),
            singing: singingHangForShot(shotId),
            mute: readMvMuteAction(job.id, hangPlateShotId(shotId) || shotId) || sendEmptyFrameFor(shotId),
            emptyFrame: sendEmptyFrameFor(shotId),
            support: isSupportShot(storyShotFor(shotId)),
          }),
        });
        const raw = (await res.json().catch(() => ({}))) as {
          job?: MobileGenJob;
          error?: string;
        };
        if (raw.job) onJobChange(raw.job);
        if (!res.ok) throw new Error(raw.error?.trim() || "Couldn't add that still");
        const afterTimings = resolvePlateTimings(
          raw.job?.scratchSong,
          raw.job?.trackDraft,
        ).filter((t) => isRealPlateHang(t));
        const after = afterTimings.length;
        const beforeIds = new Set(
          resolvePlateTimings(song, job.trackDraft)
            .filter((t) => isRealPlateHang(t))
            .map((t) => t.plateId),
        );
        const added = afterTimings.find(
          (t) => !beforeIds.has(t.plateId) && hangPlateShotId(t.plateId) === hangPlateShotId(shotId),
        );
        setPickedId(added?.plateId || shotId);
        setNote(
          after > before
            ? "On the song. Pull the handle, then Send."
            : "Already on the song. Pull the handle, then Send.",
        );
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Couldn't add that still");
      } finally {
        setBusy("");
      }
      return;
    }
    const clock = resolvePlateTimings(song, job.trackDraft);
    const next = nextPlateHangWindow(clock, {
      durationSec: readHangLengthDraft(job.id, shotId),
      singing: singingHangForShot(shotId),
      lyricCues: song.lyricCues || job.trackDraft?.lyricCues,
    });
    const win =
      rangeChosen && rangeEndMs > rangeStartMs
        ? { startMs: rangeStartMs, endMs: rangeEndMs }
        : next;
    await schedulePlate(shotId, win.startMs, win.endMs, clock.length);
    setPickedId(shotId);
    setNote("On the song. Pull the handle, then Send.");
  }

  async function sendOneCutBody(
    cutId: string,
    shotId: string,
    targetBeatId: string,
    imageMotion?: string,
  ) {
    const id = cutId.trim();
    if (!id) {
      setNote("Add this still to the timeline first.");
      return;
    }
    const timing = plateTimingForShot(
      jobRef.current.scratchSong,
      jobRef.current.trackDraft,
      shotId,
    );
    const cook = cookDurationFromHungBar(timing, "ltx");
    if ("error" in cook) {
      cookWatchLive.current = false;
      setNote(cook.error);
      paintPlateSend(cook.error, "Failed");
      return;
    }
    if (cook.note) {
      setNote(cook.note);
      paintPlateSend(cook.note);
    }
    askSongCookNotifyPermission();
    setBusy(`send-${id}`);
    sendPostedRef.current = true;
    try {
      await songPost("run", {
        cutId: id,
        beatId: targetBeatId || beatId,
        clipEngine: "ltx",
        durationSec: cook.durationSec,
        ...songRunEmptyExtras(shotId),
        ...(imageMotion?.trim() ? { imageMotion: imageMotion.trim() } : {}),
      });
      await waitForSongCut({
        jobId: job.id,
        cutId: id,
        setJob: onJobChange,
        cancelled: () => cookCancel.current || songCookStopRequested(job.id),
      });
      if (cookCancel.current || songCookStopRequested(job.id)) return;
      paintPlateSend("", "Send");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't send that cut";
      setNote(msg);
      paintPlateSend(msg, "Failed");
    } finally {
      setBusy("");
    }
  }

  async function sendPlate(shotId: string) {
    const hangId = hangIdForSend({
      shotId,
      plateTimings: jobRef.current.scratchSong?.plateTimings,
      cuts: jobRef.current.scratchSong?.cuts,
      pickedId: pickedId || picked?.shotId,
    });
    setPickedId(hangId);
    const targetBeatId = beatIdForShot(hangId);
    const timingNow = () =>
      plateTimingForShot(
        jobRef.current.scratchSong,
        jobRef.current.trackDraft,
        hangId,
      );
    // Still with no clock hangs as a still. Do not hang-plates every leftover
    // mp4 — that put old cooks back after he cleared the song.
    if (!isRealPlateHang(timingNow())) {
      await addPlateToTimeline(hangPlateShotId(hangId) || hangId);
    }
    const hungCut = () =>
      cutForHungPlate({
        cuts: jobRef.current.scratchSong?.cuts,
        shotId: hangId,
        timing: timingNow(),
      });
    let cut = hungCut();
    if (!cut?.id) {
      const timing = timingNow();
      if (timing) {
        await schedulePlate(hangId, timing.startMs, timing.endMs, timing.sortIndex);
        cut = hungCut();
      }
    }
    if (!cut?.id) {
      setNote("Add this still to the song first, then Send.");
      return;
    }
    if (cookLock.current) return;
    cookLock.current = true;
    cookCancel.current = false;
    clearSongCookStop(job.id);
    setBusy(`send-${cut.id}`);
    setNote("");
    const startedMs = Date.now();
    const useH3 =
      resolveMvSendEngine({
        jobId: job.id,
        shotId: hangPlateShotId(hangId) || hangId,
        beatId: targetBeatId,
      }) === "h3";
    const engine: ScratchCookEngine = useH3 ? "h3" : "ltx";
    sendPostedRef.current = false;
    void watchPlateCook(hangId, startedMs, engine);
    try {
      const motion = motionBodyForSend(hangId);
      paintPlateSend("Starting the Send", "Starting…");
      if (useH3) {
        await sendI2v(cut.id, hangId, targetBeatId);
        return;
      }
      await sendOneCutBody(cut.id, hangId, targetBeatId, motion);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't send that still";
      setNote(msg);
      paintPlateSend(msg, "Failed");
    } finally {
      cookWatchLive.current = false;
      cookLock.current = false;
      sendPostedRef.current = false;
      setBusy("");
    }
  }
  sendPlateRef.current = sendPlate;

  async function dropPlateFromWave(shotId: string) {
    if (!hasSong) {
      setNote("Nothing on the song to drop.");
      return;
    }
    setBusy(`drop-${shotId}`);
    setNote("");
    try {
      const updated = await trackAction("remove-plate-timing", {
        jobId: job.id,
        plateId: shotId,
      });
      if (updated) onJobChange(updated);
      setNote("Off the wave. Clip stays. Still stays.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't drop that plate");
    } finally {
      setBusy("");
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
    onBindSendStill?.((shotId) => sendPlateRef.current(shotId));
  }, [onBindSendStill]);

  useEffect(() => {
    onSendStillBusy?.(busy.startsWith("send-"));
  }, [busy, onSendStillBusy]);

  useEffect(() => {
    const cook = parseScratchCook(job.scratchCook);
    if (!cook || cook.step === "done") return;
    if (busy.startsWith("send-")) return;
    if (cook.step === "error") {
      paintPlateSend(cook.message || "Clip failed", "Send");
      return;
    }
    paintPlateSend(
      formatScratchCookNote(cook),
      scratchCookButtonLabel(cook, true),
    );
  }, [busy, job.scratchCook]);

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
    if (!hasSong) {
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
    cookWatchLive.current = false;
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
      const stopped = "Stopped. Move plates, then Send when you like the order.";
      setNote(stopped);
      paintPlateSend(stopped);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't stop send";
      setNote(msg);
      paintPlateSend(msg);
    } finally {
      setBusy("");
    }
  }

  async function schedulePlate(shotId: string, startMs: number, endMs: number, sortIndex: number) {
    if (!hasSong) {
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

  async function saveStretchedBoxes(next: PlateTiming[]) {
    if (!hasSong) {
      setNote("Drop the song first.");
      setStretchTimings(null);
      setStretchReadout("");
      return;
    }
    setBusy("stretch");
    setNote("");
    try {
      const updated = await trackAction("set-plate-timings", {
        jobId: job.id,
        plateTimings: next.map(({ plateId, startMs, endMs, sortIndex }) => ({
          plateId,
          startMs,
          endMs,
          sortIndex,
        })),
      });
      if (updated) onJobChange(updated);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't stretch that bar");
    } finally {
      setStretchTimings(null);
      setStretchReadout("");
      setBusy("");
    }
  }

  async function setHungPlateLength(durationSec: number) {
    if (!picked?.shotId || !pickedOnSong || !pickedClock) {
      setNote("Hang the still on the song first.");
      return;
    }
    const startSec = msToSec(pickedClock.startMs);
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
      setLenDraft(String(durationSec));
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't set that length");
    } finally {
      setBusy("");
    }
  }

  function commitHungPlateLength() {
    const sec = Number(lenDraft);
    if (!Number.isFinite(sec) || sec <= 0) {
      if (pickedLenSec > 0) setLenDraft(String(pickedLenSec));
      return;
    }
    if (pickedLenSec > 0 && Math.abs(sec - pickedLenSec) < 0.05) return;
    void setHungPlateLength(sec);
  }

  async function dropSong() {
    // The browser copy and the saved attached take both have to go, or the
    // × looks dead: clearing only the parked file left scratchSong.fileName
    // pointing at it and the player carried on. File stays in Blob. Clips stay.
    clearPendingSong(job.id);
    setLocalPeaks([]);
    setPlayheadMs(0);
    const attached = Boolean(
      (song?.fileName || "").trim() || (job.trackDraft?.songFile || "").trim(),
    );
    if (!attached) return;
    setBusy("song");
    try {
      const updated = await trackAction("drop-song", { jobId: job.id });
      if (updated) onJobChange(updated);
      setNote("");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't drop that song");
    } finally {
      setBusy("");
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
            {needsDoneClipHang(song, job.shots, job.clips || []) && hasSong ? (
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
              {musicVideoCreditLine(job) ||
                songChipName(song?.fileName || job.trackDraft?.songFile || parked?.file.name || "")}
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
              selectedPlateId={picked?.shotId || ""}
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
              onStretchLive={(timings, clockMs, label, plateId) => {
                setStretchTimings(timings);
                if (plateId) setPickedId(plateId);
                setStretchReadout(
                  timings && label
                    ? `${label} · ${formatTrackClockPrecise(clockMs)}`
                    : "",
                );
              }}
              onStretchCommit={(timings) => {
                void saveStretchedBoxes(timings);
              }}
            />
          ) : (
            <div className="m-track-wave-placeholder">
              {busy === "peaks" ? "Reading waveform…" : "Waveform…"}
            </div>
          )}
          {plateBlocks.length ? (
            <div className="m-track-rail m-track-rail-on-wave">
              <div className="m-track-rail-scroll m-track-rail-align">
                {filmItems
                  .filter((cell) => cell.onSong && cell.timing)
                  .map((cell) => {
                    const timing = cell.timing!;
                    const box = plateRailBox(
                      timing.startMs,
                      timing.endMs,
                      effectiveDurationMs || 1,
                    );
                    const durSec = msToSec(timing.endMs - timing.startMs);
                    const on = picked?.shotId === cell.shotId;
                    return (
                      <button
                        type="button"
                        key={cell.shotId}
                        className={`m-track-rail-cell is-align is-timed${on ? " is-on" : ""}`}
                        style={{ left: `${box.leftPct}%`, width: `${box.widthPct}%` }}
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
                        <span className="m-track-film-len">{durSec}s</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : null}
          </TrackScroll>

          {stretchReadout ? (
            <p className="m-track-stretch-hint">{stretchReadout}</p>
          ) : null}

          {picked ? (
            <div className="m-track-pick">
              <div className="m-track-pick-name">{picked.title}</div>
              <div className="m-track-pick-clock">
                {pickedOnSong && pickedClock
                  ? `${formatTrackClockPrecise(pickedClock.startMs)} – ${formatTrackClockPrecise(pickedClock.endMs)} · ${pickedLenSec}s`
                  : "Not on the song yet"}
              </div>
              <div className="m-track-pick-tools">
                {pickedOnSong ? (
                  <>
                    <button
                      type="button"
                      className="m-track-btn"
                      disabled={
                        Boolean(busy) ||
                        !slidePlateIntoGap(plateBlocks, picked.shotId, -1, effectiveDurationMs)
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
                        !slidePlateIntoGap(plateBlocks, picked.shotId, 1, effectiveDurationMs)
                      }
                      onClick={() => void movePlate(picked.shotId, "later")}
                    >
                      Move right
                    </button>
                    <button
                      type="button"
                      className="m-track-btn"
                      disabled={Boolean(busy) || busy === `drop-${picked.shotId}`}
                      onClick={() => void dropPlateFromWave(picked.shotId)}
                    >
                      {busy === `drop-${picked.shotId}` ? "…" : "Off song"}
                    </button>
                    <PlateLenSlider
                      valueSec={Number(lenDraft) || pickedLenSec || 0}
                      disabled={Boolean(busy)}
                      onDraft={(sec) => writeHangLengthDraft(job.id, picked.shotId, sec)}
                      onCommit={(sec) => {
                        setLenDraft(String(clampHangLengthSec(sec)));
                        void setHungPlateLength(sec);
                      }}
                    />
                    {/* Send lives on the JACK GHOST plate row — one cook. */}
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
                          aria-label="Take off the song"
                          disabled={Boolean(busy) || busy === `drop-${picked.shotId}`}
                          onClick={() => void dropPlateFromWave(picked.shotId)}
                        >
                          {busy === `drop-${picked.shotId}` ? "…" : "X"}
                        </button>
                      </>
                    ) : null}
                  </>
                ) : hungClipFileForPlate(job, picked.shotId) ? null : (
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
                    onClick={() => onOpenPlate(hangPlateShotId(picked.shotId))}
                  >
                    Open
                  </button>
                ) : null}
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
