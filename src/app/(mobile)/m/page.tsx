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
import { SwipeCarousel } from "@/components/mobile/SwipeCarousel";
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
  const [targetDurationSec, setTargetDurationSec] = useState(60);

  const [job, setJob] = useState<MobileGenJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [characterIds, setCharacterIds] = useState<Record<string, string>>({});
  const pollRef = useRef<number | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const refreshJob = useCallback(async (jobId: string) => {
    const res = await fetch(`/api/crash/mobile/job/${jobId}`);
    const data = await res.json();
    if (res.ok && data.job) setJob(data.job as MobileGenJob);
  }, []);

  // Drive the automatic phases (plates/voices/animate/stitch) by polling
  // /step repeatedly — each call does one bounded unit of work.
  useEffect(() => {
    const autoPhases = ["plates", "voices", "animate", "stitch"];
    if (!job || !autoPhases.includes(job.phase)) {
      stopPoll();
      return;
    }
    stopPoll();
    pollRef.current = window.setInterval(async () => {
      try {
        const data = await postJson<{ job: MobileGenJob }>("/api/crash/mobile/step", {
          jobId: job.id,
        });
        setJob(data.job);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Step failed");
        stopPoll();
      }
    }, 1500);
    return stopPoll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.phase, job?.id]);

  useEffect(() => {
    if (job?.phase === "cast_images") {
      fetch("/api/characters")
        .then((r) => r.json())
        .then((d) => {
          const map: Record<string, string> = {};
          for (const c of d.characters || []) map[c.name] = c.id;
          setCharacterIds(map);
        })
        .catch(() => {});
    }
  }, [job?.phase]);

  const runScreenplay = useCallback(async (jobId: string) => {
    setBusy(true);
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
      setBusy(false);
    }
  }, []);

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
      setBusy(false);
      await runScreenplay(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start");
      setBusy(false);
    }
  }, [prompt, styleId, styleRealism, targetDurationSec, runScreenplay]);

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
        // Check whether every speaker/scene now has a pick — if so, advance.
        const res = await postJson<{ job: MobileGenJob }>("/api/crash/mobile/step", {
          jobId: job.id,
        });
        setJob(res.job);
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
        <div>
          {prompt ? <CompletedStepRow title="Prompt" summary={prompt} /> : null}
          {job || localStep === "duration" ? (
            <CompletedStepRow title="Style" summary={preset.label} />
          ) : null}
          {job ? (
            <CompletedStepRow
              title="Duration"
              summary={`~${Math.round(targetDurationSec / 60) || targetDurationSec / 60} min · ~${shotEstimate} clips`}
            />
          ) : null}
        </div>
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
              onChange={(e) => setStyleRealism(Number(e.target.value))}
              aria-label="Cartoon to photoreal"
              style={{ width: "100%", accentColor: "var(--acid)" }}
            />
          </div>

          <div style={{ fontSize: "12px", color: "var(--chrome-dim)", marginBottom: "8px" }}>
            Start from a show recipe
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", overflow: "auto" }}>
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
                  textAlign: "left",
                  padding: "14px",
                  color: "var(--chrome)",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "15px" }}>{p.label}</div>
                <div style={{ color: "var(--chrome-dim)", fontSize: "12px", marginTop: "2px" }}>{p.tagline}</div>
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
              {busy ? "Writing the screenplay…" : "Generate"}
            </MobilePrimaryButton>
          </div>
        </ActiveStepPanel>
      )}

      {/* Waiting on screenplay before job.phase exists yet */}
      {job && job.phase === "screenplay" && !error && (
        <ActiveStepPanel title="Writing the screenplay…" subtitle="Casting your idea into a script.">
          <BusySpinner />
        </ActiveStepPanel>
      )}
      {job && job.phase === "screenplay" && error && (
        <ActiveStepPanel title="Couldn't write the screenplay" subtitle="Fix the issue above, then try again.">
          <MobilePrimaryButton onClick={() => void runScreenplay(job.id)}>Retry</MobilePrimaryButton>
        </ActiveStepPanel>
      )}

      {/* Step 4: Cast */}
      {job && job.phase === "cast_images" && (
        <CastLocationStep
          key="cast"
          title="Pick your cast"
          subtitle="Swipe to see faces, tap to pick one. Type to steer a fresh batch."
          items={job.speakers}
          candidatesOf={(name) => job.castCandidates[name] || []}
          imageSrc={(name, c) =>
            `/api/crash/mobile/cast-face?styleId=${encodeURIComponent(job.styleId)}&folderName=${encodeURIComponent(job.folderName)}&characterId=${encodeURIComponent(characterIds[name] || "")}&fileName=${encodeURIComponent(c.fileName)}`
          }
          onGenerate={(name, customPrompt) => genCandidates("cast", name, customPrompt)}
          onApprove={(name, candidateId) => approveCandidate("cast", name, candidateId)}
          busy={busy}
          error={error}
          promptPlaceholder="e.g. more like a grumpy dad"
        />
      )}

      {/* Step 5: Location */}
      {job && job.phase === "location_images" && (
        <CastLocationStep
          key="location"
          title="Pick your locations"
          subtitle='Prompt anything — try "Mars" — then swipe and pick.'
          items={job.scenes.map((s) => s.id)}
          labelOf={(id) => job.scenes.find((s) => s.id === id)?.placeName || id}
          candidatesOf={(id) => job.locationCandidates[id] || []}
          imageSrc={(_id, c) => `/api/crash/gen/file?name=${encodeURIComponent(c.fileName)}`}
          onGenerate={(id, customPrompt) => genCandidates("location", id, customPrompt)}
          onApprove={(id, candidateId) => approveCandidate("location", id, candidateId)}
          busy={busy}
          error={error}
          promptPlaceholder="e.g. Mars, a dive bar, outer space"
        />
      )}

      {/* Steps 6-7: auto-build (plates + voices) */}
      {job && (job.phase === "plates" || job.phase === "voices") && (
        <ActiveStepPanel
          title={job.phase === "plates" ? "Building the shots…" : "Casting voices…"}
          subtitle="This runs on its own — sit tight."
        >
          <BusySpinner />
        </ActiveStepPanel>
      )}

      {/* Step 8: Review & approve */}
      {job && job.phase === "review" && (
        <ActiveStepPanel title="Ready to animate" subtitle="Everything's built. This next part costs GPU time.">
          <div style={{ color: "var(--chrome-dim)", fontSize: "13px", marginBottom: "16px" }}>
            {job.shots.filter((s) => s.plateFile && s.plateFile !== "__error__").length}/{job.shots.length} shots plated ·{" "}
            {job.clips.length} lines to animate
          </div>
          <MobilePrimaryButton disabled={busy} onClick={() => void approveReview()}>
            {busy ? "Starting…" : "Generate video"}
          </MobilePrimaryButton>
        </ActiveStepPanel>
      )}

      {/* Step 9: Animate */}
      {job && (job.phase === "animate" || job.phase === "stitch") && (
        <ActiveStepPanel
          title="Animating…"
          subtitle={
            job.phase === "animate"
              ? `${job.clips.filter((c) => c.clipStatus !== "pending").length}/${job.clips.length} clips`
              : "Stitching it all together…"
          }
        >
          <BusySpinner />
        </ActiveStepPanel>
      )}

      {/* Step 10: Result */}
      {job && job.phase === "done" && (
        <ActiveStepPanel title="Done!" subtitle="Here's your video.">
          <ResultStep job={job} />
        </ActiveStepPanel>
      )}

      {job && job.phase === "error" && (
        <ActiveStepPanel title="Something went wrong" subtitle={job.error || "Unknown error"}>
          {/* Per-clip failures are server-side, so they never reach the browser
              console. Without them on screen this panel is a dead end. */}
          {[...new Set(job.clips.map((c) => (c.error || "").trim()).filter(Boolean))].map((reason) => (
            <div
              key={reason}
              style={{
                margin: "0 0 8px",
                padding: "10px",
                borderRadius: "8px",
                background: "var(--panel-2)",
                color: "var(--chrome-dim)",
                fontSize: "12px",
                wordBreak: "break-word",
              }}
            >
              {reason}
            </div>
          ))}
          <MobilePrimaryButton onClick={() => void refreshJob(job.id)}>Check again</MobilePrimaryButton>
        </ActiveStepPanel>
      )}
    </main>
  );
}

