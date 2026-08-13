"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import { Btn } from "@/components/ui";
import type { CrashVoiceSlot } from "@/lib/crashVoice";
import {
  defaultCrashVoicePrompt,
  matchPresetCharacter,
} from "@/lib/crashVoicePrompt";
import type { ShowStylePreset } from "@/lib/showStylePresets";
import type { SwapResultLabel } from "@/lib/swapCards";
import type { VoiceAttempt } from "@/lib/types";
import {
  payloadFromImageUrl,
  readPlateDrag,
  writePlateDrag,
} from "@/lib/crashPlateDrag";
import {
  pickVoiceHeroStill,
  type VoiceCastRow,
} from "@/lib/resolveVoiceCast";
import { dispatchVoiceSaved } from "@/lib/crashStyleSync";
import {
  addScriptDeskCastKey,
  clearScriptDeskCastKeys,
  removeScriptDeskCastKey,
} from "@/lib/crashScriptFields";

type Props = {
  preset: ShowStylePreset;
  voiceCast: VoiceCastRow[];
  thumbVersion: number;
  swapResults: Record<string, SwapResultLabel>;
  swapVersion: number;
  targetGenFile: string;
  plateLabel?: string;
  onContinueStory?: () => void;
  variant?: "inline" | "panel";
  /** When true, cast rows come from Script desk tray — can Remove / Clear. */
  castRemovable?: boolean;
  /** Drag Character face into empty Voice tray. */
  allowFaceDrop?: boolean;
};

