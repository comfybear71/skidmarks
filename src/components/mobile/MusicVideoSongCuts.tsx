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
  cutsForPlate,
  droppablePlateCuts,
  findSongCarrierBeatId,
  MUSIC_VIDEO_SLICE_DEFAULT,
  plateLabel,
  songCutTallyLine,
  tallySongCuts,
} from "@/lib/musicVideoSong";
import {
  cookPendingSongCuts,
  pendingSongCuts,
  songCookFlagOn,
} from "@/lib/songCutCook";

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
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [playing, setPlaying] = useState("");
  const [flashId, setFlashId] = useState("");
  const cutCount = useRef(job.scratchSong?.cuts?.length || 0);
  const song = job.scratchSong;
  const beatId = findSongCarrierBeatId(story, song?.fileName, plated[0]?.shotId);

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

  async function dropPlateParked(shotId: string) {
    setBusy(`drop-${shotId}`);
    setNote("Dropping parked slices — plate stays.");
    try {
      await songAction("remove-plate-parked", { shotId });
      setNote("Parked slices dropped. Plate is still there.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't drop those slices");
    } finally {
      setBusy("");
    }
  }

  async function dropOneCut(cutId: string) {
    if (!cutId) return;
    try {
      await songAction("remove", { cutId });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't remove");
    }
  }

  async function parkPlate(shotId: string) {
    const n = clampPlateSliceCount(counts[shotId] ?? MUSIC_VIDEO_SLICE_DEFAULT);
    setBusy("park");
    setNote(`Parking ${n} × 15s…`);
    try {
      await songAction("assign", {
        shotId,
        count: n,
      });
      setNote(`Parked ${n} × 15s on that plate`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't park those slices");
    } finally {
      setBusy("");
    }
  }

  async function runCuts() {
    if (cookLock.current) return;
    if (!pendingSongCuts(job).length) {
      setNote("Park 15s slices on a plate first.");
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

  useEffect(() => {
    const next = song?.cuts?.length || 0;
    if (next > cutCount.current) {
      const newest = song?.cuts?.[next - 1];
      if (newest) setFlashId(newest.id);
      const t = window.setTimeout(() => setFlashId(""), 2800);
      cutCount.current = next;
      return () => window.clearTimeout(t);
    }
    cutCount.current = next;
  }, [song?.cuts]);

  const cuts = song?.cuts || [];
  const tally = tallySongCuts(cuts);
  const cooking = cuts.find((c) => c.status === "running");
  const cookingN = cooking ? cuts.findIndex((c) => c.id === cooking.id) + 1 : 0;
  const done = cuts.filter((c) => c.status === "done" && c.clipFile).length;
  const label = song?.fileName
    ? songWindowLabel(song.durationSec, cuts)
    : "Drop the song, then Add N × 15s on each plate. Same plate can come back later.";
  const progress =
    song?.fileName && cuts.length
      ? cooking
        ? `${tally.done}/${tally.total} done · now cooking ${cookingN} · ${plateLabel(story, cooking.shotId || "", cookingN)}`
        : songCutTallyLine(tally)
      : "";

  return (
    <div className="scratch-song">
      <div className="scratch-song-title">Music video — song cuts</div>
      <p className="scratch-song-clock">{label}</p>
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
              title={`${formatSongClock(cut.startSec)} · ${cut.status || "parked"}`}
            />
          ))}
        </div>
      ) : null}
      <p className="scratch-song-hint">
        Position stays on the plate. Singer plates sing. A sax plate plays the
        instrumental — write that in Position. Leave the screen — cooking keeps
        going. You get each clip and one stitch.
      </p>
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
      {song?.fileName && plated.length ? (
        <ul className="scratch-song-cuts">
          {plated.map((s, i) => {
            const n = clampPlateSliceCount(counts[s.shotId] ?? MUSIC_VIDEO_SLICE_DEFAULT);
            const name = plateLabel(story, s.shotId, i + 1);
            const mine = cutsForPlate(cuts, s.shotId, s.plateFile);
            const mineTally = tallySongCuts(mine);
            const parkedHere = droppablePlateCuts(mine);
            const thumb = s.plateFile
              ? `/api/crash/gen/file?name=${encodeURIComponent(s.plateFile)}`
              : "";
            const row = (
                  <div className="scratch-song-cut m-song-plate-row">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="m-song-cut-thumb" src={thumb} alt="" />
                    ) : (
                      <span className="scratch-song-cut-n">{i + 1}</span>
                    )}
                    <span className="scratch-song-cut-meta">
                      {name}
                      <span className="m-song-cut-sub">
                        {mineTally.total
                          ? songCutTallyLine(mineTally)
                          : "No slices on this plate yet."}
                      </span>
                    </span>
                    {mineTally.total ? (
                      <>
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            setCounts((cur) => ({
                              ...cur,
                              [s.shotId]: clampPlateSliceCount(n - 1),
                            }))
                          }
                        >
                          −
                        </button>
                        <span className="scratch-song-cut-meta">{n} × 15s</span>
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            setCounts((cur) => ({
                              ...cur,
                              [s.shotId]: clampPlateSliceCount(n + 1),
                            }))
                          }
                        >
                          +
                        </button>
                      </>
                    ) : null}
                    <MobilePrimaryButton
                      size="chip"
                      tone="ghost"
                      disabled={Boolean(busy)}
                      onClick={() => void parkPlate(s.shotId)}
                    >
                      {busy === "park" ? "Adding…" : `Add ${n} × 15s`}
                    </MobilePrimaryButton>
                    {parkedHere.length ? (
                      <MobilePrimaryButton
                        size="chip"
                        tone="ghost"
                        busy={busy === `drop-${s.shotId}`}
                        disabled={busy.startsWith("drop-") && busy !== `drop-${s.shotId}`}
                        onClick={() => void dropPlateParked(s.shotId)}
                      >
                        {busy === `drop-${s.shotId}`
                          ? "Dropping…"
                          : `Drop parked (${parkedHere.length})`}
                      </MobilePrimaryButton>
                    ) : null}
                  </div>
            );
            return (
              <li key={s.shotId}>
                {parkedHere.length ? (
                  <SwipeDropRow
                    label="Drop parked"
                    onDrop={() => void dropPlateParked(s.shotId)}
                  >
                    {row}
                  </SwipeDropRow>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="scratch-song-actions">
        <MobilePrimaryButton
          size="chip"
          tone="ghost"
          disabled={Boolean(busy) || !cuts.length}
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
      {cuts.length ? (
        <ol className="scratch-song-cuts">
          {cuts.map((cut, i) => {
            const kind = cut.status || "pending";
            const chip =
              kind === "error"
                ? "FAIL"
                : kind === "running"
                  ? "COOKING"
                  : kind === "done"
                    ? ""
                    : "PARKED";
            const thumb = cut.plateFile
              ? `/api/crash/gen/file?name=${encodeURIComponent(cut.plateFile)}`
              : "";
            return (
              <li key={cut.id}>
                <SwipeDropRow
                  label="Drop"
                  disabled={kind === "running" && Boolean(cut.clipFile)}
                  onDrop={() => void dropOneCut(cut.id)}
                >
                  <div
                    className={`scratch-song-cut is-${kind}${flashId === cut.id ? " is-just-added" : ""}`}
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="m-song-cut-thumb" src={thumb} alt="" />
                    ) : (
                      <span className="scratch-song-cut-n">{i + 1}</span>
                    )}
                    <span className="scratch-song-cut-meta">
                      {i + 1}. {plateLabel(story, cut.shotId || "", i + 1)} · {formatSongClock(cut.startSec)} ·{" "}
                      {cut.durationSec}s
                      {kind === "error" && cut.error ? (
                        <span className="m-song-cut-sub">{cut.error}</span>
                      ) : null}
                    </span>
                    {kind === "done" || !chip ? null : (
                      <span className={`m-song-cut-chip is-${kind}`}>{chip}</span>
                    )}
                    {cut.clipFile ? (
                      <button type="button" onClick={() => setPlaying(mobileClipSrc(job, cut.clipFile || ""))}>
                        Play
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={kind === "running" && Boolean(cut.clipFile)}
                      onClick={() => void dropOneCut(cut.id)}
                    >
                      ×
                    </button>
                  </div>
                </SwipeDropRow>
              </li>
            );
          })}
        </ol>
      ) : null}
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
