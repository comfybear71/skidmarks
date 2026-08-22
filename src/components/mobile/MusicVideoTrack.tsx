"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MobileGenJob, MobileShotUnit } from "@/lib/mobileGenJob";
import type { CrashStoryDoc } from "@/lib/crashStoryTypes";
import {
  TRACK_SECTION_LABELS,
  formatTrackClock,
  plateTimingForShot,
  sortPlateTimings,
  type TrackSectionLabel,
} from "@/lib/musicVideoTrack";
import { decodeWaveformPeaks } from "@/lib/decodeWaveformPeaks";
import { findSongCarrierBeatId } from "@/lib/musicVideoSong";
import { peekPendingSong } from "@/lib/musicVideoStart";
import { probeBrowserAudioDurationSec } from "@/lib/scratchSongDrop";
import { mobileLocationStillUrl } from "@/lib/mobileCandidateUrls";
import { readApiJson } from "@/lib/studioFetchError";
import { SongDropRow } from "./MusicVideoStart";

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
  onSeek,
  onSelectRange,
}: {
  peaks: number[];
  durationMs: number;
  playheadMs: number;
  markers: { id: string; label: string; startMs: number; endMs: number }[];
  plateTimings: { plateId: string; startMs: number; endMs: number; label: string }[];
  onSeek: (ms: number) => void;
  onSelectRange: (startMs: number, endMs: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drag = useRef<{ startX: number; startMs: number } | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !peaks.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0a0a0c";
    ctx.fillRect(0, 0, w, h);

    for (const m of markers) {
      const x0 = (m.startMs / durationMs) * w;
      const x1 = (m.endMs / durationMs) * w;
      ctx.fillStyle = "rgba(180, 255, 0, 0.12)";
      ctx.fillRect(x0, 0, Math.max(2, x1 - x0), h);
    }
    for (const p of plateTimings) {
      const x0 = (p.startMs / durationMs) * w;
      const x1 = (p.endMs / durationMs) * w;
      ctx.fillStyle = "rgba(120, 200, 255, 0.18)";
      ctx.fillRect(x0, h * 0.55, Math.max(2, x1 - x0), h * 0.4);
    }

    const mid = h / 2;
    ctx.strokeStyle = "var(--acid)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    peaks.forEach((p, i) => {
      const x = (i / (peaks.length - 1)) * w;
      const y = mid - p * (h * 0.42);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    peaks.forEach((p, i) => {
      const x = (i / (peaks.length - 1)) * w;
      const y = mid + p * (h * 0.42);
      ctx.lineTo(x, y);
    });
    ctx.stroke();

    const ph = (playheadMs / durationMs) * w;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ph, 0);
    ctx.lineTo(ph, h);
    ctx.stroke();
  }, [peaks, durationMs, playheadMs, markers, plateTimings]);

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
      width={720}
      height={96}
      onPointerDown={(e) => {
        const ms = msFromEvent(e.clientX);
        drag.current = { startX: e.clientX, startMs: ms };
        onSeek(ms);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        onSeek(msFromEvent(e.clientX));
      }}
      onPointerUp={(e) => {
        if (!drag.current) return;
        const endMs = msFromEvent(e.clientX);
        const startMs = Math.min(drag.current.startMs, endMs);
        const end = Math.max(drag.current.startMs, endMs);
        drag.current = null;
        if (Math.abs(end - startMs) > 200) onSelectRange(startMs, end);
      }}
      onPointerLeave={() => {
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
}: {
  job: MobileGenJob;
  story: CrashStoryDoc | null;
  plated: MobileShotUnit[];
  onJobChange: (job: MobileGenJob) => void;
}) {
  const song = job.scratchSong;
  const parked = peekPendingSong(job.id);
  const beatId = findSongCarrierBeatId(story, song?.fileName, plated[0]?.shotId);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [playheadMs, setPlayheadMs] = useState(0);
  const [markerLabel, setMarkerLabel] = useState<TrackSectionLabel>("verse");
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

  const hasSong = Boolean(song?.fileName || parked?.file);

  return (
    <div className="m-track">
      {!hasSong ? (
        <div className="m-track-empty">
          <p className="m-track-note">Add the song before you time plates.</p>
          <SongDropRow jobId={job.id} />
        </div>
      ) : (
        <>
          <div className="m-track-toolbar">
            <span className="m-track-clock">
              {formatTrackClock(playheadMs)} / {formatTrackClock(durationMs)}
            </span>
            {audioSrc ? (
              <audio
                ref={audioRef}
                className="m-track-audio"
                src={audioSrc}
                controls
                preload="metadata"
                onTimeUpdate={() => setPlayheadMs(Math.round((audioRef.current?.currentTime || 0) * 1000))}
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

          {markers.length ? (
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

          {job.folderName && plateRows.length ? (
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
