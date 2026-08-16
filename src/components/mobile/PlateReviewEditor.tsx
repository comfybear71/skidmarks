"use client";

import { useEffect, useState } from "react";
import { MobileAiButton, MobileAudioPlayer, MobilePrimaryButton, MobileTextInput, mobileCard } from "./MobileUi";
import { useMobileAssist } from "./useMobileAssist";
import type { MobileGenJob } from "@/lib/mobileGenJob";
import type { CrashStoryBeat, CrashStoryDoc, CrashStoryShot } from "@/lib/crashStoryTypes";

/** A shot minted by the "+" solo-card picker: exactly one beat, and its
 * speaker is the shot's whole title. Original script shots never look like
 * this, so it's a safe way to tell "test card" apart without new state. */
function isSoloTestShot(shot: CrashStoryShot | null | undefined): boolean {
  if (!shot) return false;
  return shot.beats.length === 1 && shot.title.trim() === (shot.beats[0]?.speaker || "").trim();
}

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addBusySpeaker, setAddBusySpeaker] = useState<string | null>(null);
  const [addError, setAddError] = useState("");

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

  const shots = job.shots;
  if (!shots.length && !story) return null;

  const shotById = (shotId: string): CrashStoryShot | null => {
    if (!story) return null;
    for (const scene of story.scenes) {
      const shot = scene.shots.find((sh) => sh.id === shotId);
      if (shot) return shot;
    }
    return null;
  };

  function defaultSceneId(): string | null {
    if (!story) return null;
    if (openShotId) {
      const sc = story.scenes.find((s) => s.shots.some((sh) => sh.id === openShotId));
      if (sc) return sc.id;
    }
    if (shots.length) {
      const lastSceneId = shots[shots.length - 1].sceneId;
      if (story.scenes.some((s) => s.id === lastSceneId)) return lastSceneId;
    }
    return story.scenes[0]?.id || null;
  }

  const soloShotSpeakers = new Set(
    shots
      .map((s) => shotById(s.shotId))
      .filter(isSoloTestShot)
      .map((sh) => (sh as CrashStoryShot).title.trim()),
  );

  async function addSoloShot(speaker: string) {
    const sceneId = defaultSceneId();
    if (!sceneId) {
      setAddError("No location yet — build one first.");
      return;
    }
    setAddError("");
    setAddBusySpeaker(speaker);
    try {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, action: "add", sceneId, speaker }),
      });
      const data = (await res.json()) as { error?: string; job?: MobileGenJob; shotId?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't add that card");
      const fresh = await fetchStory(job.styleId, job.folderName);
      if (fresh) setStory(fresh);
      if (data.job) onJobChange?.(data.job);
      if (data.shotId) setOpenShotId(data.shotId);
      setPickerOpen(false);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Couldn't add that card");
    } finally {
      setAddBusySpeaker(null);
    }
  }

  async function removeShot(shotId: string) {
    try {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, shotId, action: "remove" }),
      });
      const data = (await res.json()) as { error?: string; job?: MobileGenJob };
      if (!res.ok) throw new Error(data.error || "Couldn't remove that card");
      setStory((cur) => {
        if (!cur) return cur;
        return {
          ...cur,
          scenes: cur.scenes.map((sc) => ({ ...sc, shots: sc.shots.filter((sh) => sh.id !== shotId) })),
        };
      });
      if (openShotId === shotId) setOpenShotId(null);
      if (data.job) onJobChange?.(data.job);
    } catch {
      /* card stays until the next job refresh */
    }
  }

  async function dropPlate(shotId: string) {
    try {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, shotId, action: "drop" }),
      });
      const data = (await res.json()) as { error?: string; job?: MobileGenJob };
      if (!res.ok) throw new Error(data.error || "Couldn't park that plate");
      setStory((cur) => {
        if (!cur) return cur;
        return {
          ...cur,
          scenes: cur.scenes.map((sc) => ({
            ...sc,
            shots: sc.shots.map((sh) => (sh.id === shotId ? { ...sh, plateFile: "" } : sh)),
          })),
        };
      });
      if (data.job) onJobChange?.(data.job);
    } catch {
      /* strip stays until the next job refresh */
    }
  }

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
        Shots — tap one, Tweak position, Rebuild. Tap the picture to inspect.
      </div>
      <div
        style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          padding: "2px 2px 10px",
          touchAction: "pan-x pan-y",
        }}
      >
        {shots.map((s, i) => {
          const plated = Boolean(s.plateFile && s.plateFile !== "__error__");
          const solo = isSoloTestShot(shotById(s.shotId));
          return (
            <div key={s.shotId} style={{ position: "relative", flex: "0 0 auto" }}>
              <button
                type="button"
                onClick={() => setOpenShotId((cur) => (cur === s.shotId ? null : s.shotId))}
                style={{
                  padding: "2px",
                  border: s.shotId === openShotId ? "2px solid var(--acid)" : "2px solid var(--line)",
                  borderRadius: "2px",
                  background: "var(--panel-2)",
                  cursor: "pointer",
                  lineHeight: 0,
                }}
              >
                {plated ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/crash/gen/file?name=${encodeURIComponent(s.plateFile)}`}
                    alt=""
                    style={{
                      width: "72px",
                      height: "72px",
                      objectFit: "cover",
                      borderRadius: "2px",
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "72px",
                      height: "72px",
                      borderRadius: "2px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--chrome-dim)",
                      fontSize: "11px",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {i + 1}
                  </div>
                )}
              </button>
              {plated ? (
                <button
                  type="button"
                  aria-label="Park this shot plate"
                  onClick={(e) => {
                    e.stopPropagation();
                    void dropPlate(s.shotId);
                  }}
                  style={{
                    position: "absolute",
                    top: "4px",
                    left: "4px",
                    width: "20px",
                    height: "20px",
                    padding: 0,
                    borderRadius: "2px",
                    border: "none",
                    background: "rgba(0,0,0,0.72)",
                    color: "var(--chrome)",
                    fontSize: "14px",
                    lineHeight: 1,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              ) : null}
              {solo ? (
                <button
                  type="button"
                  aria-label="Remove this character card"
                  onClick={(e) => {
                    e.stopPropagation();
                    void removeShot(s.shotId);
                  }}
                  style={{
                    position: "absolute",
                    bottom: "4px",
                    right: "4px",
                    width: "20px",
                    height: "20px",
                    padding: 0,
                    borderRadius: "2px",
                    border: "none",
                    background: "rgba(0,0,0,0.72)",
                    color: "var(--chrome)",
                    fontSize: "14px",
                    lineHeight: 1,
                    cursor: "pointer",
                  }}
                >
                  −
                </button>
              ) : null}
            </div>
          );
        })}

        {story && story.scenes.length ? (
          <button
            type="button"
            aria-label="Add a character test card"
            onClick={() => setPickerOpen((v) => !v)}
            style={{
              flex: "0 0 auto",
              width: "76px",
              height: "76px",
              borderRadius: "2px",
              border: pickerOpen ? "2px solid var(--acid)" : "2px dashed var(--line)",
              background: "var(--panel-2)",
              color: "var(--chrome-dim)",
              fontSize: "26px",
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            +
          </button>
        ) : null}
      </div>

      {pickerOpen ? (
        <div style={{ ...mobileCard, padding: "10px", marginBottom: "10px" }}>
          <div
            style={{
              color: "var(--chrome-dim)",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "8px",
            }}
          >
            One character, one card — pick who to test
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {job.speakers.map((name) => {
              const already = soloShotSpeakers.has(name.trim());
              return (
                <button
                  key={name}
                  type="button"
                  disabled={Boolean(addBusySpeaker)}
                  onClick={() => void addSoloShot(name)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "2px",
                    border: "1px solid var(--line)",
                    background: already ? "var(--panel-2)" : "transparent",
                    color: addBusySpeaker === name ? "var(--acid)" : "var(--chrome)",
                    fontSize: "13px",
                    cursor: addBusySpeaker ? "default" : "pointer",
                  }}
                >
                  {addBusySpeaker === name ? "Adding…" : already ? `${name} · another` : name}
                </button>
              );
            })}
          </div>
          {addError ? (
            <div style={{ fontSize: "12px", color: "var(--magenta-hot)", marginTop: "8px" }}>{addError}</div>
          ) : null}
        </div>
      ) : null}

      {openShotId ? (
        <ShotLineEditor
          key={openShotId}
          styleId={job.styleId}
          folderName={job.folderName}
          jobId={job.id}
          shot={shotById(openShotId)}
          loading={!story && !loadError}
          error={loadError}
          onPlateRebuilt={(plateFile, staging, summary) => {
            setStory((cur) => {
              if (!cur || !openShotId) return cur;
              return {
                ...cur,
                scenes: cur.scenes.map((sc) => ({
                  ...sc,
                  shots: sc.shots.map((sh) =>
                    sh.id === openShotId
                      ? {
                          ...sh,
                          ...(plateFile !== undefined ? { plateFile } : {}),
                          ...(staging !== undefined ? { staging } : {}),
                          ...(summary !== undefined ? { summary } : {}),
                        }
                      : sh,
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

/** The strip thumb is 72px — too small to check for artifacts. Tap it to
 * see the actual plate full screen, same zoom-to-inspect pattern as cast
 * and location candidates. */
function PlatePreview({ plateFile, title }: { plateFile: string; title: string }) {
  const [zoomed, setZoomed] = useState(false);
  if (!plateFile || plateFile === "__error__") return null;
  const src = `/api/crash/gen/file?name=${encodeURIComponent(plateFile)}`;
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        aria-label="Enlarge this plate"
        style={{
          display: "block",
          width: "100%",
          padding: 0,
          border: "1px solid var(--line)",
          borderRadius: "2px",
          background: "var(--panel-2)",
          cursor: "zoom-in",
          lineHeight: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={title}
          style={{ width: "100%", maxHeight: "260px", objectFit: "contain", display: "block" }}
        />
      </button>
      <span
        style={{
          position: "absolute",
          bottom: "8px",
          right: "8px",
          padding: "4px 8px",
          borderRadius: "999px",
          background: "rgba(0,0,0,0.55)",
          color: "var(--chrome)",
          fontSize: "11px",
          pointerEvents: "none",
        }}
      >
        Tap to enlarge
      </span>
      {zoomed ? (
        <div
          onClick={() => setZoomed(false)}
          role="dialog"
          aria-label="Full screen plate"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0,0,0,0.94)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px",
            cursor: "zoom-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={title} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          <span style={{ position: "absolute", top: "16px", right: "18px", color: "var(--chrome)", fontSize: "24px" }}>
            ✕
          </span>
        </div>
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
  onPlateRebuilt: (plateFile: string | undefined, staging: string, summary: string) => void;
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
      <PlatePreview plateFile={shot.plateFile} title={shot.title} />
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

function fieldLabel(text: string) {
  return (
    <div
      style={{
        color: "var(--chrome-dim)",
        fontSize: "10px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        flex: "0 0 auto",
      }}
    >
      {text}
    </div>
  );
}

const shotFieldStyle = {
  width: "100%",
  minWidth: 0,
  padding: "8px",
  borderRadius: "2px",
  border: "1px solid var(--line)",
  background: "var(--panel-2)",
  color: "var(--chrome)",
  fontSize: "13px",
  fontFamily: "inherit",
  resize: "vertical" as const,
};

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
  onRebuilt: (plateFile: string | undefined, staging: string, summary: string) => void;
  onJobChange?: (job: MobileGenJob) => void;
}) {
  const [summary, setSummary] = useState(shot.summary || "");
  const [staging, setStaging] = useState(
    shot.staging?.trim() ||
      "Who sits, leans, presents — Jo on the bar, Matty behind it.",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const actionAssist = useMobileAssist(
    "shot",
    styleId,
    () => summary,
    setSummary,
    shot.title,
  );
  const plateAssist = useMobileAssist(
    "plate",
    styleId,
    () => staging,
    setStaging,
    `${shot.title}. ${summary || ""}`,
  );

  async function saveText() {
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          shotId: shot.id,
          action: "save",
          summary,
          staging,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't save");
      onRebuilt(undefined, staging, summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    }
  }

  async function rebuild() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, shotId: shot.id, staging, summary }),
      });
      const data = (await res.json()) as {
        error?: string;
        plateFile?: string;
        job?: MobileGenJob;
      };
      if (!res.ok) throw new Error(data.error || "Couldn't rebuild the plate");
      onRebuilt(data.plateFile, staging, summary);
      if (data.job) onJobChange?.(data.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't rebuild the plate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {fieldLabel("Action")}
          <div style={{ flex: 1 }} />
          <MobileAiButton onClick={() => void actionAssist.runAssist()} busy={actionAssist.aiBusy} />
        </div>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={() => void saveText()}
          rows={6}
          placeholder="What we see — Jo on the bar, Matty behind it, the room going."
          style={shotFieldStyle}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {fieldLabel("Position tweak")}
          <div style={{ flex: 1 }} />
          <MobileAiButton onClick={() => void plateAssist.runAssist()} busy={plateAssist.aiBusy} />
          <MobilePrimaryButton
            size="chip"
            disabled={busy || plateAssist.aiBusy || actionAssist.aiBusy || !staging.trim()}
            onClick={() => void rebuild()}
          >
            {busy ? "…" : "Rebuild"}
          </MobilePrimaryButton>
        </div>
        <textarea
          value={staging}
          onChange={(e) => setStaging(e.target.value)}
          onBlur={() => void saveText()}
          rows={3}
          placeholder="Who sits, leans, presents — Jo on the bar, Matty behind it"
          style={shotFieldStyle}
        />
        <div style={{ fontSize: "11px", color: "var(--chrome-dim)" }}>
          Rebuild redraws this shot&apos;s picture from the position notes above — same faces, same place.
        </div>
      </div>
      {actionAssist.aiError ? (
        <div style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>{actionAssist.aiError}</div>
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
        placeholder="What they say — aim for 20-30 seconds, about 60-90 words for a test line."
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
