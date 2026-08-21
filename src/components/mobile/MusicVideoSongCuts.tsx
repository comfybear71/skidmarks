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
  formatSongClock,
  songWindowLabel,
} from "@/lib/scratchSongWindow";
import {
  clampPlateSliceCount,
  cutsForDeskRow,
  deskRowAllDone,
  findSongCarrierBeatId,
  formatSongSpan,
  MUSIC_VIDEO_SLICE_DEFAULT,
  plateCutSpan,
  shortPlateLabel,
  songCutTallyLine,
  songDeskPlateIds,
  songDeskRowSlices,
  songOrdinal,
  tallySongCuts,
} from "@/lib/musicVideoSong";
import {
  cookPendingSongCuts,
  pendingSongCuts,
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
  const resumeCook = useRef<() => void>(() => {});
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [playing, setPlaying] = useState("");
  const song = job.scratchSong;
  const beatId = findSongCarrierBeatId(story, song?.fileName, plated[0]?.shotId);
  const cuts = song?.cuts || [];
  const cooking = Boolean(cuts.some((c) => c.status === "running") || busy === "cook");
  const listLocked = cooking || cuts.some((c) => c.status === "done");

  async function songAction(action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch("/api/crash/mobile/song", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, jobId: job.id, ...extra }),
    });
    const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
    if (data.job) onJobChange(data.job);
    return data;
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
      });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't generate those cuts");
    } finally {
      cookLock.current = false;
      setBusy("");
    }
  }
  resumeCook.current = () => {
    void runCuts();
  };

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (cookLock.current) return;
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
  const cookingCut = cuts.find((c) => c.status === "running");
  const cookingN = cookingCut ? cuts.findIndex((c) => c.id === cookingCut.id) + 1 : 0;
  const done = cuts.filter((c) => c.status === "done" && c.clipFile).length;
  const label = song?.fileName
    ? songWindowLabel(song.durationSec, cuts)
    : "Drop the song, then Add plates. − / + sets the length.";
  const progress =
    song?.fileName && cuts.length
      ? cookingCut
        ? `${tally.done}/${tally.total} done · cooking ${cookingN}`
        : songCutTallyLine(tally)
      : "";

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
          className="m-animate-meter"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={cuts.length}
          aria-valuenow={tally.done}
          aria-label="Song cut progress"
        >
          {cuts.map((cut) => (
            <span
              key={cut.id}
              className={`m-animate-meter-cell${
                cut.status === "done" ? " is-done" : ""
              }${cut.status === "error" ? " is-error" : ""}${
                cut.status === "running" ? " is-run" : ""
              }`}
              title={`${formatSongClock(cut.startSec)} · ${cut.status || "pending"}`}
            />
          ))}
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
                  disabled={skipBusy || listLocked}
                  onDrop={() => void hidePlateFromSong(s.shotId, row.listIndex)}
                >
                  <div className={`scratch-song-cut m-song-plate-row${rowDone ? " is-done" : ""}`}>
                    <div className="m-song-plate-head">
                      <div className="m-song-plate-thumb-wrap">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="m-song-cut-thumb" src={thumb} alt="" />
                        ) : (
                          <span className="scratch-song-cut-n">{i + 1}</span>
                        )}
                        <button
                          type="button"
                          className="m-song-plate-x"
                          aria-label="Take this plate off the song"
                          disabled={skipBusy || listLocked}
                          onClick={() => void hidePlateFromSong(s.shotId, row.listIndex)}
                        >
                          {skipBusy ? "…" : "×"}
                        </button>
                      </div>
                      <span className={`scratch-song-cut-meta${rowDone ? " is-done" : ""}`}>
                        {songOrdinal(i + 1)} · {n} × 15s
                        {span ? <span className="m-song-cut-clock">{span}</span> : null}
                        <span className="m-song-cut-sub">{name}</span>
                      </span>
                    </div>
                    <div className="m-song-plate-tools">
                      <button
                        type="button"
                        disabled={Boolean(busy) || listLocked}
                        onClick={() => void setRowSlices(row.listIndex, n - 1)}
                      >
                        −
                      </button>
                      <span className="scratch-song-cut-meta">{n} × 15s</span>
                      <button
                        type="button"
                        disabled={Boolean(busy) || listLocked}
                        onClick={() => void setRowSlices(row.listIndex, n + 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="m-song-plate-x-inline"
                        aria-label="Take this plate off the song"
                        disabled={skipBusy || listLocked}
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
          {busy === "cook" ? "Cooking…" : "Generate cuts"}
        </MobilePrimaryButton>
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
