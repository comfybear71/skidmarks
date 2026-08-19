"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import {
  MobileAudioPlayer,
  MobilePrimaryButton,
  MobileTextInput,
  mobileCard,
} from "@/components/mobile/MobileUi";
import { CastVoiceRow } from "@/components/mobile/CastVoiceRow";
import { PlateClipThumbs, clipsUnderPlate } from "@/components/mobile/PlateClipThumbs";
import { OpenEpisodePicker } from "@/components/mobile/OpenEpisodePicker";
import { DEFAULT_DESK_ID, jobDeskId } from "@/lib/mobileDesk";
import { readResumedJobId, writeResumedJobId, clearResumedJobId } from "@/lib/mobileJobResume";
import type { MobileGenJob } from "@/lib/mobileGenJob";
import { mobileMediaFolder } from "@/lib/mobileJobFolder";
import type { CrashStoryBeat, CrashStoryDoc } from "@/lib/crashStoryTypes";
import { approvedCandidateFileName, preferredCandidate, candidateLookPrompt } from "@/lib/mobileJobReady";
import { mobileLocationStillUrl } from "@/lib/mobileCandidateUrls";
import { findScratchShot, scratchPadClips } from "@/lib/mobileScratch";
import { isMobileSavedVoiceFile } from "@/lib/mobileSavedVoice";
import { buildDefaultBeatMotion, LTX_LIP_SYNC_LEAD, stripLtxLipSyncLead } from "@/lib/mobileImageMotion";
import { readApiJson, studioFetchError } from "@/lib/studioFetchError";
import {
  ScratchChaosSelect,
  ScratchHistoryStrip,
  ScratchPromptBible,
  ScratchFloorPanel,
  ScratchScoreToggles,
  type ScratchBiblePickMode,
} from "@/components/scratch";
import {
  appendBenchRun,
  applyBibleTokens,
  clearBenchRuns,
  removeBenchRun,
  downloadScratchRunsCsv,
  dropPercents,
  emptyBenchSession,
  generateScratchPrompt,
  injectChaosStill,
  keepScratchPositionLines,
  mergePlacementsIntoStaging,
  stripScratchLayoutMarks,
  loadBenchSession,
  saveBenchSession,
  setBenchChaos,
  setScratchDrag,
  readScratchDrag,
  stagingActionBody,
  stagingCameraBlock,
  toggleScoreTag,
  updateBenchRunTags,
  upsertPlacement,
  type ScratchBenchSession,
  type ScratchBenchRun,
  type ScratchBibleEntry,
  type ScratchBibleSectionId,
  type ScratchPadPlacement,
  type ScratchBackendId,
  type ScratchScoreTag,
} from "@/lib/scratchBench";
import { buildScratchStillSend, faceRecordsFromJob, padHasJo } from "@/lib/scratchStillSend";
import { useScratchPadHotkeys } from "@/hooks/useScratchPadHotkeys";
import {
  SIRAY_I2V_DEFAULT,
  SIRAY_I2V_MODELS,
  scratchWantsMaleNude,
  scratchWantsNude,
  sirayI2vSpec,
  type SirayI2vId,
} from "@/lib/sirayI2v";

type ScratchClipPick = "ltx" | SirayI2vId;

function plateFileFromHistoryRun(run: ScratchBenchRun): string {
  const direct = (run.plateFile || "").trim();
  if (direct) return direct;
  const url = (run.plateUrl || "").trim();
  if (!url) return "";
  try {
    const q = url.includes("?") ? url.slice(url.indexOf("?")) : "";
    const name = new URLSearchParams(q).get("name");
    return name ? decodeURIComponent(name) : "";
  } catch {
    const m = url.match(/[?&]name=([^&]+)/);
    return m?.[1] ? decodeURIComponent(m[1]) : "";
  }
}

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

function padClearedStorageKey(jobId: string): string {
  return `skidmarks.scratch.padCleared.${jobId.trim()}`;
}

function sceneStorageKey(jobId: string): string {
  return `skidmarks.scratch.sceneId.${jobId.trim()}`;
}

function readLocalPadCleared(jobId: string): boolean {
  try {
    return window.localStorage.getItem(padClearedStorageKey(jobId)) === "1";
  } catch {
    return false;
  }
}

