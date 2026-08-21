"use client";

import { useEffect, useRef, useState } from "react";
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
  findSongCarrierBeatId,
  MUSIC_VIDEO_SLICE_DEFAULT,
  plateLabel,
} from "@/lib/musicVideoSong";
import {
  cookPendingSongCuts,
  pendingSongCuts,
  songCookFlagOn,
} from "@/lib/songCutCook";

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

  async function parkPlate(shotId: string) {
    setBusy("park");
    setNote("");
    try {
      await songAction("assign", {
        shotId,
        count: clampPlateSliceCount(counts[shotId] ?? MUSIC_VIDEO_SLICE_DEFAULT),
      });
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

  const cuts = song?.cuts || [];
  const done = cuts.filter((c) => c.status === "done" && c.clipFile).length;
  const label = song?.fileName
    ? songWindowLabel(song.durationSec, cuts)
    : "Drop the song, then park N × 15s on each plate. Same plate can come back later.";

  return (
    <div className="scratch-song">
      <div className="scratch-song-title">Music video — song cuts</div>
      <p className="scratch-song-clock">{label}</p>
      {note ? <p className="scratch-song-parked">{note}</p> : null}
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
            return (
              <li key={s.shotId} className="scratch-song-cut">
                <span className="scratch-song-cut-n">{i + 1}</span>
                <span className="scratch-song-cut-meta">{name}</span>
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
                <MobilePrimaryButton
                  size="chip"
                  tone="ghost"
                  disabled={Boolean(busy)}
                  onClick={() => void parkPlate(s.shotId)}
                >
                  {busy === "park" ? "Parking…" : `Park ${n} × 15s`}
                </MobilePrimaryButton>
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
            const status =
              cut.status === "done"
                ? " · done"
                : cut.status === "error"
                  ? ` · ${cut.error || "fail"}`
                  : cut.status === "running"
                    ? " · cooking"
                    : " · parked";
            return (
              <li key={cut.id} className={`scratch-song-cut is-${cut.status || "pending"}`}>
                <span className="scratch-song-cut-n">{i + 1}</span>
                <span className="scratch-song-cut-meta">
                  {plateLabel(story, cut.shotId || "", i + 1)} · {formatSongClock(cut.startSec)} ·{" "}
                  {cut.durationSec}s{status}
                </span>
                {cut.clipFile ? (
                  <button type="button" onClick={() => setPlaying(mobileClipSrc(job, cut.clipFile || ""))}>
                    Play
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    if (!cut.id) return;
                    void songAction("remove", { cutId: cut.id }).catch((e) =>
                      setNote(e instanceof Error ? e.message : "Couldn't remove"),
                    );
                  }}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}
      {song?.stitchedFile ? (
        <div>
          <p className="scratch-song-done">Stitched: {song.stitchedFile}</p>
          <button type="button" onClick={() => setPlaying(mobileClipSrc(job, song.stitchedFile || ""))}>
            Play stitch
          </button>
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
