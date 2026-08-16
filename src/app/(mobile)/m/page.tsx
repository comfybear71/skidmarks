"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActiveStepPanel,
  CompletedStepRow,
  MobilePrimaryButton,
  MobileTextInput,
  mobileCard,
  mobileCardSelected,
} from "@/components/mobile/MobileUi";
import { StudioTree } from "@/components/mobile/StudioTree";
import { SHOW_STYLE_PRESETS } from "@/lib/showStylePresets";
import { styleRealismLabel } from "@/lib/types";
import type { MobileGenJob } from "@/lib/mobileGenJob";

type LocalStep = "prompt" | "style" | "duration";

const DURATION_PRESETS = [
  { label: "Quick", seconds: 60 },
  { label: "Short", seconds: 5 * 60 },
  { label: "Standard", seconds: 10 * 60 },
  { label: "Long", seconds: 20 * 60 },
];
const SECONDS_PER_SHOT = 5; // matches Stuie's real 2-7s Comfy clips

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
  const [localStep, setLocalStep] = useState<LocalStep>("prompt");
  const [prompt, setPrompt] = useState("");
  const [styleId, setStyleId] = useState<(typeof SHOW_STYLE_PRESETS)[number]["id"]>("skidmarks");
  const [styleRealism, setStyleRealism] = useState<number>(
    SHOW_STYLE_PRESETS.find((p) => p.id === "skidmarks")?.defaultRealism ?? 60,
  );
  // A preset tap used to always drag the slider along with it — dragging the
  // slider yourself, then tapping a different recipe, silently threw the
  // drag away. Once the slider's been touched by hand it stays put; only an
  // untouched slider still takes a preset's default.
  const [realismTouched, setRealismTouched] = useState(false);
  const [targetDurationSec, setTargetDurationSec] = useState(60);

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
        targetDurationSec,
        secondsPerShot: SECONDS_PER_SHOT,
      });
      setJob(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start");
    } finally {
      setBusy(false);
    }
  }, [prompt, styleId, styleRealism, targetDurationSec]);

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

  const preset = SHOW_STYLE_PRESETS.find((p) => p.id === styleId) || SHOW_STYLE_PRESETS[0]!;
  const shotEstimate = Math.max(1, Math.round(targetDurationSec / SECONDS_PER_SHOT));

  return (
    <main style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      {/* Completed-step trail */}
      {job || localStep !== "prompt" ? (
        <CompletedTrail
          prompt={prompt || undefined}
          style={job || localStep === "duration" ? preset.label : undefined}
          duration={
            job
              ? `~${Math.round(targetDurationSec / 60) || targetDurationSec / 60} min · ~${shotEstimate} clips`
              : undefined
          }
        />
      ) : null}

      {error ? (
        <div style={{ margin: "8px 16px", padding: "10px", borderRadius: "8px", background: "rgba(255,26,140,0.12)", color: "var(--magenta-hot)", fontSize: "13px" }}>
          {error}
        </div>
      ) : null}

      {/* Step 1: Prompt */}
      {!job && localStep === "prompt" && (
        <ActiveStepPanel title="What's the idea?" subtitle="A scene, a script, or just a word — Mars, a bad first date, whatever.">
          <MobileTextInput value={prompt} onChange={setPrompt} placeholder="A crew lands on Mars and immediately regrets it..." multiline />
          <div style={{ marginTop: "16px" }}>
            <MobilePrimaryButton disabled={!prompt.trim()} onClick={() => setLocalStep("style")}>
              Next
            </MobilePrimaryButton>
          </div>
        </ActiveStepPanel>
      )}

      {/* Step 2: Style */}
      {!job && localStep === "style" && (
        <ActiveStepPanel title="Pick a style" subtitle="Drag the slider. The show recipes below are just starting points.">
          {/* Slider first — it is the control that actually decides the look.
              Same cartoon <-> photo scale as the desktop Image gen. */}
          <div style={{ marginBottom: "22px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                color: "var(--chrome-dim)",
                marginBottom: "8px",
              }}
            >
              <span>Cartoon</span>
              <span style={{ color: "var(--acid)", fontWeight: 700, fontSize: "15px" }}>
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
              onChange={(e) => {
                setRealismTouched(true);
                setStyleRealism(Number(e.target.value));
              }}
              aria-label="Cartoon to photoreal"
              style={{ width: "100%", accentColor: "var(--acid)" }}
            />
          </div>

          <div style={{ fontSize: "12px", color: "var(--chrome-dim)", marginBottom: "8px" }}>
            Start from a show recipe
          </div>
          <div style={{ display: "flex", gap: "10px", overflowX: "auto", padding: "2px 2px 4px" }}>
            {SHOW_STYLE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setStyleId(p.id);
                  if (!realismTouched) setStyleRealism(p.defaultRealism);
                }}
                style={{
                  ...(p.id === styleId ? mobileCardSelected : mobileCard),
                  textAlign: "left",
                  padding: "12px",
                  color: "var(--chrome)",
                  flex: "0 0 auto",
                  width: "140px",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "14px" }}>{p.label}</div>
                <div style={{ color: "var(--chrome-dim)", fontSize: "11px", marginTop: "2px" }}>{p.tagline}</div>
              </button>
            ))}
          </div>

          <div style={{ marginTop: "16px" }}>
            <MobilePrimaryButton onClick={() => setLocalStep("duration")}>Next</MobilePrimaryButton>
          </div>
        </ActiveStepPanel>
      )}

      {/* Step 3: Duration */}
      {!job && localStep === "duration" && (
        <ActiveStepPanel title="How long?" subtitle={`~${shotEstimate} short clips stitched together, ~${SECONDS_PER_SHOT}s each.`}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {DURATION_PRESETS.map((d) => (
              <button
                key={d.label}
                type="button"
                onClick={() => setTargetDurationSec(d.seconds)}
                style={{
                  ...(d.seconds === targetDurationSec ? mobileCardSelected : mobileCard),
                  textAlign: "left",
                  padding: "14px",
                  color: "var(--chrome)",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontWeight: 700 }}>{d.label}</span>
                <span style={{ color: "var(--chrome-dim)" }}>
                  {d.seconds < 60 ? `${d.seconds}s` : `${d.seconds / 60} min`}
                </span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: "16px" }}>
            <MobilePrimaryButton disabled={busy} onClick={() => void startRun()}>
              {busy ? "Starting…" : "Open studio"}
            </MobilePrimaryButton>
          </div>
        </ActiveStepPanel>
      )}

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
          onGenerateLocation={(id, customPrompt) => genCandidates("location", id, customPrompt)}
          onApproveLocation={(id, candidateId) => approveCandidate("location", id, candidateId)}
          onAddLocation={(name) => addRosterItem("location", name)}
          onWriteScript={() => void runScreenplay(job.id)}
          onGenerateVideo={() => void approveReview()}
          onRetryError={() => void retryFromError(job.id)}
          onJobChange={setJob}
        />
      ) : null}
    </main>
  );
}

/** Prompt/Style/Duration used to be three full-width rows eating the top of
 * the screen before anything else could show — one line, tap to expand. */
function CompletedTrail({
  prompt,
  style,
  duration,
}: {
  prompt?: string;
  style?: string;
  duration?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const parts = [prompt, style, duration].filter(Boolean) as string[];
  if (!parts.length) return null;

  return (
    <div style={{ borderBottom: "1px solid var(--line)" }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 16px",
          background: "none",
          border: "none",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: "12px",
            color: "var(--chrome-dim)",
          }}
        >
          {parts.join("  ·  ")}
        </span>
        <span
          style={{
            color: "var(--chrome-dim)",
            fontSize: "10px",
            flex: "0 0 auto",
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 150ms",
          }}
        >
          ▾
        </span>
      </button>
      {expanded ? (
        <div style={{ paddingBottom: "4px" }}>
          {prompt ? <CompletedStepRow title="Prompt" summary={prompt} /> : null}
          {style ? <CompletedStepRow title="Style" summary={style} /> : null}
          {duration ? <CompletedStepRow title="Duration" summary={duration} /> : null}
        </div>
      ) : null}
    </div>
  );
}

