"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { BeatAudioMini } from "@/components/BeatAudioMini";
import { MobilePrimaryButton, MobileTextInput, mobileCard } from "./MobileUi";
import { ThumbTile } from "./ThumbTile";
import { ZoomableStill, ZoomOverlay } from "./ZoomableStill";
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
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

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

  if (!job.shots.length) return null;
  const plateSrcFor = (fileName: string) =>
    `/api/crash/gen/file?name=${encodeURIComponent(fileName)}`;
  const openPlate = job.shots.find((s) => s.shotId === openShotId && s.plateFile && s.plateFile !== "__error__");

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
      <div
        className="mobile-scroll"
        style={{
          display: "flex",
          gap: "10px",
          overflowX: "auto",
          padding: "2px 2px 10px",
          touchAction: "pan-x pan-y",
          overscrollBehaviorX: "contain",
        }}
      >
        {job.shots.map((s, i) => {
          const failed = s.plateFile === "__error__";
          const ready = Boolean(s.plateFile && !failed);
          const src = ready ? plateSrcFor(s.plateFile) : "";
          const selected = s.shotId === openShotId;
          const place = job.scenes.find((sc) => sc.id === s.sceneId)?.placeName || "";
          const title = shotById(s.shotId)?.title || place || `Shot ${i + 1}`;
          return (
            <ThumbTile
              key={s.shotId}
              src={src}
              label={failed ? "Failed" : ready ? title : "…"}
              picked={selected}
              failed={failed}
              onClick={() => {
                if (!ready) return;
                if (selected) {
                  setZoomSrc(src);
                  return;
                }
                setOpenShotId(s.shotId);
              }}
            />
          );
        })}
      </div>
      {zoomSrc ? <ZoomOverlay src={zoomSrc} alt="Shot plate" onClose={() => setZoomSrc(null)} /> : null}

      {openShotId ? (
        <ShotLineEditor
          key={openShotId}
          styleId={job.styleId}
          folderName={job.folderName}
          jobId={job.id}
          plateSrc={openPlate?.plateFile ? plateSrcFor(openPlate.plateFile) : ""}
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
  plateSrc,
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
  plateSrc: string;
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
    <div style={{ ...mobileCard, padding: "14px", display: "flex", flexDirection: "column", gap: "14px" }}>
      {plateSrc ? (
        <ZoomableStill
          src={plateSrc}
          alt={shot.title || "Shot plate"}
          height={220}
          style={{ borderRadius: "12px" }}
        />
      ) : null}
      {shot.summary ? (
        <div style={{ fontSize: "12px", color: "var(--chrome-dim)" }}>{shot.summary}</div>
      ) : null}
      <PlateStagingEditor
        styleId={styleId}
        jobId={jobId}
        shot={shot}
        onRebuilt={onPlateRebuilt}
        onJobChange={onJobChange}
      />
      {speakingBeats.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {speakingBeats.map((beat) => (
            <BeatLineEditor
              key={beat.id}
              styleId={styleId}
              folderName={folderName}
              jobId={jobId}
              beat={beat}
              onSaved={(text, voiceFile) => onBeatSaved(beat.id, text, voiceFile)}
            />
          ))}
        </div>
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
      shot.summary?.trim() ||
      "People inhabit the place — sitting, leaning, walking, using the furniture.",
  );
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
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div
        style={{
          color: "var(--chrome-dim)",
          fontSize: "10px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Plate — who sits where
      </div>
      <MobileTextInput
        value={staging}
        onChange={setStaging}
        multiline
        rows={3}
        placeholder="Jo on the stool. Matty behind the fridge. Not both standing in the front."
        onAi={() => void plateAssist.runAssist()}
        aiBusy={plateAssist.aiBusy}
      />
      {plateAssist.aiError ? (
        <div style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>{plateAssist.aiError}</div>
      ) : null}
      <MobilePrimaryButton disabled={busy || plateAssist.aiBusy || !staging.trim()} onClick={() => void rebuild()}>
        {busy ? "Rebuilding…" : "Rebuild this plate"}
      </MobilePrimaryButton>
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
  const [open, setOpen] = useState(false);
  const lineAssist = useMobileAssist("line", styleId, () => text, setText, beat.speaker);
  const dirty = text.trim() !== beat.text.trim() || voiceFile !== (beat.voiceFile || "");
  const audioSrc = voiceFile
    ? `/api/crash/mobile/beat-audio?styleId=${encodeURIComponent(styleId)}&folderName=${encodeURIComponent(
        folderName,
      )}&beatId=${encodeURIComponent(beat.id)}&fileName=${encodeURIComponent(voiceFile)}`
    : "";

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

  const squareBtn: CSSProperties = {
    flex: "0 0 auto",
    padding: "4px 8px",
    borderRadius: "2px",
    border: "1px solid var(--line)",
    fontSize: "11px",
    fontWeight: 600,
    lineHeight: 1.2,
  };

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "2px",
        background: "var(--panel-2)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 6px",
          minHeight: "32px",
        }}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? `Hide ${beat.speaker}` : `Edit ${beat.speaker}`}
          onClick={() => setOpen((v) => !v)}
          style={{
            ...squareBtn,
            width: "22px",
            padding: 0,
            background: "transparent",
            color: "var(--acid)",
          }}
        >
          {open ? "▾" : "▸"}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "baseline",
            gap: "8px",
            padding: 0,
            border: "none",
            background: "none",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              flex: "0 0 auto",
              fontSize: "12px",
              color: "var(--acid)",
              fontWeight: 700,
            }}
          >
            {beat.speaker}
          </span>
          {!open ? (
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: "12px",
                color: "var(--chrome-dim)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {text.trim() || "—"}
            </span>
          ) : null}
        </button>
        {audioSrc ? <BeatAudioMini src={audioSrc} compact /> : null}
        <button
          type="button"
          disabled={saving || (!dirty && Boolean(voiceFile))}
          onClick={() => void save()}
          style={{
            ...squareBtn,
            background: dirty || !voiceFile ? "var(--acid)" : "transparent",
            color: dirty || !voiceFile ? "var(--void)" : "var(--chrome-dim)",
          }}
        >
          {saving ? "…" : voiceFile && !dirty ? "Ok" : "Hear"}
        </button>
      </div>
      {open ? (
        <div style={{ padding: "0 6px 6px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <MobileTextInput
            value={text}
            onChange={setText}
            multiline
            rows={2}
            sharp
            onAi={() => void lineAssist.runAssist()}
            aiBusy={lineAssist.aiBusy}
          />
          {lineAssist.aiError ? (
            <div style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>{lineAssist.aiError}</div>
          ) : null}
          {error ? <div style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>{error}</div> : null}
        </div>
      ) : error ? (
        <div style={{ padding: "0 6px 6px", fontSize: "12px", color: "var(--magenta-hot)" }}>{error}</div>
      ) : null}
    </div>
  );
}
