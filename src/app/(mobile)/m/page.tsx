"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActiveStepPanel,
  MobilePrimaryButton,
  MobileTextInput,
  mobileCard,
  mobileCardSelected,
} from "@/components/mobile/MobileUi";
import { StudioTree } from "@/components/mobile/StudioTree";
import { StudioSessionChip } from "@/components/mobile/StudioSessionChip";
import { OpenEpisodePicker } from "@/components/mobile/OpenEpisodePicker";
import { useMobileAssist } from "@/components/mobile/useMobileAssist";
import { SHOW_STYLE_PRESETS } from "@/lib/showStylePresets";
import { styleRealismLabel } from "@/lib/types";
import type { MobileGenJob } from "@/lib/mobileGenJob";
import { DEFAULT_DESK_ID, jobDeskId } from "@/lib/mobileDesk";
import { readResumedJobId, writeResumedJobId, clearResumedJobId } from "@/lib/mobileJobResume";
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

export default function MobileHomePage() {
  const [prompt, setPrompt] = useState("");
  const [styleId, setStyleId] = useState<(typeof SHOW_STYLE_PRESETS)[number]["id"]>("skidmarks");
  const [styleRealism, setStyleRealism] = useState<number>(
    SHOW_STYLE_PRESETS.find((p) => p.id === "skidmarks")?.defaultRealism ?? 60,
  );

  const [job, setJob] = useState<MobileGenJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockingScript, setLockingScript] = useState(false);
  const [error, setError] = useState("");
  const [characterIds, setCharacterIds] = useState<Record<string, string>>({});
  const [resuming, setResuming] = useState(true);
  const [resumeError, setResumeError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftingNew, setDraftingNew] = useState(false);
  const pollRef = useRef<number | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  // "Check again" on the error screen used to just re-fetch the same stuck
  // job — a GET can't move a terminal "error" phase anywhere. This POSTs to
  // /step, which now knows how to resume once a clip has been attached
  // manually; the auto-poll effect below picks up from there since it
  // restarts whenever job.phase changes.
  const retryFromError = useCallback(async (jobId: string) => {
    setError("");
    try {
      const data = await postJson<{ job: MobileGenJob }>("/api/crash/mobile/step", { jobId });
      setJob(data.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed");
    }
  }, []);

  // Drive the automatic phases (plates/animate) by polling /step
  // repeatedly — each call does one bounded unit of work. "review" is
  // deliberately not here — it waits on Generate video, not a timer.
  // Stitch is parked (MOBILE_STITCH_MOVIES); LTX still runs.
  useEffect(() => {
    const autoPhases = ["plates", "animate"];
    const url =
      job && autoPhases.includes(job.phase) ? "/api/crash/mobile/step" : null;
    if (!job || !url) {
      stopPoll();
      return;
    }
    stopPoll();
    // A step can take far longer than the poll interval — voices and plates
    // take minutes. Without this guard the timer kept firing and several
    // copies of the same phase ran at once, which is what tripped ElevenLabs'
    // 5-concurrent-request limit.
    let inFlight = false;
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const data = await postJson<{ job: MobileGenJob }>(url, {
          jobId: job.id,
        });
        setJob(data.job);
        if (data.job.error) setError(data.job.error);
        if (data.job.phase === "error") stopPoll();
      } catch (e) {
        setError(studioFetchError(e, "Step failed"));
        stopPoll();
      } finally {
        inFlight = false;
      }
    };
    void tick();
    pollRef.current = window.setInterval(() => {
      void tick();
    }, 1500);
    return stopPoll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.phase, job?.id]);

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
        const d = (await r.json().catch(() => ({}))) as {
          job?: MobileGenJob;
          error?: string;
        };
        if (cancelled) return;
        if (!d.job) {
          setResumeError(d.error || `Couldn't open ${id}. The episode is still there — don't tap Start directing.`);
          return;
        }
        setJob(d.job);
      })
      .catch(() => {
        if (!cancelled) {
          setResumeError(`Couldn't open ${id}. The episode is still there — don't tap Start directing.`);
        }
      })
      .finally(() => {
        if (!cancelled) setResuming(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    if (job) {
      fetch("/api/characters")
        .then((r) => r.json())
        .then((d) => {
          const map: Record<string, string> = {};
          for (const c of d.characters || []) map[c.name] = c.id;
          setCharacterIds(map);
        })
        .catch(() => {});
    }
    // "+ Add another character" grows job.speakers without a phase change —
    // refetch so the new one's face-generation calls get a real characterId.
  }, [job?.phase, job?.speakers.length]);

  const runScreenplay = useCallback(async (jobId: string, script: string) => {
    setBusy(true);
    setLockingScript(true);
    setError("");
    try {
      const { job: withScreenplay } = await postJson<{ job: MobileGenJob }>(
        "/api/crash/mobile/screenplay",
        { jobId, script },
      );
      setJob(withScreenplay);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't lock the script");
    } finally {
      setLockingScript(false);
      setBusy(false);
    }
  }, []);

  // Job creation used to fall straight into writing the screenplay; cast and
  // locations are built freeform first now, so this just creates the job —
  // it lands on "cast_build". The episode is a template + AI draft + refine,
  // then Lock — Grok does not write-and-lock in one tap.
  const startRun = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const { job: created } = await postJson<{ job: MobileGenJob }>("/api/crash/mobile/job", {
        prompt,
        styleId,
        styleRealism,
        deskId: DEFAULT_DESK_ID,
      });
      setJob(created);
      setDraftingNew(false);
      setResumeError("");
      setPickerOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start");
    } finally {
      setBusy(false);
    }
  }, [prompt, styleId, styleRealism]);

  const openEpisode = useCallback(async (jobId: string) => {
    const id = jobId.trim();
    if (!id) return;
    setBusy(true);
    setError("");
    setResumeError("");
    try {
      const res = await fetch(`/api/crash/mobile/job/${encodeURIComponent(id)}`);
      const data = (await res.json().catch(() => ({}))) as { job?: MobileGenJob; error?: string };
      if (!data.job) throw new Error(data.error || "Episode not found");
      setJob(data.job);
      setDraftingNew(false);
      setPrompt(data.job.prompt || "");
      if (data.job.styleId) setStyleId(data.job.styleId as typeof styleId);
      if (typeof data.job.styleRealism === "number") setStyleRealism(data.job.styleRealism);
      try {
        writeResumedJobId(window.localStorage, data.job.id, jobDeskId(data.job));
      } catch {
        /* private mode */
      }
      const url = new URL(window.location.href);
      url.searchParams.set("job", data.job.id);
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open episode");
    } finally {
      setBusy(false);
    }
  }, []);

  const beginNewEpisode = useCallback(() => {
    stopPoll();
    setJob(null);
    setDraftingNew(true);
    setResumeError("");
    setError("");
    setPickerOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("job");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }, [stopPoll]);

  const afterEpisodeDeleted = useCallback(
    (jobId: string) => {
      try {
        clearResumedJobId(window.localStorage, jobId, DEFAULT_DESK_ID);
      } catch {
        /* private mode */
      }
      if (job?.id === jobId) beginNewEpisode();
    },
    [job?.id, beginNewEpisode],
  );

  const genCandidates = useCallback(
    async (kind: "cast" | "location", target: string, customPrompt?: string) => {
      if (!job) return;
      setBusy(true);
      setError("");
      try {
        const { job: updated } = await postJson<{ job: MobileGenJob }>(
          "/api/crash/mobile/candidates",
          { jobId: job.id, kind, target, action: "generate", customPrompt },
        );
        setJob(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Generation failed");
      } finally {
        setBusy(false);
      }
    },
    [job],
  );

  // Adds a speaker/scene not yet on the roster — "his friend is a grunge
  // bottle of olive oil" — with no dialogue attached yet. It joins the
  // roster/world and picks a face like anything else; giving it a line is a
  // later, separate decision.
  const addRosterItem = useCallback(
    async (
      kind: "cast" | "location",
      name: string,
      description?: string,
      file?: File,
    ) => {
      if (!job) return;
      setBusy(true);
      setError("");
      try {
        const { job: added } = await postJson<{ job: MobileGenJob }>(
          "/api/crash/mobile/candidates",
          { jobId: job.id, kind, action: "add", name, description },
        );
        setJob(added);
        if (file && kind === "cast") {
          const form = new FormData();
          form.set("jobId", added.id);
          form.set("kind", "cast");
          form.set("target", name);
          form.set("file", file);
          const res = await fetch("/api/crash/mobile/candidate-upload", {
            method: "POST",
            body: form,
          });
          const data = (await res.json()) as { job?: MobileGenJob; error?: string };
          if (!res.ok || !data.job) throw new Error(data.error || "Couldn't use that photo");
          setJob(data.job);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't add that");
      } finally {
        setBusy(false);
      }
    },
    [job],
  );

  const uploadCandidate = useCallback(
    async (kind: "cast" | "location", target: string, file: File) => {
      if (!job) return;
      setBusy(true);
      setError("");
      try {
        const form = new FormData();
        form.set("jobId", job.id);
        form.set("kind", kind);
        form.set("target", target);
        form.set("file", file);
        const res = await fetch("/api/crash/mobile/candidate-upload", { method: "POST", body: form });
        const data = (await res.json()) as { job?: MobileGenJob; error?: string };
        if (!res.ok || !data.job) throw new Error(data.error || "Couldn't use that photo");
        setJob(data.job);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't use that photo");
      } finally {
        setBusy(false);
      }
    },
    [job],
  );

  const makeCharacterPlate = useCallback(
    async (name: string) => {
      if (!job) return;
      setJob((prev) =>
        prev
          ? {
              ...prev,
              characterPlates: {
                ...(prev.characterPlates || {}),
                [name]: {
                  fileName: prev.characterPlates?.[name]?.fileName || "",
                  status: "pending",
                },
              },
            }
          : prev,
      );
      try {
        const { job: updated } = await postJson<{ job: MobileGenJob }>(
          "/api/crash/mobile/character-plate",
          { jobId: job.id, name },
        );
        setJob(updated);
      } catch {
        // Plate row on the tree holds the why. A page banner here made
        // it look like the episode died — the cast is still on the job.
      }
    },
    [job],
  );

  const approveCandidate = useCallback(
    async (kind: "cast" | "location", target: string, candidateId: string) => {
      if (!job) return false;
      setBusy(true);
      setError("");
      try {
        const { job: updated } = await postJson<{ job: MobileGenJob }>(
          "/api/crash/mobile/candidates",
          { jobId: job.id, kind, target, action: "approve", candidateId },
        );
        setJob(updated);
        // After the script, leftover pick screens still need /step to move
        // on. During the tree build, approving a face/place must not jump
        // the page away — Cast and Locations stay put.
        if (job.phase === "cast_images" || job.phase === "location_images") {
          const res = await postJson<{ job: MobileGenJob }>("/api/crash/mobile/step", {
            jobId: job.id,
          });
          setJob(res.job);
        }
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Approve failed");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [job],
  );

  const approveReview = useCallback(async () => {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const { job: updated } = await postJson<{ job: MobileGenJob }>("/api/crash/mobile/step", {
        jobId: job.id,
        approveReview: true,
      });
      setJob(updated);
      if (updated.error) setError(updated.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start animation");
    } finally {
      setBusy(false);
    }
  }, [job]);

  const removeCandidate = useCallback(
    async (kind: "cast" | "location", target: string, candidateId: string) => {
      if (!job) return;
      setBusy(true);
      setError("");
      try {
        const { job: updated } = await postJson<{ job: MobileGenJob }>(
          "/api/crash/mobile/candidates",
          { jobId: job.id, kind, target, action: "remove", candidateId },
        );
        setJob(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't remove that still");
      } finally {
        setBusy(false);
      }
    },
    [job],
  );

  const vibeAssist = useMobileAssist("vibe", styleId, () => prompt, setPrompt);

  const showVibeForm = !resuming && (!job || draftingNew);
  const showResumeFail = !resuming && !job && Boolean(resumeError) && !draftingNew;

  return (
    <main className="mobile-shell" style={{ minHeight: "100dvh" }}>
      <StudioSessionChip />
      {error ? (
        <div style={{ margin: "8px 16px", padding: "10px", borderRadius: "8px", background: "rgba(255,26,140,0.12)", color: "var(--magenta-hot)", fontSize: "13px" }}>
          {error}
        </div>
      ) : null}

      {!resuming ? (
        <div style={{ padding: "8px 16px 0" }}>
          <OpenEpisodePicker
            deskId={DEFAULT_DESK_ID}
            activeJobId={job?.id}
            open={pickerOpen || !job || showResumeFail}
            onOpenChange={setPickerOpen}
            onOpen={(id) => void openEpisode(id)}
            onNew={beginNewEpisode}
            onDeleted={afterEpisodeDeleted}
          />
        </div>
      ) : null}

      {resuming ? (
        <div style={{ padding: "24px 16px", color: "var(--chrome-dim)", fontSize: "14px" }}>
          Opening the episode…
        </div>
      ) : showResumeFail ? (
        <div style={{ padding: "16px" }}>
          <div style={{ color: "var(--magenta-hot)", fontSize: "15px", fontWeight: 600 }}>
            {resumeError}
          </div>
          <div style={{ color: "var(--chrome-dim)", fontSize: "13px", marginTop: "8px" }}>
            Pick an episode above, or New episode. Do not mash Start directing hoping it finds the old one.
          </div>
        </div>
      ) : showVibeForm ? (
        <ActiveStepPanel title="What's the vibe?" subtitle="You direct. We hold the cast, the places, and the plates.">
          <MobileTextInput
            value={prompt}
            onChange={setPrompt}
            placeholder="A crew lands on Mars and immediately regrets it..."
            multiline
            rows={3}
            onAi={() => void vibeAssist.runAssist()}
            aiBusy={vibeAssist.aiBusy}
          />
          {vibeAssist.aiError ? (
            <div style={{ color: "var(--magenta-hot)", fontSize: "12px", marginTop: "6px" }}>
              {vibeAssist.aiError}
            </div>
          ) : null}

          {/* Named show = naming this episode's look. Slider = something else. */}
          <div
            style={{
              color: "var(--chrome-dim)",
              fontSize: "11px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              margin: "14px 0 8px",
            }}
          >
            Look
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "6px",
            }}
          >
            {SHOW_STYLE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setStyleId(p.id);
                  setStyleRealism(p.defaultRealism);
                }}
                style={{
                  ...(p.id === styleId ? mobileCardSelected : mobileCard),
                  textAlign: "center",
                  padding: "8px 4px",
                  color: "var(--chrome)",
                  fontWeight: 700,
                  fontSize: "11px",
                  lineHeight: 1.2,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: "14px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "11px",
                color: "var(--chrome-dim)",
                marginBottom: "4px",
              }}
            >
              <span>Cartoon</span>
              <span style={{ color: "var(--acid)", fontWeight: 700 }}>
                {styleRealism} · {styleRealismLabel(styleRealism)}
              </span>
              <span>Photoreal</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={styleRealism}
              onChange={(e) => setStyleRealism(Number(e.target.value))}
              aria-label="Cartoon to photoreal"
              style={{ width: "100%", accentColor: "var(--acid)" }}
            />
          </div>

          <div style={{ marginTop: "14px" }}>
            <MobilePrimaryButton disabled={!prompt.trim() || busy} onClick={() => void startRun()}>
              {busy ? "Starting…" : "Start directing"}
            </MobilePrimaryButton>
          </div>
        </ActiveStepPanel>
      ) : null}

      {job && !draftingNew ? (
        <StudioTree
          job={job}
          characterIds={characterIds}
          busy={busy}
          error={error}
          lockingScript={lockingScript}
          onGenerateCast={(name, customPrompt) => genCandidates("cast", name, customPrompt)}
          onApproveCast={(name, candidateId) => approveCandidate("cast", name, candidateId)}
          onMakeCharacterPlate={(name) => void makeCharacterPlate(name)}
          onAddCast={(name, description, file) =>
            addRosterItem("cast", name, description, file)
          }
          onUploadCast={(name, file) => uploadCandidate("cast", name, file)}
          onGenerateLocation={(id, customPrompt) => genCandidates("location", id, customPrompt)}
          onApproveLocation={(id, candidateId) => approveCandidate("location", id, candidateId)}
          onAddLocation={(name) => addRosterItem("location", name)}
          onUploadLocation={(id, file) => uploadCandidate("location", id, file)}
          onRemoveCast={(name, candidateId) => void removeCandidate("cast", name, candidateId)}
          onRemoveLocation={(id, candidateId) => void removeCandidate("location", id, candidateId)}
          onDropScript={(script) => void runScreenplay(job.id, script)}
          onGenerateVideo={() => void approveReview()}
          onRetryError={() => void retryFromError(job.id)}
          onJobChange={setJob}
        />
      ) : null}
    </main>
  );
}

