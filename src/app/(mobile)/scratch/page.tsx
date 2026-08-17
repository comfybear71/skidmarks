"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  MobileAudioPlayer,
  MobilePrimaryButton,
  MobileTextInput,
  mobileCard,
} from "@/components/mobile/MobileUi";
import { CastVoiceRow } from "@/components/mobile/CastVoiceRow";
import { PLATE_TILE_PX, PlateClipThumbs, clipsUnderPlate } from "@/components/mobile/PlateClipThumbs";
import {
  MOBILE_DESK_EVENT,
  deskLabel,
  jobDeskId,
  readDeskId,
} from "@/lib/mobileDesk";
import { readResumedJobId, writeResumedJobId } from "@/lib/mobileJobResume";
import type { MobileGenJob } from "@/lib/mobileGenJob";
import type { CrashStoryBeat, CrashStoryDoc } from "@/lib/crashStoryTypes";
import { approvedCandidateFileName, preferredCandidate } from "@/lib/mobileJobReady";
import { mobileLocationStillUrl } from "@/lib/mobileCandidateUrls";
import { findScratchShot, scratchPadClips } from "@/lib/mobileScratch";
import { isMobileSavedVoiceFile } from "@/lib/mobileSavedVoice";
import { speakerWantedSex } from "@/lib/crashVoicePrompt";
import { readApiJson, studioFetchError } from "@/lib/studioFetchError";
import {
  SCRATCH_PRESET_GROUPS,
  applyScratchPresetTemplate,
  deleteScratchPreset,
  loadScratchPresets,
  newScratchPresetId,
  saveScratchPresetFromPrompt,
  type ScratchPreset,
  type ScratchPresetGroup,
} from "@/lib/scratchPresets";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(studioFetchError(e, "Request failed"));
  }
  return readApiJson<T & { error?: string }>(res);
}

function faceUrl(job: MobileGenJob, name: string): string {
  const file = approvedCandidateFileName(job.castCandidates, name) || "";
  if (!file) return "";
  return (
    `/api/crash/mobile/cast-face?styleId=${encodeURIComponent(job.styleId)}` +
    `&folderName=${encodeURIComponent(job.folderName || job.id)}` +
    `&characterId=&fileName=${encodeURIComponent(file)}`
  );
}

function placeUrl(job: MobileGenJob, sceneId: string): string {
  const file =
    approvedCandidateFileName(job.locationCandidates, sceneId) ||
    preferredCandidate(job.locationCandidates[sceneId] || [])?.fileName ||
    "";
  return file ? mobileLocationStillUrl(job, file) : "";
}

function pickDefaultSpeaker(job: MobileGenJob): string {
  const jo = job.speakers.find((n) => /jo/i.test(n));
  return jo || job.speakers.find((n) => approvedCandidateFileName(job.castCandidates, n)) || job.speakers[0] || "";
}

function pickDefaultPlace(job: MobileGenJob): string {
  const donga = job.scenes.find((s) => /donga/i.test(s.placeName));
  return (
    donga?.id ||
    job.scenes.find((s) => approvedCandidateFileName(job.locationCandidates, s.id))?.id ||
    job.scenes[0]?.id ||
    ""
  );
}

function rosterHint(job: MobileGenJob, name: string): string {
  const row = job.roster.find((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase());
  return `${row?.appearance || ""} ${row?.description || ""}`.trim();
}

function splitSpeakersBySex(job: MobileGenJob): { female: string[]; male: string[] } {
  const female: string[] = [];
  const male: string[] = [];
  for (const name of job.speakers) {
    if (speakerWantedSex(name, rosterHint(job, name)) === "female") female.push(name);
    else male.push(name);
  }
  return { female, male };
}

const SIDE_THUMB_PX = 72;

const selectStyle: CSSProperties = {
  ...mobileCard,
  width: "100%",
  padding: "12px 14px",
  color: "var(--chrome)",
  fontSize: "14px",
  fontFamily: "inherit",
  appearance: "none",
  backgroundImage:
    "linear-gradient(45deg, transparent 50%, var(--chrome-dim) 50%), linear-gradient(135deg, var(--chrome-dim) 50%, transparent 50%)",
  backgroundPosition: "calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px)",
  backgroundSize: "6px 6px, 6px 6px",
  backgroundRepeat: "no-repeat",
};

const ghostBtn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: "4px",
  border: "1px solid var(--line)",
  background: "transparent",
  color: "var(--chrome)",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
};

