"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DeskFold, MobilePrimaryButton } from "@/components/mobile/MobileUi";
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
  clampPlateSliceCount,
  cutsForDeskRow,
  deskRowAllDone,
  expectedDeskCutCount,
  findSongCarrierBeatId,
  formatSongSpan,
  hasStuckSongCook,
  MUSIC_VIDEO_SLICE_DEFAULT,
  deskRowSongSpan,
  shortPlateLabel,
  songCutsOrderBroken,
  songDeskPlateIds,
  songDeskRowSlices,
  songOrdinal,
} from "@/lib/musicVideoSong";
import {
  askSongCookNotifyPermission,
  requestSongCookStop,
  setSongCookFlag,
  songCookFlagOn,
  songCookStopRequested,
  waitForSongCut,
} from "@/lib/songCutCook";
import { approvedCandidateFileName } from "@/lib/mobileJobReady";
import { mobilePlacePreviewUrl } from "@/lib/mobileCandidateUrls";
import { attachParkedSongToBeat } from "./MusicVideoStart";
import { peekPendingSong, takePendingSong } from "@/lib/musicVideoStart";
import {
  EMPTY_STOCK_LOOK,
  parseStockLook,
  stockLookFoldLabel,
  stockLookIsOn,
  type StockLook,
} from "@/lib/stockLook";

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
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [playing, setPlaying] = useState("");
  const [cutsOpen, setCutsOpen] = useState(false);
  const [freeLookOpen, setFreeLookOpen] = useState(false);
  const [freeLook, setFreeLook] = useState<StockLook>(() => parseStockLook(job.stockLook));

  useEffect(() => {
    setFreeLook(parseStockLook(job.stockLook));
  }, [job.stockLook?.theme, job.stockLook?.colour, job.stockLook?.types]);
  const song = job.scratchSong;
  const beatId =
    (song?.carrierBeatId || "").trim() ||
    findSongCarrierBeatId(story, song?.fileName, plated[0]?.shotId);
  const cuts = song?.cuts || [];
  /** Only lock controls while this phone is actively generating — not a hung server flag. */
  const workingNow = busy.startsWith("send-");
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

  async function saveFreeLook(next: StockLook) {
    setFreeLook(next);
    setBusy("look");
    setNote("");
    try {
      const res = await fetch("/api/crash/mobile/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-stock-look", jobId: job.id, stockLook: next }),
      });
      const raw = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (raw.job) onJobChange(raw.job);
      if (!res.ok) throw new Error(raw.error?.trim() || `Request failed (${res.status})`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't save the free look");
    } finally {
      setBusy("");
    }
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

  async function runOneCut(cutId: string) {
    const id = cutId.trim();
    if (!id) {
      setNote("Add a plate to the song first.");
      return;
    }
    if (cookLock.current) return;
    cookLock.current = true;
    cookCancel.current = false;
    askSongCookNotifyPermission();
    setBusy(`send-${id}`);
    setNote("");
    try {
      await songAction("run", { cutId: id, beatId });
      await waitForSongCut({
        jobId: job.id,
        cutId: id,
        setJob: onJobChange,
        cancelled: () => cookCancel.current || songCookStopRequested(job.id),
      });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't send that cut");
    } finally {
      cookLock.current = false;
      setBusy("");
    }
  }

  async function stopStuckCook() {
    cookCancel.current = true;
    cookLock.current = false;
    requestSongCookStop(job.id);
    setBusy("unstick");
    setNote("");
    try {
      await songAction("unstick-all");
      setSongCookFlag(job.id, false);
      setNote("Stopped. Tap a still, then Send when you like the order.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't stop that hung clip");
    } finally {
      cookLock.current = false;
      setBusy("");
    }
  }

  async function redoCut(cutId: string) {
    setBusy(`redo-${cutId}`);
    setNote("");
    try {
      await songAction("redo-cut", { cutId });
      setNote("Clip parked. Still stays. Send again when you want.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't redo that cut");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    if (!beatId || song?.fileName) return;
    if (!peekPendingSong(job.id)) return;
    let cancelled = false;
    void (async () => {
      const taken = takePendingSong(job.id);
      if (!taken) return;
      try {
        const attached = await attachParkedSongToBeat({
          jobId: job.id,
          beatId,
          pending: taken as { file: File; durationSec: number },
        });
        if (!cancelled && attached) onJobChange(attached);
      } catch (e) {
        if (!cancelled) {
          setNote(e instanceof Error ? e.message : "Couldn't attach the parked song");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [beatId, job.id, song?.fileName, onJobChange]);

  useEffect(() => {
    const songNow = jobRef.current.scratchSong;
    if (!songNow?.fileName) return;
    // Plate clocks are the song. Do not rebuild them into 1 × 15s rows.
    if ((songNow.plateTimings || []).length) return;
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
  const runningCut = cuts.find((c) => c.status === "running");

  return (
    <div className="scratch-song">
      {note ? <p className="scratch-song-parked">{note}</p> : null}
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
        <DeskFold
          label="Song list"
          count={deskPlates.length}
          open={cutsOpen}
          onToggle={() => setCutsOpen((v) => !v)}
        >
        <ul className="scratch-song-cuts">
          {deskPlates.map((row, i) => {
            const s = row.unit;
            const n = clampPlateSliceCount(rowSlices[row.listIndex] ?? MUSIC_VIDEO_SLICE_DEFAULT);
            const name = shortPlateLabel(story, s.shotId, i + 1);
            const mine = cutsForDeskRow(cuts, rowSlices, row.listIndex);
            const spanObj = deskRowSongSpan({
              cuts: mine,
              shotId: row.shotId,
              plateTimings: song?.plateTimings,
            });
            const span = spanObj ? formatSongSpan(spanObj.startSec, spanObj.endSec) : "";
            const rowDone = deskRowAllDone(mine);
            const rowRun = mine.some((c) => c.status === "running");
            const rowFail = mine.find((c) => c.status === "error");
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
                    }${rowRun ? " is-run" : ""}${rowFail ? " is-error" : ""}`}
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
                      {rowFail ? (
                        <>
                          {" "}
                          · fail
                          {rowFail.error?.trim() ? ` — ${rowFail.error.trim()}` : ""}
                        </>
                      ) : null}
                    </span>
                    <div className="m-song-plate-tools m-song-line-tools">
                      {(() => {
                        const wait = mine.find(
                          (c) => c.status !== "done" && (c.status !== "error" || !c.clipFile),
                        );
                        if (!wait?.id || rowDone) return null;
                        return (
                          <button
                            type="button"
                            disabled={Boolean(busy) || workingNow}
                            onClick={() => void runOneCut(wait.id)}
                          >
                            {busy === `send-${wait.id}` ? "Sending…" : "Send"}
                          </button>
                        );
                      })()}
                      {(() => {
                        const done = mine.find((c) => c.status === "done" && c.clipFile);
                        const fail = mine.find((c) => c.status === "error");
                        const redo = fail || done;
                        if (!redo?.id || workingNow) return null;
                        return (
                          <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => void redoCut(redo.id)}
                          >
                            {busy === `redo-${redo.id}` ? "…" : "Redo"}
                          </button>
                        );
                      })()}
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
        </DeskFold>
      ) : null}
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
      <div className="scratch-song-actions">
        {stuckCook ||
        workingNow ||
        songCookFlagOn(job.id) ||
        Boolean(runningCut) ? (
          <MobilePrimaryButton
            size="chip"
            tone="ghost"
            disabled={busy === "unstick"}
            onClick={() => void stopStuckCook()}
          >
            {busy === "unstick" ? "Stopping…" : "Stop send"}
          </MobilePrimaryButton>
        ) : null}
      </div>
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
