"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MobileGenJob, MobileShotUnit } from "@/lib/mobileGenJob";
import type { CrashStoryDoc } from "@/lib/crashStoryTypes";
import {
  TRACK_ACID,
  TRACK_SECTION_LABELS,
  activeLyricLineIndex,
  coverageLine,
  formatTrackClock,
  filmstripCellAt,
  filmstripCells,
  filmstripPlayheadPx,
  filmstripRailWidth,
  lyricHoldMs,
  lyricCueFor,
  lyricLinesFrom,
  plateTimingForShot,
  sortPlateTimings,
  trackCoverage,
  withLyricCue,
  withoutLyricCue,
  type LyricCue,
  type TrackSectionLabel,
} from "@/lib/musicVideoTrack";
import { decodeWaveformPeaks } from "@/lib/decodeWaveformPeaks";
import { clearPendingSong, songChipName } from "@/lib/musicVideoStart";
import { findSongCarrierBeatId, musicVideoCreditLine } from "@/lib/musicVideoSong";

import { probeBrowserAudioDurationSec } from "@/lib/scratchSongDrop";
import { mobileLocationStillUrl } from "@/lib/mobileCandidateUrls";
import { readApiJson } from "@/lib/studioFetchError";
import { LyricsBox, SongDropRow, SongPlayer, usePendingSong } from "./MusicVideoStart";

