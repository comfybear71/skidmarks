"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DeskFold,
  MobileAudioPlayer,
  MobilePrimaryButton,
  MobileTextInput,
  ShimmerText,
  mobileCard,
} from "./MobileUi";
import { PLATE_TILE_PX, PlateClipThumbs, clipsForStillsDesk, clipsUnderPlate } from "./PlateClipThumbs";
import { stackedClipFiles } from "@/lib/mobilePlateClips";
import { orderedJobClips } from "@/lib/orderedJobClips";
import { useMobileAssist } from "./useMobileAssist";
import { ScratchPromptBible, type ScratchBiblePickMode } from "@/components/scratch";
import { PositionPromptPanel, LtxImageMotionPanel } from "@/components/mobile/ShotPromptPanels";
import {
  applyBibleTokens,
  stripBibleSoloLock,
  dropPercents,
  mergePlacementsIntoStaging,
  readScratchDrag,
  resolveShotBibleIds,
  setScratchDrag,
  upsertPlacement,
  type ScratchBibleEntry,
  type ScratchBibleSectionId,
  type ScratchPadPlacement,
} from "@/lib/scratchBench";
import { mobileLocationStillUrl } from "@/lib/mobileCandidateUrls";
import {
  approvedCandidateFileName,
  candidateLookPrompt,
  preferredCandidate,
} from "@/lib/mobileJobReady";
import { imageMotionAssistHint, platePositionAssistHint } from "@/lib/mobileAssist";
import type { MobileClipUnit, MobileGenJob } from "@/lib/mobileGenJob";
import type { CrashStoryBeat, CrashStoryDoc, CrashStoryShot, PlateTake, ShotFootageRole } from "@/lib/crashStoryTypes";
import { StockFootagePanel } from "@/components/StockFootagePanel";
import { isSupportShot } from "@/lib/stockFootage";
import type { StockLook } from "@/lib/stockLook";
import {
  leftoverHydrateBeat,
  plateLineBeats,
  shotSpeakersOnCard,
  speakersAlreadyInPlate,
  castPopupFaceGrey,
} from "@/lib/mobilePlateLines";
import { lineVoiceLabel, type JobSpeakerVoice } from "@/lib/mobileJobVoices";
import { shownVoiceId } from "@/lib/mobileVoicePick";
import type { ShowStyleId } from "@/lib/showStylePresets";
import { applyStylePositionGold, stylePositionGold } from "@/lib/stylePositionGold";
import {
  MUTE_MV_SLOT_PLACEHOLDER,
  buildDefaultBeatMotion,
  buildMuteMvMotionLock,
  clearLtxMotionDraft,
  extractMuteMvMotionSlot,
  looksLikePlatePositionPrompt,
  pickLtxMotionBody,
  readLtxMotionDraft,
  readMvClipEngine,
  readMvEngine,
  readMvMotionSlot,
  storedMotionNeedsRebuild,
  stripLtxLipSyncLead,
  writeLtxMotionDraft,
  writeMvClipEngine,
  writeMvEngine,
  writeMvMotionSlot,
  type MuteMvEngine,
} from "@/lib/mobileImageMotion";
import { compileScriptedPosition } from "@/lib/mobilePlateScript";
import { isEmptyStageStaging } from "@/lib/emptyStagePlate";
import { talkNextShotTitle } from "@/lib/talkClipTimeline";
import { isLeftoverPackVoiceFile, isMobileSavedVoiceFile } from "@/lib/mobileSavedVoice";
import { episodeJobShots } from "@/lib/mobileScratch";
import {
  cutsForPlate,
  isMusicVideoSongJob,
  songCutTallyLine,
  tallySongCuts,
} from "@/lib/musicVideoSong";
import { CutawayBeatPanel } from "@/components/mobile/CutawayBeatPanel";
import { requestSongCookStop } from "@/lib/songCutCook";
import { readApiJson, studioFetchError } from "@/lib/studioFetchError";

function placeStillUrl(job: MobileGenJob, sceneId: string): string {
  const file =
    approvedCandidateFileName(job.locationCandidates, sceneId) ||
    preferredCandidate(job.locationCandidates[sceneId] || [])?.fileName ||
    "";
  return file ? mobileLocationStillUrl(job, file) : "";
}

