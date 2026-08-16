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
import { useMobileAssist } from "@/components/mobile/useMobileAssist";
import { SHOW_STYLE_PRESETS } from "@/lib/showStylePresets";
import { styleRealismLabel } from "@/lib/types";
import type { MobileGenJob } from "@/lib/mobileGenJob";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export default function MobileHomePage() {
  const [prompt, setPrompt] = useState("");
  const [styleId, setStyleId] = useState<(typeof SHOW_STYLE_PRESETS)[number]["id"]>("skidmarks");
  const [styleRealism, setStyleRealism] = useState<number>(
    SHOW_STYLE_PRESETS.find((p) => p.id === "skidmarks")?.defaultRealism ?? 60,
  );

  const [job, setJob] = useState<MobileGenJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [writingScript, setWritingScript] = useState(false);
  const [error, setError] = useState("");
  const [characterIds, setCharacterIds] = useState<Record<string, string>>({});
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

  // Drive the automatic phases (plates/animate/stitch) by polling /step
  // repeatedly — each call does one bounded unit of work. "review" is
  // deliberately not here — it waits on Generate video, not a timer.
  useEffect(() => {
    const autoPhases = ["plates", "animate", "stitch"];
    if (!job || !autoPhases.includes(job.phase)) {
      stopPoll();
      return;
    }
    stopPoll();
    // A step can take far longer than the poll interval — voices and plates
    // take minutes. Without this guard the timer kept firing and several
    // copies of the same phase ran at once, which is what tripped ElevenLabs'
    // 5-concurrent-request limit.
    let inFlight = false;
    pollRef.current = window.setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const data = await postJson<{ job: MobileGenJob }>("/api/crash/mobile/step", {
          jobId: job.id,
        });
        setJob(data.job);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Step failed");
        stopPoll();
      } finally {
        inFlight = false;
      }
    }, 1500);
    return stopPoll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.phase, job?.id]);

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

  const runScreenplay = useCallback(async (jobId: string) => {
    setBusy(true);
    setWritingScript(true);
    setError("");
    try {
      const { job: withScreenplay } = await postJson<{ job: MobileGenJob }>(
        "/api/crash/mobile/screenplay",
        { jobId },
      );
      setJob(withScreenplay);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't write the screenplay");
    } finally {
      setWritingScript(false);
      setBusy(false);
    }
  }, []);

  // Job creation used to fall straight into writing the screenplay; cast and
  // locations are built freeform first now, so this just creates the job —
  // it lands on "cast_build" and the script gets written once that's done.
  const startRun = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const { job: created } = await postJson<{ job: MobileGenJob }>("/api/crash/mobile/job", {
        prompt,
        styleId,
        styleRealism,
      });
      setJob(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start");
    } finally {
      setBusy(false);
    }
  }, [prompt, styleId, styleRealism]);

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
    async (kind: "cast" | "location", name: string, description?: string) => {
      if (!job) return;
      setBusy(true);
      setError("");
      try {
        const { job: updated } = await postJson<{ job: MobileGenJob }>(
          "/api/crash/mobile/candidates",
          { jobId: job.id, kind, action: "add", name, description },
        );
        setJob(updated);
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

  const approveCandidate = useCallback(
    async (kind: "cast" | "location", target: string, candidateId: string) => {
      if (!job) return;
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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Approve failed");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start animation");
    } finally {
      setBusy(false);
    }
  }, [job]);

  const vibeAssist = useMobileAssist("vibe", styleId, () => prompt, setPrompt);

  return (
    <main style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      {error ? (
        <div style={{ margin: "8px 16px", padding: "10px", borderRadius: "8px", background: "rgba(255,26,140,0.12)", color: "var(--magenta-hot)", fontSize: "13px" }}>
          {error}
        </div>
      ) : null}

      {!job ? (
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

      {job ? (
        <StudioTree
          job={job}
          characterIds={characterIds}
          busy={busy}
          error={error}
          writingScript={writingScript}
          onGenerateCast={(name, customPrompt) => genCandidates("cast", name, customPrompt)}
          onApproveCast={(name, candidateId) => approveCandidate("cast", name, candidateId)}
          onAddCast={(name, description) => addRosterItem("cast", name, description)}
          onUploadCast={(name, file) => uploadCandidate("cast", name, file)}
          onGenerateLocation={(id, customPrompt) => genCandidates("location", id, customPrompt)}
          onApproveLocation={(id, candidateId) => approveCandidate("location", id, candidateId)}
          onAddLocation={(name) => addRosterItem("location", name)}
          onUploadLocation={(id, file) => uploadCandidate("location", id, file)}
          onWriteScript={() => void runScreenplay(job.id)}
          onGenerateVideo={() => void approveReview()}
          onRetryError={() => void retryFromError(job.id)}
          onJobChange={setJob}
        />
      ) : null}
    </main>
  );
}