const thumbBtn = (on: boolean): CSSProperties => ({
  flex: "0 0 auto",
  padding: "2px",
  border: on ? "2px solid var(--acid)" : "2px solid var(--line)",
  borderRadius: "2px",
  background: "var(--panel-2)",
  cursor: "pointer",
});

function ScratchLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-label="Enlarge still"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(0,0,0,0.94)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px",
        cursor: "zoom-out",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
      <span style={{ position: "absolute", top: "16px", right: "18px", color: "var(--chrome)", fontSize: "24px" }}>✕</span>
    </div>
  );
}

export default function ScratchPage() {
  const [deskTick, setDeskTick] = useState(0);
  const [job, setJob] = useState<MobileGenJob | null>(null);
  const [story, setStory] = useState<CrashStoryDoc | null>(null);
  const [speaker, setSpeaker] = useState("");
  const [padCast, setPadCast] = useState<string[]>([]);
  const [sceneId, setSceneId] = useState("");
  const [poseId, setPoseId] = useState("mcu-phone");
  const [staging, setStaging] = useState("");
  const [line, setLine] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [resuming, setResuming] = useState(true);
  const [resumeError, setResumeError] = useState("");
  const [lightbox, setLightbox] = useState("");
  const [padCleared, setPadCleared] = useState(false);
  const [presets, setPresets] = useState<ScratchPreset[]>([]);
  const [editLabel, setEditLabel] = useState("");
  const [editGroup, setEditGroup] = useState<ScratchPresetGroup>("Mine");
  const drawSeq = useRef(0);

  const scratch = findScratchShot(story);
  const beat: CrashStoryBeat | undefined =
    scratch?.shot.beats.find((b) => b.speaker.trim().toLowerCase() === speaker.trim().toLowerCase()) ||
    scratch?.shot.beats.find((b) => b.speaker.trim()) ||
    scratch?.shot.beats[0];
  const plateFile = job?.shots.find((s) => s.shotId === scratch?.shot.id)?.plateFile || scratch?.shot.plateFile || "";
  const plateSrc =
    !padCleared && plateFile && plateFile !== "__error__"
      ? `/api/crash/gen/file?name=${encodeURIComponent(plateFile)}`
      : "";
  const underClips = scratch
    ? clipsUnderPlate(
        scratch.shot.id,
        scratch.shot.beats.map((b) => b.id),
        job?.clips || [],
      )
    : [];
  const padStack = job
    ? scratchPadClips(job, story).filter((c) => !underClips.some((u) => u.beatId === c.beatId))
    : [];
  const stackClips = [...underClips.filter((c) => c.clipFile), ...padStack];
  const castBySex = useMemo(() => (job ? splitSpeakersBySex(job) : { female: [], male: [] }), [job]);
  const placeName = job?.scenes.find((s) => s.id === sceneId)?.placeName || "this place";
  const activePreset = presets.find((p) => p.id === poseId) || null;

  useEffect(() => {
    setPresets(loadScratchPresets());
  }, []);

  const loadStory = useCallback(async (next: MobileGenJob) => {
    if (!next.folderName) {
      setStory(null);
      return;
    }
    const res = await fetch(
      `/api/crash/story?styleId=${encodeURIComponent(next.styleId)}&folderName=${encodeURIComponent(next.folderName)}`,
    );
    const data = (await res.json().catch(() => ({}))) as { story?: CrashStoryDoc };
    setStory(data.story || null);
    const found = findScratchShot(data.story || null);
    if (found?.shot.staging) setStaging(found.shot.staging);
    const first = found?.shot.beats.find((b) => b.speaker.trim());
    if (first?.text) setLine(first.text);
  }, []);

  useEffect(() => {
    setDeskTick((n) => n + 1);
    const onDesk = () => {
      setDeskTick((n) => n + 1);
      setJob(null);
      setStory(null);
      setResumeError("");
      setResuming(true);
    };
    window.addEventListener(MOBILE_DESK_EVENT, onDesk);
    return () => window.removeEventListener(MOBILE_DESK_EVENT, onDesk);
  }, []);

  useEffect(() => {
    const deskId = readDeskId(window.localStorage);
    const id = readResumedJobId(window.location.search, window.localStorage, deskId);
    if (!id) {
      setResuming(false);
      return;
    }
    let cancelled = false;
    setResuming(true);
    fetch(`/api/crash/mobile/job/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const d = (await r.json().catch(() => ({}))) as { job?: MobileGenJob; error?: string };
        if (cancelled) return;
        if (!d.job) {
          setResumeError(d.error || "Couldn't open that episode. Don't tap Start directing.");
          return;
        }
        if (jobDeskId(d.job) !== deskId) {
          setResumeError(`That's ${deskLabel(jobDeskId(d.job))}'s episode. Switch desk to open it.`);
          return;
        }
        setJob(d.job);
        const who = pickDefaultSpeaker(d.job);
        const fromScratch = d.job.scratchPlate?.cast?.filter(Boolean) || [];
        setSpeaker(d.job.scratchPlate?.speaker || who);
        setPadCast(fromScratch.length ? fromScratch : who ? [who] : []);
        setSceneId(pickDefaultPlace(d.job));
        await loadStory(d.job);
      })
      .catch(() => {
        if (!cancelled) setResumeError("Couldn't open that episode. Don't tap Start directing.");
      })
      .finally(() => {
        if (!cancelled) setResuming(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deskTick, loadStory]);

  useEffect(() => {
    if (!job?.id) return;
    try {
      writeResumedJobId(window.localStorage, job.id, jobDeskId(job));
    } catch {
      /* private mode */
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get("job") !== job.id) {
      url.searchParams.set("job", job.id);
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    }
  }, [job?.id]);

  async function draw(opts?: {
    poseId?: string;
    staging?: string;
    speaker?: string;
    cast?: string[];
    sceneId?: string;
  }) {
    if (!job) return;
    const nextPose = opts?.poseId ?? poseId;
    const nextStaging = opts?.staging ?? staging;
    const nextSpeaker = opts?.speaker ?? speaker;
    const nextCast = opts?.cast ?? (padCast.length ? padCast : nextSpeaker ? [nextSpeaker] : []);
    const nextScene = opts?.sceneId ?? sceneId;
    if (!nextSpeaker || !nextScene || !nextCast.length) return;
    const seq = ++drawSeq.current;
    setBusy("draw");
    setError("");
    try {
      const ensured = await postJson<{ job: MobileGenJob; shotId?: string }>(
        "/api/crash/mobile/scratch",
        {
          action: "ensure",
          jobId: job.id,
          speaker: nextSpeaker,
          cast: nextCast,
          sceneId: nextScene,
          poseId: nextPose,
        },
      );
      if (seq !== drawSeq.current) return;
      setJob(ensured.job);
      const drawn = await postJson<{ job: MobileGenJob; staging?: string }>(
        "/api/crash/mobile/scratch",
        {
          action: "preset",
          jobId: job.id,
          speaker: nextSpeaker,
          cast: nextCast,
          poseId: nextPose,
          staging: nextStaging || undefined,
        },
      );
      if (seq !== drawSeq.current) return;
      setJob(drawn.job);
      if (drawn.staging) setStaging(drawn.staging);
      setPadCleared(false);
      await loadStory(drawn.job);
    } catch (e) {
      if (seq !== drawSeq.current) return;
      setError(e instanceof Error ? e.message : "Couldn't draw");
    } finally {
      if (seq === drawSeq.current) setBusy("");
    }
  }

  function pickCast(name: string) {
    const onPad = padCast.some((n) => n === name);
    if (!onPad) {
      setPadCast([...padCast, name]);
      setSpeaker(name);
      return;
    }
    if (name !== speaker) {
      // Already on the still — this mouth gets the lip-sync line.
      setSpeaker(name);
      return;
    }
    if (padCast.length === 1) {
      const src = job ? faceUrl(job, name) : "";
      if (src) setLightbox(src);
      return;
    }
    const next = padCast.filter((n) => n !== name);
    setPadCast(next);
    setSpeaker(next[0] || "");
  }

  function dropPlace(id: string) {
    if (!job) return;
    const src = placeUrl(job, id);
    if (id === sceneId && src) {
      setLightbox(src);
      return;
    }
    setSceneId(id);
    // Place is backdrop — drop it straight onto the pad and redraw.
    void draw({
      sceneId: id,
      speaker,
      cast: padCast.length ? padCast : speaker ? [speaker] : [],
      poseId,
      staging: staging || undefined,
    });
  }

  function clearPrompt() {
    setStaging("");
  }

  function clearPad() {
    setPadCleared(true);
    setPadCast([]);
    setSpeaker("");
    setStaging("");
    setPoseId("");
    setError("");
  }

  function fillFromPreset(preset: ScratchPreset) {
    const who = speaker || padCast[0] || "Character";
    const text = applyScratchPresetTemplate(preset.template, {
      name: who,
      place: placeName,
      cast: padCast.length ? padCast : [who],
    });
    setPoseId(preset.id);
    setStaging(text);
    setEditLabel(preset.label);
    setEditGroup(preset.group);
  }

  function onPresetSelect(group: ScratchPresetGroup, id: string) {
    if (!id) return;
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    fillFromPreset(preset);
  }

  function saveCurrentPreset(asNew: boolean) {
    const template = staging.trim();
    if (!template) {
      setError("Write a prompt before saving a preset");
      return;
    }
    const label = (editLabel || activePreset?.label || "Custom").trim() || "Custom";
    const group = editGroup || activePreset?.group || "Mine";
    const id = asNew ? newScratchPresetId() : activePreset?.id || newScratchPresetId();
    const next = saveScratchPresetFromPrompt({ id, group, label, template });
    setPresets(next);
    setPoseId(id);
    setEditLabel(label);
    setEditGroup(group);
  }

  function removeCurrentPreset() {
    if (!activePreset || activePreset.builtin) return;
    setPresets(deleteScratchPreset(activePreset.id));
    setPoseId("");
  }

  async function saveLine() {
    if (!job || !beat) return;
    setBusy("voice");
    setError("");
    try {
      const data = await postJson<{ job?: MobileGenJob }>("/api/crash/mobile/beat-audio", {
        jobId: job.id,
        beatId: beat.id,
        text: line,
      });
      if (data.job) setJob(data.job);
      await loadStory(data.job || job);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the line");
    } finally {
      setBusy("");
    }
  }

  async function makeClip() {
    if (!job || !beat) return;
    setBusy("clip");
    setError("");
    try {
      const data = await postJson<{ job?: MobileGenJob }>("/api/crash/mobile/scratch", {
        action: "clip",
        jobId: job.id,
        beatId: beat.id,
      });
      if (data.job) setJob(data.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the clip");
    } finally {
      setBusy("");
    }
  }

  const playable = Boolean(beat?.voiceFile && isMobileSavedVoiceFile(beat.voiceFile));

  return (
    <main className="mobile-shell" style={{ minHeight: "100dvh", paddingBottom: "48px" }}>
      <div style={{ padding: "28px 16px 0" }}>
        <div
          style={{
            fontFamily: "var(--font-display), sans-serif",
            fontSize: "22px",
            letterSpacing: "0.04em",
            color: "var(--chrome)",
          }}
        >
          Scratch
        </div>
      </div>

      {error ? (
        <div style={{ margin: "12px 16px 0", padding: "10px", borderRadius: "8px", background: "rgba(255,26,140,0.12)", color: "var(--magenta-hot)", fontSize: "13px" }}>
          {error}
        </div>
      ) : null}

      {resuming ? (
        <div style={{ padding: "48px 16px", color: "var(--chrome-dim)" }}>Opening…</div>
      ) : resumeError && !job ? (
        <div style={{ padding: "48px 16px", color: "var(--magenta-hot)", fontWeight: 600 }}>{resumeError}</div>
      ) : !job ? (
        <div style={{ padding: "48px 16px", color: "var(--chrome-dim)", fontSize: "14px" }}>
          Open /m, pick a face and a place, then come back here. Don&apos;t tap Start directing on an episode that already exists.
        </div>
      ) : (
        <>
          <div className="scratch-viewport">
            <div className="scratch-stage">
              <div className="scratch-rail">
                {(
                  [
                    { title: "Female", names: castBySex.female },
                    { title: "Male", names: castBySex.male },
                  ] as const
                ).map((group) =>
                  group.names.length ? (
                    <div key={group.title}>
                      <div style={{ color: "var(--chrome-dim)", fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
                        {group.title}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {group.names.map((name) => {
                          const src = faceUrl(job, name);
                          const onPad = padCast.includes(name);
                          const speaks = name === speaker;
                          return (
                            <button
                              key={name}
                              type="button"
                              title={
                                !onPad
                                  ? `Add ${name} to pad`
                                  : !speaks
                                    ? "On pad — tap to make them speak (lip sync)"
                                    : padCast.length === 1 && src
                                      ? "Tap again to enlarge"
                                      : "Speaking — tap again to pull off pad"
                              }
                              onClick={() => pickCast(name)}
                              style={{
                                ...thumbBtn(onPad),
                                boxShadow: speaks ? "0 0 0 2px var(--acid)" : undefined,
                              }}
                            >
                              {src ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={src}
                                  alt=""
                                  style={{ width: `${SIDE_THUMB_PX}px`, height: `${SIDE_THUMB_PX}px`, objectFit: "cover", display: "block" }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: `${SIDE_THUMB_PX}px`,
                                    height: `${SIDE_THUMB_PX}px`,
                                    color: "var(--chrome-dim)",
                                    fontSize: "10px",
                                    overflow: "hidden",
                                  }}
                                >
                                  {name}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>

              <div className="scratch-pad-col">
                <button
                  type="button"
                  disabled={!plateSrc}
                  onClick={() => plateSrc && setLightbox(plateSrc)}
                  title={plateSrc ? "Tap to enlarge" : undefined}
                  style={{
                    ...mobileCard,
                    padding: "2px",
                    lineHeight: 0,
                    width: "100%",
                    border: "none",
                    cursor: plateSrc ? "zoom-in" : "default",
                    background: "var(--panel)",
                  }}
                >
                  {plateSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={plateSrc}
                      alt=""
                      style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "1",
                        minHeight: `${PLATE_TILE_PX * 2.5}px`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--chrome-dim)",
                        fontSize: "12px",
                        textAlign: "center",
                        padding: "12px",
                      }}
                    >
                      Faces left. Place right. Draw.
                    </div>
                  )}
                </button>
              </div>

              <div className="scratch-rail">
                {job.scenes.map((sc) => {
                  const src = placeUrl(job, sc.id);
                  const on = sc.id === sceneId;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      disabled={Boolean(busy)}
                      title={on && src ? "Tap again to enlarge" : `Drop ${sc.placeName} on pad`}
                      onClick={() => dropPlace(sc.id)}
                      style={thumbBtn(on)}
                    >
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt=""
                          style={{ width: `${SIDE_THUMB_PX}px`, height: `${SIDE_THUMB_PX}px`, objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: `${SIDE_THUMB_PX}px`,
                            height: `${SIDE_THUMB_PX}px`,
                            color: "var(--chrome-dim)",
                            fontSize: "10px",
                            overflow: "hidden",
                          }}
                        >
                          {sc.placeName}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {job.folderName && stackClips.length ? (
              <div className="scratch-clip-rail">
                <PlateClipThumbs job={job} clips={stackClips} preload />
              </div>
            ) : null}

            <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
              <div style={{ flex: 1 }}>
                <MobilePrimaryButton
                  disabled={!padCast.length || !sceneId || Boolean(busy)}
                  onClick={() =>
                    void draw({
                      cast: padCast,
                      speaker: speaker || padCast[0],
                      staging: staging || undefined,
                    })
                  }
                >
                  {busy === "draw" ? "Drawing…" : "Draw"}
                </MobilePrimaryButton>
              </div>
              <button type="button" style={ghostBtn} onClick={clearPad} disabled={Boolean(busy)}>
                Clear pad
              </button>
            </div>
          </div>

          <div style={{ padding: "0 16px 28px", display: "flex", flexDirection: "column", gap: "18px" }}>
            {padCast.length > 1 ? (
              <div style={{ color: "var(--chrome-dim)", fontSize: "12px" }}>
                On pad: {padCast.join(" · ")}. Speaks:{" "}
                <span style={{ color: "var(--acid)" }}>{speaker || padCast[0]}</span>
              </div>
            ) : null}

            <div>
              <div className="scratch-group-label">Prompt</div>
              <MobileTextInput
                value={staging}
                onChange={setStaging}
                placeholder="Position, emotion, holding, wearing, who is where…"
                multiline
                rows={5}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
                <button type="button" style={ghostBtn} onClick={clearPrompt}>
                  Clear prompt
                </button>
                <button type="button" style={ghostBtn} onClick={() => saveCurrentPreset(false)} disabled={!staging.trim()}>
                  {activePreset?.builtin ? "Save override" : "Save preset"}
                </button>
                <button type="button" style={ghostBtn} onClick={() => saveCurrentPreset(true)} disabled={!staging.trim()}>
                  Save as new
                </button>
                {activePreset && !activePreset.builtin ? (
                  <button type="button" style={ghostBtn} onClick={removeCurrentPreset}>
                    Delete preset
                  </button>
                ) : null}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="scratch-group-label">Presets</div>
              {SCRATCH_PRESET_GROUPS.map((group) => {
                const rows = presets.filter((p) => p.group === group);
                if (!rows.length) return null;
                const selectedInGroup = rows.some((p) => p.id === poseId) ? poseId : "";
                return (
                  <label key={group} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span className="scratch-group-label" style={{ marginBottom: 0 }}>
                      {group}
                    </span>
                    <select
                      value={selectedInGroup}
                      onChange={(e) => onPresetSelect(group, e.target.value)}
                      style={selectStyle}
                    >
                      <option value="">Choose…</option>
                      {rows.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                          {p.builtin ? "" : " ★"}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span className="scratch-group-label" style={{ marginBottom: 0 }}>
                    Preset name
                  </span>
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="Label"
                    style={{ ...selectStyle, backgroundImage: "none" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span className="scratch-group-label" style={{ marginBottom: 0 }}>
                    Save under
                  </span>
                  <select
                    value={editGroup}
                    onChange={(e) => setEditGroup(e.target.value as ScratchPresetGroup)}
                    style={selectStyle}
                  >
                    {SCRATCH_PRESET_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <MobileTextInput
              value={line}
              onChange={setLine}
              placeholder="What they say — lip-sync test line. Not the still position."
              multiline
              rows={3}
            />
            {playable && beat?.voiceFile && job.folderName ? (
              <MobileAudioPlayer
                src={`/api/crash/mobile/beat-audio?styleId=${encodeURIComponent(job.styleId)}&folderName=${encodeURIComponent(
                  job.folderName,
                )}&beatId=${encodeURIComponent(beat.id)}&fileName=${encodeURIComponent(beat.voiceFile)}`}
              />
            ) : null}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "nowrap",
                minWidth: 0,
              }}
            >
              <div style={{ flex: "0 0 auto" }}>
                <MobilePrimaryButton disabled={!line.trim() || !beat || Boolean(busy)} onClick={() => void saveLine()}>
                  {busy === "voice" ? "Saving…" : "Save"}
                </MobilePrimaryButton>
              </div>
              {speaker ? (
                <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex" }}>
                  <CastVoiceRow jobId={job.id} styleId={job.styleId} name={speaker} />
                </div>
              ) : (
                <div style={{ flex: "1 1 auto" }} />
              )}
              <div style={{ flex: "0 0 auto" }}>
                <MobilePrimaryButton disabled={!playable || Boolean(busy)} onClick={() => void makeClip()} tone="ghost">
                  {busy === "clip" ? "Sending…" : "Generate"}
                </MobilePrimaryButton>
              </div>
            </div>
          </div>
        </>
      )}

      {lightbox ? <ScratchLightbox src={lightbox} onClose={() => setLightbox("")} /> : null}
    </main>
  );
}
