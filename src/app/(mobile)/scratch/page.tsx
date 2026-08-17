"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MobileAudioPlayer,
  MobilePrimaryButton,
  MobileTextInput,
  mobileCard,
} from "@/components/mobile/MobileUi";
import { DeskSwitcher } from "@/components/mobile/DeskSwitcher";
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
import { plateLtxCampaignScenarios } from "@/lib/mobilePlateLtxCampaign";
import { findScratchShot } from "@/lib/mobileScratch";
import { isMobileSavedVoiceFile } from "@/lib/mobileSavedVoice";
import { readApiJson, studioFetchError } from "@/lib/studioFetchError";

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

export default function ScratchPage() {
  const [deskTick, setDeskTick] = useState(0);
  const [job, setJob] = useState<MobileGenJob | null>(null);
  const [story, setStory] = useState<CrashStoryDoc | null>(null);
  const [speaker, setSpeaker] = useState("");
  const [sceneId, setSceneId] = useState("");
  const [poseId, setPoseId] = useState("mcu-phone");
  const [staging, setStaging] = useState("");
  const [line, setLine] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [resuming, setResuming] = useState(true);
  const [resumeError, setResumeError] = useState("");

  const scratch = findScratchShot(story);
  const beat: CrashStoryBeat | undefined = scratch?.shot.beats.find((b) => b.speaker.trim()) || scratch?.shot.beats[0];
  const plateFile = job?.shots.find((s) => s.shotId === scratch?.shot.id)?.plateFile || scratch?.shot.plateFile || "";
  const underClips = scratch
    ? clipsUnderPlate(
        scratch.shot.id,
        scratch.shot.beats.map((b) => b.id),
        job?.clips || [],
      )
    : [];
  const poses = useMemo(() => plateLtxCampaignScenarios(), []);

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
        setSpeaker(pickDefaultSpeaker(d.job));
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

  async function draw(nextPose = poseId, nextStaging = staging) {
    if (!job) return;
    setBusy("draw");
    setError("");
    try {
      const ensured = await postJson<{ job: MobileGenJob; shotId?: string }>(
        "/api/crash/mobile/scratch",
        { action: "ensure", jobId: job.id, speaker, sceneId, poseId: nextPose },
      );
      setJob(ensured.job);
      const drawn = await postJson<{ job: MobileGenJob; staging?: string }>(
        "/api/crash/mobile/scratch",
        {
          action: "preset",
          jobId: job.id,
          poseId: nextPose,
          staging: nextStaging || undefined,
        },
      );
      setJob(drawn.job);
      if (drawn.staging) setStaging(drawn.staging);
      await loadStory(drawn.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't draw");
    } finally {
      setBusy("");
    }
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
      <DeskSwitcher onChange={() => setDeskTick((n) => n + 1)} />
      <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: "18px", color: "var(--chrome)" }}>Scratch</div>
          <div style={{ color: "var(--chrome-dim)", fontSize: "12px", marginTop: "4px" }}>
            One still. Knobs for position. Voice. Then a clip. Episode desk stays on /m.
          </div>
        </div>
        <a href={job ? `/m?job=${encodeURIComponent(job.id)}` : "/m"} style={{ color: "var(--acid)", fontSize: "13px", fontWeight: 700 }}>
          /m
        </a>
      </div>

      {error ? (
        <div style={{ margin: "0 16px 12px", padding: "10px", borderRadius: "8px", background: "rgba(255,26,140,0.12)", color: "var(--magenta-hot)", fontSize: "13px" }}>
          {error}
        </div>
      ) : null}

      {resuming ? (
        <div style={{ padding: "24px 16px", color: "var(--chrome-dim)" }}>Opening…</div>
      ) : resumeError && !job ? (
        <div style={{ padding: "24px 16px", color: "var(--magenta-hot)", fontWeight: 600 }}>{resumeError}</div>
      ) : !job ? (
        <div style={{ padding: "24px 16px", color: "var(--chrome-dim)", fontSize: "14px" }}>
          Open /m, pick a face and a place, then come back here. Don&apos;t tap Start directing on an episode that already exists.
        </div>
      ) : (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "56px minmax(0, 1fr) 56px",
              gap: "10px",
              alignItems: "start",
            }}
          >
            <div>
              <div style={{ color: "var(--chrome-dim)", fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
                Who
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {job.speakers.map((name) => {
                  const src = faceUrl(job, name);
                  const on = name === speaker;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSpeaker(name)}
                      style={{
                        flex: "0 0 auto",
                        padding: "2px",
                        border: on ? "2px solid var(--acid)" : "2px solid var(--line)",
                        borderRadius: "2px",
                        background: "var(--panel-2)",
                      }}
                    >
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt="" style={{ width: "48px", height: "48px", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ width: "48px", height: "48px", color: "var(--chrome-dim)", fontSize: "9px", overflow: "hidden" }}>{name}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
              <div style={{ ...mobileCard, padding: "2px", lineHeight: 0, width: "100%" }}>
                {plateFile && plateFile !== "__error__" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/crash/gen/file?name=${encodeURIComponent(plateFile)}`}
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
                    Pick who and where, then Draw
                  </div>
                )}
              </div>
              {job.folderName ? <PlateClipThumbs job={job} clips={underClips} preload /> : null}
            </div>

            <div>
              <div style={{ color: "var(--chrome-dim)", fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
                Where
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {job.scenes.map((sc) => {
                  const src = placeUrl(job, sc.id);
                  const on = sc.id === sceneId;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setSceneId(sc.id)}
                      style={{
                        flex: "0 0 auto",
                        padding: "2px",
                        border: on ? "2px solid var(--acid)" : "2px solid var(--line)",
                        borderRadius: "2px",
                        background: "var(--panel-2)",
                      }}
                    >
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt="" style={{ width: "48px", height: "48px", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ width: "48px", height: "48px", color: "var(--chrome-dim)", fontSize: "9px", overflow: "hidden" }}>{sc.placeName}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <MobilePrimaryButton disabled={!speaker || !sceneId || Boolean(busy)} onClick={() => void draw()}>
            {busy === "draw" ? "Drawing…" : "Draw this picture"}
          </MobilePrimaryButton>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {poses.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={Boolean(busy)}
                onClick={() => {
                  setPoseId(p.id);
                  void draw(p.id, "");
                }}
                style={{
                  padding: "6px 8px",
                  borderRadius: "2px",
                  border: p.id === poseId ? "1px solid var(--acid)" : "1px solid var(--line)",
                  background: p.id === poseId ? "var(--acid)" : "var(--panel-2)",
                  color: p.id === poseId ? "#111" : "var(--chrome)",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {p.label.replace(/^\d+\s+/, "")}
              </button>
            ))}
          </div>

          <MobileTextInput
            value={staging}
            onChange={setStaging}
            placeholder="Position — sitting, on the roof, behind, facing…"
            multiline
            rows={3}
          />

          {speaker ? <CastVoiceRow jobId={job.id} styleId={job.styleId} name={speaker} /> : null}

          <MobileTextInput
            value={line}
            onChange={setLine}
            placeholder="What they say — not the still position."
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
          <MobilePrimaryButton disabled={!line.trim() || !beat || Boolean(busy)} onClick={() => void saveLine()}>
            {busy === "voice" ? "Saving…" : "Save line"}
          </MobilePrimaryButton>
          <MobilePrimaryButton disabled={!playable || Boolean(busy)} onClick={() => void makeClip()} tone="ghost">
            {busy === "clip" ? "Sending…" : "Generate this clip"}
          </MobilePrimaryButton>
        </div>
      )}
    </main>
  );
}
