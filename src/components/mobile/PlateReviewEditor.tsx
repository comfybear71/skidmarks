"use client";

import { useEffect, useState } from "react";
import { MobileAiButton, MobileAudioPlayer, MobilePrimaryButton, MobileTextInput, mobileCard } from "./MobileUi";
import { useMobileAssist } from "./useMobileAssist";
import type { MobileGenJob } from "@/lib/mobileGenJob";
import type { CrashStoryBeat, CrashStoryDoc, CrashStoryShot } from "@/lib/crashStoryTypes";

async function fetchStory(styleId: string, folderName: string): Promise<CrashStoryDoc | null> {
  const res = await fetch(
    `/api/crash/story?styleId=${encodeURIComponent(styleId)}&folderName=${encodeURIComponent(folderName)}`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  return (data.story as CrashStoryDoc) || null;
}

/**
 * Plates as a horizontal thumbnail row (step 1); tap one to open its lines
 * below (step 2) — edit the text, hear it, tap Save to re-voice. Runs during
 * "review", before Animate ever queues a clip against a line nobody has
 * actually checked.
 */
export function PlateReviewEditor({
  job,
  onJobChange,
}: {
  job: MobileGenJob;
  onJobChange?: (job: MobileGenJob) => void;
}) {
  const [story, setStory] = useState<CrashStoryDoc | null>(null);
  const [loadError, setLoadError] = useState("");
  const [openShotId, setOpenShotId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStory(job.styleId, job.folderName)
      .then((s) => {
        if (cancelled) return;
        if (s) setStory(s);
        else setLoadError("Couldn't load the lines for this episode");
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load the lines for this episode");
      });
    return () => {
      cancelled = true;
    };
  }, [job.styleId, job.folderName]);

  const platedShots = job.shots.filter((s) => s.plateFile && s.plateFile !== "__error__");
  if (!platedShots.length) return null;

  const shotById = (shotId: string): CrashStoryShot | null => {
    if (!story) return null;
    for (const scene of story.scenes) {
      const shot = scene.shots.find((sh) => sh.id === shotId);
      if (shot) return shot;
    }
    return null;
  };

  return (
    <div style={{ marginBottom: "16px" }}>
      <div
        style={{
          color: "var(--chrome-dim)",
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          margin: "0 2px 8px",
        }}
      >
        Shots — tap one to stage the plate and check the line
      </div>
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", padding: "2px 2px 10px" }}>
        {platedShots.map((s) => (
          <button
            key={s.shotId}
            type="button"
            onClick={() => setOpenShotId((cur) => (cur === s.shotId ? null : s.shotId))}
            style={{
              padding: "2px",
              border: s.shotId === openShotId ? "2px solid var(--acid)" : "2px solid transparent",
              borderRadius: "2px",
              flex: "0 0 auto",
              background: "none",
              cursor: "pointer",
              lineHeight: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/crash/gen/file?name=${encodeURIComponent(s.plateFile)}`}
              alt=""
              style={{ width: "72px", height: "72px", objectFit: "cover", borderRadius: "2px", display: "block" }}
            />
          </button>
        ))}
      </div>

      {openShotId ? (
        <ShotLineEditor
          key={openShotId}
          styleId={job.styleId}
          folderName={job.folderName}
          jobId={job.id}
          shot={shotById(openShotId)}
          loading={!story && !loadError}
          error={loadError}
          onPlateRebuilt={(plateFile, staging) => {
            setStory((cur) => {
              if (!cur || !openShotId) return cur;
              return {
                ...cur,
                scenes: cur.scenes.map((sc) => ({
                  ...sc,
                  shots: sc.shots.map((sh) =>
                    sh.id === openShotId ? { ...sh, plateFile, staging } : sh,
                  ),
                })),
              };
            });
          }}
          onJobChange={onJobChange}
          onBeatSaved={(beatId, text, voiceFile) => {
            setStory((cur) => {
              if (!cur) return cur;
              return {
                ...cur,
                scenes: cur.scenes.map((sc) => ({
                  ...sc,
                  shots: sc.shots.map((sh) => ({
                    ...sh,
                    beats: sh.beats.map((b) =>
                      b.id === beatId ? { ...b, text, voiceFile } : b,
                    ),
                  })),
                })),
              };
            });
          }}
        />
      ) : null}
    </div>
  );
}

function ShotLineEditor({
  styleId,
  folderName,
  jobId,
  shot,
  loading,
  error,
  onBeatSaved,
  onPlateRebuilt,
  onJobChange,
}: {
  styleId: string;
  folderName: string;
  jobId: string;
  shot: CrashStoryShot | null;
  loading: boolean;
  error: string;
  onBeatSaved: (beatId: string, text: string, voiceFile: string) => void;
  onPlateRebuilt: (plateFile: string, staging: string) => void;
  onJobChange?: (job: MobileGenJob) => void;
}) {
  if (loading) {
    return (
      <div style={{ ...mobileCard, padding: "14px", fontSize: "13px", color: "var(--chrome-dim)" }}>
        Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ ...mobileCard, padding: "14px", fontSize: "13px", color: "var(--magenta-hot)" }}>
        {error}
      </div>
    );
  }
  if (!shot) return null;

  const speakingBeats = shot.beats.filter((b) => b.speaker.trim());

  return (
    <div style={{ ...mobileCard, padding: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <PlateStagingEditor
        styleId={styleId}
        jobId={jobId}
        shot={shot}
        onRebuilt={onPlateRebuilt}
        onJobChange={onJobChange}
      />
      {speakingBeats.length ? (
        speakingBeats.map((beat) => (
          <BeatLineEditor
            key={beat.id}
            styleId={styleId}
            folderName={folderName}
            jobId={jobId}
            beat={beat}
            onSaved={(text, voiceFile) => onBeatSaved(beat.id, text, voiceFile)}
          />
        ))
      ) : (
        <div style={{ fontSize: "13px", color: "var(--chrome-dim)" }}>
          No dialogue in this shot — plays as a held shot.
        </div>
      )}
    </div>
  );
}

function PlateStagingEditor({
  styleId,
  jobId,
  shot,
  onRebuilt,
  onJobChange,
}: {
  styleId: string;
  jobId: string;
  shot: CrashStoryShot;
  onRebuilt: (plateFile: string, staging: string) => void;
  onJobChange?: (job: MobileGenJob) => void;
}) {
  const [staging, setStaging] = useState(
    shot.staging?.trim() ||
      "Who sits, leans, presents — Jo on the bar, Matty behind it.",
  );
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const plateAssist = useMobileAssist(
    "plate",
    styleId,
    () => staging,
    setStaging,
    `${shot.title}. ${shot.summary || ""}`,
  );

  async function rebuild() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, shotId: shot.id, staging }),
      });
      const data = (await res.json()) as {
        error?: string;
        plateFile?: string;
        job?: MobileGenJob;
      };
      if (!res.ok) throw new Error(data.error || "Couldn't rebuild the plate");
      if (data.plateFile) onRebuilt(data.plateFile, staging);
      if (data.job) onJobChange?.(data.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't rebuild the plate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Hide plate notes" : "Show plate notes"}
          style={{
            flex: "0 0 auto",
            width: "22px",
            height: "28px",
            padding: 0,
            borderRadius: "2px",
            border: "1px solid var(--line)",
            background: "transparent",
            color: "var(--acid)",
            fontSize: "12px",
          }}
        >
          {open ? "▾" : "▸"}
        </button>
        <div
          style={{
            color: "var(--chrome-dim)",
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            flex: "0 0 auto",
          }}
        >
          Tweak
        </div>
        <input
          value={staging}
          onChange={(e) => setStaging(e.target.value)}
          placeholder="Who sits, leans, presents — Jo on the bar, Matty behind it"
          style={{
            flex: 1,
            minWidth: 0,
            padding: "8px",
            borderRadius: "2px",
            border: "1px solid var(--line)",
            background: "var(--panel-2)",
            color: "var(--chrome)",
            fontSize: "13px",
          }}
        />
        <MobileAiButton onClick={() => void plateAssist.runAssist()} busy={plateAssist.aiBusy} />
        <MobilePrimaryButton
          size="chip"
          disabled={busy || plateAssist.aiBusy || !staging.trim()}
          onClick={() => void rebuild()}
        >
          {busy ? "…" : "Rebuild"}
        </MobilePrimaryButton>
      </div>
      {open && shot.summary ? (
        <div style={{ fontSize: "12px", color: "var(--chrome-dim)", paddingLeft: "28px" }}>
          {shot.summary}
        </div>
      ) : null}
      {plateAssist.aiError ? (
        <div style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>{plateAssist.aiError}</div>
      ) : null}
      {error ? <div style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>{error}</div> : null}
    </div>
  );
}

function BeatLineEditor({
  styleId,
  folderName,
  jobId,
  beat,
  onSaved,
}: {
  styleId: string;
  folderName: string;
  jobId: string;
  beat: CrashStoryBeat;
  onSaved: (text: string, voiceFile: string) => void;
}) {
  const [text, setText] = useState(beat.text);
  const [voiceFile, setVoiceFile] = useState(beat.voiceFile || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lineAssist = useMobileAssist("line", styleId, () => text, setText, beat.speaker);
  const dirty = text.trim() !== beat.text.trim() || voiceFile !== (beat.voiceFile || "");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/beat-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, beatId: beat.id, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't generate voice");
      setVoiceFile(data.voiceFile);
      onSaved(text, data.voiceFile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ fontSize: "12px", color: "var(--acid)", fontWeight: 700, flex: "0 0 auto" }}>
          {beat.speaker}
        </div>
        {voiceFile ? (
          <MobileAudioPlayer
            src={`/api/crash/mobile/beat-audio?styleId=${encodeURIComponent(styleId)}&folderName=${encodeURIComponent(
              folderName,
            )}&beatId=${encodeURIComponent(beat.id)}&fileName=${encodeURIComponent(voiceFile)}`}
          />
        ) : (
          <div style={{ fontSize: "12px", color: "var(--chrome-dim)" }}>No line yet</div>
        )}
      </div>
      <MobileTextInput
        value={text}
        onChange={setText}
        multiline
        rows={2}
        onAi={() => void lineAssist.runAssist()}
        aiBusy={lineAssist.aiBusy}
      />
      {lineAssist.aiError ? (
        <div style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>{lineAssist.aiError}</div>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <MobilePrimaryButton
          size="chip"
          disabled={saving || (!dirty && Boolean(voiceFile))}
          onClick={() => void save()}
        >
          {saving ? "…" : voiceFile && !dirty ? "Saved" : "Save"}
        </MobilePrimaryButton>
        {error ? <span style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>{error}</span> : null}
      </div>
    </div>
  );
}