function BusySpinner() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "999px",
          border: "3px solid var(--line)",
          borderTopColor: "var(--acid)",
          animation: "spin 900ms linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function CastLocationStep({
  title,
  subtitle,
  items,
  labelOf,
  candidatesOf,
  imageSrc,
  onGenerate,
  onApprove,
  busy,
  error,
  promptPlaceholder,
}: {
  title: string;
  subtitle: string;
  items: string[];
  labelOf?: (id: string) => string;
  candidatesOf: (id: string) => { id: string; fileName: string; approved: boolean }[];
  imageSrc: (id: string, c: { id: string; fileName: string; approved: boolean }) => string;
  onGenerate: (id: string, customPrompt?: string) => void;
  onApprove: (id: string, candidateId: string) => void;
  busy: boolean;
  error: string;
  promptPlaceholder: string;
}) {
  const [cursor, setCursor] = useState(0);
  const [customPrompt, setCustomPrompt] = useState("");
  const requested = useRef<Record<string, boolean>>({});
  const current = items[cursor];
  const candidates = current ? candidatesOf(current) : [];

  // Approving advances the cursor while the approve POST is still in flight,
  // so this fires for the next item with busy already true. Watching busy as
  // well means the skipped generate is picked up the moment approve lands —
  // without it the second character sat on a spinner and never asked for
  // anything. attempted[] keeps that from re-firing forever when a batch
  // legitimately comes back empty.
  useEffect(() => {
    if (!current || busy) return;
    if (candidatesOf(current).length || requested.current[current]) return;
    requested.current[current] = true;
    onGenerate(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, busy]);

  if (!current) return null;

  return (
    <ActiveStepPanel title={title} subtitle={`${subtitle} (${cursor + 1}/${items.length})`}>
      {/* Everything picked so far, so the cast/locations you have built stay
          visible instead of disappearing the moment the cursor moves on. */}
      {(() => {
        const picked = items
          .map((id) => ({ id, chosen: candidatesOf(id).find((c) => c.approved) }))
          .filter((p) => p.chosen && p.id !== current);
        if (!picked.length) return null;
        return (
          <div
            style={{
              maxHeight: "132px",
              overflowY: "auto",
              marginBottom: "12px",
              border: "1px solid var(--line)",
              borderRadius: "10px",
              background: "var(--panel-2)",
            }}
          >
            {picked.map(({ id, chosen }) => (
              <div
                key={id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "6px 8px",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc(id, chosen!)}
                  alt=""
                  style={{
                    width: "40px",
                    height: "40px",
                    objectFit: "cover",
                    borderRadius: "8px",
                    flex: "0 0 auto",
                  }}
                />
                <span style={{ fontSize: "13px", color: "var(--chrome)" }}>
                  {labelOf ? labelOf(id) : id}
                </span>
                <span style={{ marginLeft: "auto", color: "var(--acid)", fontSize: "13px" }}>✓</span>
              </div>
            ))}
          </div>
        );
      })()}

      <div style={{ color: "var(--acid)", fontWeight: 700, marginBottom: "8px" }}>
        {labelOf ? labelOf(current) : current}
      </div>
      {candidates.length ? (
        <SwipeCarousel
          candidates={candidates}
          imageSrc={(c) => imageSrc(current, c)}
          busy={busy}
          onApprove={(c) => {
            onApprove(current, c.id);
            if (cursor < items.length - 1) setCursor((n) => n + 1);
          }}
        />
      ) : !busy && error ? (
        // Idle, asked for, nothing to show. Previously this rendered a spinner
        // that never resolved and gave no way out.
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ color: "var(--chrome-dim)", fontSize: "13px", marginBottom: "12px" }}>
            Nothing came back for this one.
          </div>
          <MobilePrimaryButton
            onClick={() => {
              requested.current[current] = false;
              onGenerate(current);
            }}
          >
            Try again
          </MobilePrimaryButton>
        </div>
      ) : (
        <BusySpinner />
      )}
      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
        <input
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder={promptPlaceholder}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid var(--line)",
            background: "var(--panel-2)",
            color: "var(--chrome)",
            fontSize: "13px",
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            onGenerate(current, customPrompt || undefined);
            setCustomPrompt("");
          }}
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid var(--line)",
            background: "transparent",
            color: "var(--chrome)",
            fontSize: "13px",
          }}
        >
          More
        </button>
      </div>
    </ActiveStepPanel>
  );
}

function ResultStep({ job }: { job: MobileGenJob }) {
  const src = `/api/crash/mobile/final?jobId=${job.id}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
      <video src={src} controls playsInline style={{ width: "100%", borderRadius: "12px", background: "#000" }} />
      <a
        href={src}
        download
        style={{
          textAlign: "center",
          padding: "14px",
          borderRadius: "10px",
          background: "var(--acid)",
          color: "var(--void)",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Save to device
      </a>
      <button
        type="button"
        onClick={() => {
          if (navigator.share) {
            void navigator.share({ title: "Skidmarks Auto Studio", url: window.location.href });
          }
        }}
        style={{
          padding: "14px",
          borderRadius: "10px",
          border: "1px solid var(--line)",
          background: "transparent",
          color: "var(--chrome)",
          fontWeight: 600,
        }}
      >
        Share
      </button>
    </div>
  );
}
