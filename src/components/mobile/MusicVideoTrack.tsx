"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MobileGenJob, MobileShotUnit } from "@/lib/mobileGenJob";
import type { CrashStoryDoc } from "@/lib/crashStoryTypes";
import {
  TRACK_ACID,
  TRACK_SECTION_LABELS,
  formatTrackClock,
  evenLineStartMs,
  evenLyricHoldMs,
  evenLyricIndexAt,
  marqueeWordAt,
  lyricLinesFrom,
  plateTimingForShot,
  nextSectionStartMs,
  parseTrackClock,
  plateBarColor,
  sectionColor,
  sectionTint,
  sectionTitle,
  sortPlateTimings,
  withSectionTime,
  type LyricCue,
  type TrackSectionLabel,
} from "@/lib/musicVideoTrack";
import { decodeWaveformPeaks } from "@/lib/decodeWaveformPeaks";
import { clearPendingSong, songChipName } from "@/lib/musicVideoStart";
import { findSongCarrierBeatId, musicVideoCreditLine } from "@/lib/musicVideoSong";

import { probeBrowserAudioDurationSec } from "@/lib/scratchSongDrop";
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

/** m:ss box. Commits on blur or Enter; a typo just snaps back. */
function TimeField({
  value,
  label,
  onCommit,
}: {
  value: number;
  label: string;
  onCommit: (ms: number) => void;
}) {
  // Draft only exists while the box is being typed in; the rest of the time
  // the value is read straight off the marker. No effect syncing the two.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? formatTrackClock(value);

  function commit() {
    const typed = draft;
    setDraft(null);
    if (typed === null) return;
    const ms = parseTrackClock(typed);
    if (ms !== null) onCommit(ms);
  }

  return (
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
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
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
}) {
  const song = job.scratchSong;
  const parked = usePendingSong(job.id);
  const beatId = findSongCarrierBeatId(story, song?.fileName, plated[0]?.shotId);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [playheadMs, setPlayheadMs] = useState(0);
  const [markerLabel, setMarkerLabel] = useState<TrackSectionLabel>("verse");
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [rangeStartMs, setRangeStartMs] = useState(0);
  const [rangeEndMs, setRangeEndMs] = useState(15000);
  const [localPeaks, setLocalPeaks] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobRef = useRef("");

  const durationMs = useMemo(() => {
    if (song?.durationSec) return Math.round(song.durationSec * 1000);
    if (parked?.durationSec) return Math.round(parked.durationSec * 1000);
    return 0;
  }, [song?.durationSec, parked?.durationSec]);

  const peaks =
    song?.waveformPeaks ||
    job.trackDraft?.waveformPeaks ||
    (localPeaks.length ? localPeaks : []);

  const markers = song?.sectionMarkers || job.trackDraft?.sectionMarkers || [];

  const lyricCues = useMemo<LyricCue[]>(
    () => song?.lyricCues || job.trackDraft?.lyricCues || [],
    [song?.lyricCues, job.trackDraft?.lyricCues],
  );
  const lyricLines = useMemo(() => lyricLinesFrom(job.lyrics || ""), [job.lyrics]);
  // Lines are pasted, not pinned — spread them across the song, then split
  // each line's slot between its words so one word rides through at a time.
  const activeLyric = evenLyricIndexAt(lyricLines.length, playheadMs, durationMs);
  const activeWord = useMemo(() => {
    if (activeLyric === null) return null;
    const text = lyricLines.find((l) => l.index === activeLyric)?.text || "";
    const words = text.split(/\s+/).filter(Boolean);
    if (!words.length) return null;
    const hit = marqueeWordAt({
      words: words.length,
      lineStartMs: evenLineStartMs(activeLyric, lyricLines.length, durationMs),
      lineHoldMs: evenLyricHoldMs(lyricLines.length, durationMs),
      atMs: playheadMs,
    });
    if (!hit) return null;
    return { key: `${activeLyric}-${hit.index}`, word: words[hit.index]!, holdMs: hit.holdMs };
  }, [activeLyric, lyricLines, durationMs, playheadMs]);


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
    if (song?.fileName && beatId && job.folderName) {
      return (
        `/api/crash/mobile/beat-audio?styleId=${encodeURIComponent(job.styleId)}` +
        `&folderName=${encodeURIComponent(job.folderName)}` +
        `&beatId=${encodeURIComponent(beatId)}` +
        `&fileName=${encodeURIComponent(song.fileName)}`
      );
    }
    if (parked?.file) {
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
      blobRef.current = URL.createObjectURL(parked.file as File);
      return blobRef.current;
    }
    return "";
  }, [song?.fileName, beatId, job.folderName, job.styleId, parked?.file]);

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
    else if (audioSrc && song?.fileName && !song.waveformPeaks?.length) {
      void fetch(audioSrc)
        .then((r) => r.blob())
        .then((blob) => decodeAndSave(new File([blob], song.fileName, { type: "audio/mpeg" })))
        .catch(() => undefined);
    }
  }, [audioSrc, parked?.file, peaks.length, busy, decodeAndSave, song?.fileName, song?.waveformPeaks]);

  async function saveMarkers(next: typeof markers) {
    setBusy("markers");
    setNote("");
    try {
      const action = song?.fileName ? "save-track" : "save-draft";
      const updated = await trackAction(action, {
        jobId: job.id,
        sectionMarkers: next,
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
    // Pre-lock the mp3 is only parked in the browser, so dropping it is local.
    // Post-lock it is a real attached take: leave that to the song desk rather
    // than deleting media from here (AGENTS.md — never delete, park).
    if (!song?.fileName) {
      clearPendingSong(job.id);
      setLocalPeaks([]);
      return;
    }
    setNote("The song is attached to this episode — drop it from the song desk.");
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
              onClick={() => setLyricsOpen((v) => !v)}
            >
              Lyrics <span className="m-mv-lyr-caret">{lyricsOpen ? "▾" : "▸"}</span>
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
          {lyricsOpen ? <LyricsBox job={job} /> : null}

          {/* Nothing playing, nothing shown — the strip is for the line, not
              for instructions about the line. */}
          {!compact && playing && activeWord ? (
            <div className="m-track-marquee">
              <span
                key={activeWord.key}
                className="m-track-marquee-word"
                style={{ animationDuration: `${activeWord.holdMs}ms` }}
              >
                {activeWord.word}
              </span>
            </div>
          ) : null}

          <div className="m-track-toolbar">
            {audioSrc ? (
              <SongPlayer
                src={audioSrc}
                audioRef={audioRef}
                onTime={(sec) => setPlayheadMs(Math.round(sec * 1000))}
                onPlayingChange={setPlaying}
              />
            ) : (
              <SongDropRow jobId={job.id} />
            )}
          </div>

          {peaks.length ? (
            <WaveformCanvas
              peaks={peaks}
              durationMs={durationMs || 1}
              playheadMs={playheadMs}
              markers={markers}
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

          {/* Where the plates are going: a horizontal rail under the wave.
              Placeholder for now so the space is held and the layout below it
              does not move when the real thumbnails land. */}
          {!compact ? (
            <div className="m-track-rail" aria-label="Plates (coming)">
              <div className="m-track-rail-scroll">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="m-track-rail-cell" />
                ))}
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
          <div className="m-track-marker-row">
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
                // No assumed length. Music does not come in 15s blocks, so a
                // new section runs from the last one to the end of the song and
                // you type the end you actually want.
                const startMs = nextSectionStartMs(markers);
                const endMs = Math.max(startMs + 1000, durationMs || startMs + 1000);
                void saveMarkers([
                  ...markers,
                  { id: `marker_${Date.now()}`, label: markerLabel, startMs, endMs },
                ]);
              }}
            >
              Add section
            </button>
          </div>
          ) : null}

          {!compact && sectionsOpen && markers.length ? (
            <ul className="m-track-marker-list">
              {markers.map((m) => (
                <li key={m.id} style={{ borderLeftColor: sectionColor(m.label) }}>
                  <span className="m-track-marker-name">
                    <i className="m-track-swatch" style={{ background: sectionColor(m.label) }} />
                    {sectionTitle(m.label)}
                  </span>
                  {/* Type the times. A section is a number you know — dragging
                      for it gave 15s blobs and two half-right Intros. */}
                  <TimeField
                    value={m.startMs}
                    label={`${sectionTitle(m.label)} start`}
                    onCommit={(ms) => void saveMarkers(withSectionTime(markers, m.id, "start", ms, durationMs))}
                  />
                  <span className="m-track-dash">–</span>
                  <TimeField
                    value={m.endMs}
                    label={`${sectionTitle(m.label)} end`}
                    onCommit={(ms) => void saveMarkers(withSectionTime(markers, m.id, "end", ms, durationMs))}
                  />
                  <button
                    type="button"
                    className="m-track-x"
                    aria-label={`Remove ${sectionTitle(m.label)}`}
                    onClick={() => void saveMarkers(markers.filter((x) => x.id !== m.id))}
                  >
                    ×
                  </button>
                </li>
              ))}
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
