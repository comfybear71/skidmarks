"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { pickLibraryVoiceId, shownVoiceId } from "@/lib/mobileVoicePick";
import type { ShowStyleId } from "@/lib/showStylePresets";

type LibraryVoice = { voiceId: string; name: string; gender?: string };

/**
 * Face card voice strip — name of the recycled library voice + a play/stop
 * chip. No "Voice" label, no Auto, no Cast+hear. Play fetches a sample
 * (pins the picker if they chose one) and swaps to stop while it runs.
 */
export function CastVoiceRow({ jobId, styleId, name }: { jobId: string; styleId: string; name: string }) {
  const [assignedId, setAssignedId] = useState("");
  const [library, setLibrary] = useState<LibraryVoice[] | null>(null);
  const [userPick, setUserPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Record<string, string>>({});
  const copiedToJob = useRef("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/crash/mobile/voices?jobId=${encodeURIComponent(jobId)}&speaker=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((data: { voices?: { cast: boolean; voiceId?: string; voiceName?: string }[]; error?: string }) => {
        if (cancelled) return;
        const row = data.voices?.[0];
        if (row) setAssignedId(row.voiceId || "");
        else setError(data.error || "Couldn't load voice status");
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load voice status");
      });
    fetch(`/api/crash/mobile/voice-library?styleId=${encodeURIComponent(styleId)}`)
      .then((r) => r.json())
      .then((data: { voices?: LibraryVoice[] }) => {
        if (!cancelled && data.voices) setLibrary(data.voices);
      })
      .catch(() => {
        /* picker just won't show a list — play still works */
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, styleId, name]);

  const picked = useMemo(() => {
    if (userPick) return userPick;
    if (!library?.length) return assignedId;
    return shownVoiceId({
      assignedId,
      speaker: name,
      styleId: styleId as ShowStyleId,
      library,
    });
  }, [assignedId, library, name, styleId, userPick]);

  const pickedName = (library || []).find((v) => v.voiceId === picked)?.name || "";

  function persistPick(voiceId: string, voiceName: string) {
    if (!voiceId) return;
    void fetch("/api/crash/mobile/voices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, speaker: name, voiceId, voiceName }),
    })
      .then((r) => r.json())
      .then(() => setAssignedId(voiceId))
      .catch(() => {
        /* Save on the line still tries the last known pick */
      });
  }

  useEffect(() => {
    if (!assignedId || !library?.length) return;
    const key = `${jobId}:${name}:${assignedId}`;
    if (copiedToJob.current === key) return;
    copiedToJob.current = key;
    const voiceName = library.find((v) => v.voiceId === assignedId)?.name || "";
    void fetch("/api/crash/mobile/voices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, speaker: name, voiceId: assignedId, voiceName }),
    }).catch(() => {
      copiedToJob.current = "";
    });
  }, [assignedId, library, jobId, name]);

  function stop() {
    const audio = audioRef.current;
    if (!audio) {
      setPlaying(false);
      return;
    }
    audio.pause();
    audio.currentTime = 0;
    setPlaying(false);
  }

  function wire(audio: HTMLAudioElement, src: string) {
    audio.onplay = () => setPlaying(true);
    audio.onpause = () => setPlaying(false);
    audio.onended = () => setPlaying(false);
    audio.src = src;
    return audio.play().catch(() => {});
  }

  async function play() {
    const voiceId =
      picked ||
      (library?.length
        ? pickLibraryVoiceId(styleId as ShowStyleId, name, library)
        : "");
    const cached = voiceId ? cacheRef.current[voiceId] : "";
    const audio = audioRef.current || new Audio();
    audioRef.current = audio;
    if (cached) {
      await wire(audio, cached);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const voiceName = (library || []).find((v) => v.voiceId === voiceId)?.name || pickedName;
      const res = await fetch("/api/crash/mobile/voice-sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          voiceId
            ? { jobId, speaker: name, voiceId, voiceName }
            : { jobId, speaker: name, voiceName },
        ),
      });
      const data = (await res.json()) as {
        error?: string;
        audioBase64?: string;
        voiceId?: string;
      };
      if (!res.ok || !data.audioBase64) throw new Error(data.error || "Couldn't get a sample");
      const locked = data.voiceId || voiceId;
      const src = `data:audio/mpeg;base64,${data.audioBase64}`;
      if (locked) {
        setAssignedId(locked);
        cacheRef.current[locked] = src;
      }
      await wire(audio, src);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't get a sample");
    } finally {
      setBusy(false);
    }
  }

  const options = [...(library || [])];
  if (picked && !options.some((v) => v.voiceId === picked)) {
    options.unshift({ voiceId: picked, name: "Chosen voice" });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flex: "1 1 auto" }}>
      {options.length ? (
        <select
          aria-label="Voice"
          value={picked}
          onChange={(e) => {
            stop();
            const voiceId = e.target.value;
            setUserPick(voiceId);
            persistPick(voiceId, options.find((v) => v.voiceId === voiceId)?.name || "");
          }}
          disabled={busy}
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            maxWidth: "160px",
            padding: "6px 8px",
            borderRadius: "2px",
            border: "1px solid var(--line)",
            background: "var(--panel-2)",
            color: "var(--chrome)",
            fontSize: "12px",
          }}
        >
          {options.map((v) => (
            <option key={v.voiceId} value={v.voiceId}>
              {v.name}
            </option>
          ))}
        </select>
      ) : (
        <span
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            fontSize: "12px",
            color: "var(--chrome-dim)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {busy ? "…" : ""}
        </span>
      )}
      <button
        type="button"
        aria-label={playing ? "Stop" : "Play"}
        disabled={busy}
        onClick={() => {
          if (playing) stop();
          else void play();
        }}
        style={{
          width: "28px",
          height: "28px",
          flex: "0 0 auto",
          padding: 0,
          borderRadius: "2px",
          border: "1px solid var(--acid)",
          background: busy ? "var(--panel-2)" : "var(--acid)",
          color: busy ? "var(--chrome-dim)" : "var(--void)",
          fontSize: playing ? "12px" : "11px",
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {busy ? "…" : playing ? "■" : "▶"}
      </button>
      {error ? (
        <span
          style={{
            fontSize: "11px",
            color: "var(--magenta-hot)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "90px",
          }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