function speakerFaceUrl(job: MobileGenJob, name: string): string {
  const file =
    approvedCandidateFileName(job.castCandidates, name) ||
    preferredCandidate(job.castCandidates[name] || [])?.fileName ||
    "";
  if (!file) return "";
  return (
    `/api/crash/mobile/cast-face?styleId=${encodeURIComponent(job.styleId)}` +
    `&folderName=${encodeURIComponent(job.folderName || job.id)}` +
    `&characterId=` +
    `&fileName=${encodeURIComponent(file)}`
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

/** One removed shot, kept around just long enough to put back. */
type RemovedShot = { sceneId: string; shot: CrashStoryShot };

async function fetchStory(styleId: string, folderName: string): Promise<CrashStoryDoc | null> {
  const res = await fetch(
    `/api/crash/story?styleId=${encodeURIComponent(styleId)}&folderName=${encodeURIComponent(folderName)}`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  return (data.story as CrashStoryDoc) || null;
}

/** Submit the still, then poll. One long POST was dying as "Couldn't reach Studio". */
async function drawPlateStill(opts: {
  jobId: string;
  shotId: string;
  staging: string;
  bibleIds?: string[];
}): Promise<{
  job?: MobileGenJob;
  plateFile?: string;
  plateTakes?: PlateTake[];
  staging: string;
  bibleIds?: string[];
}> {
  const startRes = await fetch("/api/crash/mobile/plate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: opts.jobId,
      shotId: opts.shotId,
      action: "draw-start",
      staging: opts.staging,
      summary: opts.staging,
      bibleIds: opts.bibleIds,
    }),
  });
  const start = await readApiJson<{
    error?: string;
    pending?: boolean;
    job?: MobileGenJob;
    plateFile?: string;
    plateTakes?: PlateTake[];
    staging?: string;
    bibleIds?: string[];
  }>(startRes);
  if (!start.pending) {
    return {
      job: start.job,
      plateFile: start.plateFile,
      plateTakes: start.plateTakes,
      staging: start.staging || opts.staging,
      bibleIds: start.bibleIds,
    };
  }
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const pollRes = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: opts.jobId,
          shotId: opts.shotId,
          action: "draw-poll",
        }),
      });
      const poll = await readApiJson<{
        error?: string;
        pending?: boolean;
        job?: MobileGenJob;
        plateFile?: string;
        plateTakes?: PlateTake[];
        staging?: string;
        bibleIds?: string[];
      }>(pollRes);
      if (!poll.pending) {
        return {
          job: poll.job,
          plateFile: poll.plateFile,
          plateTakes: poll.plateTakes,
          staging: poll.staging || opts.staging,
          bibleIds: poll.bibleIds,
        };
      }
    } catch {
      /* short poll dropped — keep waiting, don't pink-line yet */
    }
  }
  throw new Error("Draw is still cooking. The episode is still there — tap again.");
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
  collapsed,
  onExpand,
  defaultPlaceId,
  focusShotId,
}: {
  job: MobileGenJob;
  onJobChange?: (job: MobileGenJob) => void;
  /** Strip-only mode — everything below the thumbnails stays hidden. */
  collapsed?: boolean;
  onExpand?: () => void;
  /** Place currently open under Locations — new + cards land here. */
  defaultPlaceId?: string;
  /** Shot just minted from Locations — open it on the strip. */
  focusShotId?: string | null;
}) {
  const [story, setStory] = useState<CrashStoryDoc | null>(null);
  const [loadError, setLoadError] = useState("");
  const [openShotId, setOpenShotId] = useState<string | null>(null);
  const [castPickerShotId, setCastPickerShotId] = useState<string | null>(null);
  const [addBusySpeaker, setAddBusySpeaker] = useState<string | null>(null);
  const [addError, setAddError] = useState("");
  const [removedBuffer, setRemovedBuffer] = useState<RemovedShot[]>([]);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [songAddFor, setSongAddFor] = useState<string | null>(null);
  const [clipBusy, setClipBusy] = useState(false);
  const [clipsOpen, setClipsOpen] = useState(false);
  const [stillsStripOpen, setStillsStripOpen] = useState(false);
  const clipsAutoOpened = useRef(false);

  const shots = episodeJobShots(job, story);
  const shotIdsKey = shots.map((s) => s.shotId).join("\0");

  useEffect(() => {
    let cancelled = false;
    fetchStory(job.styleId, job.folderName)
      .then((s) => {
        if (cancelled) return;
        if (s) {
          setStory(s);
          setLoadError("");
        } else setLoadError("Couldn't load the plates. Tap + — the episode is still there.");
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(studioFetchError(e, "Couldn't load the plates. Tap + — the episode is still there."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [job.styleId, job.folderName, shotIdsKey]);

  useEffect(() => {
    const id = (focusShotId || "").trim();
    if (id) {
      setOpenShotId(id);
      setStillsStripOpen(true);
    }
  }, [focusShotId]);

  const shotById = (shotId: string): CrashStoryShot | null => {
    if (!story) return null;
    for (const scene of story.scenes) {
      const shot = scene.shots.find((sh) => sh.id === shotId);
      if (shot) return shot;
    }
    return null;
  };

  /** Job strip is plated/unplated truth. Hydrate used to glue leftover
   * Blob stills onto an empty plateFile — don't show Comfy on a Jo card. */
  const displayShot = (shotId: string): CrashStoryShot | null => {
    const fromStory = shotById(shotId);
    if (!fromStory) return null;
    const beats = fromStory.beats.filter((b) => !leftoverHydrateBeat(fromStory.id, b.id));
    const fromJob = shots.find((s) => s.shotId === shotId);
    const jobPlated = Boolean(
      fromJob?.plateFile && fromJob.plateFile !== "__error__",
    );
    if (jobPlated || (!fromStory.plateFile && !(fromStory.plateTakes && fromStory.plateTakes.length))) {
      return { ...fromStory, beats };
    }
    return { ...fromStory, plateFile: "", plateTakes: [], beats };
  };

  /** Full-bleed Clips rail under the plate strip — not trapped in a 160px column. */
  const plateClipRail = useMemo(() => {
    const focus = (openShotId || "").trim();
    const deskClips = clipsForStillsDesk(job);
    const gather = (list: typeof shots) => {
      const out: MobileClipUnit[] = [];
      for (const s of list) {
        const beatIds = displayShot(s.shotId)?.beats.map((b) => b.id) || [];
        out.push(...clipsUnderPlate(s.shotId, beatIds, deskClips));
      }
      return out;
    };
    let clips = gather(focus ? shots.filter((s) => s.shotId === focus) : shots);
    let focused = Boolean(focus && clips.length);
    if (focus && !clips.length) {
      clips = gather(shots);
      focused = false;
    }
    const posterRow =
      (focus ? shots.find((s) => s.shotId === focus) : null) ||
      shots.find((s) => {
        const beatIds = displayShot(s.shotId)?.beats.map((b) => b.id) || [];
        return clipsUnderPlate(s.shotId, beatIds, deskClips).length > 0;
      });
    const plated = Boolean(posterRow?.plateFile && posterRow.plateFile !== "__error__");
    const poster = plated
      ? `/api/crash/gen/file?name=${encodeURIComponent(posterRow!.plateFile)}`
      : posterRow
        ? placeStillUrl(job, posterRow.sceneId)
        : undefined;
    const posterByShotId: Record<string, string> = {};
    for (const s of shots) {
      if (s.plateFile && s.plateFile !== "__error__") {
        posterByShotId[s.shotId] = `/api/crash/gen/file?name=${encodeURIComponent(s.plateFile)}`;
      } else {
        const place = placeStillUrl(job, s.sceneId);
        if (place) posterByShotId[s.shotId] = place;
      }
    }
    const focusIdx = focus ? shots.findIndex((s) => s.shotId === focus) : -1;
    return {
      clips,
      poster,
      posterByShotId,
      focusLabel: focused && focusIdx >= 0 ? `plate ${focusIdx + 1}` : "",
    };
    // displayShot closes over story + shots; list those rather than the fn.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- displayShot is local
  }, [openShotId, shots, story, job]);

  const zipClips = useMemo(() => orderedJobClips(job, story), [job, story]);
  const zipHref = zipClips.length
    ? `/api/crash/mobile/clips/zip?jobId=${encodeURIComponent(job.id)}`
    : "";

  useEffect(() => {
    if (clipsAutoOpened.current) return;
    const hasFile = plateClipRail.clips.some((c) => stackedClipFiles(c).length > 0);
    if (!hasFile) return;
    clipsAutoOpened.current = true;
    setClipsOpen(true);
  }, [plateClipRail.clips]);

  function defaultSceneId(): string | null {
    const known = (id: string | undefined): string | null => {
      if (!id) return null;
      if (job.scenes.some((s) => s.id === id)) return id;
      if (story?.scenes.some((s) => s.id === id)) return id;
      return null;
    };
    const focused = known(defaultPlaceId);
    if (focused) return focused;
    if (openShotId) {
      const sc = story?.scenes.find((s) => s.shots.some((sh) => sh.id === openShotId));
      if (sc) return sc.id;
      const fromOpen = known(shots.find((s) => s.shotId === openShotId)?.sceneId);
      if (fromOpen) return fromOpen;
    }
    if (shots.length) {
      const last = known(shots[shots.length - 1].sceneId);
      if (last) return last;
    }
    return job.scenes[0]?.id || story?.scenes[0]?.id || null;
  }

  async function addPlaceCard(speaker = "") {
    const sceneId = defaultSceneId();
    if (!sceneId) {
      setAddError("No location yet — build one first.");
      return;
    }
    setAddError("");
    setAddBusySpeaker(speaker || "__empty__");
    try {
      const titled = (story?.scenes || []).flatMap((sc) =>
        sc.shots.map((sh) => ({ title: sh.title })),
      );
      const title = talkNextShotTitle(titled, speaker);
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, action: "add", sceneId, speaker, title }),
      });
      const data = (await res.json()) as { error?: string; job?: MobileGenJob; shotId?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't add that card");
      const fresh = await fetchStory(job.styleId, job.folderName);
      if (fresh) setStory(fresh);
      if (data.job) onJobChange?.(data.job);
      if (data.shotId) setOpenShotId(data.shotId);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Couldn't add that card");
    } finally {
      setAddBusySpeaker(null);
    }
  }

  async function clearAllShots() {
    setActionError("");
    setClearBusy(true);
    try {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, action: "clear" }),
      });
      const data = (await res.json()) as {
        error?: string;
        job?: MobileGenJob;
        removed?: RemovedShot[];
      };
      if (!res.ok) throw new Error(data.error || "Couldn't clear the shots");
      setOpenShotId(null);
      setStory((cur) => {
        if (!cur) return cur;
        const removedIds = new Set((data.removed || []).map((r) => r.shot.id));
        return {
          ...cur,
          scenes: cur.scenes.map((sc) => ({ ...sc, shots: sc.shots.filter((sh) => !removedIds.has(sh.id)) })),
        };
      });
      if (data.job) onJobChange?.(data.job);
      if (data.removed?.length) setRemovedBuffer(data.removed);
      setClearConfirm(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't clear the shots");
    } finally {
      setClearBusy(false);
    }
  }

  async function undoRemoved() {
    if (!removedBuffer.length) return;
    setUndoBusy(true);
    setActionError("");
    try {
      for (const { sceneId, shot } of removedBuffer) {
        const res = await fetch("/api/crash/mobile/plate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: job.id, action: "restore", sceneId, shot }),
        });
        const data = (await res.json()) as { error?: string; job?: MobileGenJob };
        if (!res.ok) throw new Error(data.error || "Couldn't undo that");
        if (data.job) onJobChange?.(data.job);
      }
      const fresh = await fetchStory(job.styleId, job.folderName);
      if (fresh) setStory(fresh);
      setRemovedBuffer([]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't undo that");
    } finally {
      setUndoBusy(false);
    }
  }

  async function removePlate(shotId: string) {
    setActionError("");
    try {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, shotId, action: "remove" }),
      });
      const data = await readApiJson<{
        job?: MobileGenJob;
        removedShot?: CrashStoryShot;
        sceneId?: string;
        error?: string;
      }>(res);
      if (openShotId === shotId) setOpenShotId(null);
      if (castPickerShotId === shotId) setCastPickerShotId(null);
      setStory((cur) => {
        if (!cur) return cur;
        return {
          ...cur,
          scenes: cur.scenes.map((sc) => ({
            ...sc,
            shots: sc.shots.filter((sh) => sh.id !== shotId),
          })),
        };
      });
      if (data.job) onJobChange?.(data.job);
      if (data.removedShot && data.sceneId) {
        setRemovedBuffer([{ sceneId: data.sceneId, shot: data.removedShot }]);
      }
    } catch (e) {
      setActionError(studioFetchError(e, "Couldn't remove that plate"));
    }
  }

  async function postClipAction(body: Record<string, string>) {
    setActionError("");
    setClipBusy(true);
    if (isMusicVideoSongJob(job) && body.action === "remove-clip") {
      requestSongCookStop(job.id);
    }
    try {
      const res = await fetch("/api/crash/mobile/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, ...body }),
      });
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (data.job) onJobChange?.(data.job);
    } catch (e) {
      setActionError(studioFetchError(e, "Couldn't park that clip"));
    } finally {
      setClipBusy(false);
    }
  }

  async function addPlateToSong(shotId: string) {
    if (!job.scratchSong?.fileName) {
      setActionError("Drop the song mp3 first.");
      return;
    }
    setSongAddFor(shotId);
    setActionError("");
    try {
      const res = await fetch("/api/crash/mobile/song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-plate",
          jobId: job.id,
          shotId,
        }),
      });
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (data.job) onJobChange?.(data.job);
      const fresh = await fetchStory(job.styleId, job.folderName);
      if (fresh) setStory(fresh);
    } catch (e) {
      setActionError(studioFetchError(e, "Couldn't add this plate to the song"));
    } finally {
      setSongAddFor(null);
    }
  }

  const songReady = isMusicVideoSongJob(job) && Boolean(job.scratchSong?.fileName);
  // Music video adds plates from the track rail under the wave — this empty
  // strip duplicated the + and the "no plates yet" line under Sections.
  const musicVideoTrackOwnsEmptyPlates = isMusicVideoSongJob(job) && !shots.length;

  return (
    <div style={{ marginBottom: "16px" }}>
      {loadError ? (
        <div style={{ fontSize: "13px", color: "var(--magenta-hot)", margin: "0 2px 8px" }}>{loadError}</div>
      ) : null}
      {!shots.length && !musicVideoTrackOwnsEmptyPlates ? (
        <div style={{ fontSize: "13px", color: "var(--chrome-dim)", margin: "0 2px 8px", lineHeight: 1.4 }}>
          No plates yet. Tap + for an empty card, or tap a name on a place then Add.
        </div>
      ) : null}
      {focusShotId && shots.some((s) => s.shotId === focusShotId) ? (
        <div className="m-place-plate-note" style={{ margin: "0 2px 8px" }}>
          New plate — this one. No still yet. Tap it, then Draw.
        </div>
      ) : null}
      {musicVideoTrackOwnsEmptyPlates ? null : (
      <DeskFold
        label="Stills"
        count={shots.length}
        open={stillsStripOpen}
        onToggle={() => setStillsStripOpen((v) => !v)}
      >
      {collapsed ? null : shots.length || job.finalVideoFile ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", margin: "0 2px 8px" }}>
          <button
            type="button"
            onClick={() => setClearConfirm((v) => !v)}
            style={{
              flex: "0 0 auto",
              padding: "4px 8px",
              borderRadius: "2px",
              border: "1px solid var(--line)",
              background: "transparent",
              color: "var(--chrome-dim)",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              cursor: "pointer",
            }}
          >
            {shots.length ? "Clear all" : "Clear video"}
          </button>
        </div>
      ) : null}

      {!collapsed && clearConfirm ? (
        <div
          style={{
            ...mobileCard,
            padding: "10px",
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div style={{ flex: 1, fontSize: "12px", color: "var(--chrome)" }}>
            {shots.length
              ? `Remove all ${shots.length} shot${shots.length === 1 ? "" : "s"}? Plates and audio already made stay on disk — Undo puts the cards straight back.`
              : "Clear the leftover stitched video? It was built from shots that are already gone."}
          </div>
          <button
            type="button"
            onClick={() => setClearConfirm(false)}
            style={{
              padding: "6px 10px",
              borderRadius: "2px",
              border: "1px solid var(--line)",
              background: "transparent",
              color: "var(--chrome)",
              fontSize: "12px",
            }}
          >
            Cancel
          </button>
          <MobilePrimaryButton size="chip" disabled={clearBusy} onClick={() => void clearAllShots()}>
            {clearBusy ? "…" : "Clear all"}
          </MobilePrimaryButton>
        </div>
      ) : null}

      {!collapsed && removedBuffer.length ? (
        <div
          style={{
            ...mobileCard,
            padding: "10px",
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div style={{ flex: 1, fontSize: "12px", color: "var(--chrome)" }}>
            Removed {removedBuffer.length} shot{removedBuffer.length === 1 ? "" : "s"}.
          </div>
          <button
            type="button"
            onClick={() => setRemovedBuffer([])}
            style={{
              padding: "6px 10px",
              borderRadius: "2px",
              border: "1px solid var(--line)",
              background: "transparent",
              color: "var(--chrome-dim)",
              fontSize: "12px",
            }}
          >
            Dismiss
          </button>
          <MobilePrimaryButton size="chip" disabled={undoBusy} onClick={() => void undoRemoved()}>
            {undoBusy ? "…" : "Undo"}
          </MobilePrimaryButton>
        </div>
      ) : null}

      {!collapsed && actionError ? (
        <div style={{ fontSize: "12px", color: "var(--magenta-hot)", marginBottom: "8px" }}>{actionError}</div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: "10px",
          overflowX: "auto",
          padding: "2px 2px 10px",
          touchAction: "pan-x pan-y",
          alignItems: "flex-start",
        }}
      >
        {shots.map((s, i) => {
          const plated = Boolean(s.plateFile && s.plateFile !== "__error__");
          const placeSrc = placeStillUrl(job, s.sceneId);
          const thumbSrc = plated
            ? `/api/crash/gen/file?name=${encodeURIComponent(s.plateFile)}`
            : placeSrc;
          const addingCast = castPickerShotId === s.shotId;
          const storyShot = displayShot(s.shotId);
          const songMine = isMusicVideoSongJob(job)
            ? cutsForPlate(job.scratchSong?.cuts, s.shotId, s.plateFile)
            : [];
          const songTally = tallySongCuts(songMine);
          return (
            <div
              key={s.shotId}
              style={{
                position: "relative",
                flex: "0 0 auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {!collapsed ? (
                <button
                  type="button"
                  aria-label="Add someone to this plate"
                  title="Add someone"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenShotId(s.shotId);
                    setCastPickerShotId((cur) => (cur === s.shotId ? null : s.shotId));
                  }}
                  style={{
                    width: "28px",
                    height: "28px",
                    padding: 0,
                    borderRadius: "2px",
                    border: "1px solid var(--acid)",
                    background: addingCast ? "var(--acid)" : "transparent",
                    color: addingCast ? "#111" : "var(--acid)",
                    fontSize: "16px",
                    lineHeight: 1,
                    cursor: "pointer",
                  }}
                >
                  +
                </button>
              ) : null}
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => {
                    if (collapsed) {
                      onExpand?.();
                      setOpenShotId(s.shotId);
                      return;
                    }
                    setCastPickerShotId(null);
                    setOpenShotId((cur) => (cur === s.shotId ? null : s.shotId));
                  }}
                  style={{
                    position: "relative",
                    padding: "2px",
                    border: s.shotId === openShotId ? "2px solid var(--acid)" : "2px solid var(--line)",
                    borderRadius: "2px",
                    background: "var(--panel-2)",
                    cursor: "pointer",
                    lineHeight: 0,
                  }}
                >
                  {isSupportShot(storyShot) ? (
                    <span
                      style={{
                        position: "absolute",
                        right: "4px",
                        bottom: "4px",
                        fontSize: "9px",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        background: "var(--acid)",
                        color: "#111",
                        padding: "1px 4px",
                        borderRadius: "2px",
                        zIndex: 2,
                      }}
                    >
                      Stock
                    </span>
                  ) : null}
                  {thumbSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbSrc}
                      alt=""
                      style={{
                        width: `${PLATE_TILE_PX}px`,
                        height: `${PLATE_TILE_PX}px`,
                        objectFit: "cover",
                        borderRadius: "2px",
                        display: "block",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: `${PLATE_TILE_PX}px`,
                        height: `${PLATE_TILE_PX}px`,
                        borderRadius: "2px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--chrome-dim)",
                        fontSize: "13px",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {i + 1}
                    </div>
                  )}
                  {!plated ? (
                    <div className="m-plate-no-still">
                      <span>
                        {(storyShot?.beats || [])
                          .map((b) => b.speaker.trim())
                          .filter(Boolean)
                          .join(", ") || "Empty"}
                      </span>
                      <span className="m-plate-no-still-sub">
                        {placeSrc ? "Empty stage" : "No still"}
                      </span>
                    </div>
                  ) : null}
                </button>
                {!collapsed ? (
                  <button
                    type="button"
                    aria-label="Remove this plate"
                    title="Remove this plate, its clips, and the lines below. Files park in _cleared/ — not deleted."
                    onClick={(e) => {
                      e.stopPropagation();
                      void removePlate(s.shotId);
                    }}
                    style={{
                      position: "absolute",
                      top: "4px",
                      left: "4px",
                      width: "18px",
                      height: "18px",
                      padding: 0,
                      borderRadius: "2px",
                      border: "1px solid var(--acid)",
                      background: "rgba(0,0,0,0.72)",
                      color: "var(--acid)",
                      fontSize: "12px",
                      lineHeight: 1,
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
              {!collapsed && songTally.total ? (
                <div className="m-song-plate-tally">{songCutTallyLine(songTally)}</div>
              ) : null}
              {!collapsed && songReady ? (
                <div
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <MobilePrimaryButton
                    size="chip"
                    busy={songAddFor === s.shotId}
                    disabled={Boolean(songAddFor) && songAddFor !== s.shotId}
                    onClick={() => void addPlateToSong(s.shotId)}
                  >
                    {songAddFor === s.shotId ? "Adding…" : "Add"}
                  </MobilePrimaryButton>
                </div>
              ) : null}
            </div>
          );
        })}

        {isMusicVideoSongJob(job) ? null : (
          <button
            type="button"
            aria-label="Add a new plate"
            disabled={Boolean(addBusySpeaker)}
            onClick={() => {
              if (collapsed) onExpand?.();
              setCastPickerShotId(null);
              void addPlaceCard("");
            }}
            style={{
              flex: "0 0 auto",
              width: `${PLATE_TILE_PX + 4}px`,
              height: `${PLATE_TILE_PX + 4}px`,
              borderRadius: "2px",
              border: addBusySpeaker === "__empty__" ? "2px solid var(--acid)" : "2px dashed var(--line)",
              background: "var(--panel-2)",
              color: "var(--chrome-dim)",
              fontSize: "32px",
              lineHeight: 1,
              cursor: addBusySpeaker ? "default" : "pointer",
            }}
          >
            {addBusySpeaker === "__empty__" ? "…" : "+"}
          </button>
        )}
      </div>
      </DeskFold>
      )}

      {!collapsed && zipClips.length ? (
        <DeskFold
          label="Clips"
          count={zipClips.length}
          open={clipsOpen}
          onToggle={() => setClipsOpen((v) => !v)}
        >
          {zipHref ? (
            <div style={{ margin: "0 2px 8px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <a
                href={zipHref}
                download
                style={{
                  color: "var(--acid)",
                  fontSize: "13px",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Download clips zip
              </a>
              <div style={{ color: "var(--chrome-dim)", fontSize: "12px" }}>
                Shot order, named 01_Who_Shot_title.mp4. Not a stitch.
              </div>
            </div>
          ) : null}
          <div className="m-plate-clips-bleed">
            {plateClipRail.focusLabel ? (
              <span className="m-plate-clips-bleed-focus">{plateClipRail.focusLabel}</span>
            ) : null}
            <div className="m-plate-clip-rail">
              <PlateClipThumbs
                job={job}
                clips={plateClipRail.clips}
                poster={plateClipRail.poster}
                posterByShotId={plateClipRail.posterByShotId}
                preload
                layout="strip"
                removeDisabled={clipBusy}
                onRemoveTake={({ beatId, fileName }) =>
                  void postClipAction({ action: "remove-clip", beatId, fileName })
                }
              />
            </div>
          </div>
        </DeskFold>
      ) : null}

      {addError ? (
        <div style={{ fontSize: "12px", color: "var(--magenta-hot)", margin: "0 0 10px" }}>{addError}</div>
      ) : null}

      {!collapsed && castPickerShotId ? (
        <CastIntoPlatePopup
          job={job}
          shotId={castPickerShotId}
          shot={displayShot(castPickerShotId)}
          placeName={
            job.scenes.find(
              (sc) => sc.id === shots.find((s) => s.shotId === castPickerShotId)?.sceneId,
            )?.placeName ||
            story?.scenes.find((sc) => sc.shots.some((sh) => sh.id === castPickerShotId))
              ?.placeName ||
            ""
          }
          placeLook={candidateLookPrompt(
            job.locationCandidates,
            shots.find((s) => s.shotId === castPickerShotId)?.sceneId || "",
          )}
          placeSrc={placeStillUrl(
            job,
            shots.find((s) => s.shotId === castPickerShotId)?.sceneId || "",
          )}
          onCancel={() => setCastPickerShotId(null)}
          onPlaced={(result) => {
            const id = castPickerShotId;
            if (result.job) onJobChange?.(result.job);
            setStory((cur) => {
              if (!cur || !id) return cur;
              return {
                ...cur,
                scenes: cur.scenes.map((sc) => ({
                  ...sc,
                  shots: sc.shots.map((sh) =>
                    sh.id === id
                      ? {
                          ...sh,
                          ...(result.plateFile ? { plateFile: result.plateFile } : {}),
                          ...(result.plateTakes ? { plateTakes: result.plateTakes } : {}),
                          staging: result.staging,
                          summary: result.staging,
                        }
                      : sh,
                  ),
                })),
              };
            });
            void fetchStory(job.styleId, job.folderName).then((fresh) => {
              if (fresh) setStory(fresh);
            });
            setCastPickerShotId(null);
            if (id) setOpenShotId(id);
          }}
        />
      ) : null}

      {!collapsed && openShotId && !castPickerShotId ? (
        <ShotLineEditor
          key={openShotId}
          styleId={job.styleId}
          folderName={job.folderName}
          jobId={job.id}
          stockLook={job.stockLook}
          jobSpeakers={job.speakers}
          jobVoices={job.speakerVoices}
          lookForSpeaker={(name) =>
            candidateLookPrompt(job.castCandidates, name) ||
            job.roster.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase())
              ?.appearance ||
            ""
          }
          shot={displayShot(openShotId)}
          clips={job.clips}
          trackClipFile={
            (job.scratchSong?.cuts || []).find(
              (c) => (c.shotId || "") === openShotId && (c.clipFile || "").trim(),
            )?.clipFile || ""
          }
          loading={!story && !loadError}
          error={loadError}
          placeName={
            (() => {
              const row = shots.find((s) => s.shotId === openShotId);
              if (!row) return "this place";
              return job.scenes.find((sc) => sc.id === row.sceneId)?.placeName || "this place";
            })()
          }
          placeSrc={
            shots.find((s) => s.shotId === openShotId)
              ? placeStillUrl(job, shots.find((s) => s.shotId === openShotId)!.sceneId)
              : ""
          }
          jobPlated={Boolean(
            shots.find((s) => s.shotId === openShotId)?.plateFile &&
              shots.find((s) => s.shotId === openShotId)?.plateFile !== "__error__",
          )}
          clipRemoveDisabled={clipBusy}
          onAddCast={() => {
            if (!openShotId) return;
            setCastPickerShotId(openShotId);
          }}
          onAddToSong={
            songReady && openShotId
              ? () => void addPlateToSong(openShotId)
              : undefined
          }
          songAdding={Boolean(openShotId && songAddFor === openShotId)}
          onJobChange={onJobChange}
          onShotMeta={(patch) => {
            if (!openShotId) return;
            setStory((cur) => {
              if (!cur) return cur;
              return {
                ...cur,
                scenes: cur.scenes.map((sc) => ({
                  ...sc,
                  shots: sc.shots.map((sh) =>
                    sh.id === openShotId ? { ...sh, ...patch } : sh,
                  ),
                })),
              };
            });
          }}
          onDismissClipError={(beatId) => void postClipAction({ action: "dismiss", beatId })}
          onPlateRebuilt={(plateFile, staging, summary, plateTakes, bibleIds) => {
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
                          ...(plateTakes !== undefined ? { plateTakes } : {}),
                          ...(bibleIds !== undefined ? { bibleIds } : {}),
                        }
                      : sh,
                  ),
                })),
              };
            });
          }}
          onLineAdded={(beat) => {
            setStory((cur) => {
              if (!cur || !openShotId) return cur;
              return {
                ...cur,
                scenes: cur.scenes.map((sc) => ({
                  ...sc,
                  shots: sc.shots.map((sh) =>
                    sh.id === openShotId && !sh.beats.some((b) => b.id === beat.id)
                      ? { ...sh, beats: [...sh.beats, beat] }
                      : sh,
                  ),
                })),
              };
            });
          }}
          onLineRemoved={(beatId, nextJob) => {
            if (nextJob) onJobChange?.(nextJob);
            setStory((cur) => {
              if (!cur || !openShotId) return cur;
              return {
                ...cur,
                scenes: cur.scenes.map((sc) => ({
                  ...sc,
                  shots: sc.shots.map((sh) =>
                    sh.id === openShotId
                      ? { ...sh, beats: sh.beats.filter((b) => b.id !== beatId) }
                      : sh,
                  ),
                })),
              };
            });
          }}
          onBeatSaved={(beatId, text, voiceFile, imageMotion, nextJob) => {
            if (nextJob) onJobChange?.(nextJob);
            setStory((cur) => {
              if (!cur) return cur;
              return {
                ...cur,
                scenes: cur.scenes.map((sc) => ({
                  ...sc,
                  shots: sc.shots.map((sh) => ({
                    ...sh,
                    beats: sh.beats.map((b) =>
                      b.id === beatId
                        ? {
                            ...b,
                            text,
                            voiceFile,
                            ...(imageMotion !== undefined ? { imageMotion } : {}),
                          }
                        : b,
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

/** Scrollable "everyone" picker. One = tap a face (rest grey) and Draw.
 * 2 or more = Scratch pad: park faces on the room still, then Draw. */
function CastIntoPlatePopup({
  job,
  shotId,
  shot,
  placeName,
  placeLook,
  placeSrc,
  onCancel,
  onPlaced,
}: {
  job: MobileGenJob;
  shotId: string;
  shot: CrashStoryShot | null;
  placeName: string;
  placeLook: string;
  placeSrc?: string;
  onCancel: () => void;
  onPlaced: (result: {
    job?: MobileGenJob;
    plateFile?: string;
    plateTakes?: PlateTake[];
    staging: string;
  }) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [crowd, setCrowd] = useState(false);
  const [padCast, setPadCast] = useState<string[]>([]);
  const [placements, setPlacements] = useState<ScratchPadPlacement[]>([]);
  const [staging, setStaging] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [bibleMode, setBibleMode] = useState<ScratchBiblePickMode>("replace");
  const [bibleActiveId, setBibleActiveId] = useState<string | null>(null);
  const [padDragOver, setPadDragOver] = useState(false);
  const padSurfaceRef = useRef<HTMLDivElement | null>(null);
  const markDragging = useRef(false);
  const inShot = new Set(
    speakersAlreadyInPlate({
      shotId: shot?.id || shotId,
      title: shot?.title,
      staging: shot?.staging,
      summary: shot?.summary,
      plateFile: shot?.plateFile,
      jobSpeakers: job.speakers,
      beats: shot?.beats || [],
    }).map((n) => n.toLowerCase()),
  );
  const crowdPeople = crowd ? padCast : picked ? [picked] : [];
  const hint = platePositionAssistHint({
    people: crowdPeople,
    placeName,
    placeLook,
    looks: crowdPeople.map((name) => ({
      name,
      look: candidateLookPrompt(job.castCandidates, name),
    })),
  });
  const assist = useMobileAssist("plate", job.styleId, () => staging, setStaging, hint);

  function crowdX(count: number): number {
    if (count === 0) return 70;
    if (count === 1) return 22;
    return Math.min(88, 22 + count * 28);
  }

  function writeCrowdLetter(nextPlaces: ScratchPadPlacement[]) {
    setStaging(mergePlacementsIntoStaging("", nextPlaces, placeName || "this place"));
  }

  function parkFace(name: string, xPercent: number, yPercent: number) {
    setPadCast((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setPlacements((prev) => {
      const next = upsertPlacement(prev, { name, xPercent, yPercent });
      writeCrowdLetter(next);
      return next;
    });
    setPicked(name);
    setError("");
  }

  function unparkFace(name: string) {
    const nextCast = padCast.filter((n) => n !== name);
    const nextPlaces = placements.filter((p) => p.name !== name);
    setPadCast(nextCast);
    setPlacements(nextPlaces);
    writeCrowdLetter(nextPlaces);
    setPicked(nextCast[nextCast.length - 1] || null);
  }

  function pickFace(name: string) {
    if (crowd) {
      if (!padCast.includes(name)) {
        parkFace(name, crowdX(padCast.length), 58);
        return;
      }
      if (picked === name) {
        unparkFace(name);
        return;
      }
      setPicked(name);
      setError("");
      return;
    }
    setPicked(name);
    setStaging(inShot.has(name.trim().toLowerCase()) ? shot?.staging?.trim() || "" : "");
    setError("");
  }

  function turnCrowd(on: boolean) {
    setCrowd(on);
    setError("");
    if (!on) return;
    const already = speakersAlreadyInPlate({
      shotId: shot?.id || shotId,
      title: shot?.title,
      staging: shot?.staging,
      summary: shot?.summary,
      plateFile: shot?.plateFile,
      jobSpeakers: job.speakers,
      beats: shot?.beats || [],
    });
    if (!already.length) return;
    const places = already.map((name, i) => ({
      name,
      xPercent: crowdX(i),
      yPercent: 58,
    }));
    setPadCast(already);
    setPlacements(places);
    setPicked(already[already.length - 1] || null);
    writeCrowdLetter(places);
  }

  function onPadDragOver(e: React.DragEvent) {
    if (!crowd) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!padDragOver) setPadDragOver(true);
  }

  function onPadDragLeave(e: React.DragEvent) {
    const next = e.relatedTarget as Node | null;
    if (next && padSurfaceRef.current?.contains(next)) return;
    setPadDragOver(false);
  }

  function placeAtClient(clientX: number, clientY: number, name: string) {
    if (!padSurfaceRef.current) return;
    const { xPercent, yPercent } = dropPercents(
      clientX,
      clientY,
      padSurfaceRef.current.getBoundingClientRect(),
    );
    parkFace(name, xPercent, yPercent);
  }

  function onPadDrop(e: React.DragEvent) {
    e.preventDefault();
    setPadDragOver(false);
    if (!crowd) return;
    const payload = readScratchDrag(e.dataTransfer);
    if (!payload || payload.type !== "actor") return;
    placeAtClient(e.clientX, e.clientY, payload.id);
  }

  async function putIn() {
    if (crowd) {
      if (padCast.length < 2) {
        setError("Park at least two faces on the room — tap them, or drag onto the still.");
        return;
      }
    } else if (!picked || !staging.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (crowd) {
        const letter = mergePlacementsIntoStaging(
          staging.trim(),
          placements,
          placeName || "this place",
        );
        for (const name of padCast) {
          if (inShot.has(name.trim().toLowerCase())) continue;
          const addRes = await fetch("/api/crash/mobile/plate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId: job.id, shotId, speaker: name, action: "add-cast" }),
          });
          try {
            await readApiJson<{ error?: string }>(addRes);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "";
            if (!/already in this shot/i.test(msg)) throw e;
          }
        }
        const drawData = await drawPlateStill({
          jobId: job.id,
          shotId,
          staging: letter,
        });
        onPlaced({
          job: drawData.job,
          plateFile: drawData.plateFile,
          plateTakes: drawData.plateTakes,
          staging: drawData.staging || letter,
        });
        return;
      }
      const already = inShot.has(picked!.trim().toLowerCase());
      if (!already) {
        const addRes = await fetch("/api/crash/mobile/plate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: job.id, shotId, speaker: picked, action: "add-cast" }),
        });
        try {
          await readApiJson<{ error?: string }>(addRes);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (!/already in this shot/i.test(msg)) throw e;
        }
      }
      const existing = (shot?.staging || "").trim();
      const next = already
        ? staging.trim()
        : existing && !isEmptyStageStaging(existing)
          ? `${existing.replace(/\s+$/, "")} ${staging.trim()}`
          : staging.trim();
      const drawData = await drawPlateStill({
        jobId: job.id,
        shotId,
        staging: next,
      });
      onPlaced({
        job: drawData.job,
        plateFile: drawData.plateFile,
        plateTakes: drawData.plateTakes,
        staging: drawData.staging || next,
      });
    } catch (e) {
      setError(studioFetchError(e, "Couldn't draw that still"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        ...mobileCard,
        padding: "12px",
        marginBottom: "10px",
        maxHeight: crowd ? "82vh" : "70vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Cast strip stays pinned — bible/position scroll under it */}
      <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              flex: 1,
              color: "var(--chrome-dim)",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Who&apos;s in this plate
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => turnCrowd(false)}
            style={{
              padding: "4px 8px",
              borderRadius: "8px",
              border: crowd ? "1px solid var(--line)" : "1px solid var(--acid)",
              background: "transparent",
              color: crowd ? "var(--chrome)" : "var(--acid)",
              fontSize: "11px",
            }}
          >
            One
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => turnCrowd(true)}
            style={{
              padding: "4px 8px",
              borderRadius: "8px",
              border: crowd ? "1px solid var(--acid)" : "1px solid var(--line)",
              background: "transparent",
              color: crowd ? "var(--acid)" : "var(--chrome)",
              fontSize: "11px",
            }}
          >
            2 or more
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "4px 8px",
              border: "none",
              background: "transparent",
              color: "var(--chrome-dim)",
              fontSize: "18px",
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            display: "flex",
            gap: "10px",
            overflowX: "auto",
            padding: "2px 0 8px",
            touchAction: "pan-x pan-y",
          }}
        >
          {job.speakers.map((name) => {
            const onPad = padCast.includes(name);
            const selected = crowd ? onPad || picked === name : picked === name;
            const already = inShot.has(name.trim().toLowerCase());
            const grey = crowd ? false : castPopupFaceGrey(picked, name);
            const face = speakerFaceUrl(job, name);
            return (
              <button
                key={name}
                type="button"
                disabled={busy}
                draggable={crowd}
                onDragStart={(e) => {
                  if (!crowd) return;
                  setScratchDrag(e.dataTransfer, { type: "actor", id: name, label: name });
                }}
                onClick={() => pickFace(name)}
                style={{
                  flex: "0 0 auto",
                  width: "72px",
                  padding: 0,
                  border: "none",
                  background: "none",
                  opacity: grey ? 0.32 : 1,
                  filter: grey ? "grayscale(1)" : "none",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "10px",
                    border: selected ? "2px solid var(--acid)" : "2px solid var(--line)",
                    overflow: "hidden",
                    display: "block",
                    background: "var(--panel-2)",
                  }}
                >
                  {face ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={face}
                      alt=""
                      style={{ width: "64px", height: "64px", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <span
                      style={{
                        width: "64px",
                        height: "64px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--chrome-dim)",
                        fontSize: "18px",
                      }}
                    >
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: selected ? "var(--acid)" : "var(--chrome)",
                    maxWidth: "72px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {already && !selected && !crowd ? `${name} · in` : onPad && crowd ? `${name} · on` : name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {crowd ? (
          <div className="cast-popup-pad">
            <div style={{ fontSize: "12px", color: "var(--chrome-dim)" }}>
              Tap 2 or more faces, then drag them onto the room — same as Scratch (bed left, sofa
              right). Drag a name on the still to move them. Tap a lit face again to take them off.
            </div>
            <div
              ref={padSurfaceRef}
              className={`scratch-pad-surface${padDragOver ? " is-drop-target" : ""}`}
              onDragOver={onPadDragOver}
              onDragLeave={onPadDragLeave}
              onDrop={onPadDrop}
              onClick={(e) => {
                if (!picked || markDragging.current) return;
                placeAtClient(e.clientX, e.clientY, picked);
              }}
            >
              <div
                style={{
                  ...mobileCard,
                  padding: "2px",
                  lineHeight: 0,
                  width: "100%",
                  border: "none",
                  background: "var(--panel)",
                  position: "relative",
                }}
              >
                {placeSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={placeSrc}
                    alt={placeName || "This place"}
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
                    No room still on this plate yet.
                  </div>
                )}
              </div>
              {placements.length ? (
                <div className="scratch-pad-markers">
                  {placements.map((p) => (
                    <div
                      key={p.name}
                      className="scratch-pad-marker"
                      style={{ left: `${p.xPercent}%`, top: `${p.yPercent}%` }}
                      title={`${p.name} · drag to move`}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        markDragging.current = true;
                        setPicked(p.name);
                        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      }}
                      onPointerMove={(e) => {
                        if (!markDragging.current) return;
                        placeAtClient(e.clientX, e.clientY, p.name);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        markDragging.current = false;
                      }}
                    >
                      <span className="scratch-pad-marker-label">{p.name}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {crowd || picked ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {fieldLabel(
              crowd
                ? padCast.length
                  ? `Position ${padCast.join(" + ")}`
                  : "Position the pair"
                : `Position ${picked}`,
            )}
            <ScratchPromptBible
              activeId={bibleActiveId}
              mode={bibleMode}
              onModeChange={setBibleMode}
              disabled={busy}
              gold={
                crowd
                  ? null
                  : {
                      title: stylePositionGold(job.styleId as ShowStyleId).forWhat,
                      onClick: () => {
                        const text = applyStylePositionGold(job.styleId as ShowStyleId, {
                          name: picked || "",
                          place: placeName || "this place",
                        });
                        setBibleActiveId("style-position-gold");
                        if (bibleMode === "append" && staging.trim()) {
                          setStaging(`${staging.trim()}\n\n${text}`);
                        } else {
                          setStaging(text);
                        }
                      },
                    }
              }
              onPick={(_sectionId: ScratchBibleSectionId, entry: ScratchBibleEntry) => {
                const who = picked || padCast[0] || "";
                // Every chip on the dropdown opens with "{{name}} alone at
                // {{place}}. Only {{name}} in frame, no one else appears." —
                // right on Scratch, which is one character by design. On a
                // group plate it fights the headcount lock in the same
                // paragraph, so the chip looked like it did nothing. Keep the
                // camera, pose, wardrobe and props; drop the alone-ness.
                const template =
                  crowd && padCast.length > 1
                    ? stripBibleSoloLock(entry.template)
                    : entry.template;
                const text = applyBibleTokens(template, {
                  name: who,
                  place: placeName || "this place",
                  cast: crowd && padCast.length ? padCast : who ? [who] : [],
                });
                setBibleActiveId(entry.id);
                if (bibleMode === "append" && staging.trim()) {
                  setStaging(`${staging.trim()}\n\n${text}`);
                } else {
                  setStaging(text);
                }
              }}
            />
            <MobileTextInput
              value={staging}
              onChange={setStaging}
              multiline
              rows={3}
              placeholder={
                crowd
                  ? `Park 2 faces on ${placeName || "this room"} — then Draw.`
                  : `${picked} in ${placeName || "this room"} — sitting, lying down, against the wall…`
              }
              onAi={() => void assist.runAssist()}
              aiBusy={assist.aiBusy}
            />
            <MobilePrimaryButton
              busy={busy}
              disabled={
                assist.aiBusy ||
                (crowd ? padCast.length < 2 || !staging.trim() : !staging.trim())
              }
              onClick={() => void putIn()}
            >
              {busy
                ? "Drawing…"
                : crowd
                  ? padCast.length < 2
                    ? "Need 2 faces"
                    : "Draw this picture"
                  : "Draw this picture"}
            </MobilePrimaryButton>
            {busy ? (
              <ShimmerText style={{ fontSize: "13px", fontWeight: 700 }}>
                Drawing the still — wait here.
              </ShimmerText>
            ) : null}
            {assist.aiError ? (
              <div style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>{assist.aiError}</div>
            ) : null}
          </div>
        ) : (
          <div style={{ fontSize: "12px", color: "var(--chrome-dim)" }}>
            Tap someone. The rest fade. Position them — that draws the still.
          </div>
        )}
        {error ? <div style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>{error}</div> : null}
      </div>
    </div>
  );
}

/** A conversation shot can carry several takes — swipe or tap the arrows to
 * move between them. Picking one mirrors it onto plateFile/staging so
 * everything downstream (strip thumb, Animate) still just reads plateFile.
 * Tap the picture itself to inspect full screen. Older shots with no
 * plateTakes fall back to treating plateFile as a single take. */
function PlatePreview({
  shot,
  jobId,
  placeSrc,
  jobPlated,
  onPicked,
}: {
  shot: CrashStoryShot;
  jobId: string;
  placeSrc?: string;
  jobPlated?: boolean;
  onPicked: (plateFile: string, staging: string, plateTakes?: PlateTake[]) => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const pickSeq = useRef(0);

  const takes: PlateTake[] =
    jobPlated === false
      ? []
      : shot.plateTakes && shot.plateTakes.length
        ? shot.plateTakes
        : shot.plateFile && shot.plateFile !== "__error__"
          ? [{ id: "legacy", fileName: shot.plateFile, staging: shot.staging || "", approved: true }]
          : [];
  const showTakes = takes.length > 0;
  const activeIndex = Math.max(
    0,
    takes.findIndex((t) => t.fileName === shot.plateFile),
  );
  const active = takes[activeIndex] || takes[0];
  const src = showTakes
    ? `/api/crash/gen/file?name=${encodeURIComponent(active.fileName)}`
    : placeSrc || "";
  if (!src) return null;

  /** Flip the still now; Neon save runs in the background. Waiting on pick
   * is why swipe / × felt stuck for seconds on the phone. */
  function pick(index: number) {
    const take = takes[index];
    if (!take || index === activeIndex) return;
    if (take.id === "legacy") {
      onPicked(take.fileName, take.staging);
      return;
    }
    const plateTakes = takes.map((t) => ({ ...t, approved: t.id === take.id }));
    onPicked(take.fileName, take.staging, plateTakes);
    const seq = ++pickSeq.current;
    void (async () => {
      try {
        const res = await fetch("/api/crash/mobile/plate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, shotId: shot.id, action: "pick", takeId: take.id }),
        });
        if (!res.ok || seq !== pickSeq.current) return;
        const data = (await res.json()) as {
          plateFile?: string;
          staging?: string;
          plateTakes?: PlateTake[];
        };
        if (data.plateTakes) {
          onPicked(data.plateFile ?? take.fileName, data.staging ?? take.staging, data.plateTakes);
        }
      } catch {
        /* UI already flipped; next Open / refresh reconciles */
      }
    })();
  }

  function dropActiveTake() {
    if (!active || active.id === "legacy") return;
    const takeId = active.id;
    let remaining = takes.filter((t) => t.id !== takeId);
    let plateFile = "";
    let staging = "";
    if (remaining.length) {
      if (active.fileName === shot.plateFile || remaining.every((t) => !t.approved)) {
        const nextTake = remaining[remaining.length - 1]!;
        remaining = remaining.map((t) => ({ ...t, approved: t.id === nextTake.id }));
        plateFile = nextTake.fileName;
        staging = nextTake.staging;
      } else {
        plateFile = shot.plateFile || "";
        staging = shot.staging || "";
      }
    }
    onPicked(plateFile, staging, remaining);
    const seq = ++pickSeq.current;
    void (async () => {
      try {
        const res = await fetch("/api/crash/mobile/plate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, shotId: shot.id, action: "drop-take", takeId }),
        });
        if (!res.ok || seq !== pickSeq.current) return;
        const data = (await res.json()) as {
          plateFile?: string;
          staging?: string;
          plateTakes?: PlateTake[];
        };
        onPicked(data.plateFile ?? "", data.staging ?? "", data.plateTakes ?? remaining);
      } catch {
        /* UI already dropped; next Open / refresh reconciles */
      }
    })();
  }

  const arrowStyle = {
    position: "absolute" as const,
    top: "50%",
    transform: "translateY(-50%)",
    width: "32px",
    height: "32px",
    borderRadius: "999px",
    border: "none",
    background: "rgba(0,0,0,0.55)",
    color: "var(--chrome)",
    fontSize: "18px",
    lineHeight: 1,
    cursor: "pointer",
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const startX = touchStartX.current;
          touchStartX.current = null;
          if (startX === null) return;
          const dx = (e.changedTouches[0]?.clientX ?? startX) - startX;
          if (Math.abs(dx) < 40) return;
          if (dx < 0) pick(activeIndex + 1);
          else pick(activeIndex - 1);
        }}
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
          alt={shot.title}
          style={{ width: "100%", maxHeight: "260px", objectFit: "contain", display: "block" }}
        />
      </button>
      {takes.length > 0 && active?.id !== "legacy" ? (
        <button
          type="button"
          aria-label="Park this still"
          onClick={() => dropActiveTake()}
          style={{
            position: "absolute",
            top: "8px",
            left: "8px",
            width: "22px",
            height: "22px",
            padding: 0,
            borderRadius: "2px",
            border: "1px solid var(--acid)",
            background: "rgba(0,0,0,0.72)",
            color: "var(--acid)",
            fontSize: "14px",
            lineHeight: 1,
            cursor: "pointer",
            zIndex: 2,
          }}
        >
          ×
        </button>
      ) : null}
      {takes.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous take"
            disabled={activeIndex === 0}
            onClick={() => pick(activeIndex - 1)}
            style={{ ...arrowStyle, left: "6px", opacity: activeIndex === 0 ? 0.3 : 1 }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next take"
            disabled={activeIndex === takes.length - 1}
            onClick={() => pick(activeIndex + 1)}
            style={{ ...arrowStyle, right: "6px", opacity: activeIndex === takes.length - 1 ? 0.3 : 1 }}
          >
            ›
          </button>
          <div
            style={{
              position: "absolute",
              bottom: "8px",
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              gap: "5px",
            }}
          >
            {takes.map((t, i) => (
              <span
                key={t.id}
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "999px",
                  background: i === activeIndex ? "var(--acid)" : "rgba(255,255,255,0.35)",
                }}
              />
            ))}
          </div>
        </>
      ) : (
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
      )}
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
          <img src={src} alt={shot.title} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          <span style={{ position: "absolute", top: "16px", right: "18px", color: "var(--chrome)", fontSize: "24px" }}>
            ✕
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ShotStockPanel({
  jobId,
  styleId,
  shot,
  clips,
  trackClipFile,
  stockLook,
  onShotMeta,
  onJobChange,
}: {
  jobId: string;
  styleId?: string;
  shot: CrashStoryShot;
  clips?: MobileClipUnit[];
  trackClipFile?: string;
  stockLook?: StockLook | null;
  onShotMeta?: (patch: { footageRole?: ShotFootageRole; stockQuery?: string }) => void;
  onJobChange?: (job: MobileGenJob) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const queryTimer = useRef<number | null>(null);

  async function saveMeta(patch: { footageRole?: ShotFootageRole; stockQuery?: string }) {
    onShotMeta?.(patch);
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          shotId: shot.id,
          action: "save",
          ...patch,
        }),
      });
      const data = await readApiJson<{ error?: string }>(res);
      if (data.error) setError(data.error);
    } catch (e) {
      setError(studioFetchError(e, "Couldn't save that tag"));
    }
  }

  async function attachStock(file: File) {
    const beatId = shot.beats[0]?.id;
    if (!beatId) {
      setError("This shot has no beat to hang on.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("jobId", jobId);
      form.set("beatId", beatId);
      form.set("source", "stock");
      form.set("file", file);
      const res = await fetch("/api/crash/mobile/clip/upload", { method: "POST", body: form });
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (data.job) onJobChange?.(data.job);
      if (data.error) setError(data.error);
    } catch (e) {
      setError(studioFetchError(e, "Couldn't hang that clip"));
    } finally {
      setBusy(false);
    }
  }

  async function applyArsenal(effectId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/clip/arsenal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          shotId: shot.id,
          effectId,
          text: shot.title || "",
        }),
      });
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (data.job) onJobChange?.(data.job);
      if (data.error) setError(data.error);
    } catch (e) {
      setError(studioFetchError(e, "Couldn't apply that effect"));
    } finally {
      setBusy(false);
    }
  }

  const hungClip =
    Boolean((trackClipFile || "").trim()) ||
    (shot.beats || []).some((b) =>
      (clips || []).some(
        (c) => c.beatId === b.id && c.clipStatus === "done" && Boolean((c.clipFile || "").trim()),
      ),
    ) ||
    (clips || []).some(
      (c) => (c.shotId || "") === shot.id && c.clipStatus === "done" && Boolean((c.clipFile || "").trim()),
    );
  const showArsenal = styleId === "music_video";

  return (
    <StockFootagePanel
      shot={shot}
      variant="phone"
      attachBusy={busy}
      attachError={error}
      look={stockLook}
      arsenal={
        showArsenal
          ? {
              hasClip: hungClip,
              busy,
              onApply: (effectId) => void applyArsenal(effectId),
            }
          : undefined
      }
      onRoleChange={(footageRole) => void saveMeta({ footageRole })}
      onQueryChange={(stockQuery) => {
        onShotMeta?.({ stockQuery });
        if (queryTimer.current) window.clearTimeout(queryTimer.current);
        queryTimer.current = window.setTimeout(() => {
          void saveMeta({ stockQuery });
        }, 600);
      }}
      onAttachFile={(file) => void attachStock(file)}
    />
  );
}

function ShotLineEditor({
  styleId,
  folderName,
  jobId,
  stockLook,
  jobSpeakers,
  jobVoices,
  lookForSpeaker,
  shot,
  clips,
  trackClipFile,
  loading,
  error,
  placeName,
  placeSrc,
  jobPlated,
  clipRemoveDisabled,
  onDismissClipError,
  onBeatSaved,
  onPlateRebuilt,
  onLineAdded,
  onLineRemoved,
  onAddCast,
  onAddToSong,
  songAdding,
  onJobChange,
  onShotMeta,
}: {
  styleId: string;
  folderName: string;
  jobId: string;
  stockLook?: StockLook | null;
  jobSpeakers: string[];
  jobVoices?: Record<string, JobSpeakerVoice>;
  lookForSpeaker: (name: string) => string;
  shot: CrashStoryShot | null;
  clips: MobileClipUnit[];
  trackClipFile?: string;
  loading: boolean;
  error: string;
  placeName?: string;
  placeSrc?: string;
  jobPlated?: boolean;
  clipRemoveDisabled?: boolean;
  onDismissClipError?: (beatId: string) => void;
  onBeatSaved: (beatId: string, text: string, voiceFile: string, imageMotion?: string, job?: MobileGenJob) => void;
  onLineAdded?: (beat: CrashStoryBeat) => void;
          onLineRemoved?: (beatId: string, job?: MobileGenJob) => void;
          onAddCast?: () => void;
          onAddToSong?: () => void;
          songAdding?: boolean;
          onJobChange?: (job: MobileGenJob) => void;
          onShotMeta?: (patch: { footageRole?: ShotFootageRole; stockQuery?: string }) => void;
          onPlateRebuilt: (
    plateFile: string | undefined,
    staging: string,
    summary: string,
    plateTakes?: PlateTake[],
    bibleIds?: string[],
  ) => void;
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

  const speakingBeats = plateLineBeats({
    shotId: shot.id,
    title: shot.title,
    staging: shot.staging,
    summary: shot.summary,
    jobSpeakers,
    beats: shot.beats,
  });

  return (
    <div style={{ ...mobileCard, padding: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <PlatePreview
        shot={shot}
        jobId={jobId}
        placeSrc={placeSrc}
        jobPlated={jobPlated}
        onPicked={(plateFile, staging, plateTakes) =>
          onPlateRebuilt(plateFile, staging, shot.summary, plateTakes)
        }
      />
      <ShotStockPanel
        jobId={jobId}
        styleId={styleId}
        shot={shot}
        clips={clips}
        trackClipFile={trackClipFile}
        stockLook={stockLook}
        onShotMeta={onShotMeta}
        onJobChange={onJobChange}
      />
      {speakingBeats.map((beat) => {
        const clip = clips.find((c) => c.beatId === beat.id);
        return (
          <div key={beat.id}>
            {clip?.clipStatus === "error" && clip.error ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  marginBottom: "6px",
                }}
              >
                <div style={{ flex: 1, fontSize: "12px", color: "var(--magenta-hot)" }}>
                  {clip.error}
                </div>
                {onDismissClipError ? (
                  <button
                    type="button"
                    aria-label="Bin failed clip"
                    title="Bin this failed Generate. File parks in _cleared/ — not deleted."
                    disabled={clipRemoveDisabled}
                    onClick={() => onDismissClipError(beat.id)}
                    style={{
                      flex: "0 0 auto",
                      width: "22px",
                      height: "22px",
                      padding: 0,
                      borderRadius: "2px",
                      border: "1px solid var(--acid)",
                      background: "transparent",
                      color: "var(--acid)",
                      fontSize: "11px",
                      lineHeight: 1,
                      cursor: clipRemoveDisabled ? "not-allowed" : "pointer",
                      opacity: clipRemoveDisabled ? 0.45 : 1,
                    }}
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            ) : null}
            {beat.kind === "cutaway" ? (
            <CutawayBeatPanel
            key={beat.id}
            styleId={styleId as ShowStyleId}
            folderName={folderName}
            jobId={jobId}
            shotId={shot.id}
            lookLock={lookForSpeaker(beat.speaker)}
            shotSpeakers={shotSpeakersOnCard({
              shotId: shot.id,
              title: shot.title,
              staging: shot.staging,
              summary: shot.summary,
              plateFile: shot.plateFile,
              jobSpeakers,
              beats: shot.beats,
            })}
            beat={beat}
            clipStatus={clips.find((c) => c.beatId === beat.id)?.clipStatus}
            staging={shot.staging || ""}
            onSaved={(text, voiceFile, imageMotion, nextJob) => {
              onBeatSaved(beat.id, text, voiceFile, imageMotion, nextJob);
            }}
            onRemoved={(beatId, nextJob, emptyBeat) => {
              onLineRemoved?.(beatId, nextJob);
              if (emptyBeat) onLineAdded?.(emptyBeat);
            }}
            />
            ) : (
            <BeatLineEditor
            key={beat.id}
            styleId={styleId}
            folderName={folderName}
            jobId={jobId}
            shotId={shot.id}
            jobVoices={jobVoices}
            lookLock={lookForSpeaker(beat.speaker)}
            shotSpeakers={shotSpeakersOnCard({
              shotId: shot.id,
              title: shot.title,
              staging: shot.staging,
              summary: shot.summary,
              plateFile: shot.plateFile,
              jobSpeakers,
              beats: shot.beats,
            })}
            placeName={placeName || "this place"}
            beat={beat}
            clipStatus={clips.find((c) => c.beatId === beat.id)?.clipStatus}
            songDesk={styleId === "music_video"}
            positionPrompt={shot.staging || ""}
            positionBibleIds={resolveShotBibleIds(shot)}
            onPositionSaved={(staging, plate) =>
              onPlateRebuilt(
                plate?.plateFile !== undefined ? plate.plateFile : shot.plateFile,
                staging,
                shot.summary,
                plate?.plateTakes !== undefined ? plate.plateTakes : shot.plateTakes,
                plate?.bibleIds !== undefined ? plate.bibleIds : shot.bibleIds,
              )
            }
            onSaved={(text, voiceFile, imageMotion, nextJob, addedBeats) => {
              onBeatSaved(beat.id, text, voiceFile, imageMotion, nextJob);
              for (const extra of addedBeats || []) {
                onLineAdded?.({
                  id: extra.id,
                  speaker: beat.speaker,
                  text: extra.text,
                  voiceFile: extra.voiceFile,
                });
              }
            }}
            onRemoved={(beatId, nextJob, emptyBeat) => {
              onLineRemoved?.(beatId, nextJob);
              if (emptyBeat) onLineAdded?.(emptyBeat);
            }}
          />
            )}
          </div>
        );
      })}
      {!speakingBeats.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {onAddToSong ? (
            <>
              <div className="m-plate-add-engines">
                <MobilePrimaryButton busy={songAdding} onClick={onAddToSong}>
                  {songAdding ? "Adding…" : "Add"}
                </MobilePrimaryButton>
                <PlateEngineButtons
                  jobId={jobId}
                  shotId={shot.id}
                  beatId={shot.beats[0]?.id || ""}
                />
              </div>
              {onAddCast ? (
                <MobilePrimaryButton tone="ghost" onClick={onAddCast}>
                  Add someone
                </MobilePrimaryButton>
              ) : null}
            </>
          ) : (
            <>
              <div style={{ fontSize: "13px", color: "var(--chrome-dim)" }}>
                Nobody on this plate yet. Tap Add someone — or the small + on this card in the row.
              </div>
              {onAddCast ? (
                <MobilePrimaryButton onClick={onAddCast}>Add someone</MobilePrimaryButton>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="m-plate-add-engines">
        {onAddToSong ? (
          <MobilePrimaryButton busy={songAdding} onClick={onAddToSong}>
            {songAdding ? "Adding…" : "Add"}
          </MobilePrimaryButton>
        ) : null}
        {styleId === "music_video" ? (
          <PlateEngineButtons
            jobId={jobId}
            shotId={shot.id}
            beatId={speakingBeats[0]?.id || shot.beats[0]?.id || ""}
          />
        ) : (
          <>
            <AnotherLineButton
              jobId={jobId}
              shotId={shot.id}
              speaker={speakingBeats[0]?.speaker || ""}
              onAdded={(beat) => onLineAdded?.(beat)}
            />
            <AnotherLineButton
              jobId={jobId}
              shotId={shot.id}
              speaker={speakingBeats[0]?.speaker || ""}
              cutaway
              onAdded={(beat) => onLineAdded?.(beat)}
            />
          </>
        )}
        </div>
      )}
    </div>
  );
}

/** Add | LTX | H3 — pick stores for the next TRACK Send. Does not cook. */
function PlateEngineButtons({
  jobId,
  shotId,
  beatId,
}: {
  jobId: string;
  shotId: string;
  beatId: string;
}) {
  const [engine, setEngine] = useState<MuteMvEngine>(() =>
    shotId ? readMvClipEngine(jobId, shotId) : beatId ? readMvEngine(jobId, beatId) : "ltx",
  );
  const [h3Ready, setH3Ready] = useState(false);

  useEffect(() => {
    if (shotId) {
      setEngine(readMvClipEngine(jobId, shotId));
      return;
    }
    if (beatId) setEngine(readMvEngine(jobId, beatId));
  }, [beatId, jobId, shotId]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/crash/mobile/scratch")
      .then((res) => res.json())
      .then((data: { minimax?: boolean }) => {
        if (!cancelled && typeof data.minimax === "boolean") setH3Ready(data.minimax);
      })
      .catch(() => {
        /* H3 stays dead */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (h3Ready || engine !== "h3") return;
    if (shotId) writeMvClipEngine(jobId, shotId, "ltx");
    if (beatId) writeMvEngine(jobId, beatId, "ltx");
    setEngine("ltx");
  }, [beatId, engine, h3Ready, jobId, shotId]);

  function pick(next: MuteMvEngine) {
    if (next === "h3" && !h3Ready) return;
    if (shotId) writeMvClipEngine(jobId, shotId, next);
    if (beatId) writeMvEngine(jobId, beatId, next);
    setEngine(next);
  }

  return (
    <>
      <MobilePrimaryButton tone={engine === "ltx" ? "accent" : "ghost"} onClick={() => pick("ltx")}>
        LTX
      </MobilePrimaryButton>
      <MobilePrimaryButton
        tone={engine === "h3" ? "accent" : "ghost"}
        disabled={!h3Ready}
        onClick={() => pick("h3")}
      >
        H3
      </MobilePrimaryButton>
    </>
  );
}

function AnotherLineButton({
  jobId,
  shotId,
  speaker,
  cutaway,
  onAdded,
}: {
  jobId: string;
  shotId: string;
  speaker: string;
  cutaway?: boolean;
  onAdded?: (beat: CrashStoryBeat) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function add() {
    if (!speaker.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          shotId,
          speaker,
          action: cutaway ? "add-cutaway" : "add-line",
        }),
      });
      const data = await readApiJson<{ error?: string; beat?: CrashStoryBeat }>(res);
      if (data.beat) onAdded?.(data.beat);
    } catch (e) {
      setError(studioFetchError(e, cutaway ? "Couldn't add a cutaway" : "Couldn't add a line"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        disabled={busy || !speaker.trim()}
        onClick={() => void add()}
        style={{
          padding: "8px 10px",
          borderRadius: "2px",
          border: "1px dashed var(--line)",
          background: "transparent",
          color: "var(--chrome-dim)",
          fontSize: "12px",
          fontWeight: 600,
        }}
      >
        {busy ? "Adding…" : cutaway ? "+ cutaway" : "+ another line"}
      </button>
      {error ? (
        <div style={{ color: "var(--magenta-hot)", fontSize: "12px", marginTop: "6px" }}>{error}</div>
      ) : null}
    </div>
  );
}

function BeatLineEditor({
  styleId,
  folderName,
  jobId,
  shotId,
  jobVoices,
  lookLock,
  shotSpeakers,
  placeName,
  beat,
  clipStatus,
  songDesk,
  positionPrompt,
  positionBibleIds,
  onPositionSaved,
  onSaved,
  onRemoved,
}: {
  styleId: string;
  folderName: string;
  jobId: string;
  shotId: string;
  jobVoices?: Record<string, JobSpeakerVoice>;
  lookLock: string;
  shotSpeakers: string[];
  placeName?: string;
  beat: CrashStoryBeat;
  clipStatus?: MobileClipUnit["clipStatus"];
  songDesk?: boolean;
  positionPrompt: string;
  positionBibleIds?: string[];
  onPositionSaved: (
    staging: string,
    plate?: { plateFile?: string; plateTakes?: PlateTake[]; bibleIds?: string[] },
  ) => void;
  onSaved: (
    text: string,
    voiceFile: string,
    imageMotion?: string,
    job?: MobileGenJob,
    addedBeats?: { id: string; text: string; voiceFile: string }[],
  ) => void;
  onRemoved?: (beatId: string, job?: MobileGenJob, emptyBeat?: CrashStoryBeat) => void;
}) {
  const [text, setText] = useState(
    isLeftoverPackVoiceFile(beat.voiceFile) ? "" : beat.text,
  );
  const [voiceFile, setVoiceFile] = useState(
    isMobileSavedVoiceFile(beat.voiceFile) &&
      !isLeftoverPackVoiceFile(beat.voiceFile)
      ? beat.voiceFile || ""
      : "",
  );
  const [voiceName, setVoiceName] = useState(
    lineVoiceLabel({ speaker: beat.speaker, jobVoices, library: [] }),
  );
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [redrawing, setRedrawing] = useState(false);
  const [error, setError] = useState("");
  const [ltxOpen, setLtxOpen] = useState(false);
  // Bible already ran on Draw — keep this shut unless they need Redo still.
  const [positionOpen, setPositionOpen] = useState(false);
  const [positionDraft, setPositionDraft] = useState<string | null>(null);
  const [motionDraft, setMotionDraftState] = useState<string | null>(() =>
    readLtxMotionDraft(jobId, beat.id),
  );
  const setMotionDraft = (v: string | null) => {
    if (v === null) clearLtxMotionDraft(jobId, beat.id);
    else writeLtxMotionDraft(jobId, beat.id, v);
    setMotionDraftState(v);
  };
  const [bibleMode, setBibleMode] = useState<ScratchBiblePickMode>("replace");
  const [bibleActiveIds, setBibleActiveIds] = useState<string[]>(() =>
    (positionBibleIds || []).filter(Boolean),
  );
  const lineAssist = useMobileAssist("line", styleId, () => text, setText, beat.speaker);
  const dirty = text.trim() !== beat.text.trim() || voiceFile !== (beat.voiceFile || "");
  const positionAsLine = looksLikePlatePositionPrompt(text);
  // Stamped Save takes are playable even if the pack-name parser only sees
  // the first token of "BIG SEXY" — don't hide Play after a good Save.
  const playable = Boolean(voiceFile && isMobileSavedVoiceFile(voiceFile));
  const savedTake = playable && !dirty;
  const scriptedPosition = compileScriptedPosition({
    name: beat.speaker,
    place: placeName || "this place",
  });
  const positionBody = positionDraft ?? (positionPrompt.trim() ? positionPrompt : scriptedPosition);
  const positionDirty = positionDraft !== null && positionDraft.trim() !== (positionPrompt || "").trim();

  useEffect(() => {
    setPositionDraft(null);
    setBibleActiveIds((positionBibleIds || []).filter(Boolean));
    // Do not depend on positionBibleIds identity — resolveShotBibleIds
    // returns a new array every render and was wiping chip picks.
  }, [shotId, positionPrompt]);

  // Sticky voice like Scratch — survive take switches / parent story rewrites.
  useEffect(() => {
    const next = (beat.voiceFile || "").trim();
    if (!next) return;
    if (isLeftoverPackVoiceFile(next)) {
      setText("");
      setVoiceFile("");
      return;
    }
    if (isMobileSavedVoiceFile(next)) setVoiceFile(next);
  }, [beat.id, beat.voiceFile]);

  const persistPosition = useCallback(
    async (body: string): Promise<string> => {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          shotId,
          action: "save",
          staging: body,
          bibleIds: bibleActiveIds,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        staging?: string;
        bibleIds?: string[];
      };
      if (!res.ok) throw new Error(data.error || "Couldn't keep position prompt");
      const saved = (data.staging ?? body).trim();
      const ids = Array.isArray(data.bibleIds) ? data.bibleIds : bibleActiveIds;
      setBibleActiveIds(ids);
      onPositionSaved(saved, { bibleIds: ids });
      return saved;
    },
    [bibleActiveIds, jobId, onPositionSaved, shotId],
  );

  const redrawPosition = useCallback(
    async (body: string) => {
      const staging = body.trim();
      if (!staging) throw new Error("Write a position prompt before redrawing");
      const data = await drawPlateStill({
        jobId,
        shotId,
        staging,
        bibleIds: bibleActiveIds,
      });
      const saved = (data.staging ?? staging).trim();
      const ids = Array.isArray(data.bibleIds) ? data.bibleIds : bibleActiveIds;
      setBibleActiveIds(ids);
      onPositionSaved(saved, {
        plateFile: data.plateFile,
        plateTakes: data.plateTakes,
        bibleIds: ids,
      });
      return saved;
    },
    [bibleActiveIds, jobId, onPositionSaved, shotId],
  );

  const positionAssist = useMobileAssist(
    "plate",
    styleId,
    () => positionBody,
    (v) => {
      setPositionDraft(v);
      void persistPosition(v)
        .then(() => setPositionDraft(null))
        .catch((e) => setError(e instanceof Error ? e.message : "Couldn't keep position prompt"));
    },
    platePositionAssistHint({
      people: shotSpeakers,
      placeName: "",
      placeLook: "",
      looks: shotSpeakers.map((name) => ({ name, look: name === beat.speaker ? lookLock : "" })),
    }),
  );
  const defaultMotionBody = useMemo(
    () =>
      stripLtxLipSyncLead(
        buildDefaultBeatMotion({
          styleId: styleId as ShowStyleId,
          speaker: beat.speaker,
          line: text,
          lookLock,
          shotSpeakers,
          staging: positionBody,
        }),
      ),
    [beat.speaker, lookLock, positionBody, shotSpeakers, styleId, text],
  );
  const storedMotion = stripLtxLipSyncLead(beat.imageMotion || "");
  const muteLock = useMemo(
    () =>
      songDesk
        ? buildMuteMvMotionLock({
            styleId: (styleId || "music_video") as ShowStyleId,
            speaker: beat.speaker,
            lookLock,
            shotSpeakers: shotSpeakers.length ? shotSpeakers : undefined,
            staging: positionBody,
          })
        : null,
    [beat.speaker, lookLock, positionBody, shotSpeakers, songDesk, styleId],
  );
  const [muteSlot, setMuteSlot] = useState("");
  useEffect(() => {
    if (!songDesk || !muteLock) return;
    const drafted = readMvMotionSlot(jobId, beat.id);
    if (drafted !== null) {
      setMuteSlot(drafted);
      return;
    }
    setMuteSlot(extractMuteMvMotionSlot(storedMotion, muteLock));
  }, [beat.id, jobId, songDesk, storedMotion]);
  const motionBody = pickLtxMotionBody({
    draft: motionDraft,
    stored: storedMotion,
    defaultBody: defaultMotionBody,
  });
  const motionDirty = motionDraft !== null;
  const motionHint = useMemo(
    () =>
      imageMotionAssistHint({
        speaker: beat.speaker,
        line: text,
        lookLock,
        shotSpeakers,
      }),
    [beat.speaker, lookLock, shotSpeakers, text],
  );

  const persistMotion = useCallback(
    async (body: string): Promise<string> => {
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
      onSaved(text, voiceFile, saved, data.job);
      return saved;
    },
    [beat.id, jobId, onSaved, text, voiceFile],
  );

  async function generateThisClip() {
    if (!playable) {
      setError("Save the spoken line first — Play appears when the mp3 is ready.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      if (motionDirty) await persistMotion(motionBody);
      const res = await fetch("/api/crash/mobile/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, approveReview: true, beatId: beat.id }),
      });
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (data.job) onSaved(text, voiceFile, motionBody, data.job);
    } catch (e) {
      setError(studioFetchError(e, "Couldn't start that clip"));
    } finally {
      setGenerating(false);
    }
  }

  const emptiedPhoneMotionRef = useRef("");
  useEffect(() => {
    if (songDesk) return;
    if (motionDraft !== null) return;
    if ((storedMotion || "").trim()) return;
    if (!storedMotionNeedsRebuild(storedMotion, positionBody)) return;
    const next = defaultMotionBody.trim();
    if (!next) return;
    const key = `${beat.id}:${next}`;
    if (emptiedPhoneMotionRef.current === key) return;
    emptiedPhoneMotionRef.current = key;
    void persistMotion(next).catch(() => {
      emptiedPhoneMotionRef.current = "";
    });
  }, [beat.id, defaultMotionBody, motionDraft, persistMotion, positionBody, songDesk, storedMotion]);

  const motionAssist = useMobileAssist(
    "image_motion",
    styleId,
    () => motionBody,
    (v) => {
      setMotionDraft(v);
      void persistMotion(v)
        .then(() => setMotionDraft(null))
        .catch((e) => setError(e instanceof Error ? e.message : "Couldn't keep Image motion"));
    },
    motionHint,
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/crash/mobile/voices?jobId=${encodeURIComponent(jobId)}&speaker=${encodeURIComponent(beat.speaker)}`).then(
        (r) => r.json(),
      ),
      fetch(`/api/crash/mobile/voice-library?styleId=${encodeURIComponent(styleId)}`).then((r) => r.json()),
    ])
      .then(([status, lib]) => {
        if (cancelled) return;
        const row = status.voices?.[0] as { voiceId?: string; voiceName?: string } | undefined;
        const list = (lib.voices || []) as { voiceId: string; name: string }[];
        const assignedId =
          (row?.voiceId || "").trim() ||
          shownVoiceId({
            assignedId: "",
            speaker: beat.speaker,
            styleId: styleId as ShowStyleId,
            library: list,
          });
        const label = lineVoiceLabel({
          speaker: beat.speaker,
          jobVoices,
          assignedVoiceId: assignedId,
          library: [
            ...list,
            ...(row?.voiceId && row?.voiceName
              ? [{ voiceId: row.voiceId, name: row.voiceName }]
              : []),
          ],
        });
        if (label) setVoiceName(label);
      })
      .catch(() => {
        /* line still edits — name is a hint */
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, styleId, beat.speaker, jobVoices]);

  async function removeLine() {
    setRemoving(true);
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, shotId, beatId: beat.id, action: "remove-line" }),
      });
      const data = await readApiJson<{
        error?: string;
        job?: MobileGenJob;
        beat?: CrashStoryBeat;
      }>(res);
      onRemoved?.(beat.id, data.job, data.beat);
    } catch (e) {
      setError(studioFetchError(e, "Couldn't remove that line"));
    } finally {
      setRemoving(false);
    }
  }

  async function save() {
    if (!text.trim()) {
      setError("Type what they say, then Save.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/crash/mobile/beat-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, beatId: beat.id, text }),
      });
      const data = await readApiJson<{
        error?: string;
        voiceFile: string;
        line?: string;
        split?: number;
        addedBeats?: { id: string; text: string; voiceFile: string }[];
        imageMotion?: string;
        job?: MobileGenJob;
      }>(res);
      const stamped = (data.voiceFile || "").trim();
      // A 200 Save already voiced the line. Don't reject Jo / long-name
      // takes just because the leftover-pack detector is picky — that
      // showed "try Save again" while the mp3 was already on disk.
      if (!stamped.toLowerCase().endsWith(".mp3")) {
        throw new Error(
          stamped
            ? `Save came back without an mp3 (${stamped}). Tap Save again — don't start a new episode.`
            : "Save came back empty. Tap Save again — don't start a new episode.",
        );
      }
      setVoiceFile(stamped);
      const firstLine = (data.line || "").trim() || text;
      if (firstLine !== text) setText(firstLine);
      let imageMotion = (data.imageMotion as string) || "";
      if (motionDirty) {
        imageMotion = await persistMotion(motionBody);
        setMotionDraft(null);
      }
      onSaved(firstLine, stamped, imageMotion, data.job, data.addedBeats);
    } catch (e) {
      setError(studioFetchError(e, "Save failed"));
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
        {songDesk ? null : playable ? (
          <MobileAudioPlayer
            src={`/api/crash/mobile/beat-audio?styleId=${encodeURIComponent(styleId)}&folderName=${encodeURIComponent(
              folderName,
            )}&beatId=${encodeURIComponent(beat.id)}&fileName=${encodeURIComponent(voiceFile)}`}
            onRemove={() => void removeLine()}
            removing={removing}
          />
        ) : (
          <div style={{ fontSize: "12px", color: "var(--chrome-dim)", flex: 1 }}>No line yet</div>
        )}
      </div>
      {songDesk ? null : (
      <MobileTextInput
        value={text}
        onChange={setText}
        placeholder="What she says — not the still position."
        multiline
        rows={2}
        onAi={() => void lineAssist.runAssist()}
        aiBusy={lineAssist.aiBusy}
      />
      )}
      {songDesk ? null : lineAssist.aiError ? (
        <div style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>{lineAssist.aiError}</div>
      ) : null}
      {songDesk ? null : positionAsLine ? (
        <div style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>
          That&apos;s the still position, not the spoken line. Wipe it. Type what she says, then Save.
        </div>
      ) : null}
      {songDesk ? null : (
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", minWidth: 0 }}>
        <MobilePrimaryButton
          size="chip"
          disabled={saving || removing || savedTake || positionAsLine || !text.trim()}
          onClick={() => void save()}
        >
          {saving ? "…" : savedTake ? "Saved" : "Save"}
        </MobilePrimaryButton>
        <MobilePrimaryButton
          size="chip"
          tone="ghost"
          disabled={saving || removing}
          onClick={() => void removeLine()}
        >
          {removing ? "…" : playable ? "Remove mp3" : "Remove line"}
        </MobilePrimaryButton>
        <span
          style={{
            fontSize: "12px",
            color: voiceName ? "var(--acid)" : "var(--chrome-dim)",
            fontWeight: voiceName ? 600 : 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {voiceName || "No voice yet"}
        </span>
        {error ? <span style={{ fontSize: "12px", color: "var(--magenta-hot)" }}>{error}</span> : null}
      </div>
      )}

      <PositionPromptPanel
        open={positionOpen}
        onToggle={() => setPositionOpen((open) => !open)}
        body={positionBody}
        onChange={(v) => setPositionDraft(v)}
        bibleMode={bibleMode}
        onBibleModeChange={(mode) => {
          setBibleMode(mode);
          if (mode === "replace") setBibleActiveIds([]);
        }}
        bibleActiveIds={bibleActiveIds}
        bibleDisabled={saving || redrawing}
        onBiblePick={(_sectionId: ScratchBibleSectionId, entry: ScratchBibleEntry) => {
          const template =
            shotSpeakers.length > 1 ? stripBibleSoloLock(entry.template) : entry.template;
          const text = applyBibleTokens(template, {
            name: beat.speaker,
            place: placeName || "this place",
            cast: shotSpeakers.length ? shotSpeakers : [beat.speaker],
          });
          setBibleActiveIds((prev) =>
            bibleMode === "append"
              ? prev.includes(entry.id)
                ? prev
                : [...prev, entry.id]
              : [entry.id],
          );
          if (bibleMode === "append" && positionBody.trim()) {
            setPositionDraft(`${positionBody.trim()}\n\n${text}`);
          } else {
            setPositionDraft(text);
          }
        }}
        keepDisabled={saving || redrawing || !positionDirty}
        redoDisabled={saving || redrawing || !positionBody.trim()}
        keeping={saving && !redrawing}
        redrawing={redrawing}
        onKeep={() => {
          setSaving(true);
          setError("");
          void persistPosition(positionBody)
            .then(() => setPositionDraft(null))
            .catch((e) => setError(e instanceof Error ? e.message : "Couldn't keep position prompt"))
            .finally(() => setSaving(false));
        }}
        onRedo={() => {
          setRedrawing(true);
          setError("");
          void redrawPosition(positionBody)
            .then(() => setPositionDraft(null))
            .catch((e) => setError(e instanceof Error ? e.message : "Couldn't redraw that still"))
            .finally(() => setRedrawing(false));
        }}
        onAi={() => void positionAssist.runAssist()}
        aiBusy={positionAssist.aiBusy}
        aiError={positionAssist.aiError}
      />

      {songDesk && muteLock ? (
        <label className="m-plate-motion-slot">
          <span className="m-plate-motion-slot-mark" aria-hidden>
            [
          </span>
          <textarea
            value={muteSlot}
            placeholder={MUTE_MV_SLOT_PLACEHOLDER}
            rows={2}
            disabled={saving}
            onChange={(e) => {
              const next = e.target.value;
              setMuteSlot(next);
              writeMvMotionSlot(jobId, beat.id, next);
            }}
          />
          <span className="m-plate-motion-slot-mark" aria-hidden>
            ]
          </span>
        </label>
      ) : (
      <LtxImageMotionPanel
        open={ltxOpen}
        onToggle={() => setLtxOpen((open) => !open)}
        body={motionBody}
        onChange={(v) => setMotionDraft(v)}
        keepDisabled={saving}
        keeping={saving}
        onKeep={() => {
          setSaving(true);
          setError("");
          void persistMotion(motionBody)
            .then(() => setMotionDraft(null))
            .catch((e) => setError(e instanceof Error ? e.message : "Couldn't keep Image motion"))
            .finally(() => setSaving(false));
        }}
        onAi={() => void motionAssist.runAssist()}
        aiBusy={motionAssist.aiBusy}
        aiError={motionAssist.aiError}
      />
      )}
      {songDesk ? null : (
      <MobilePrimaryButton
        disabled={
          generating ||
          saving ||
          removing ||
          !playable ||
          positionAsLine ||
          clipStatus === "running"
        }
        onClick={() => void generateThisClip()}
      >
        {generating || clipStatus === "running"
          ? "Sending…"
          : playable
            ? "Generate"
            : "Save the line first"}
      </MobilePrimaryButton>
      )}
      {songDesk || playable ? null : (
        <div style={{ fontSize: "12px", color: "var(--chrome-dim)" }}>
          Save the spoken line (Play appears), then Generate — that makes this line&apos;s LTX
          clip only. Generate video at the top still sends every Saved line.
        </div>
      )}
    </div>
  );
}
