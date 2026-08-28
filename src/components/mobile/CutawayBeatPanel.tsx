"use client";

import { useEffect, useState } from "react";
import { MobileAudioPlayer, MobilePrimaryButton } from "./MobileUi";
import { LtxImageMotionPanel } from "@/components/mobile/ShotPromptPanels";
import {
  CUTAWAY_ACTIONS,
  CUTAWAY_SFX_MAX_SEC,
  CUTAWAY_SFX_MIN_SEC,
} from "@/lib/cutawayActions";
import {
  buildCutawayMotion,
  clearLtxMotionDraft,
  pickLtxMotionBody,
  readLtxMotionDraft,
  stripLtxLipSyncLead,
  writeLtxMotionDraft,
} from "@/lib/mobileImageMotion";
import type { CrashStoryBeat } from "@/lib/crashStoryTypes";
import type { MobileClipUnit, MobileGenJob } from "@/lib/mobileGenJob";
import type { ShowStyleId } from "@/lib/showStylePresets";
import { isMobileSavedVoiceFile } from "@/lib/mobileSavedVoice";
import { readApiJson, studioFetchError } from "@/lib/studioFetchError";

type SfxRow = { id: string; fileName: string; label: string; note?: string };

export function CutawayBeatPanel({
  styleId,
  folderName,
  jobId,
  shotId,
  lookLock,
  shotSpeakers,
  beat,
  clipStatus,
  staging,
  onSaved,
  onRemoved,
}: {
  styleId: ShowStyleId;
  folderName: string;
  jobId: string;
  shotId: string;
  lookLock: string;
  shotSpeakers: string[];
  beat: CrashStoryBeat;
  clipStatus?: MobileClipUnit["clipStatus"];
  staging: string;
  onSaved: (
    text: string,
    voiceFile: string,
    imageMotion?: string,
    job?: MobileGenJob,
  ) => void;
  onRemoved?: (beatId: string, job?: MobileGenJob, emptyBeat?: CrashStoryBeat) => void;
}) {
  const [items, setItems] = useState<SfxRow[]>([]);
  const [actionId, setActionId] = useState(
    () =>
      CUTAWAY_ACTIONS.find((a) => a.action === (beat.action || beat.text || "").trim())?.id ||
      CUTAWAY_ACTIONS[0]!.id,
  );
  const [voiceFile, setVoiceFile] = useState(
    isMobileSavedVoiceFile(beat.voiceFile) ? beat.voiceFile || "" : "",
  );
  const [motionDraft, setMotionDraftState] = useState<string | null>(() =>
    readLtxMotionDraft(jobId, beat.id),
  );
  const setMotionDraft = (v: string | null) => {
    if (v === null) clearLtxMotionDraft(jobId, beat.id);
    else writeLtxMotionDraft(jobId, beat.id, v);
    setMotionDraftState(v);
  };
  const [ltxOpen, setLtxOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const playable = Boolean(voiceFile && isMobileSavedVoiceFile(voiceFile));
  const move = CUTAWAY_ACTIONS.find((a) => a.id === actionId) || CUTAWAY_ACTIONS[0]!;
  const storedMotion = stripLtxLipSyncLead(beat.imageMotion || "");
  const defaultMotion = buildCutawayMotion({
    styleId,
    speaker: beat.speaker,
    action: move.action,
    lookLock,
    shotSpeakers,
    staging,
  });
  const motionBody = pickLtxMotionBody({
    draft: motionDraft,
    stored: storedMotion,
    defaultBody: defaultMotion,
  });
  const motionDirty = motionDraft !== null;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/crash/mobile/cutaway-sfx?styleId=${encodeURIComponent(styleId)}`)
      .then((r) => r.json())
      .then((data: { items?: SfxRow[]; error?: string }) => {
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        if (data.error) setError(data.error);
      })
      .catch((e) => {
        if (!cancelled) setError(studioFetchError(e, "Couldn't load the SFX shelf"));
      });
    return () => {
      cancelled = true;
    };
  }, [styleId]);

  async function setMove(id: string) {
    setActionId(id);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/cutaway-sfx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, beatId: beat.id, actionId: id }),
      });
      const data = await readApiJson<{
        error?: string;
        action?: string;
        imageMotion?: string;
        job?: MobileGenJob;
      }>(res);
      setMotionDraft(null);
      onSaved(data.action || move.action, voiceFile, data.imageMotion, data.job);
    } catch (e) {
      setError(studioFetchError(e, "Couldn't set that move"));
    } finally {
      setBusy(false);
    }
  }

  async function attachSfx(spxId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/cutaway-sfx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, beatId: beat.id, spxId, actionId }),
      });
      const data = await readApiJson<{
        error?: string;
        voiceFile?: string;
        action?: string;
        imageMotion?: string;
        job?: MobileGenJob;
      }>(res);
      const stamped = (data.voiceFile || "").trim();
      if (!isMobileSavedVoiceFile(stamped)) {
        throw new Error(data.error || "SFX came back without an mp3. Tap it again.");
      }
      setVoiceFile(stamped);
      setMotionDraft(null);
      onSaved(data.action || move.action, stamped, data.imageMotion, data.job);
    } catch (e) {
      setError(studioFetchError(e, "Couldn't attach that SFX"));
    } finally {
      setBusy(false);
    }
  }

  async function persistMotion(body: string) {
    const res = await fetch("/api/crash/mobile/beat-motion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, beatId: beat.id, imageMotion: body }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      imageMotion?: string;
      job?: MobileGenJob;
    };
    if (!res.ok) throw new Error(data.error || "Couldn't keep Image motion");
    const saved = stripLtxLipSyncLead((data.imageMotion as string) || body);
    onSaved(move.action, voiceFile, saved, data.job);
    return saved;
  }

  async function generateThisClip() {
    if (!playable) {
      setError("Pick a 6–10s SFX first — Play appears when the mp3 is ready.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      if (motionDraft !== null) await persistMotion(motionBody);
      const res = await fetch("/api/crash/mobile/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, approveReview: true, beatId: beat.id }),
      });
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (data.job) onSaved(move.action, voiceFile, motionBody, data.job);
    } catch (e) {
      setError(studioFetchError(e, "Couldn't start that clip"));
    } finally {
      setGenerating(false);
    }
  }

  async function removeLine() {
    setRemoving(true);
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          shotId,
          beatId: beat.id,
          action: "remove-line",
        }),
      });
      const data = await readApiJson<{
        error?: string;
        job?: MobileGenJob;
        beat?: CrashStoryBeat;
      }>(res);
      onRemoved?.(beat.id, data.job, data.beat);
    } catch (e) {
      setError(studioFetchError(e, "Couldn't remove this cutaway"));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "10px" }}>
      <div style={{ fontSize: "12px", color: "var(--chrome-dim)" }}>
        Cutaway — same still. Do not Redo Position. Pick a move, then a{" "}
        {CUTAWAY_SFX_MIN_SEC}–{CUTAWAY_SFX_MAX_SEC}s SFX so LTX has a length. Strip the
        sound in Resolve.
      </div>
      <div style={{ fontSize: "12px", color: "var(--acid)", fontWeight: 700 }}>
        {beat.speaker}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {CUTAWAY_ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={busy}
            onClick={() => void setMove(a.id)}
            style={{
              padding: "6px 8px",
              borderRadius: "2px",
              border: a.id === actionId ? "1px solid var(--acid)" : "1px solid var(--line)",
              background: a.id === actionId ? "var(--acid)" : "transparent",
              color: a.id === actionId ? "var(--bg)" : "var(--chrome)",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
      {playable ? (
        <MobileAudioPlayer
          src={`/api/crash/mobile/beat-audio?styleId=${encodeURIComponent(styleId)}&folderName=${encodeURIComponent(
            folderName,
          )}&beatId=${encodeURIComponent(beat.id)}&fileName=${encodeURIComponent(voiceFile)}`}
          onRemove={() => void removeLine()}
          removing={removing}
        />
      ) : (
        <div style={{ fontSize: "12px", color: "var(--chrome-dim)" }}>
          No SFX yet — tap one below ({CUTAWAY_SFX_MIN_SEC}–{CUTAWAY_SFX_MAX_SEC}s mp3).
        </div>
      )}
      <div style={{ display: "grid", gap: "6px" }}>
        {items.length ? (
          items.map((row) => (
            <button
              key={row.id}
              type="button"
              disabled={busy}
              onClick={() => void attachSfx(row.id)}
              style={{
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: "2px",
                border:
                  beat.spxId === row.id
                    ? "1px solid var(--acid)"
                    : "1px solid var(--line)",
                background: "transparent",
                color: "var(--chrome)",
                fontSize: "12px",
              }}
            >
              <strong>{row.label}</strong>
              {row.note ? (
                <span style={{ color: "var(--chrome-dim)" }}> — {row.note}</span>
              ) : null}
            </button>
          ))
        ) : (
          <div style={{ fontSize: "12px", color: "var(--chrome-dim)" }}>
            No SFX on this show shelf — add a {CUTAWAY_SFX_MIN_SEC}–{CUTAWAY_SFX_MAX_SEC}s
            mp3 on the SPX desk.
          </div>
        )}
      </div>
      <LtxImageMotionPanel
        open={ltxOpen}
        onToggle={() => setLtxOpen((open) => !open)}
        body={motionBody}
        onChange={(v) => setMotionDraft(v)}
        dirty={motionDirty}
        keepDisabled={busy}
        keeping={busy}
        placeholder="No dialogue. Mouth stays closed. The move only."
        onKeep={() => {
          setBusy(true);
          setError("");
          void persistMotion(motionBody)
            .then(() => setMotionDraft(null))
            .catch((e) => setError(e instanceof Error ? e.message : "Couldn't keep Image motion"))
            .finally(() => setBusy(false));
        }}
      />
      <MobilePrimaryButton
        disabled={busy || generating || removing || !playable || clipStatus === "running"}
        onClick={() => void generateThisClip()}
      >
        {generating || clipStatus === "running"
          ? "Sending…"
          : playable
            ? "Generate"
            : "Pick an SFX first"}
      </MobilePrimaryButton>
      {error ? (
        <div style={{ color: "var(--magenta-hot)", fontSize: "12px" }}>{error}</div>
      ) : null}
    </div>
  );
}