function writeLocalPadCleared(jobId: string, cleared: boolean): void {
  try {
    const key = padClearedStorageKey(jobId);
    if (cleared) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}

function readLocalSceneId(jobId: string): string {
  try {
    return window.localStorage.getItem(sceneStorageKey(jobId))?.trim() || "";
  } catch {
    return "";
  }
}

function writeLocalSceneId(jobId: string, sceneId: string): void {
  try {
    const key = sceneStorageKey(jobId);
    const id = sceneId.trim();
    if (id) window.localStorage.setItem(key, id);
    else window.localStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}

function resolveJobSceneId(next: MobileGenJob, fallback = ""): string {
  const local = readLocalSceneId(next.id);
  const fromScratch = (next.scratchPlate?.sceneId || "").trim();
  const pick =
    [local, fromScratch, fallback, pickDefaultPlace(next)].find(
      (id) => id && next.scenes.some((s) => s.id === id),
    ) || "";
  return pick;
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

const SIDE_THUMB_PX = 96;

const selectStyle: CSSProperties = {
  ...mobileCard,
  width: "100%",
  padding: "6px 28px 6px 8px",
  color: "var(--chrome)",
  fontSize: "12px",
  fontFamily: "inherit",
  appearance: "none",
  backgroundImage:
    "linear-gradient(45deg, transparent 50%, var(--chrome-dim) 50%), linear-gradient(135deg, var(--chrome-dim) 50%, transparent 50%)",
  backgroundPosition: "calc(100% - 14px) calc(50% - 2px), calc(100% - 9px) calc(50% - 2px)",
  backgroundSize: "5px 5px, 5px 5px",
  backgroundRepeat: "no-repeat",
};

const ghostBtn: CSSProperties = {
  padding: "6px 10px",
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
  const [job, setJob] = useState<MobileGenJob | null>(null);
  const [story, setStory] = useState<CrashStoryDoc | null>(null);
  const [speaker, setSpeaker] = useState("");
  const [padCast, setPadCast] = useState<string[]>([]);
  const [sceneId, setSceneId] = useState("");
  const [staging, setStaging] = useState("");
  const [line, setLine] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [resuming, setResuming] = useState(true);
  const [resumeError, setResumeError] = useState("");
  const [lightbox, setLightbox] = useState("");
  const [padCleared, setPadCleared] = useState(false);
  const [bench, setBench] = useState<ScratchBenchSession>(() => emptyBenchSession());
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [bibleMode, setBibleMode] = useState<ScratchBiblePickMode>("replace");
  const [bibleActiveIds, setBibleActiveIds] = useState<string[]>([]);
  const [placements, setPlacements] = useState<ScratchPadPlacement[]>([]);
  const [padDragOver, setPadDragOver] = useState(false);
  /** Last successful Save — unlocks Generate even if story GET lags. */
  const [savedTake, setSavedTake] = useState<{ beatId: string; voiceFile: string } | null>(null);
  const [ltxOpen, setLtxOpen] = useState(true);
  const [clipEngine, setClipEngine] = useState<ScratchClipPick>("ltx");
  const [stillBackend, setStillBackend] = useState<ScratchBackendId>("unknown");
  const [clipStamp, setClipStamp] = useState("");
  const [joPhone, setJoPhone] = useState(true);
  const [sirayReady, setSirayReady] = useState(false);
  const [motionDraft, setMotionDraft] = useState<string | null>(null);
  /** Which beat the draft belongs to — ignore draft after mouth / beat switch. */
  const motionEditBeatId = useRef<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const padSurfaceRef = useRef<HTMLDivElement | null>(null);
  const drawSeq = useRef(0);
  const drawStartedAt = useRef(0);
  const [drawTick, setDrawTick] = useState(0);

  const scratch = findScratchShot(story);
  const beat: CrashStoryBeat | undefined =
    scratch?.shot.beats.find((b) => b.speaker.trim().toLowerCase() === speaker.trim().toLowerCase()) ||
    scratch?.shot.beats.find((b) => b.speaker.trim()) ||
    scratch?.shot.beats[0];
  const effectiveVoiceFile =
    (savedTake && beat && savedTake.beatId === beat.id ? savedTake.voiceFile : "") ||
    beat?.voiceFile ||
    "";
  const plateFile = job?.shots.find((s) => s.shotId === scratch?.shot.id)?.plateFile || scratch?.shot.plateFile || "";
  const plateSrc =
    !padCleared && plateFile && plateFile !== "__error__"
      ? `/api/crash/gen/file?name=${encodeURIComponent(plateFile)}`
      : "";
  const placePreview = job && sceneId ? placeUrl(job, sceneId) : "";
  const padImage = plateSrc || placePreview;
  const padIsPlaceOnly = !plateSrc && Boolean(placePreview);
  const drawSecs =
    busy === "draw" && drawStartedAt.current
      ? Math.max(drawTick, Math.floor((Date.now() - drawStartedAt.current) / 1000))
      : 0;
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
  const placeName = job?.scenes.find((s) => s.id === sceneId)?.placeName || "this place";
  const lookLock =
    (job && speaker
      ? candidateLookPrompt(job.castCandidates, speaker) ||
        job.roster.find((c) => c.name.trim().toLowerCase() === speaker.trim().toLowerCase())?.appearance
      : "") || "";
  const defaultMotionBody =
    job && speaker && line.trim()
      ? stripLtxLipSyncLead(
          buildDefaultBeatMotion({
            styleId: job.styleId,
            speaker,
            line: line.trim(),
            lookLock,
            shotSpeakers: padCast.length ? padCast : [speaker],
            staging,
          }),
        )
      : "";
  const storedMotion = stripLtxLipSyncLead(beat?.imageMotion || "");
  const activeMotionDraft =
    beat && motionEditBeatId.current === beat.id ? motionDraft : null;
  const motionBody = activeMotionDraft ?? (storedMotion || defaultMotionBody);
  const motionDirty = activeMotionDraft !== null;
  const floorFaces = job ? faceRecordsFromJob(padCast.length ? padCast : speaker ? [speaker] : [], job.castCandidates) : [];
  const looksByName = Object.fromEntries(floorFaces.map((f) => [f.name, f.look]));
  const joOnPad = padHasJo(padCast.length ? padCast : speaker ? [speaker] : []);
  const floorSend = useMemo(() => {
    if (!job || !(padCast.length || speaker)) return null;
    return buildScratchStillSend({
      styleId: job.styleId,
      styleRealism: job.styleRealism,
      placeName,
      speakers: padCast.length ? padCast : [speaker],
      looksByName,
      placeLook: sceneId ? candidateLookPrompt(job.locationCandidates, sceneId) : "",
      staging,
      refineFromStill: Boolean(plateSrc),
      joPhone,
    });
  }, [job, padCast, speaker, looksByName, placeName, sceneId, staging, plateSrc, joPhone]);

  useEffect(() => {
    setBench(loadBenchSession());
  }, []);

  useEffect(() => {
    if (busy !== "draw") return;
    const t = window.setInterval(() => setDrawTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [busy]);

  const loadStory = useCallback(
    async (
      next: MobileGenJob,
      opts?: { preferSpeaker?: string; keepLine?: string; keepStaging?: boolean },
    ) => {
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
      if (!opts?.keepStaging && found?.shot.staging) setStaging(found.shot.staging);
      if (opts?.keepLine != null) {
        setLine(opts.keepLine);
        return;
      }
      const prefer = (opts?.preferSpeaker || "").trim().toLowerCase();
      const match =
        (prefer
          ? found?.shot.beats.find((b) => b.speaker.trim().toLowerCase() === prefer)
          : undefined) || found?.shot.beats.find((b) => b.speaker.trim());
      if (match?.text) setLine(match.text);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/crash/mobile/scratch")
      .then((r) => r.json())
      .then((d: { siray?: boolean }) => {
        if (!cancelled && typeof d.siray === "boolean") setSirayReady(d.siray);
      })
      .catch(() => {
        /* Draw still works — chip stays off until a preset round-trip */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = readResumedJobId(window.location.search, window.localStorage, DEFAULT_DESK_ID);
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
        setJob(d.job);
        const fromScratch = d.job.scratchPlate?.cast?.filter(Boolean) || [];
        const cleared = Boolean(d.job.scratchPadCleared) || readLocalPadCleared(d.job.id);
        const padWiped = Boolean(cleared && !fromScratch.length);
        setPadCleared(cleared);
        writeLocalPadCleared(d.job.id, cleared);
        const who = pickDefaultSpeaker(d.job);
        setSpeaker(d.job.scratchPlate?.speaker || (fromScratch[0] || (padWiped ? "" : who)));
        setPadCast(fromScratch.length ? fromScratch : padWiped ? [] : who ? [who] : []);
        const scene = resolveJobSceneId(d.job);
        setSceneId(scene);
        if (scene) writeLocalSceneId(d.job.id, scene);
        await loadStory(d.job, { keepStaging: padWiped });
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
  }, [loadStory]);

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

  const applyOpenedJob = useCallback(
    async (next: MobileGenJob) => {
      setJob(next);
      setSavedTake(null);
      setMotionDraft(null);
      motionEditBeatId.current = null;
      const fromScratch = next.scratchPlate?.cast?.filter(Boolean) || [];
      const cleared = Boolean(next.scratchPadCleared) || readLocalPadCleared(next.id);
      const padWiped = Boolean(cleared && !fromScratch.length);
      setPadCleared(cleared);
      writeLocalPadCleared(next.id, cleared);
      setPlacements([]);
      setError("");
      setResumeError("");
      const who = pickDefaultSpeaker(next);
      setSpeaker(next.scratchPlate?.speaker || (fromScratch[0] || (padWiped ? "" : who)));
      setPadCast(fromScratch.length ? fromScratch : padWiped ? [] : who ? [who] : []);
      const scene = resolveJobSceneId(next);
      setSceneId(scene);
      if (scene) writeLocalSceneId(next.id, scene);
      setStaging("");
      setLine("");
      await loadStory(next, { keepStaging: padWiped });
    },
    [loadStory],
  );

  const openEpisode = useCallback(
    async (jobId: string) => {
      const id = jobId.trim();
      if (!id) return;
      setBusy("open");
      setError("");
      try {
        const res = await fetch(`/api/crash/mobile/job/${encodeURIComponent(id)}`);
        const data = (await res.json().catch(() => ({}))) as { job?: MobileGenJob; error?: string };
        if (!data.job) throw new Error(data.error || "Episode not found");
        await applyOpenedJob(data.job);
        try {
          writeResumedJobId(window.localStorage, data.job.id, jobDeskId(data.job));
        } catch {
          /* private mode */
        }
        const url = new URL(window.location.href);
        url.searchParams.set("job", data.job.id);
        window.history.replaceState({}, "", `${url.pathname}${url.search}`);
        setPickerOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't open episode");
      } finally {
        setBusy("");
      }
    },
    [applyOpenedJob],
  );

  const afterEpisodeDeleted = useCallback(
    (jobId: string) => {
      try {
        clearResumedJobId(window.localStorage, jobId, DEFAULT_DESK_ID);
      } catch {
        /* private mode */
      }
      if (job?.id !== jobId) return;
      setJob(null);
      setStory(null);
      setSavedTake(null);
      setMotionDraft(null);
      motionEditBeatId.current = null;
      setPadCleared(false);
      writeLocalPadCleared(jobId, false);
      writeLocalSceneId(jobId, "");
      setPlacements([]);
      setError("");
      setResumeError("");
      const url = new URL(window.location.href);
      url.searchParams.delete("job");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      setPickerOpen(true);
    },
    [job?.id],
  );

  async function draw(opts?: {
    staging?: string;
    speaker?: string;
    cast?: string[];
    sceneId?: string;
  }) {
    if (!job) return;
    if (busy === "restore") return;
    const rawStaging = opts?.staging ?? staging;
    const laidOut = mergePlacementsIntoStaging(rawStaging || "", placements, placeName);
    const nextStaging = injectChaosStill(laidOut, bench.chaosId);
    const nextSpeaker = opts?.speaker ?? speaker;
    const nextCast = opts?.cast ?? (padCast.length ? padCast : nextSpeaker ? [nextSpeaker] : []);
    const nextScene = opts?.sceneId ?? sceneId;
    if (!nextScene) {
      setError("Drop a place on the pad so you can see the room, then Draw.");
      return;
    }
    if (!nextSpeaker || !nextCast.length) {
      setError("Park faces on the place still, then Draw.");
      return;
    }
    const seq = ++drawSeq.current;
    setBusy("draw");
    drawStartedAt.current = Date.now();
    setDrawTick(0);
    setError("");
    setPadCleared(true);
    writeLocalPadCleared(job.id, true);
    try {
      const ensured = await postJson<{ job: MobileGenJob; shotId?: string }>(
        "/api/crash/mobile/scratch",
        {
          action: "ensure",
          jobId: job.id,
          speaker: nextSpeaker,
          cast: nextCast,
          sceneId: nextScene,
        },
      );
      if (seq !== drawSeq.current) return;
      setJob(ensured.job);
      let drawn = await postJson<{
        job: MobileGenJob;
        staging?: string;
        backend?: ScratchBackendId;
        siray?: boolean;
        pending?: boolean;
        send?: { prompt: string; layers: { id: string; label: string; text: string }[] };
        sendPrompt?: string;
      }>(
        "/api/crash/mobile/scratch",
        {
          action: "preset",
          jobId: job.id,
          speaker: nextSpeaker,
          cast: nextCast,
          staging: nextStaging || undefined,
          joPhone,
        },
      );
      if (seq !== drawSeq.current) return;
      if (drawn.job) setJob(drawn.job);
      if (drawn.pending) {
        const started = Date.now();
        while (drawn.pending) {
          if (Date.now() - started > 240_000) {
            throw new Error(
              "Siray is still drawing. The episode is still there — tap Draw again. Don't start a new episode.",
            );
          }
          await new Promise((r) => setTimeout(r, 3500));
          if (seq !== drawSeq.current) return;
          drawn = await postJson<{
            job: MobileGenJob;
            staging?: string;
            backend?: ScratchBackendId;
            siray?: boolean;
            pending?: boolean;
          }>("/api/crash/mobile/scratch", { action: "preset-poll", jobId: job.id });
        }
      }
      if (seq !== drawSeq.current) return;
      setJob(drawn.job);
      if (drawn.backend) setStillBackend(drawn.backend);
      if (typeof drawn.siray === "boolean") setSirayReady(drawn.siray);
      if (drawn.staging) setStaging(stripScratchLayoutMarks(drawn.staging));
      else if (nextStaging) setStaging(stripScratchLayoutMarks(nextStaging));
      setPadCleared(false);
      writeLocalPadCleared(drawn.job.id, false);
      drawStartedAt.current = 0;
      await loadStory(drawn.job);
      const plateFileName =
        drawn.job.shots.map((s) => s.plateFile).filter((f): f is string => Boolean(f && f !== "__error__")).at(-1) ||
        "";
      const plateUrl = plateFileName
        ? `/api/crash/gen/file?name=${encodeURIComponent(plateFileName)}`
        : undefined;
      let loggedId: string | null = null;
      setBench((prev) => {
        const next = appendBenchRun(prev, {
          kind: "still",
          backend: drawn.backend || "unknown",
          chaosId: prev.chaosId,
          positionPrompt: nextStaging || undefined,
          sendPrompt: drawn.send?.prompt || drawn.sendPrompt || floorSend?.prompt,
          sendLayers: drawn.send?.layers || floorSend?.layers,
          faceLooks: floorFaces.map((f) => ({ name: f.name, look: f.look })),
          plateUrl,
          styleId: drawn.job.styleId,
          mediaFolder: mobileMediaFolder(drawn.job),
          plateFile: plateFileName || undefined,
          tags: prev.chaosId !== "none" ? (["chaos"] as ScratchScoreTag[]) : [],
          placements: placements.length ? placements : undefined,
          environment: placeName || undefined,
          dialogue: line.trim() || undefined,
        });
        loggedId = next.runs[0]?.id || null;
        return next;
      });
      setSelectedRunId(loggedId);
    } catch (e) {
      if (seq !== drawSeq.current) return;
      setError(e instanceof Error ? e.message : "Couldn't draw");
    } finally {
      if (seq === drawSeq.current) {
        setBusy("");
        drawStartedAt.current = 0;
      }
    }
  }

  function pickCast(name: string) {
    const onPad = padCast.some((n) => n === name);
    if (!onPad) {
      setPadCast([...padCast, name]);
      setSpeaker(name);
      setSavedTake(null);
      setPlacements((prev) => {
        if (prev.some((p) => p.name === name)) return prev;
        const n = prev.length;
        const xPercent = n === 0 ? 70 : n === 1 ? 22 : Math.min(88, 22 + n * 28);
        return upsertPlacement(prev, { name, xPercent, yPercent: 58 });
      });
      const beatLine = scratch?.shot.beats.find((b) => b.speaker.trim().toLowerCase() === name.trim().toLowerCase())?.text;
      if (beatLine) setLine(beatLine);
      return;
    }
    if (name !== speaker) {
      // Already on the still — this mouth gets the lip-sync line.
      setSpeaker(name);
      setSavedTake(null);
      const beatLine = scratch?.shot.beats.find((b) => b.speaker.trim().toLowerCase() === name.trim().toLowerCase())?.text;
      if (beatLine != null) setLine(beatLine);
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
    setPlacements((prev) => prev.filter((p) => p.name !== name));
  }

  function dropPlace(id: string) {
    if (!job) return;
    const src = placeUrl(job, id);
    if (id === sceneId && src && padCleared) {
      setLightbox(src);
      return;
    }
    parkPlace(id);
  }

  function parkPlace(id: string) {
    if (!job) return;
    setSceneId(id);
    setPadCleared(true);
    writeLocalPadCleared(job.id, true);
    writeLocalSceneId(job.id, id);
    setLightbox("");
    setError("");
    void postJson<{ job: MobileGenJob }>("/api/crash/mobile/scratch", {
      action: "select-place",
      jobId: job.id,
      sceneId: id,
    })
      .then((d) => {
        if (d.job) setJob(d.job);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't park that place"));
  }

  function clearPrompt() {
    setStaging("");
    setBibleActiveIds([]);
  }

  function compilePrompt() {
    const composed = generateScratchPrompt({
      placements,
      environment: placeName,
      camera: stagingCameraBlock(staging),
      actionBody: stagingActionBody(staging),
      dialogue: line,
    });
    setStaging(composed);
    setBibleActiveIds([]);
  }

  /** Hide the composite — keep the place still so they can park faces. */
  function clearPlate() {
    setPadCleared(true);
    setLightbox("");
    setError("");
    if (!job) return;
    writeLocalPadCleared(job.id, true);
    void postJson<{ job: MobileGenJob }>("/api/crash/mobile/scratch", {
      action: "clear-plate",
      jobId: job.id,
    })
      .then((d) => {
        if (d.job) setJob(d.job);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't hide the plate"));
  }

  function clearPad() {
    setPadCleared(true);
    setPadCast([]);
    setSpeaker("");
    setStaging("");
    setPlacements([]);
    setBibleActiveIds([]);
    setSavedTake(null);
    setError("");
    if (!job) return;
    writeLocalPadCleared(job.id, true);
    void postJson<{ job: MobileGenJob }>("/api/crash/mobile/scratch", {
      action: "clear-pad",
      jobId: job.id,
    })
      .then((d) => {
        if (d.job) setJob(d.job);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't clear the pad"));
  }

  function onPadDragOver(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!padDragOver) setPadDragOver(true);
  }

  function onPadDragLeave(e: DragEvent) {
    const next = e.relatedTarget as Node | null;
    if (next && padSurfaceRef.current?.contains(next)) return;
    setPadDragOver(false);
  }

  function onPadDrop(e: DragEvent) {
    e.preventDefault();
    setPadDragOver(false);
    if (!job || !padSurfaceRef.current) return;
    const payload = readScratchDrag(e.dataTransfer);
    if (!payload) return;
    const rect = padSurfaceRef.current.getBoundingClientRect();
    const { xPercent, yPercent } = dropPercents(e.clientX, e.clientY, rect);

    if (payload.type === "actor") {
      const name = payload.id;
      setPadCast((prev) => (prev.includes(name) ? prev : [...prev, name]));
      setSpeaker(name);
      const place = { name, xPercent, yPercent };
      setPlacements((prev) => upsertPlacement(prev, place));
      const beatLine = scratch?.shot.beats.find(
        (b) => b.speaker.trim().toLowerCase() === name.trim().toLowerCase(),
      )?.text;
      if (beatLine) setLine(beatLine);
      return;
    }

    // place / environment
    const id = payload.id;
    parkPlace(id);
  }

  async function restoreHistoryPlate(run: ScratchBenchRun) {
    if (!job) return;
    drawSeq.current += 1;
    setBusy("restore");
    setError("");
    const plateFile = plateFileFromHistoryRun(run);
    if (!plateFile) {
      setBusy("");
      if (run.plateUrl) setLightbox(run.plateUrl);
      setError("That history row has no still file — pick a still thumb, not a clip.");
      return;
    }
    try {
      const data = await postJson<{ job: MobileGenJob; staging?: string; plateFile?: string }>(
        "/api/crash/mobile/scratch",
        {
          action: "restore-plate",
          jobId: job.id,
          plateFile,
          staging: run.positionPrompt,
        },
      );
      if (data.job) setJob(data.job);
      setSelectedRunId(run.id);
      if (run.placements?.length) {
        setPlacements(run.placements);
        setPadCast(run.placements.map((p) => p.name));
        setSpeaker(run.placements[0]?.name || speaker);
      }
      if (run.dialogue) setLine(run.dialogue);
      if (run.environment) {
        const match = job.scenes.find(
          (s) => s.placeName.trim().toLowerCase() === run.environment!.trim().toLowerCase(),
        );
        if (match) setSceneId(match.id);
      }
      setPadCleared(false);
      writeLocalPadCleared(job.id, false);
      await loadStory(data.job, { keepStaging: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't put that still on the pad");
    } finally {
      setBusy("");
    }
  }

  function pickBibleEntry(_sectionId: ScratchBibleSectionId, entry: ScratchBibleEntry) {
    if (entry.id.startsWith("crowd-") && padCast.length < 2) {
      setError("Put at least two faces on the pad for crowd chips");
      return;
    }
    const who = speaker || padCast[0] || "Character";
    const text = applyBibleTokens(entry.template, {
      name: who,
      place: placeName,
      cast: padCast.length ? padCast : [who],
    });
    setBibleActiveIds((prev) =>
      bibleMode === "append" ? (prev.includes(entry.id) ? prev : [...prev, entry.id]) : [entry.id],
    );
    if (bibleMode === "append" && staging.trim()) {
      setStaging(`${staging.trim()}\n\n${text}`);
    } else {
      setStaging(keepScratchPositionLines(staging, text));
    }
  }

  async function persistMotion(body?: string): Promise<string> {
    if (!job || !beat) {
      throw new Error("No Scratch line yet — Draw a still first");
    }
    const next = (body ?? motionBody).trim();
    if (!next) throw new Error("LTX Image motion is empty");
    if (stripLtxLipSyncLead(beat.imageMotion || "") === next) {
      motionEditBeatId.current = null;
      setMotionDraft(null);
      return next;
    }
    const data = await postJson<{ imageMotion?: string; job?: MobileGenJob }>(
      "/api/crash/mobile/beat-motion",
      { jobId: job.id, beatId: beat.id, imageMotion: next },
    );
    if (data.job) setJob(data.job);
    const saved = stripLtxLipSyncLead(data.imageMotion || next);
    setStory((cur) => {
      if (!cur) return cur;
      return {
        ...cur,
        scenes: cur.scenes.map((sc) => ({
          ...sc,
          shots: sc.shots.map((sh) => ({
            ...sh,
            beats: sh.beats.map((b) => (b.id === beat.id ? { ...b, imageMotion: saved } : b)),
          })),
        })),
      };
    });
    motionEditBeatId.current = null;
    setMotionDraft(null);
    return saved;
  }

  async function saveLine() {
    if (!job || !beat) {
      setError(
        !beat
          ? "No Scratch line yet — Draw a still with a face on the pad first, then Save."
          : "Episode not open",
      );
      return;
    }
    const text = line.trim();
    if (!text) return;
    setBusy("voice");
    setError("");
    try {
      const data = await postJson<{ job?: MobileGenJob; voiceFile?: string }>(
        "/api/crash/mobile/beat-audio",
        {
          jobId: job.id,
          beatId: beat.id,
          text,
        },
      );
      if (data.job) setJob(data.job);
      const savedVoice = (data.voiceFile || "").trim();
      if (!savedVoice) {
        setError("Save finished but no mp3 came back — tap Save again.");
        return;
      }
      if (!isMobileSavedVoiceFile(savedVoice)) {
        setError(
          `Got an old leftover voice file (${savedVoice}) — Draw again, then Save the spoken line.`,
        );
        return;
      }
      setSavedTake({ beatId: beat.id, voiceFile: savedVoice });
      setStory((cur) => {
        if (!cur) return cur;
        return {
          ...cur,
          scenes: cur.scenes.map((sc) => ({
            ...sc,
            shots: sc.shots.map((sh) => ({
              ...sh,
              beats: sh.beats.map((b) =>
                b.id === beat.id ? { ...b, text, voiceFile: savedVoice } : b,
              ),
            })),
          })),
        };
      });
      await loadStory(data.job || job, {
        preferSpeaker: beat.speaker || speaker,
        keepLine: text,
        keepStaging: true,
      });
      setSavedTake({ beatId: beat.id, voiceFile: savedVoice });
      setStory((cur) => {
        if (!cur) return cur;
        return {
          ...cur,
          scenes: cur.scenes.map((sc) => ({
            ...sc,
            shots: sc.shots.map((sh) => ({
              ...sh,
              beats: sh.beats.map((b) =>
                b.id === beat.id ? { ...b, text, voiceFile: savedVoice } : b,
              ),
            })),
          })),
        };
      });
      // Lock the LTX box onto this beat so Generate uses what's on screen
      // (mouth/head + NAME says), not a stale leftover motion string.
      if (motionBody.trim()) {
        await persistMotion(motionBody);
      }
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
      if (clipEngine === "ltx" && motionBody.trim()) {
        await persistMotion(motionBody);
      }
      const data = await postJson<{
        job?: MobileGenJob;
        backend?: ScratchBackendId;
        siray?: boolean;
        clipLabel?: string;
        i2v?: SirayI2vId;
      }>("/api/crash/mobile/scratch", {
        action: "clip",
        jobId: job.id,
        beatId: beat.id,
        clipEngine,
      });
      if (typeof data.siray === "boolean") setSirayReady(data.siray);
      if (data.job) setJob(data.job);
      const ranLabel =
        data.clipLabel ||
        (clipEngine === "ltx" ? "LTX (mp3)" : sirayI2vSpec(clipEngine).label);
      setClipStamp(ranLabel);
      const clipFile =
        data.job?.clips?.filter((c) => c.beatId === beat.id && c.clipFile).at(-1)?.clipFile || "";
      const clipUrl = clipFile
        ? `/api/crash/gen/file?name=${encodeURIComponent(clipFile)}`
        : undefined;
      let loggedId: string | null = null;
      setBench((prev) => {
        const next = appendBenchRun(prev, {
          kind: "clip",
          backend: data.backend || (clipEngine === "ltx" ? "ltx" : "siray-i2v"),
          chaosId: prev.chaosId,
          positionPrompt: staging || undefined,
          plateUrl: plateSrc || undefined,
          clipUrl,
          styleId: data.job?.styleId || job.styleId,
          mediaFolder: mobileMediaFolder(data.job || job),
          plateFile: plateFile && plateFile !== "__error__" ? plateFile : undefined,
          clipFile: clipFile || undefined,
          tags: prev.chaosId !== "none" ? (["chaos"] as ScratchScoreTag[]) : [],
          placements: placements.length ? placements : undefined,
          environment: placeName || undefined,
          dialogue: line.trim() || undefined,
        });
        loggedId = next.runs[0]?.id || null;
        return next;
      });
      setSelectedRunId(loggedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the clip");
    } finally {
      setBusy("");
    }
  }

  const playable = Boolean(effectiveVoiceFile && isMobileSavedVoiceFile(effectiveVoiceFile));
  const clipPlayable = Boolean(
    beat &&
      job?.clips?.some(
        (c) => c.beatId === beat.id && isMobileSavedVoiceFile(c.voiceFile),
      ),
  );
  const canGenerate = playable || clipPlayable;
  const canSirayGenerate = Boolean(plateSrc && beat && job);
  const generateReady = clipEngine === "ltx" ? canGenerate : canSirayGenerate && sirayReady;
  const sirayClip = clipEngine !== "ltx";
  const selectedSiray = sirayClip ? sirayI2vSpec(clipEngine) : sirayI2vSpec(SIRAY_I2V_DEFAULT);

  useScratchPadHotkeys({
    enabled: Boolean(job) && !resuming,
    onDraw: () => {
      if (busy || !job || !padCast.length || !sceneId) return;
      void draw({
        cast: padCast,
        speaker: speaker || padCast[0],
        staging: staging || undefined,
      });
    },
    onGenerate: () => {
      if (busy || !generateReady) return;
      void makeClip();
    },
    onArchive: () => {
      saveBenchSession(bench);
    },
    onClearPad: () => {
      clearPad();
    },
    onExportCsv: () => {
      if (!bench.runs.length) {
        setError("No history to export yet");
        return;
      }
      downloadScratchRunsCsv(bench.runs);
    },
  });

  return (
    <main className="mobile-shell scratch-shell" style={{ minHeight: "100dvh", paddingBottom: "16px" }}>
      <div style={{ padding: "12px 12px 0" }}>
        <div
          style={{
            fontFamily: "var(--font-display), sans-serif",
            fontSize: "20px",
            letterSpacing: "0.04em",
            color: "var(--chrome)",
          }}
        >
          Scratch
        </div>
        <div style={{ marginTop: "8px" }}>
          <OpenEpisodePicker
            deskId={DEFAULT_DESK_ID}
            activeJobId={job?.id}
            open={pickerOpen || !job}
            onOpenChange={setPickerOpen}
            onOpen={(id) => void openEpisode(id)}
            onNew={() => {
              window.location.href = "/m";
            }}
            onDeleted={afterEpisodeDeleted}
          />
        </div>
        <div className="scratch-bench-toolbar" style={{ marginTop: "8px" }}>
          <ScratchChaosSelect
            value={bench.chaosId}
            disabled={Boolean(busy)}
            onChange={(id) => setBench((prev) => setBenchChaos(prev, id))}
          />
          <ScratchScoreToggles
            tags={
              (selectedRunId
                ? bench.runs.find((r) => r.id === selectedRunId)?.tags
                : bench.runs[0]?.tags) || []
            }
            disabled={!bench.runs.length || Boolean(busy)}
            onChange={(tags) => {
              const runId = selectedRunId || bench.runs[0]?.id;
              if (!runId) return;
              setBench((prev) => updateBenchRunTags(prev, runId, tags));
            }}
          />
          <div className="scratch-hotkey-hint">
            ⌘/Ctrl+Enter Draw · ⇧Enter Generate · S save log · E CSV · ⌫ clear pad
          </div>
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
        <div style={{ padding: "16px" }}>
          <div style={{ color: "var(--magenta-hot)", fontWeight: 600 }}>{resumeError}</div>
          <div style={{ color: "var(--chrome-dim)", fontSize: "13px", marginTop: "8px" }}>
            Pick an episode above, or New episode on /m.
          </div>
        </div>
      ) : !job ? (
        <div style={{ padding: "24px 16px", color: "var(--chrome-dim)", fontSize: "14px" }}>
          Pick an episode above. Or New episode → /m, approve a face and a place, then come back.
        </div>
      ) : (
        <>
          <div className="scratch-viewport">
            <div className="scratch-stage">
              <div className="scratch-rail">
                {job.speakers.map((name) => {
                  const src = faceUrl(job, name);
                  const onPad = padCast.includes(name);
                  const speaks = name === speaker;
                  return (
                    <button
                      key={name}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        setScratchDrag(e.dataTransfer, { type: "actor", id: name, label: name });
                      }}
                      title={
                        !onPad
                          ? `Add ${name} to pad — or drag onto pad`
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
                        cursor: "grab",
                      }}
                    >
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt=""
                          draggable={false}
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

              <div className="scratch-pad-col">
                <div
                  ref={padSurfaceRef}
                  className={`scratch-pad-surface${padDragOver ? " is-drop-target" : ""}`}
                  onDragOver={onPadDragOver}
                  onDragLeave={onPadDragLeave}
                  onDrop={onPadDrop}
                >
                  <div
                    title={
                      padIsPlaceOnly
                        ? "Place still — drag faces onto the bed / sofa"
                        : padImage
                          ? "Drop faces onto this still"
                          : "Drop a place here so the room loads"
                    }
                    style={{
                      ...mobileCard,
                      padding: "2px",
                      lineHeight: 0,
                      width: "100%",
                      border: "none",
                      cursor: "default",
                      background: "var(--panel)",
                      position: "relative",
                    }}
                  >
                    {padImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={padImage}
                        alt={padIsPlaceOnly ? "Place still — park faces here" : "Last Draw"}
                        className="scratch-pad-still"
                        draggable={false}
                      />
                    ) : (
                      <div
                        className="scratch-pad-still"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--chrome-dim)",
                          fontSize: "13px",
                          textAlign: "center",
                          padding: "16px",
                        }}
                      >
                        Drop a place first so the room loads. Then drag faces onto the furniture.
                      </div>
                    )}
                    {busy === "draw" ? (
                      <div className="scratch-pad-drawing">Drawing… {drawSecs}s</div>
                    ) : null}
                    {padImage ? (
                      <button
                        type="button"
                        className="scratch-pad-enlarge"
                        onClick={() => setLightbox(padImage)}
                      >
                        Enlarge
                      </button>
                    ) : null}
                  </div>
                  {placements.length ? (
                    <div className="scratch-pad-markers" aria-hidden>
                      {placements.map((p) => (
                        <div
                          key={p.name}
                          className="scratch-pad-marker"
                          style={{ left: `${p.xPercent}%`, top: `${p.yPercent}%` }}
                          title={`${p.name} · ${p.xPercent}% / ${p.yPercent}%`}
                        >
                          <span className="scratch-pad-marker-label">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="scratch-rail">
                {job.scenes.map((sc) => {
                  const src = placeUrl(job, sc.id);
                  const on = sc.id === sceneId;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        setScratchDrag(e.dataTransfer, {
                          type: "place",
                          id: sc.id,
                          label: sc.placeName,
                        });
                      }}
                      title={on && src ? "Tap again to enlarge — or drag onto pad" : `Drop ${sc.placeName} on pad`}
                      onClick={() => dropPlace(sc.id)}
                      style={{ ...thumbBtn(on), cursor: "grab" }}
                    >
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt=""
                          draggable={false}
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
                <PlateClipThumbs job={job} clips={stackClips} poster={plateSrc || undefined} preload />
              </div>
            ) : null}

            <div style={{ display: "flex", gap: "8px", alignItems: "stretch", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 160px" }}>
                <MobilePrimaryButton
                  disabled={!job || Boolean(busy)}
                  onClick={() =>
                    void draw({
                      cast: padCast,
                      speaker: speaker || padCast[0],
                      staging: staging || undefined,
                    })
                  }
                >
                  {busy === "restore"
                    ? "Restoring still…"
                    : busy === "draw"
                      ? `Drawing… ${drawSecs}s — tap to retry`
                      : "Draw"}
                </MobilePrimaryButton>
              </div>
              <button
                type="button"
                style={ghostBtn}
                onClick={clearPlate}
                disabled={!job || !padImage}
              >
                Clear plate
              </button>
              <button type="button" style={ghostBtn} onClick={clearPad} disabled={!job}>
                Clear pad
              </button>
            </div>
            <div style={{ color: "var(--chrome-dim)", fontSize: "11px" }}>
              {padIsPlaceOnly
                ? "Place still is on the pad. Drag faces onto the furniture, then Draw. Tapping the picture only enlarges it."
                : plateSrc
                  ? "Last Draw. Clear plate hides it — tap a history still to put an older one back on the pad."
                  : "Drop a place first. The room stays so you can park people."}
            </div>
            <div style={{ color: "var(--chrome-dim)", fontSize: "11px" }}>
              Still:{" "}
              <span style={{ color: stillBackend === "siray-spicy" ? "var(--acid)" : "var(--chrome)" }}>
                {stillBackend === "siray-spicy"
                  ? "Siray Seedream 4.5 Spicy"
                  : stillBackend === "xai"
                    ? "XAI (Grok)"
                    : sirayReady
                      ? "Siray Spicy when you Draw"
                      : "XAI — no SIRAY_API_KEY"}
              </span>
              {scratchWantsMaleNude(staging)
                ? " — wardrobe override: adult man, drop the shorts, keep human anatomy."
                : scratchWantsNude(staging)
                  ? " — wardrobe override: drop the face-card clothes."
                  : ""}
            </div>

            {padCast.length > 1 ? (
              <div style={{ color: "var(--chrome-dim)", fontSize: "12px" }}>
                On pad: {padCast.join(" · ")}. Speaks:{" "}
                <span style={{ color: "var(--acid)" }}>{speaker || padCast[0]}</span>
                . Park them on the place still. Nude keeps those marks. Do not leave extras as a corner inset.
              </div>
            ) : null}

            <div className="scratch-console">
              <div>
                <div className="scratch-group-label">Prompt</div>
                <MobileTextInput
                  value={staging}
                  onChange={setStaging}
                  placeholder="Position, emotion, holding, wearing, who is where…"
                  multiline
                  rows={5}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                  <button type="button" style={ghostBtn} onClick={compilePrompt}>
                    Compile layout
                  </button>
                  <button type="button" style={ghostBtn} onClick={clearPrompt}>
                    Clear prompt
                  </button>
                </div>
              </div>

              <ScratchPromptBible
                activeIds={bibleActiveIds}
                mode={bibleMode}
                onModeChange={(mode) => {
                  setBibleMode(mode);
                  if (mode === "replace") setBibleActiveIds([]);
                }}
                onPick={pickBibleEntry}
                disabled={Boolean(busy) || !padCast.length}
              />
            </div>

            <ScratchFloorPanel
              faces={floorFaces}
              layers={floorSend?.layers || []}
              joOnPad={joOnPad}
              joPhone={joPhone}
              onJoPhone={setJoPhone}
              disabled={Boolean(busy)}
            />

            <MobileTextInput
              value={line}
              onChange={setLine}
              placeholder="What they say — lip-sync test line. Not the still position."
              multiline
              rows={2}
            />
            {canGenerate && effectiveVoiceFile && beat && job.folderName ? (
              <MobileAudioPlayer
                src={`/api/crash/mobile/beat-audio?styleId=${encodeURIComponent(job.styleId)}&folderName=${encodeURIComponent(
                  job.folderName,
                )}&beatId=${encodeURIComponent(beat.id)}&fileName=${encodeURIComponent(effectiveVoiceFile)}`}
              />
            ) : line.trim() && beat ? (
              <div style={{ color: "var(--chrome-dim)", fontSize: "12px" }}>
                Save the spoken line to unlock Generate. The Play beside the voice dropdown is only a library sample — not your line.
              </div>
            ) : line.trim() && !beat ? (
              <div style={{ color: "var(--magenta-hot)", fontSize: "12px" }}>
                No Scratch beat yet — Draw with a face on the pad, then Save the line.
              </div>
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
                <MobilePrimaryButton disabled={!generateReady || Boolean(busy)} onClick={() => void makeClip()} tone="ghost">
                  {busy === "clip" ? "Sending…" : "Generate"}
                </MobilePrimaryButton>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => {
                  setClipEngine("ltx");
                  setClipStamp("");
                }}
                style={{
                  ...ghostBtn,
                  border: clipEngine === "ltx" ? "1px solid var(--acid)" : ghostBtn.border,
                  color: clipEngine === "ltx" ? "var(--acid)" : "var(--chrome)",
                }}
              >
                LTX (mp3)
              </button>
              <button
                type="button"
                disabled={Boolean(busy) || !sirayReady}
                onClick={() => {
                  if (clipEngine === "ltx") {
                    setClipEngine(SIRAY_I2V_DEFAULT);
                    setClipStamp("");
                  }
                }}
                style={{
                  ...ghostBtn,
                  border: sirayClip ? "1px solid var(--acid)" : ghostBtn.border,
                  color: sirayClip ? "var(--acid)" : "var(--chrome)",
                }}
              >
                Siray i2v
              </button>
              {SIRAY_I2V_MODELS.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  disabled={Boolean(busy) || !sirayReady}
                  onClick={() => {
                    setClipEngine(row.id);
                    setClipStamp("");
                  }}
                  title={row.hint}
                  style={{
                    ...ghostBtn,
                    border: clipEngine === row.id ? "1px solid var(--acid)" : ghostBtn.border,
                    color: clipEngine === row.id ? "var(--acid)" : "var(--chrome)",
                    fontSize: "11px",
                  }}
                >
                  {row.shortLabel}
                  {row.id === SIRAY_I2V_DEFAULT ? " cheap" : ""}
                </button>
              ))}
            </div>
            <div style={{ color: "var(--chrome-dim)", fontSize: "11px" }}>
              Clip:{" "}
              <span style={{ color: sirayClip || clipStamp ? "var(--acid)" : "var(--chrome)" }}>
                {clipStamp ||
                  (sirayClip
                    ? selectedSiray.label
                    : sirayReady
                      ? "LTX — lip-sync on the Saved mp3"
                      : "LTX — Siray chip needs SIRAY_API_KEY")}
              </span>
              {sirayClip ? " — motion from the still. Keep LTX when she has to speak." : ""}
            </div>

            <div className="scratch-ltx-motion">
              <button
                type="button"
                onClick={() => setLtxOpen((open) => !open)}
                className="scratch-ltx-motion-toggle"
              >
                {ltxOpen ? "▾ LTX Image motion" : "▸ LTX Image motion"}
              </button>
              {ltxOpen ? (
                <div className="scratch-ltx-motion-body">
                  <p className="scratch-ltx-motion-lead">{LTX_LIP_SYNC_LEAD}</p>
                  <MobileTextInput
                    value={motionBody}
                    onChange={(v) => {
                      motionEditBeatId.current = beat?.id || null;
                      setMotionDraft(v);
                    }}
                    placeholder='Mouth + head + NAME says: "line" — this is the LTX clip prompt.'
                    multiline
                    rows={8}
                  />
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <MobilePrimaryButton
                      size="chip"
                      tone="ghost"
                      disabled={!beat || !motionBody.trim() || Boolean(busy)}
                      onClick={() => {
                        setBusy("motion");
                        setError("");
                        void persistMotion(motionBody)
                          .catch((e) =>
                            setError(e instanceof Error ? e.message : "Couldn't keep Image motion"),
                          )
                          .finally(() => setBusy(""));
                      }}
                    >
                      {busy === "motion" ? "Keeping…" : "Keep Image motion"}
                    </MobilePrimaryButton>
                    {motionDirty ? (
                      <span style={{ color: "var(--chrome-dim)", fontSize: "11px" }}>
                        Unsaved — Keep or Generate will write it
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <ScratchHistoryStrip
              runs={bench.runs}
              selectedId={selectedRunId}
              padPlateFile={!padCleared ? plateFile : ""}
              blobFallback={
                job
                  ? { styleId: job.styleId, folder: mobileMediaFolder(job) }
                  : undefined
              }
              onSelect={(run) => {
                void restoreHistoryPlate(run);
              }}
              onVerdict={(run, tag) => {
                setSelectedRunId(run.id);
                setBench((prev) =>
                  updateBenchRunTags(prev, run.id, toggleScoreTag(run.tags, tag)),
                );
              }}
              disabled={Boolean(busy)}
              onRemove={(run) => {
                setBench((prev) => removeBenchRun(prev, run.id));
                setSelectedRunId((id) => (id === run.id ? null : id));
              }}
              onClear={() => {
                setBench((prev) => clearBenchRuns(prev));
                setSelectedRunId(null);
              }}
              onExportCsv={() => {
                if (!bench.runs.length) {
                  setError("No history to export yet");
                  return;
                }
                downloadScratchRunsCsv(bench.runs);
              }}
            />
          </div>
        </>
      )}

      {lightbox ? <ScratchLightbox src={lightbox} onClose={() => setLightbox("")} /> : null}
    </main>
  );
}
