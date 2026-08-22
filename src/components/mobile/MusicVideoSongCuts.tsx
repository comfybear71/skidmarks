"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MobilePrimaryButton } from "@/components/mobile/MobileUi";
import type { MobileGenJob } from "@/lib/mobileGenJob";
import type { CrashStoryDoc } from "@/lib/crashStoryTypes";
import type { MobileShotUnit } from "@/lib/mobileGenJob";
import { mobileClipSrc } from "@/lib/mobilePlateClips";
import { readApiJson, studioFetchError } from "@/lib/studioFetchError";
import {
  dropScratchSongViaBlob,
  probeBrowserAudioDurationSec,
  SCRATCH_SONG_DIRECT_POST_MAX_BYTES,
} from "@/lib/scratchSongDrop";
import {
  songWindowLabel,
} from "@/lib/scratchSongWindow";
import {
  clampPlateSliceCount,
  cutsForDeskRow,
  deskRowAllDone,
  expectedDeskCutCount,
  findSongCarrierBeatId,
  formatSongSpan,
  hasStuckSongCook,
  MUSIC_VIDEO_SLICE_DEFAULT,
  plateCutSpan,
  shortPlateLabel,
  songCutsOrderBroken,
  songDeskPlateIds,
  songDeskRowSlices,
  songOrdinal,
  tallySongCuts,
} from "@/lib/musicVideoSong";
import {
  cookPendingSongCuts,
  pendingSongCuts,
  setSongCookFlag,
  songCookFlagOn,
} from "@/lib/songCutCook";
import { approvedCandidateFileName } from "@/lib/mobileJobReady";
import { mobilePlacePreviewUrl } from "@/lib/mobileCandidateUrls";

function SwipeDropRow({
  children,
  onDrop,
  label = "Drop",
  disabled,
}: {
  children: ReactNode;
  onDrop: () => void;
  label?: string;
  disabled?: boolean;
}) {
  const startX = useRef<number | null>(null);
  const startY = useRef(0);
  const axis = useRef<"h" | "v" | null>(null);
  const [dx, setDx] = useState(0);
  const dxRef = useRef(0);

  function endSwipe() {
    const gone = dxRef.current <= -72;
    startX.current = null;
    axis.current = null;
    dxRef.current = 0;
    setDx(0);
    if (gone && !disabled) onDrop();
  }

  return (
    <div className="m-swipe-drop">
      <button
        type="button"
        className="m-swipe-drop-action"
        disabled={disabled}
        onClick={() => {
          if (!disabled) onDrop();
        }}
      >
        {label}
      </button>
      <div
        className="m-swipe-drop-front"
        style={{ transform: `translateX(${dx}px)` }}
        onTouchStart={(e) => {
          if (disabled) return;
          startX.current = e.touches[0].clientX;
          startY.current = e.touches[0].clientY;
          axis.current = null;
        }}
        onTouchMove={(e) => {
          if (startX.current == null) return;
          const x = e.touches[0].clientX - startX.current;
          const y = e.touches[0].clientY - startY.current;
          if (!axis.current) {
            if (Math.abs(x) < 10 && Math.abs(y) < 10) return;
            axis.current = Math.abs(x) > Math.abs(y) * 1.2 ? "h" : "v";
          }
          if (axis.current !== "h") return;
          const next = Math.max(-120, Math.min(0, x));
          dxRef.current = next;
          setDx(next);
        }}
        onTouchEnd={endSwipe}
        onTouchCancel={endSwipe}
      >
        {children}
      </div>
    </div>
  );
}

