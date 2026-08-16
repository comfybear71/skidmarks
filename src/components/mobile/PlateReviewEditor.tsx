"use client";

import { useEffect, useRef, useState } from "react";
import { MobileAiButton, MobileAudioPlayer, MobilePrimaryButton, MobileTextInput, mobileCard } from "./MobileUi";
import { useMobileAssist } from "./useMobileAssist";
import type { MobileGenJob } from "@/lib/mobileGenJob";
import type { CrashStoryBeat, CrashStoryDoc, CrashStoryShot, PlateTake } from "@/lib/crashStoryTypes";

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
}: {
  job: MobileGenJob;
  onJobChange?: (job: MobileGenJob) => void;
  /** Strip-only mode — everything below the thumbnails stays hidden. */
  collapsed?: boolean;
  onExpand?: () => void;
}) {
  const [story, setStory] = useState<CrashStoryDoc | null>(null);
  const [loadError, setLoadError] = useState("");
  const [openShotId, setOpenShotId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addBusySpeaker, setAddBusySpeaker] = useState<string | null>(null);
  const [addError, setAddError] = useState("");
  const [removedBuffer, setRemovedBuffer] = useState<RemovedShot[]>([]);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);
  const [actionError, setActionError] = useState("");

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

  const usedShotSpeakers = new Set(
    shots
      .map((s) => shotById(s.shotId)?.title.trim())
      .filter((t): t is string => Boolean(t)),
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
    setActionError("");
    try {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, shotId, action: "remove" }),
      });
      const data = (await res.json()) as {
        error?: string;
        job?: MobileGenJob;
        removedShot?: CrashStoryShot;
        sceneId?: string;
      };
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
      if (data.removedShot && data.sceneId) {
        setRemovedBuffer([{ sceneId: data.sceneId, shot: data.removedShot }]);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't remove that card");
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
      {collapsed ? null : (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 2px 8px" }}>
          <div
            style={{
              color: "var(--chrome-dim)",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              flex: 1,
            }}
          >
            Shots — tap one, tweak position, redraw. Tap the picture to inspect.
          </div>
          {shots.length || job.finalVideoFile ? (
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
          ) : null}
        </div>
      )}

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
          gap: "8px",
          overflowX: "auto",
          padding: "2px 2px 10px",
          touchAction: "pan-x pan-y",
        }}
      >
        {shots.map((s, i) => {
          const plated = Boolean(s.plateFile && s.plateFile !== "__error__");
          return (
            <div key={s.shotId} style={{ position: "relative", flex: "0 0 auto" }}>
              <button
                type="button"
                onClick={() => {
                  if (collapsed) {
                    onExpand?.();
                    setOpenShotId(s.shotId);
                    return;
                  }
                  setOpenShotId((cur) => (cur === s.shotId ? null : s.shotId));
                }}
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
              {!collapsed && plated ? (
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
              {!collapsed ? (
                <button
                  type="button"
                  aria-label="Remove this shot"
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
            onClick={() => {
              if (collapsed) {
                onExpand?.();
                setPickerOpen(true);
                return;
              }
              setPickerOpen((v) => !v);
            }}
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

      {!collapsed && pickerOpen ? (
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
              const already = usedShotSpeakers.has(name.trim());
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

      {!collapsed && openShotId ? (
        <ShotLineEditor
          key={openShotId}
          styleId={job.styleId}
          folderName={job.folderName}
          jobId={job.id}
          shot={shotById(openShotId)}
          loading={!story && !loadError}
          error={loadError}
          onPlateRebuilt={(plateFile, staging, summary, plateTakes) => {
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

/** A conversation shot can carry several takes — swipe or tap the arrows to
 * move between them. Picking one mirrors it onto plateFile/staging so
 * everything downstream (strip thumb, Animate) still just reads plateFile.
 * Tap the picture itself to inspect full screen. Older shots with no
 * plateTakes fall back to treating plateFile as a single take. */
function PlatePreview({
  shot,
  jobId,
  onPicked,
}: {
  shot: CrashStoryShot;
  jobId: string;
  onPicked: (plateFile: string, staging: string) => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [busy, setBusy] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const takes: PlateTake[] =
    shot.plateTakes && shot.plateTakes.length
      ? shot.plateTakes
      : shot.plateFile && shot.plateFile !== "__error__"
        ? [{ id: "legacy", fileName: shot.plateFile, staging: shot.staging || "", approved: true }]
        : [];
  if (!takes.length) return null;

  const activeIndex = Math.max(
    0,
    takes.findIndex((t) => t.fileName === shot.plateFile),
  );
  const active = takes[activeIndex] || takes[0];
  const src = `/api/crash/gen/file?name=${encodeURIComponent(active.fileName)}`;

  async function pick(index: number) {
    const take = takes[index];
    if (!take || index === activeIndex || busy) return;
    if (take.id === "legacy") {
      onPicked(take.fileName, take.staging);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, shotId: shot.id, action: "pick", takeId: take.id }),
      });
      const data = (await res.json()) as { plateFile?: string; staging?: string };
      if (res.ok) onPicked(data.plateFile ?? take.fileName, data.staging ?? take.staging);
    } catch {
      /* strip stays on the current take */
    } finally {
      setBusy(false);
    }
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
          if (dx < 0) void pick(activeIndex + 1);
          else void pick(activeIndex - 1);
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
          style={{ width: "100%", maxHeight: "260px", objectFit: "contain", display: "block", opacity: busy ? 0.6 : 1 }}
        />
      </button>
      {takes.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous take"
            disabled={busy || activeIndex === 0}
            onClick={() => void pick(activeIndex - 1)}
            style={{ ...arrowStyle, left: "6px", opacity: activeIndex === 0 ? 0.3 : 1 }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next take"
            disabled={busy || activeIndex === takes.length - 1}
            onClick={() => void pick(activeIndex + 1)}
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
  onPlateRebuilt: (
    plateFile: string | undefined,
    staging: string,
    summary: string,
    plateTakes?: PlateTake[],
  ) => void;
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
      <PlatePreview
        shot={shot}
        jobId={jobId}
        onPicked={(plateFile, staging) => onPlateRebuilt(plateFile, staging, shot.summary)}
      />
      <PlateStagingEditor
        key={shot.plateFile}
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
  onRebuilt: (
    plateFile: string | undefined,
    staging: string,
    summary: string,
    plateTakes?: PlateTake[],
  ) => void;
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
        plateTakes?: PlateTake[];
        job?: MobileGenJob;
      };
      if (!res.ok) throw new Error(data.error || "Couldn't rebuild the plate");
      onRebuilt(data.plateFile, staging, summary, data.plateTakes);
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
        <div style={{ fontSize: "11px", color: "var(--chrome-dim)" }}>
          Story text only — saved, but it doesn&apos;t draw anything. The picture comes from Position tweak below.
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {fieldLabel("Position tweak — draws the picture")}
          <div style={{ flex: 1 }} />
          <MobileAiButton onClick={() => void plateAssist.runAssist()} busy={plateAssist.aiBusy} />
        </div>
        <textarea
          value={staging}
          onChange={(e) => setStaging(e.target.value)}
          onBlur={() => void saveText()}
          rows={3}
          placeholder="Who sits, leans, presents — Jo on the bar, Matty behind it"
          style={shotFieldStyle}
        />
        <MobilePrimaryButton
          disabled={busy || plateAssist.aiBusy || actionAssist.aiBusy || !staging.trim()}
          onClick={() => void rebuild()}
        >
          {busy ? "Drawing…" : "Draw this picture"}
        </MobilePrimaryButton>
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