/** Tall enough to read the bars and the plate lane on a phone. */
const TRACK_WAVE_HEIGHT = 84;

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
      ctx.fillStyle = "rgba(200, 255, 46, 0.07)";
      ctx.fillRect(x0, waveTop, bandW, waveH);
      ctx.fillStyle = "rgba(200, 255, 46, 0.55)";
      ctx.fillRect(x0, waveTop, 1, waveH);
      const label = String(m.label || "").toUpperCase();
      if (bandW > 34) {
        ctx.fillStyle = "rgba(200, 255, 46, 0.75)";
        ctx.fillText(label, x0 + 4, 2);
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
      ctx.beginPath();
      ctx.roundRect(x0 + 0.5, laneY, Math.max(2, bw - 1), laneBoxH, r);
      ctx.fillStyle = "rgba(120, 200, 255, 0.32)";
      ctx.fill();
      ctx.strokeStyle = "rgba(120, 200, 255, 0.75)";
      ctx.lineWidth = 1;
      ctx.stroke();
      if (bw > 40) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, laneY, bw - 4, laneBoxH);
        ctx.clip();
        ctx.fillStyle = "rgba(230, 245, 255, 0.92)";
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
}: {
  job: MobileGenJob;
  story: CrashStoryDoc | null;
  plated: MobileShotUnit[];
  onJobChange: (job: MobileGenJob) => void;
  /** Collapsed: the wave, the clock and the player only — no editing tools. */
  compact?: boolean;
}) {
  const song = job.scratchSong;
  const parked = usePendingSong(job.id);
  const beatId = findSongCarrierBeatId(story, song?.fileName, plated[0]?.shotId);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [playheadMs, setPlayheadMs] = useState(0);
  const [markerLabel, setMarkerLabel] = useState<TrackSectionLabel>("verse");
  const [lyricsOpen, setLyricsOpen] = useState(false);
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
  const activeLyric = activeLyricLineIndex(lyricCues, playheadMs);

  const railRef = useRef<HTMLDivElement | null>(null);
  const handScroll = useRef(0);

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

  const coverage = useMemo(
    () => trackCoverage(song?.plateTimings || job.trackDraft?.plateTimings || [], durationMs),
    [song?.plateTimings, job.trackDraft?.plateTimings, durationMs],
  );

  async function saveLyricCues(next: LyricCue[]) {
    setBusy("cues");
    setNote("");
    try {
      const updated = await trackAction("set-lyric-cues", { jobId: job.id, lyricCues: next });
      if (updated) onJobChange(updated);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't pin that line");
    } finally {
      setBusy("");
    }
  }

  const cells = useMemo(
    () =>
      filmstripCells(song?.plateTimings || job.trackDraft?.plateTimings || [], (id) => {
        const row = plateRows.find((p) => p.shotId === id);
        return row?.title || id;
      }),
    [song?.plateTimings, job.trackDraft?.plateTimings, plateRows],
  );
  const railWidth = filmstripRailWidth(durationMs);
  const onNow = filmstripCellAt(cells, playheadMs);

  // Follow the song: keep the playhead under the centre marker unless a hand
  // is on the strip.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !railWidth) return;
    if (Date.now() - handScroll.current < 1200) return;
    rail.scrollLeft = filmstripPlayheadPx(playheadMs) - rail.clientWidth / 2;
  }, [playheadMs, railWidth]);

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

  const hasSong = Boolean(song?.fileName || parked?.file);

  return (
    <div className="m-track">
      {!hasSong ? (
        <div className="m-track-empty">
          <p className="m-track-note">Add the song before you time plates.</p>
          <SongDropRow jobId={job.id} job={job} />
        </div>
      ) : (
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
          {lyricsOpen ? (
            <LyricsBox
              job={job}
              pinRail={
                lyricLines.length ? (
                  <ul className="m-track-lyric-list">
                    {lyricLines.map((line) => {
                      const cue = lyricCueFor(lyricCues, line.index);
                      return (
                        <li
                          key={line.index}
                          className={`m-track-lyric${cue ? " is-pinned" : ""}${
                            activeLyric === line.index ? " is-now" : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="m-track-lyric-text"
                            onClick={() =>
                              void saveLyricCues(withLyricCue(lyricCues, line.index, playheadMs))
                            }
                          >
                            {line.text}
                          </button>
                          {cue ? (
                            <>
                              <button
                                type="button"
                                className="m-track-lyric-at"
                                onClick={() => {
                                  setPlayheadMs(cue.atMs);
                                  if (audioRef.current) audioRef.current.currentTime = cue.atMs / 1000;
                                }}
                              >
                                {formatTrackClock(cue.atMs)}
                              </button>
                              <button
                                type="button"
                                className="m-track-x"
                                aria-label="Unpin this line"
                                onClick={() => void saveLyricCues(withoutLyricCue(lyricCues, line.index))}
                              >
                                ×
                              </button>
                            </>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null
              }
            />
          ) : null}

          {/* The player carries the clock — a second one here just doubled it. */}
          <div className="m-track-toolbar">
            {audioSrc ? (
              <SongPlayer
                src={audioSrc}
                audioRef={audioRef}
                onTime={(sec) => setPlayheadMs(Math.round(sec * 1000))}
              />
            ) : null}
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

          {!compact ? (
          <div className="m-track-marker-row">
            <select
              className="m-track-select"
              value={markerLabel}
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
                const next = [
                  ...markers,
                  {
                    id: `marker_${Date.now()}`,
                    label: markerLabel,
                    startMs: rangeStartMs,
                    endMs: rangeEndMs,
                  },
                ];
                void saveMarkers(next);
              }}
            >
              Add section
            </button>
            <span className="m-track-range">
              {formatTrackClock(rangeStartMs)} – {formatTrackClock(rangeEndMs)}
            </span>
          </div>
          ) : null}

          {!compact && markers.length ? (
            <ul className="m-track-marker-list">
              {markers.map((m) => (
                <li key={m.id}>
                  <span>{m.label}</span>
                  <span>
                    {formatTrackClock(m.startMs)} – {formatTrackClock(m.endMs)}
                  </span>
                  <button
                    type="button"
                    className="m-track-x"
                    onClick={() => void saveMarkers(markers.filter((x) => x.id !== m.id))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {coverage.songMs ? (
            <div className="m-track-cover">
              <div className="m-track-cover-bar">
                <div className="m-track-cover-fill" style={{ width: `${coverage.pct}%` }} />
              </div>
              <span className="m-track-cover-line">{coverageLine(coverage)}</span>
            </div>
          ) : null}

          {/* One line, not the sheet. It comes in from the right, fades up and
              scales, then leaves to the left — against the playhead. The full
              words live behind the LYRICS toggle, where they get pinned. */}
          {!compact && lyricLines.length ? (
            <div className="m-track-marquee">
              {activeLyric !== null ? (
                <span
                  key={activeLyric}
                  className="m-track-marquee-line"
                  style={{ animationDuration: `${lyricHoldMs(lyricCues, activeLyric)}ms` }}
                >
                  {lyricLines.find((l) => l.index === activeLyric)?.text || ""}
                </span>
              ) : (
                <span className="m-track-marquee-idle">
                  {lyricCues.length
                    ? "Play — the pinned line rides through here."
                    : "Open LYRICS, tap a line to pin it at the playhead."}
                </span>
              )}
            </div>
          ) : null}

          {/* The plates as a filmstrip on the song clock: it slides right to
              left past the playhead, the same way the words do. Drag it by
              hand to scrub; it picks the song back up when you let go. */}
          {!compact && cells.length ? (
            <div className="m-film">
              <div className="m-film-head">
                <span>Plates on the song</span>
                <span className="m-film-now">{onNow ? onNow.label : "—"}</span>
              </div>
              <div
                ref={railRef}
                className="m-film-scroll"
                onPointerDown={() => {
                  handScroll.current = Date.now();
                }}
                onScroll={() => {
                  // A hand on the strip wins for a moment, then the song has it
                  // back — otherwise the follow fights the drag.
                  if (Date.now() - handScroll.current > 1200) return;
                  handScroll.current = Date.now();
                }}
              >
                <div className="m-film-rail" style={{ width: `${railWidth}px` }}>
                  {cells.map((cell) => {
                    const row = plateRows.find((p) => p.shotId === cell.plateId);
                    const live = onNow?.plateId === cell.plateId;
                    return (
                      <button
                        type="button"
                        key={cell.plateId}
                        className={`m-film-cell${live ? " is-now" : ""}`}
                        style={{ left: `${cell.leftPx}px`, width: `${cell.widthPx}px` }}
                        onClick={() => {
                          setPlayheadMs(cell.startMs);
                          if (audioRef.current) audioRef.current.currentTime = cell.startMs / 1000;
                        }}
                      >
                        {row?.plateFile ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mobileLocationStillUrl(job, row.plateFile)} alt="" />
                        ) : (
                          <span className="m-film-cell-empty" />
                        )}
                        <span className="m-film-cell-label">{cell.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="m-film-playhead" aria-hidden="true" />
            </div>
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
          ) : job.folderName ? (
            <p className="m-track-note">Draw plates first — then drag a range and tap Use range.</p>
          ) : (
            <p className="m-track-note">Start the video — then time plates on this track.</p>
          )}
        </>
      )}
      {note ? <p className="m-track-err">{note}</p> : null}
    </div>
  );
}
