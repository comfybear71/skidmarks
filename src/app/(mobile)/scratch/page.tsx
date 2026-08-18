"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
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
import type { CrashStoryBeat, CrashStoryDoc } from "@/lib/crashStoryTypes";
import { approvedCandidateFileName, preferredCandidate, candidateLookPrompt } from "@/lib/mobileJobReady";
import { mobileLocationStillUrl } from "@/lib/mobileCandidateUrls";
import { findScratchShot, scratchPadClips } from "@/lib/mobileScratch";
import { isMobileSavedVoiceFile } from "@/lib/mobileSavedVoice";
import {
  buildDefaultBeatMotion,
  LTX_LIP_SYNC_LEAD,
  stripLtxLipSyncLead,
} from "@/lib/mobileImageMotion";
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
import {
  ScratchChaosSelect,
  ScratchHistoryStrip,
  ScratchPromptBible,
  ScratchScoreToggles,
  type ScratchBiblePickMode,
} from "@/components/scratch";
import {
  appendBenchRun,
  applyBibleTokens,
  clearBenchRuns,
  downloadScratchRunsCsv,
  dropPercents,
  emptyBenchSession,
  generateScratchPrompt,
  injectChaosStill,
  loadBenchSession,
  mergePositionIntoStaging,
  positionPromptLine,
  saveBenchSession,
  setBenchChaos,
  setScratchDrag,
  readScratchDrag,
  stagingActionBody,
  stagingCameraBlock,
  updateBenchRunTags,
  upsertPlacement,
  type ScratchBenchSession,
  type ScratchBibleEntry,
  type ScratchBibleSectionId,
  type ScratchPadPlacement,
  type ScratchBackendId,
  type ScratchScoreTag,
} from "@/lib/scratchBench";
import { useScratchPadHotkeys } from "@/hooks/useScratchPadHotkeys";

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
  const [bench, setBench] = useState<ScratchBenchSession>(() => emptyBenchSession());
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [bibleMode, setBibleMode] = useState<ScratchBiblePickMode>("replace");
  const [bibleActiveId, setBibleActiveId] = useState<string | null>(null);
  const [placements, setPlacements] = useState<ScratchPadPlacement[]>([]);
  const [padDragOver, setPadDragOver] = useState(false);
  /** Last successful Save — unlocks Generate even if story GET lags. */
  const [savedTake, setSavedTake] = useState<{ beatId: string; voiceFile: string } | null>(null);
  const [ltxOpen, setLtxOpen] = useState(true);
  const [clipEngine, setClipEngine] = useState<"ltx" | "siray">("ltx");
  const [stillBackend, setStillBackend] = useState<ScratchBackendId>("unknown");
  const [sirayReady, setSirayReady] = useState(false);
  const [motionDraft, setMotionDraft] = useState<string | null>(null);
  /** Which beat the draft belongs to — ignore draft after mouth / beat switch. */
  const motionEditBeatId = useRef<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const padSurfaceRef = useRef<HTMLDivElement | null>(null);
  const drawSeq = useRef(0);

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
  const activePreset = presets.find((p) => p.id === poseId) || null;
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

  useEffect(() => {
    setPresets(loadScratchPresets());
  }, []);

  useEffect(() => {
    setBench(loadBenchSession());
  }, []);

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
      setPadCleared(false);
      setPlacements([]);
      setError("");
      setResumeError("");
      const who = pickDefaultSpeaker(next);
      const fromScratch = next.scratchPlate?.cast?.filter(Boolean) || [];
      setSpeaker(next.scratchPlate?.speaker || who);
      setPadCast(fromScratch.length ? fromScratch : who ? [who] : []);
      setSceneId(pickDefaultPlace(next));
      setStaging("");
      setLine("");
      await loadStory(next);
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
    poseId?: string;
    staging?: string;
    speaker?: string;
    cast?: string[];
    sceneId?: string;
  }) {
    if (!job) return;
    const nextPose = opts?.poseId ?? poseId;
    const rawStaging = opts?.staging ?? staging;
    const nextStaging = injectChaosStill(rawStaging || "", bench.chaosId);
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
      const drawn = await postJson<{
        job: MobileGenJob;
        staging?: string;
        backend?: ScratchBackendId;
        siray?: boolean;
      }>(
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
      if (drawn.backend) setStillBackend(drawn.backend);
      if (typeof drawn.siray === "boolean") setSirayReady(drawn.siray);
      if (drawn.staging) setStaging(drawn.staging);
      else if (nextStaging) setStaging(nextStaging);
      setPadCleared(false);
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
          plateUrl,
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
      if (seq === drawSeq.current) setBusy("");
    }
  }

  function pickCast(name: string) {
    const onPad = padCast.some((n) => n === name);
    if (!onPad) {
      setPadCast([...padCast, name]);
      setSpeaker(name);
      setSavedTake(null);
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
    setBibleActiveId(null);
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
    setBibleActiveId(null);
    setPoseId("");
  }

  function clearPad() {
    setPadCleared(true);
    setPadCast([]);
    setSpeaker("");
    setStaging("");
    setPoseId("");
    setPlacements([]);
    setBibleActiveId(null);
    setSavedTake(null);
    setError("");
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
      setPadCleared(false);
      const place = { name, xPercent, yPercent };
      setPlacements((prev) => upsertPlacement(prev, place));
      const line = positionPromptLine(name, xPercent, yPercent);
      setStaging((prev) => mergePositionIntoStaging(prev, line, name));
      const beatLine = scratch?.shot.beats.find(
        (b) => b.speaker.trim().toLowerCase() === name.trim().toLowerCase(),
      )?.text;
      if (beatLine) setLine(beatLine);
      return;
    }

    // place / environment
    const id = payload.id;
    setSceneId(id);
    setPadCleared(false);
    const placeLabel = payload.label || job.scenes.find((s) => s.id === id)?.placeName || "this place";
    const backdrop = `[Backdrop: ${placeLabel} — drop anchor ${xPercent}% / ${yPercent}%.]`;
    const base = staging.trim();
    const stripped = base.replace(/\[Backdrop:\s*[^\]]*\]/i, "").trim();
    const nextStaging = stripped ? `${stripped}\n\n${backdrop}` : backdrop;
    setStaging(nextStaging);
    void draw({
      sceneId: id,
      speaker,
      cast: padCast.length ? padCast : speaker ? [speaker] : [],
      poseId,
      staging: nextStaging || undefined,
    });
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
    setBibleActiveId(null);
  }

  function pickBibleEntry(_sectionId: ScratchBibleSectionId, entry: ScratchBibleEntry) {
    const who = speaker || padCast[0] || "Character";
    const text = applyBibleTokens(entry.template, {
      name: who,
      place: placeName,
      cast: padCast.length ? padCast : [who],
    });
    setBibleActiveId(entry.id);
    setPoseId("");
    if (bibleMode === "append" && staging.trim()) {
      setStaging(`${staging.trim()}\n\n${text}`);
    } else {
      setStaging(text);
    }
  }

  function pickPreset(preset: ScratchPreset) {
    const crowd = preset.id.startsWith("crowd-");
    if (crowd && padCast.length < 2) {
      setError("Put at least two faces on the pad for crowd presets");
      return;
    }
    fillFromPreset(preset);
    void draw({
      poseId: preset.id,
      staging: applyScratchPresetTemplate(preset.template, {
        name: speaker || padCast[0] || "Character",
        place: placeName,
        cast: padCast.length ? padCast : [speaker || "Character"],
      }),
      speaker: speaker || padCast[0],
      cast: padCast,
      sceneId,
    });
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
      if (motionBody.trim()) {
        await persistMotion(motionBody);
      }
      const data = await postJson<{
        job?: MobileGenJob;
        backend?: ScratchBackendId;
        siray?: boolean;
      }>("/api/crash/mobile/scratch", {
        action: "clip",
        jobId: job.id,
        beatId: beat.id,
        clipEngine,
      });
      if (typeof data.siray === "boolean") setSirayReady(data.siray);
      if (data.job) setJob(data.job);
      const clipFile =
        data.job?.clips?.filter((c) => c.beatId === beat.id && c.clipFile).at(-1)?.clipFile || "";
      const clipUrl = clipFile
        ? `/api/crash/gen/file?name=${encodeURIComponent(clipFile)}`
        : undefined;
      let loggedId: string | null = null;
      setBench((prev) => {
        const next = appendBenchRun(prev, {
          kind: "clip",
          backend: data.backend || (clipEngine === "siray" ? "siray-i2v" : "ltx"),
          chaosId: prev.chaosId,
          positionPrompt: staging || undefined,
          plateUrl: plateSrc || undefined,
          clipUrl,
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
  const generateReady = clipEngine === "siray" ? canSirayGenerate && sirayReady : canGenerate;

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
                  <button
                    type="button"
                    disabled={!plateSrc}
                    onClick={() => plateSrc && setLightbox(plateSrc)}
                    title={plateSrc ? "Tap to enlarge" : "Drop a face or place here"}
                    style={{
                      ...mobileCard,
                      padding: "2px",
                      lineHeight: 0,
                      width: "100%",
                      border: "none",
                      cursor: plateSrc ? "zoom-in" : "default",
                      background: "var(--panel)",
                      position: "relative",
                    }}
                  >
                    {plateSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={plateSrc} alt="" className="scratch-pad-still" draggable={false} />
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
                        Drag faces left · places right · onto pad
                      </div>
                    )}
                  </button>
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
                      disabled={Boolean(busy)}
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
            </div>

            {padCast.length > 1 ? (
              <div style={{ color: "var(--chrome-dim)", fontSize: "12px" }}>
                On pad: {padCast.join(" · ")}. Speaks:{" "}
                <span style={{ color: "var(--acid)" }}>{speaker || padCast[0]}</span>
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

              <div className="scratch-preset-stack">
                {SCRATCH_PRESET_GROUPS.filter((g) => g !== "Mine").map((group) => {
                  const rows = presets.filter((p) => p.group === group);
                  if (!rows.length) return null;
                  const selectedInGroup = rows.some((p) => p.id === poseId) ? poseId : "";
                  return (
                    <label key={group} className="scratch-preset-row">
                      <span className="scratch-group-label">{group}</span>
                      <select
                        value={selectedInGroup}
                        disabled={Boolean(busy) || !padCast.length || !sceneId}
                        onChange={(e) => {
                          const preset = presets.find((p) => p.id === e.target.value);
                          if (preset) pickPreset(preset);
                        }}
                        style={selectStyle}
                      >
                        <option value="">Choose…</option>
                        {rows.map((p) => (
                          <option key={p.id} value={p.id} disabled={p.id.startsWith("crowd-") && padCast.length < 2}>
                            {p.label}
                            {p.builtin ? "" : " ★"}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
                {presets.some((p) => p.group === "Mine") ? (
                  <label className="scratch-preset-row">
                    <span className="scratch-group-label">Mine</span>
                    <select
                      value={presets.some((p) => p.group === "Mine" && p.id === poseId) ? poseId : ""}
                      disabled={Boolean(busy) || !padCast.length || !sceneId}
                      onChange={(e) => {
                        const preset = presets.find((p) => p.id === e.target.value);
                        if (preset) pickPreset(preset);
                      }}
                      style={selectStyle}
                    >
                      <option value="">Choose…</option>
                      {presets
                        .filter((p) => p.group === "Mine")
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label} ★
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginTop: "2px" }}>
                  <label style={{ display: "block" }}>
                    <span className="scratch-group-label" style={{ display: "block" }}>
                      Name
                    </span>
                    <input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Label"
                      style={{ ...selectStyle, backgroundImage: "none", paddingRight: "8px" }}
                    />
                  </label>
                  <label style={{ display: "block" }}>
                    <span className="scratch-group-label" style={{ display: "block" }}>
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
            </div>

            <ScratchPromptBible
              activeId={bibleActiveId}
              mode={bibleMode}
              onModeChange={setBibleMode}
              onPick={pickBibleEntry}
              disabled={Boolean(busy) || !padCast.length}
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
                onClick={() => setClipEngine("ltx")}
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
                onClick={() => setClipEngine("siray")}
                style={{
                  ...ghostBtn,
                  border: clipEngine === "siray" ? "1px solid var(--acid)" : ghostBtn.border,
                  color: clipEngine === "siray" ? "var(--acid)" : "var(--chrome)",
                }}
              >
                Siray Seedance Spicy
              </button>
              <span style={{ color: "var(--chrome-dim)", fontSize: "11px" }}>
                {clipEngine === "siray"
                  ? "Motion from the still. No lip-sync — keep LTX for the Saved mp3."
                  : "Lip-sync follows the Saved mp3 on Comfy."}
              </span>
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
              onSelect={(run) => {
                setSelectedRunId(run.id);
                if (run.positionPrompt) setStaging(run.positionPrompt);
                if (run.plateUrl) setLightbox(run.plateUrl);
                if (run.placements?.length) {
                  setPlacements(run.placements);
                  setPadCast(run.placements.map((p) => p.name));
                  setSpeaker(run.placements[0]?.name || speaker);
                  setPadCleared(false);
                }
                if (run.dialogue) setLine(run.dialogue);
                if (run.environment && job) {
                  const match = job.scenes.find(
                    (s) => s.placeName.trim().toLowerCase() === run.environment!.trim().toLowerCase(),
                  );
                  if (match) setSceneId(match.id);
                }
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