function VoiceAudioControls({
  src,
  compact = false,
  label = "sample",
}: {
  src: string;
  compact?: boolean;
  label?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const playable = Boolean(src?.trim());

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [src]);

  useEffect(() => {
    setPlaying(false);
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
  }, [src]);

  function togglePlay(e?: React.MouseEvent) {
    e?.stopPropagation();
    const el = audioRef.current;
    if (!el || !playable) return;
    if (playing) {
      el.pause();
      return;
    }
    void el.play().catch(() => {
      /* empty / 404 src — never bubble NotSupportedError */
    });
  }

  function stop(e?: React.MouseEvent) {
    e?.stopPropagation();
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setPlaying(false);
  }

  if (!playable) {
    return (
      <span
        className={`shrink-0 text-[9px] text-[var(--mute)] ${
          compact ? "px-1" : ""
        }`}
        title="No sample yet"
      >
        no sample
      </span>
    );
  }

  if (compact) {
    return (
      <div className="flex shrink-0 gap-0.5">
        <button
          type="button"
          aria-label={playing ? `Pause ${label}` : `Play ${label}`}
          title={playing ? "Pause" : "Play"}
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-[var(--acid)] bg-[var(--acid)]/15 text-[10px] text-[var(--acid)] hover:bg-[var(--acid)]/25"
          onClick={togglePlay}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          type="button"
          aria-label={`Stop ${label}`}
          title="Stop"
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-[var(--line)] bg-[var(--panel)] text-[10px] text-[var(--chrome-dim)] hover:border-[var(--magenta-hot)] hover:text-[var(--magenta-hot)]"
          onClick={stop}
        >
          ■
        </button>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio ref={audioRef} src={src} preload="none" className="hidden" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 gap-1">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-sm border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-[10px] text-[var(--chrome)] hover:border-[var(--acid)] hover:text-[var(--acid)]"
        onClick={togglePlay}
      >
        <span className="text-sm leading-none">{playing ? "❚❚" : "▶"}</span>
        {playing ? "Pause" : "Play sample"}
      </button>
      <button
        type="button"
        className="shrink-0 rounded-sm border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-[10px] text-[var(--chrome-dim)] hover:border-[var(--magenta-hot)] hover:text-[var(--magenta-hot)]"
        onClick={stop}
      >
        Stop
      </button>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="none" className="hidden" />
    </div>
  );
}

function StripPlayBtn({ src, label }: { src: string; label: string }) {
  return <VoiceAudioControls src={src} compact label={label} />;
}

function VoiceCastDetail({
  cast,
  preset,
  slot,
  defaultPrompt,
  onRefresh,
  onClose,
}: {
  cast: VoiceCastRow;
  preset: ShowStylePreset;
  slot: CrashVoiceSlot | null;
  defaultPrompt: string;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [voiceDesc, setVoiceDesc] = useState(
    slot?.voiceDescription || defaultPrompt,
  );
  const [pasteVoiceId, setPasteVoiceId] = useState(
    slot?.approvedVoiceId || "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listenId, setListenId] = useState(slot?.approvedAttemptId || "");

  useEffect(() => {
    setVoiceDesc(slot?.voiceDescription || defaultPrompt);
    setPasteVoiceId(slot?.approvedVoiceId || "");
    if (slot?.approvedAttemptId) {
      setListenId(slot.approvedAttemptId);
    } else {
      const pending = (slot?.attempts ?? []).filter(
        (a) => a.status !== "rejected" && a.fileName,
      );
      setListenId(pending[0]?.id || "");
    }
  }, [
    cast.key,
    slot?.voiceDescription,
    slot?.approvedVoiceId,
    slot?.approvedAttemptId,
    slot?.attempts,
    defaultPrompt,
  ]);

  const attempts = slot?.attempts ?? [];
  const pendingAttempts = attempts.filter((a) => a.status !== "rejected");
  /** Latest gen batch — up to 3 pending takes to Approve / Reject. */
  const takeBatch = pendingAttempts
    .filter((a) => a.status === "pending" && a.fileName)
    .slice(0, 3);
  const listen =
    pendingAttempts.find((a) => a.id === listenId) ||
    pendingAttempts.find((a) => a.status === "approved") ||
    takeBatch[0] ||
    pendingAttempts[0];
  const locked = Boolean(slot?.approvedAttemptId);
  const approvedAttempt = slot?.approvedAttemptId
    ? attempts.find((a) => a.id === slot.approvedAttemptId)
    : undefined;
  const hasLockedSample = Boolean(
    approvedAttempt?.fileName?.trim() || slot?.keeperSaved,
  );
  /** Locked Play always = approved sample (same as strip ▶). Not a random pending take. */
  const lockedPlaySrc =
    locked && slot?.approvedAttemptId && hasLockedSample
      ? `/api/crash/voice/file?styleId=${encodeURIComponent(preset.id)}&castKey=${encodeURIComponent(cast.key)}&attemptId=${encodeURIComponent(slot.approvedAttemptId)}`
      : null;
  const sampleSrc =
    lockedPlaySrc ||
    (listen?.fileName
      ? `/api/crash/voice/file?styleId=${encodeURIComponent(preset.id)}&castKey=${encodeURIComponent(cast.key)}&attemptId=${encodeURIComponent(listen.id)}`
      : null);

  async function genVoice() {
    if (!voiceDesc.trim() || locked) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crash/voice/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId: preset.id,
          castKey: cast.key,
          castName: cast.name,
          voiceDescription: voiceDesc.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gen voice failed");
      const newest = [...(data.slot?.attempts || [])].find(
        (v: VoiceAttempt) => v.fileName,
      );
      if (newest?.id) setListenId(newest.id);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gen voice failed");
    } finally {
      setBusy(false);
    }
  }

  async function keepVoice(attemptId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crash/voice/keep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId: preset.id,
          castKey: cast.key,
          attemptId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lock failed");
      setListenId(attemptId);
      onRefresh();
      dispatchVoiceSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lock failed");
    } finally {
      setBusy(false);
    }
  }

  async function unlockVoice() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crash/voice/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId: preset.id,
          castKey: cast.key,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unlock failed");
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  }

  async function lockPastedVoiceId() {
    const voiceId = pasteVoiceId.trim();
    if (!voiceId) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crash/voice/set-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId: preset.id,
          castKey: cast.key,
          castName: cast.name,
          voiceId,
          voiceDescription: voiceDesc.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lock voice ID failed");
      if (data.slot?.approvedAttemptId) {
        setListenId(data.slot.approvedAttemptId);
      }
      onRefresh();
      dispatchVoiceSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lock voice ID failed");
    } finally {
      setBusy(false);
    }
  }

  async function genLockedSample() {
    if (!locked) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crash/voice/sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId: preset.id,
          castKey: cast.key,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gen sample failed");
      if (data.slot?.approvedAttemptId) {
        setListenId(data.slot.approvedAttemptId);
      }
      onRefresh();
      dispatchVoiceSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gen sample failed");
    } finally {
      setBusy(false);
    }
  }

  async function rejectVoice(attemptId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crash/voice/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId: preset.id,
          castKey: cast.key,
          attemptId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reject failed");
      const next = (data.slot?.attempts as VoiceAttempt[] | undefined)?.find(
        (a) => a.status === "pending" && a.fileName,
      );
      setListenId(next?.id || "");
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--panel-2)]">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-2 py-1">
        <p className="text-[9px] uppercase tracking-wide text-[var(--mute)]">
          {cast.name} · voice
        </p>
        <button
          type="button"
          className="text-[9px] uppercase tracking-wide text-[var(--mute)] hover:text-[var(--chrome)]"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="crash-panel-body min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        <textarea
          rows={2}
          value={voiceDesc}
          readOnly={locked}
          onChange={(e) => setVoiceDesc(e.target.value)}
          className={`w-full resize-none rounded-sm border px-2 py-1 text-[10px] text-[var(--chrome)] ${
            locked
              ? "border-[var(--acid)]/30 bg-[var(--void)]/40"
              : "border-[var(--line)] bg-[var(--void)]"
          }`}
        />
        {sampleSrc ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="text-[11px] text-[var(--acid)] underline hover:text-[var(--chrome)]"
              onClick={() => {
                const el = document.getElementById(
                  `voice-prompt-play-${cast.key}`,
                ) as HTMLAudioElement | null;
                if (!el) return;
                void el.play().catch(() => {});
              }}
            >
              Play voice
            </button>
            <button
              type="button"
              className="text-[11px] text-[var(--fail)] underline hover:opacity-80"
              onClick={() => {
                const el = document.getElementById(
                  `voice-prompt-play-${cast.key}`,
                ) as HTMLAudioElement | null;
                if (!el) return;
                el.pause();
                el.currentTime = 0;
              }}
            >
              Stop
            </button>
            <audio
              id={`voice-prompt-play-${cast.key}`}
              src={sampleSrc}
              preload="none"
              className="hidden"
            />
          </div>
        ) : null}

        {!locked ? (
          <Btn
            tone="accent"
            className="w-full !py-1 !text-[10px]"
            disabled={busy || !voiceDesc.trim()}
            onClick={() => void genVoice()}
          >
            {busy ? "Working…" : "Gen voice"}
          </Btn>
        ) : null}

        {locked && hasLockedSample ? (
          <p className="text-center text-[10px] text-[var(--acid)]">
            Locked locally for clone later · not kept on ElevenLabs · ▶ to hear
          </p>
        ) : locked ? (
          <div className="space-y-1.5">
            <p className="text-center text-[10px] text-[var(--mute)]">
              Voice ID locked — no sample yet
            </p>
            <Btn
              tone="accent"
              className="w-full !py-1 !text-[10px]"
              disabled={busy}
              onClick={() => void genLockedSample()}
            >
              {busy ? "Working…" : "Gen sample"}
            </Btn>
          </div>
        ) : takeBatch.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[8px] uppercase tracking-wider text-[var(--mute)]">
              Takes · {takeBatch.length}/3 — Approve keeps local 10–20s sample
              (not on ElevenLabs). Reject drops that take.
            </p>
            <ul className="space-y-1">
              {takeBatch.map((a, i) => {
                const src = `/api/crash/voice/file?styleId=${encodeURIComponent(preset.id)}&castKey=${encodeURIComponent(cast.key)}&attemptId=${encodeURIComponent(a.id)}`;
                return (
                  <li
                    key={a.id}
                    className={`flex items-center gap-1.5 rounded-sm border px-1.5 py-1 ${
                      listenId === a.id
                        ? "border-[var(--acid)] bg-[var(--acid)]/10"
                        : "border-[var(--line)]"
                    }`}
                  >
                    <button
                      type="button"
                      className="shrink-0 text-[9px] text-[var(--chrome-dim)]"
                      onClick={() => setListenId(a.id)}
                    >
                      #{i + 1}
                    </button>
                    <VoiceAudioControls src={src} compact label={`take ${i + 1}`} />
                    <Btn
                      tone="accent"
                      className="!px-2 !py-0.5 !text-[8px]"
                      disabled={busy}
                      onClick={() => void keepVoice(a.id)}
                    >
                      Approve
                    </Btn>
                    <Btn
                      tone="magenta"
                      className="!px-2 !py-0.5 !text-[8px]"
                      disabled={busy}
                      onClick={() => void rejectVoice(a.id)}
                    >
                      Reject
                    </Btn>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : sampleSrc ? (
          <div className="flex gap-1.5">
            <VoiceAudioControls src={sampleSrc} />
            <Btn
              tone="accent"
              className="!px-2 !py-1 !text-[9px]"
              disabled={busy}
              onClick={() => void keepVoice(listen!.id)}
            >
              Approve
            </Btn>
            <Btn
              tone="magenta"
              className="!px-2 !py-1 !text-[9px]"
              disabled={busy}
              onClick={() => void rejectVoice(listen!.id)}
            >
              Reject
            </Btn>
          </div>
        ) : (
          <p className="text-[9px] text-[var(--mute)]">
            Gen voice → 3 takes → Approve or Reject.
          </p>
        )}

        {locked ? (
          <Btn
            tone="default"
            className="w-full !py-1 !text-[9px]"
            disabled={busy}
            onClick={() => void unlockVoice()}
          >
            Edit voice
          </Btn>
        ) : null}

        <div className="flex gap-1">
          <input
            type="text"
            value={pasteVoiceId}
            readOnly={locked}
            onChange={(e) => setPasteVoiceId(e.target.value)}
            placeholder="Paste voice ID"
            className={`min-w-0 flex-1 rounded-sm border px-2 py-1 font-mono text-[9px] text-[var(--chrome)] ${
              locked
                ? "border-[var(--acid)]/30 bg-[var(--void)]/40"
                : "border-[var(--line)] bg-[var(--void)]"
            }`}
          />
          {!locked ? (
            <Btn
              tone="accent"
              className="!px-2 !py-1 !text-[9px]"
              disabled={busy || !pasteVoiceId.trim()}
              onClick={() => void lockPastedVoiceId()}
            >
              Lock ID
            </Btn>
          ) : null}
        </div>

        {error ? (
          <p className="text-[9px] text-[var(--magenta-hot)]">{error}</p>
        ) : null}
      </div>
    </div>
  );
}

export function StyleVoicePanel({
  preset,
  voiceCast,
  thumbVersion,
  swapResults,
  swapVersion,
  targetGenFile,
  plateLabel,
  onContinueStory,
  variant = "inline",
  castRemovable = true,
  allowFaceDrop = false,
}: Props) {
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(
    null,
  );
  const [slots, setSlots] = useState<Record<string, CrashVoiceSlot>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [dropOver, setDropOver] = useState(false);

  function acceptFaceDrop(e: ReactDragEvent) {
    e.preventDefault();
    setDropOver(false);
    const payload =
      readPlateDrag(e) ||
      payloadFromImageUrl(
        e.dataTransfer.getData("text/uri-list") ||
          e.dataTransfer.getData("text/plain") ||
          "",
      );
    if (payload?.kind === "cast" && payload.thumbKey) {
      addScriptDeskCastKey(payload.thumbKey);
      setOpenKey(payload.thumbKey);
      return;
    }
    // Bare style-card URL
    const raw =
      e.dataTransfer.getData("text/uri-list") ||
      e.dataTransfer.getData("text/plain");
    const fromUrl = payloadFromImageUrl(raw.split("\n")[0]?.trim() || "");
    if (fromUrl?.kind === "cast" && fromUrl.thumbKey) {
      addScriptDeskCastKey(fromUrl.thumbKey);
      setOpenKey(fromUrl.thumbKey);
    }
  }

  const refreshVoices = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/crash/voice?styleId=${encodeURIComponent(preset.id)}`,
      );
      const data = await res.json();
      if (res.ok && data.slots) setSlots(data.slots);
    } catch {
      /* ignore */
    }
  }, [preset.id]);

  useEffect(() => {
    void refreshVoices();
  }, [refreshVoices, voiceCast]);

  useEffect(() => {
    if (openKey && !voiceCast.some((c) => c.key === openKey)) {
      setOpenKey(null);
    }
  }, [openKey, voiceCast]);

  const openCast = voiceCast.find((c) => c.key === openKey) ?? null;
  const heroCast = openCast || voiceCast[0] || null;

  // Tray Voice: show the dragged face — never leftover Margot / deep-fake plate.
  const hero = allowFaceDrop && heroCast?.key
    ? {
        src: `/api/crash/style-cards/file?styleId=${encodeURIComponent(preset.id)}&thumb=${encodeURIComponent(heroCast.key)}&v=${thumbVersion}`,
        title: heroCast.name || "Cast face",
      }
    : pickVoiceHeroStill({
        presetId: preset.id,
        swapResults,
        swapVersion,
        targetGenFile,
        voiceCast,
      });

  const lockedCount = voiceCast.filter(
    (c) => slots[c.key]?.approvedAttemptId,
  ).length;

  if (!voiceCast.length) {
    if (allowFaceDrop) {
      return (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDropOver(true);
          }}
          onDragLeave={() => setDropOver(false)}
          onDrop={acceptFaceDrop}
          className={`flex min-h-[140px] flex-1 flex-col items-center justify-center gap-2 rounded-sm border border-dashed p-4 text-center ${
            dropOver
              ? "border-[var(--acid)] bg-[var(--acid)]/10"
              : "border-[var(--line)]"
          }`}
        >
          <p className="text-[11px] text-[var(--chrome)]">
            Drag the locked face from Character here
          </p>
          <p className="text-[9px] text-[var(--mute)]">
            Then write a voice prompt → Gen voice → 3 takes → Approve / Reject
          </p>
        </div>
      );
    }
    return (
      <p className="shrink-0 text-[10px] text-[var(--mute)]">
        Pick episode cast on Script desk, then open Voice.
      </p>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col gap-1.5 overflow-hidden"
      onDragOver={
        allowFaceDrop
          ? (e) => {
              e.preventDefault();
              setDropOver(true);
            }
          : undefined
      }
      onDragLeave={allowFaceDrop ? () => setDropOver(false) : undefined}
      onDrop={allowFaceDrop ? acceptFaceDrop : undefined}
    >
      {variant === "inline" ? (
        <p className="display shrink-0 text-sm text-[var(--magenta-hot)]">Voice</p>
      ) : null}

      {allowFaceDrop && dropOver ? (
        <p className="shrink-0 rounded-sm border border-[var(--acid)] bg-[var(--acid)]/10 px-2 py-1 text-center text-[9px] text-[var(--acid)]">
          Drop face to add to Voice
        </p>
      ) : null}

      {hero ? (
        <button
          type="button"
          onClick={() => setPreview({ src: hero.src, title: hero.title })}
          className="shrink-0 overflow-hidden rounded-sm border border-[var(--line)] bg-black/40"
          title="Click to enlarge · drag plated still to Story DROP"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            draggable
            src={hero.src}
            alt=""
            className="mx-auto h-16 w-full cursor-grab object-contain object-center active:cursor-grabbing"
            onDragStart={(e) => {
              e.stopPropagation();
              const fromUrl = payloadFromImageUrl(hero.src);
              if (fromUrl?.kind === "cplate" || fromUrl?.kind === "swap") {
                writePlateDrag(e, { ...fromUrl, label: hero.title });
                return;
              }
              if (fromUrl) {
                writePlateDrag(e, fromUrl);
                return;
              }
              if (targetGenFile) {
                writePlateDrag(e, {
                  kind: "cplate",
                  styleId: preset.id,
                  fileName: targetGenFile,
                  label: hero.title,
                });
              }
            }}
          />
        </button>
      ) : null}

      <div className="flex shrink-0 items-center justify-between gap-2 px-0.5 text-[9px]">
        <span className="uppercase tracking-wide text-[var(--mute)]">
          Cast · {voiceCast.length}
        </span>
        <span className="flex items-center gap-2">
          {castRemovable && voiceCast.length > 0 ? (
            <button
              type="button"
              className="text-[var(--chrome-dim)] underline hover:text-[var(--magenta-hot)]"
              title="Drop all cast slots from this tray (files stay on disk)"
              onClick={() => {
                clearScriptDeskCastKeys();
                setOpenKey(null);
              }}
            >
              Clear cast
            </button>
          ) : null}
          <span className="text-[var(--acid)]">
            {lockedCount}/{voiceCast.length} locked
          </span>
        </span>
      </div>

      {/* Six compact strips — always visible, no scroll */}
      <ul className="shrink-0 space-y-1.5">
        {voiceCast.map((cast) => {
          const slot = slots[cast.key];
          const locked = Boolean(slot?.approvedAttemptId);
          const hasPreview = Boolean(slot?.attempts?.length);
          const isOpen = openKey === cast.key;
          const thumbSrc = cast.key
            ? `/api/crash/style-cards/file?styleId=${encodeURIComponent(preset.id)}&thumb=${encodeURIComponent(cast.key)}&v=${thumbVersion}`
            : null;
          const approved = slot?.approvedAttemptId
            ? slot.attempts?.find((a) => a.id === slot.approvedAttemptId)
            : undefined;
          const hasSample = Boolean(
            approved?.fileName?.trim() || slot?.keeperSaved,
          );
          const playSrc =
            locked && hasSample && slot?.approvedAttemptId
              ? `/api/crash/voice/file?styleId=${encodeURIComponent(preset.id)}&castKey=${encodeURIComponent(cast.key)}&attemptId=${encodeURIComponent(slot.approvedAttemptId)}`
              : null;

          return (
            <li key={cast.key}>
              <div
                className={`flex h-11 items-center gap-2.5 rounded-sm border px-2 ${
                  isOpen
                    ? "border-[var(--acid)] bg-[var(--acid)]/10"
                    : locked
                      ? "border-[var(--acid)]/40 bg-[var(--panel)]"
                      : "border-[var(--line)] bg-[var(--panel-2)]"
                }`}
              >
                {thumbSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    draggable
                    src={thumbSrc}
                    alt=""
                    title={`Drag ${cast.name} to Story shot DROP`}
                    className="h-9 w-8 shrink-0 cursor-grab rounded-sm border border-[var(--line)] object-cover object-top active:cursor-grabbing"
                    onDragStart={(e) => {
                      e.stopPropagation();
                      writePlateDrag(e, {
                        kind: "cast",
                        styleId: preset.id,
                        thumbKey: cast.key,
                        label: cast.name,
                      });
                    }}
                  />
                ) : (
                  <div className="h-9 w-8 shrink-0 rounded-sm border border-[var(--line)] bg-[var(--void)]" />
                )}
                <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--chrome)]">
                  {cast.name}
                </span>
                {!locked && hasPreview ? (
                  <span
                    className="shrink-0 text-[8px] text-[var(--magenta-hot)]"
                    title="Has preview — open to lock"
                  >
                    ●
                  </span>
                ) : null}
                {playSrc ? (
                  <StripPlayBtn src={playSrc} label={cast.name || "cast"} />
                ) : null}
                {castRemovable ? (
                  <button
                    type="button"
                    className="shrink-0 rounded-sm border border-[var(--line)] px-2 py-1 text-[9px] uppercase tracking-wide text-[var(--chrome-dim)] hover:border-[var(--magenta-hot)] hover:text-[var(--magenta-hot)]"
                    title="Remove from Voice cast tray (file stays on disk)"
                    onClick={() => {
                      removeScriptDeskCastKey(cast.key);
                      if (openKey === cast.key) setOpenKey(null);
                    }}
                  >
                    Remove
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`shrink-0 rounded-sm border px-2.5 py-1 text-[9px] uppercase tracking-wide ${
                    isOpen
                      ? "border-[var(--acid)] text-[var(--acid)]"
                      : "border-[var(--line)] text-[var(--chrome-dim)] hover:border-[var(--acid)] hover:text-[var(--acid)]"
                  }`}
                  onClick={() => setOpenKey(isOpen ? null : cast.key)}
                >
                  {isOpen ? "Close" : "Open"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Detail for whichever strip is open — scrolls inside here only */}
      {openCast ? (
        <VoiceCastDetail
          cast={openCast}
          preset={preset}
          slot={slots[openCast.key] ?? null}
          defaultPrompt={defaultCrashVoicePrompt(openCast.name || "", {
            brief: openCast.brief,
            preset: matchPresetCharacter(preset.presetCast, openCast.name),
          })}
          onRefresh={() => void refreshVoices()}
          onClose={() => setOpenKey(null)}
        />
      ) : (
        <p className="min-h-0 flex-1 px-0.5 text-[9px] leading-relaxed text-[var(--mute)]">
          Open a face → Gen voice → listen → Lock.
          {plateLabel ? ` Plate: ${plateLabel.split("·")[0]?.trim()}.` : ""}
        </p>
      )}

      <div className="shrink-0 border-t border-[var(--line)] pt-1 text-right">
        {onContinueStory ? (
          <Btn
            tone="accent"
            className="!px-2.5 !py-0.5 !text-[10px]"
            onClick={onContinueStory}
          >
            Story →
          </Btn>
        ) : null}
      </div>

      {preview ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative max-h-[92vh] max-w-[min(960px,96vw)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--chrome)]">{preview.title}</p>
              <Btn
                tone="magenta"
                className="!px-2 !py-0.5 !text-[11px]"
                onClick={() => setPreview(null)}
              >
                Close
              </Btn>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.src}
              alt={preview.title}
              className="max-h-[85vh] w-auto max-w-full rounded-sm border border-[var(--line)] object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