export function MusicVideoSongCuts({
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
  const jobRef = useRef(job);
  jobRef.current = job;
  const cookLock = useRef(false);
  const cookCancel = useRef(false);
  const resumeCook = useRef<() => void>(() => {});
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [playing, setPlaying] = useState("");
  const song = job.scratchSong;
  const beatId = findSongCarrierBeatId(story, song?.fileName, plated[0]?.shotId);
  const cuts = song?.cuts || [];
  /** Only lock controls while this phone is actively generating — not a hung server flag. */
  const workingNow = busy === "cook";
  const timesLocked = workingNow || cuts.some((c) => c.status === "done");
  const stuckCook = hasStuckSongCook(cuts);

  async function songAction(action: string, extra: Record<string, unknown> = {}) {
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
    if (!res.ok) {
      throw new Error(raw.error?.trim() || `Request failed (${res.status})`);
    }
    return raw;
  }

  async function dropSong(file: File) {
    if (!beatId) {
      setNote("Lock the episode and draw a plate first.");
      return;
    }
    setBusy("song");
    setNote("");
    try {
      const durationSec = await probeBrowserAudioDurationSec(file);
      if (file.size > SCRATCH_SONG_DIRECT_POST_MAX_BYTES) {
        const data = await dropScratchSongViaBlob({
          jobId: job.id,
          beatId,
          file,
          durationSec,
        });
        if (data.job) onJobChange(data.job);
        return;
      }
      const form = new FormData();
      form.set("jobId", job.id);
      form.set("beatId", beatId);
      form.set("file", file, file.name || "song.mp3");
      let res: Response;
      try {
        res = await fetch("/api/crash/mobile/beat-audio/upload", { method: "POST", body: form });
      } catch (e) {
        throw new Error(studioFetchError(e, "Couldn't take that mp3"));
      }
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (data.job) onJobChange(data.job);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't take that mp3");
    } finally {
      setBusy("");
    }
  }

  async function hidePlateFromSong(shotId: string, listIndex: number) {
    setBusy(`skip-${listIndex}`);
    setNote("");
    try {
      await songAction("skip-plate", { shotId, listIndex });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't take that plate off the song");
    } finally {
      setBusy("");
    }
  }

  async function setRowSlices(listIndex: number, count: number) {
    setBusy(`slice-${listIndex}`);
    setNote("");
    try {
      await songAction("set-row-slices", { listIndex, count });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't set that length");
    } finally {
      setBusy("");
    }
  }

  async function runCuts() {
    if (cookLock.current) return;
    if (!pendingSongCuts(job).length) {
      setNote("Add a plate to the song first.");
      return;
    }
    cookLock.current = true;
    cookCancel.current = false;
    setBusy("cook");
    setNote("");
    try {
      await cookPendingSongCuts({
        jobId: job.id,
        getJob: () => jobRef.current,
        setJob: onJobChange,
        runCut: (cutId) => songAction("run", { cutId, beatId }),
        unstickCut: (cutId) => songAction("unstick", { cutId }),
        onNote: setNote,
        cancelled: () => cookCancel.current,
      });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't generate those cuts");
    } finally {
      cookLock.current = false;
      setBusy("");
    }
  }

  async function stopStuckCook() {
    cookCancel.current = true;
    cookLock.current = false;
    setSongCookFlag(job.id, false);
    setBusy("unstick");
    setNote("");
    try {
      await songAction("unstick-all");
      setSongCookFlag(job.id, false);
      setNote("Stopped. List matches the desk again.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't stop that hung clip");
    } finally {
      cookLock.current = false;
      setBusy("");
    }
  }

  resumeCook.current = () => {
    void runCuts();
  };

  useEffect(() => {
    const songNow = jobRef.current.scratchSong;
    if (!songNow?.fileName) return;
    const onList = songDeskPlateIds(songNow);
    const slices = songDeskRowSlices(songNow, onList);
    const expected = expectedDeskCutCount(slices);
    const cutN = (songNow.cuts || []).length;
    const ghostOrStuck =
      hasStuckSongCook(songNow.cuts || []) ||
      (cutN > 0 && cutN !== expected) ||
      (cutN > 0 && songCutsOrderBroken(songNow.cuts || [], onList, slices));
    if (!ghostOrStuck) return;
    let cancelled = false;
    setSongCookFlag(job.id, false);
    cookCancel.current = true;
    void (async () => {
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
        if (cancelled) return;
        if (raw.job) onJobChange(raw.job);
        if (res.ok) setNote("Fixed cut order so the list matches the song clock.");
      } catch {
        /* leave desk as-is; Stop still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job.id, onJobChange]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (cookLock.current) return;
      if (cookCancel.current) return;
      const pending = pendingSongCuts(jobRef.current);
      if (!pending.length) return;
      if (!songCookFlagOn(job.id) && !pending.some((c) => c.status === "running")) return;
      resumeCook.current();
    };
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [job.id]);

  const onSong = songDeskPlateIds(song);
  const rowSlices = songDeskRowSlices(song, onSong);
  const platedById = new Map(plated.map((s) => [s.shotId, s]));
  const deskPlates = onSong
    .map((shotId, listIndex) => {
      const unit = platedById.get(shotId);
      if (!unit) return null;
      return { unit, listIndex, shotId };
    })
    .filter((row): row is { unit: MobileShotUnit; listIndex: number; shotId: string } => Boolean(row));
  const tally = tallySongCuts(cuts);
  const runningCut = cuts.find((c) => c.status === "running");
  const done = cuts.filter((c) => c.status === "done" && c.clipFile).length;
  const label = song?.fileName
    ? songWindowLabel(song.durationSec, cuts)
    : "Drop the song, then Add plates. − / + sets the length.";
  const progress =
    song?.fileName && cuts.length ? `${tally.done}/${tally.total}` : "";
  const progressPct = cuts.length ? Math.round((tally.done / cuts.length) * 100) : 0;

  return (
    <div className="scratch-song">
      <div className="scratch-song-title">Music video — song cuts</div>
      <p className="scratch-song-clock">{label}</p>
      {song?.fileName ? (
        beatId ? (
          <a
            className="scratch-song-mp3"
            href={
              `/api/crash/mobile/beat-audio?styleId=${encodeURIComponent(job.styleId)}` +
              `&folderName=${encodeURIComponent(job.folderName || job.id)}` +
              `&beatId=${encodeURIComponent(beatId)}` +
              `&fileName=${encodeURIComponent(song.fileName)}`
            }
          >
            Song · {song.fileName}
          </a>
        ) : (
          <p className="scratch-song-mp3">Song · {song.fileName}</p>
        )
      ) : null}
      {progress ? <p className="scratch-song-parked">{progress}</p> : null}
      {note ? <p className="scratch-song-parked">{note}</p> : null}
      {cuts.length ? (
        <div
          className="m-song-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPct}
          aria-label="Song cut progress"
        >
          <div className="m-song-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      ) : null}
      {!song?.fileName ? (
        <label className="scratch-song-hint" style={{ display: "block" }}>
          Drop the song mp3
          <input
            type="file"
            accept="audio/mpeg,audio/mp3,.mp3"
            disabled={Boolean(busy) || !beatId}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void dropSong(file);
            }}
          />
        </label>
      ) : null}
      {song?.fileName && deskPlates.length ? (
        <ul className="scratch-song-cuts">
          {deskPlates.map((row, i) => {
            const s = row.unit;
            const n = clampPlateSliceCount(rowSlices[row.listIndex] ?? MUSIC_VIDEO_SLICE_DEFAULT);
            const name = shortPlateLabel(story, s.shotId, i + 1);
            const mine = cutsForDeskRow(cuts, rowSlices, row.listIndex);
            const spanObj = plateCutSpan(mine);
            const span = spanObj ? formatSongSpan(spanObj.startSec, spanObj.endSec) : "";
            const rowDone = deskRowAllDone(mine);
            const rowRun = mine.some((c) => c.status === "running");
            const rowDoneN = mine.filter((c) => c.status === "done" && c.clipFile).length;
            const rowPct = mine.length ? Math.round((rowDoneN / mine.length) * 100) : 0;
            const placeScene = job.scenes.find((sc) => sc.id === s.sceneId);
            const placeFile = approvedCandidateFileName(job.locationCandidates, s.sceneId) || "";
            const thumb = s.plateFile
              ? `/api/crash/gen/file?name=${encodeURIComponent(s.plateFile)}`
              : mobilePlacePreviewUrl(job, {
                  fileName: placeFile,
                  worldThumbKey: placeScene?.worldThumbKey || "",
                });
            const skipBusy = busy === `skip-${row.listIndex}`;
            const sliceBusy = busy === `slice-${row.listIndex}`;
            return (
              <li key={`${s.shotId}-${row.listIndex}`}>
                <SwipeDropRow
                  label="Leave song"
                  disabled={skipBusy || workingNow}
                  onDrop={() => void hidePlateFromSong(s.shotId, row.listIndex)}
                >
                  <div
                    className={`scratch-song-cut m-song-plate-row m-song-plate-line${
                      rowDone ? " is-done" : ""
                    }${rowRun ? " is-run" : ""}`}
                    style={{ ["--row-progress" as string]: `${rowPct}%` }}
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="m-song-cut-thumb m-song-line-thumb" src={thumb} alt="" />
                    ) : (
                      <span className="scratch-song-cut-n">{i + 1}</span>
                    )}
                    <span className={`scratch-song-cut-meta m-song-line-meta${rowDone ? " is-done" : ""}`}>
                      {songOrdinal(i + 1)} · {n} × 15s
                      {span ? <> · {span}</> : null}
                      <> · {name}</>
                    </span>
                    <div className="m-song-plate-tools m-song-line-tools">
                      <button
                        type="button"
                        disabled={Boolean(busy) || timesLocked}
                        onClick={() => void setRowSlices(row.listIndex, n - 1)}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(busy) || timesLocked}
                        onClick={() => void setRowSlices(row.listIndex, n + 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="m-song-plate-x-inline"
                        aria-label="Take this plate off the song"
                        disabled={skipBusy || workingNow}
                        onClick={() => void hidePlateFromSong(s.shotId, row.listIndex)}
                      >
                        {skipBusy || sliceBusy ? "…" : "×"}
                      </button>
                    </div>
                  </div>
                </SwipeDropRow>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="scratch-song-actions">
        <MobilePrimaryButton
          size="chip"
          tone="ghost"
          disabled={Boolean(busy) || !cuts.length || !pendingSongCuts(job).length}
          onClick={() => void runCuts()}
        >
          {busy === "cook"
            ? runningCut
              ? `${tally.done}/${tally.total}`
              : "Working…"
            : "Generate cuts"}
        </MobilePrimaryButton>
        {stuckCook || workingNow ? (
          <MobilePrimaryButton
            size="chip"
            tone="ghost"
            disabled={busy === "unstick"}
            onClick={() => void stopStuckCook()}
          >
            {busy === "unstick" ? "Stopping…" : "Stop"}
          </MobilePrimaryButton>
        ) : null}
        <MobilePrimaryButton
          size="chip"
          tone="ghost"
          disabled={Boolean(busy) || done < 2}
          onClick={() => {
            setBusy("stitch");
            setNote("");
            void songAction("stitch")
              .catch((e) => setNote(e instanceof Error ? e.message : "Couldn't stitch"))
              .finally(() => setBusy(""));
          }}
        >
          {busy === "stitch" ? "Stitching…" : "Stitch song"}
        </MobilePrimaryButton>
      </div>
      {song?.stitchedFile ? (
        <div>
          <p className="scratch-song-done">Stitched: {song.stitchedFile}</p>
          <div className="scratch-song-actions">
            <button type="button" onClick={() => setPlaying(mobileClipSrc(job, song.stitchedFile || ""))}>
              Play stitch
            </button>
            <MobilePrimaryButton
              size="chip"
              tone="ghost"
              busy={busy === "drop-stitch"}
              onClick={() => {
                setBusy("drop-stitch");
                setNote("");
                void songAction("remove-stitch")
                  .then(() => setNote("Stitch parked. Song and plates are still there."))
                  .catch((e) => setNote(e instanceof Error ? e.message : "Couldn't drop the stitch"))
                  .finally(() => setBusy(""));
              }}
            >
              {busy === "drop-stitch" ? "Dropping…" : "Drop stitch"}
            </MobilePrimaryButton>
          </div>
        </div>
      ) : null}
      {playing ? (
        <video
          key={playing}
          src={playing}
          controls
          autoPlay
          playsInline
          style={{ width: "100%", marginTop: "8px", background: "#000" }}
        />
      ) : null}
    </div>
  );
}
