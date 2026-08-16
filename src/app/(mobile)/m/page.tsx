"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActiveStepPanel,
  CompletedStepRow,
  MobilePrimaryButton,
  MobileTextInput,
  ShimmerText,
  mobileCard,
  mobileCardSelected,
} from "@/components/mobile/MobileUi";
import { SingleCandidateCard } from "@/components/mobile/SingleCandidateCard";
import { StoryFeed } from "@/components/mobile/StoryFeed";
import { PlateReviewEditor } from "@/components/mobile/PlateReviewEditor";
import { SHOW_STYLE_PRESETS } from "@/lib/showStylePresets";
import { styleRealismLabel } from "@/lib/types";
import type { MobileGenJob } from "@/lib/mobileGenJob";

type LocalStep = "prompt" | "style";

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

  const [job, setJob] = useState<MobileGenJob | null>(null);
  const [busy, setBusy] = useState(false);
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
    if (job?.phase === "cast_build" || job?.phase === "cast_images") {
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

  const finishCastBuild = useCallback(async () => {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const { job: updated } = await postJson<{ job: MobileGenJob }>(
        "/api/crash/mobile/cast-build-done",
        { jobId: job.id },
      );
      setJob(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't move on");
    } finally {
      setBusy(false);
    }
  }, [job]);

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

  return (
    <main style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      {/* Completed-step trail */}
      {job || localStep !== "prompt" ? (
        <CompletedTrail
          prompt={prompt || undefined}
          style={job ? preset.label : undefined}
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
            <MobilePrimaryButton disabled={busy} onClick={() => void startRun()}>
              {busy ? "Starting…" : "Next: Build cast"}
            </MobilePrimaryButton>
          </div>
        </ActiveStepPanel>
      )}

      {/* Step 3: Build cast — freeform, before any script exists */}
      {job && job.phase === "cast_build" && (
        <CastLocationStep
          key="cast-build"
          title="Build your cast"
          subtitle="One at a time — dud it, reroll, or pick it. No script yet."
          items={job.speakers}
          candidatesOf={(name) => job.castCandidates[name] || []}
          imageSrc={(name, c) =>
            `/api/crash/mobile/cast-face?styleId=${encodeURIComponent(job.styleId)}&folderName=${encodeURIComponent(job.folderName || job.id)}&characterId=${encodeURIComponent(characterIds[name] || "")}&fileName=${encodeURIComponent(c.fileName)}`
          }
          onGenerate={(name, customPrompt) => genCandidates("cast", name, customPrompt)}
          onApprove={(name, candidateId) => approveCandidate("cast", name, candidateId)}
          onAddNew={(name, description) => addRosterItem("cast", name, description)}
          addLabel="Add a character"
          addPlaceholder="e.g. Tomato"
          addDescriptionPlaceholder="What do they look like? e.g. a heavy metal tomato, sunglasses, leather jacket"
          busy={busy}
          error={error}
          promptPlaceholder="e.g. more like a grumpy dad"
          mode="build"
          onDoneBuild={() => void finishCastBuild()}
          doneLabel="Next: Locations"
          doneBusy={busy}
        />
      )}

      {/* Step 5: Build locations — same freeform pattern, still no script */}
      {job && job.phase === "location_build" && (
        <CastLocationStep
          key="location-build"
          title="Build your locations"
          subtitle='One at a time — try "Mars", dud it, reroll, or pick it.'
          items={job.scenes.map((s) => s.id)}
          labelOf={(id) => job.scenes.find((s) => s.id === id)?.placeName || id}
          candidatesOf={(id) => job.locationCandidates[id] || []}
          imageSrc={(_id, c) => `/api/crash/gen/file?name=${encodeURIComponent(c.fileName)}`}
          onGenerate={(id, customPrompt) => genCandidates("location", id, customPrompt)}
          onApprove={(id, candidateId) => approveCandidate("location", id, candidateId)}
          onAddNew={(name) => addRosterItem("location", name)}
          addLabel="Add a location"
          addPlaceholder="e.g. the cowboy set, a sinking ship"
          busy={busy}
          error={error}
          promptPlaceholder="e.g. Mars, a dive bar, outer space"
          topExtra={<PickedSoFar job={job} characterIds={characterIds} categories={["cast"]} />}
          mode="build"
          onDoneBuild={() => void runScreenplay(job.id)}
          doneLabel="Next: Write the script"
          doneBusy={busy}
        />
      )}

      {/* Step 6: Cast picks the screenplay didn't already have approved —
          normally instant, since cast_build/location_build already picked
          everyone; only a name the script invented despite the constraint
          lands here needing a fresh face. */}
      {job && job.phase === "cast_images" && (
        <CastLocationStep
          key="cast"
          title="Pick your cast"
          subtitle="One face at a time — dud it and try again, or pick it."
          items={job.speakers}
          candidatesOf={(name) => job.castCandidates[name] || []}
          imageSrc={(name, c) =>
            `/api/crash/mobile/cast-face?styleId=${encodeURIComponent(job.styleId)}&folderName=${encodeURIComponent(job.folderName || job.id)}&characterId=${encodeURIComponent(characterIds[name] || "")}&fileName=${encodeURIComponent(c.fileName)}`
          }
          onGenerate={(name, customPrompt) => genCandidates("cast", name, customPrompt)}
          onApprove={(name, candidateId) => approveCandidate("cast", name, candidateId)}
          onAddNew={(name, description) => addRosterItem("cast", name, description)}
          addLabel="Add another character"
          addPlaceholder="e.g. his friend, a grunge bottle of olive oil"
          addDescriptionPlaceholder="What do they look like?"
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
          subtitle='One place at a time — try "Mars", dud it or pick it.'
          items={job.scenes.map((s) => s.id)}
          labelOf={(id) => job.scenes.find((s) => s.id === id)?.placeName || id}
          candidatesOf={(id) => job.locationCandidates[id] || []}
          imageSrc={(_id, c) => `/api/crash/gen/file?name=${encodeURIComponent(c.fileName)}`}
          onGenerate={(id, customPrompt) => genCandidates("location", id, customPrompt)}
          onApprove={(id, candidateId) => approveCandidate("location", id, candidateId)}
          onAddNew={(name) => addRosterItem("location", name)}
          addLabel="Add another location"
          addPlaceholder="e.g. the cowboy set, a sinking ship"
          busy={busy}
          error={error}
          promptPlaceholder="e.g. Mars, a dive bar, outer space"
          topExtra={<PickedSoFar job={job} characterIds={characterIds} categories={["cast"]} />}
        />
      )}

      {/* Step 6: auto-build plates */}
      {job && job.phase === "plates" && (
        <ActiveStepPanel title={<ShimmerText>Building the shots…</ShimmerText>} subtitle="This runs on its own — sit tight.">
          {/* Everything picked stays on screen while the slow phase runs. A
              bare spinner threw the whole cast and every location away and
              left nothing to look at. */}
          <PickedSoFar job={job} characterIds={characterIds} />
          <StoryFeed job={job} />
          <BusySpinner />
        </ActiveStepPanel>
      )}

      {/* Step 7: Review — plates are done; dialogue/voice is a deliberate
          step from here, not automatic. Whatever's left untouched when
          Generate is hit gets auto-voiced with the AI-drafted line as-is. */}
      {job && job.phase === "review" && (
        <ActiveStepPanel title="Check the plates" subtitle="Tap one, check or write the line, hear it — then go.">
          <PlateReviewEditor job={job} />
          <div style={{ color: "var(--chrome-dim)", fontSize: "13px", marginBottom: "16px" }}>
            {job.shots.filter((s) => s.plateFile && s.plateFile !== "__error__").length}/{job.shots.length} shots plated ·{" "}
            {job.clips.length} lines to animate
          </div>
          <MobilePrimaryButton disabled={busy} onClick={() => void approveReview()}>
            {busy ? "Casting voices…" : "Generate video"}
          </MobilePrimaryButton>
        </ActiveStepPanel>
      )}

      {/* Step 9: Animate */}
      {job && (job.phase === "animate" || job.phase === "stitch") && (
        <ActiveStepPanel
          title={<ShimmerText>Animating…</ShimmerText>}
          subtitle={
            job.phase === "animate"
              ? `${job.clips.filter((c) => c.clipStatus !== "pending").length}/${job.clips.length} clips`
              : "Stitching it all together…"
          }
        >
          <StoryFeed job={job} onClipUploaded={setJob} />
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
          <StoryFeed job={job} onClipUploaded={setJob} />
          <MobilePrimaryButton onClick={() => void retryFromError(job.id)}>Check again</MobilePrimaryButton>
        </ActiveStepPanel>
      )}
    </main>
  );
}

/** Prompt/Style used to be full-width rows eating the top of the screen
 * before anything else could show — one line, tap to expand. Runtime is
 * not a planning step; it comes from the voiced lines and plates. */
function CompletedTrail({
  prompt,
  style,
}: {
  prompt?: string;
  style?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const parts = [prompt, style].filter(Boolean) as string[];
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
        </div>
      ) : null}
    </div>
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

/** Half-size, left-aligned, with a single animated status word next to it —
 * the centered full-screen spinner on the swipe picker read as a dead end
 * rather than "generating", and sat where the eye expects the next card. */
function InlineBusy({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "24px 0" }}>
      <div
        style={{
          width: "20px",
          height: "20px",
          flex: "0 0 auto",
          borderRadius: "999px",
          border: "2px solid var(--line)",
          borderTopColor: "var(--acid)",
          animation: "spin 900ms linear infinite",
        }}
      />
      <ShimmerText style={{ fontSize: "13px", fontWeight: 600 }}>{label}</ShimmerText>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/** Cast and locations already chosen, kept on screen through the long
 * unattended phases so the run still shows what it is building. */
function PickedSoFar({
  job,
  characterIds,
  categories = ["cast", "locations"],
}: {
  job: MobileGenJob;
  characterIds: Record<string, string>;
  categories?: ("cast" | "locations")[];
}) {
  const cast = job.speakers
    .map((name) => ({
      key: `cast-${name}`,
      label: name,
      src: (() => {
        const chosen = (job.castCandidates[name] || []).find((c) => c.approved);
        return chosen
          ? `/api/crash/mobile/cast-face?styleId=${encodeURIComponent(job.styleId)}&folderName=${encodeURIComponent(job.folderName || job.id)}&characterId=${encodeURIComponent(characterIds[name] || "")}&fileName=${encodeURIComponent(chosen.fileName)}`
          : "";
      })(),
    }))
    .filter((r) => r.src);

  const places = job.scenes
    .map((scene) => ({
      key: `loc-${scene.id}`,
      label: scene.placeName,
      src: (() => {
        const chosen = (job.locationCandidates[scene.id] || []).find((c) => c.approved);
        return chosen
          ? `/api/crash/gen/file?name=${encodeURIComponent(chosen.fileName)}`
          : "";
      })(),
    }))
    .filter((r) => r.src);

  if (!cast.length && !places.length) return null;

  const section = (heading: string, rows: typeof cast) =>
    rows.length ? (
      <div style={{ marginBottom: "14px" }}>
        <div
          style={{
            color: "var(--chrome-dim)",
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            margin: "0 2px 6px",
          }}
        >
          {heading}
        </div>
        <div style={{ display: "flex", gap: "10px", overflowX: "auto", padding: "2px 2px 4px" }}>
          {rows.map((row) => (
            <div
              key={row.key}
              style={{
                position: "relative",
                flex: "0 0 auto",
                width: "64px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={row.src}
                alt=""
                style={{
                  width: "64px",
                  height: "64px",
                  objectFit: "cover",
                  borderRadius: "10px",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  top: "2px",
                  right: "2px",
                  background: "var(--acid)",
                  color: "var(--void)",
                  borderRadius: "999px",
                  width: "16px",
                  height: "16px",
                  fontSize: "10px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✓
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--chrome-dim)",
                  textAlign: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  width: "100%",
                }}
              >
                {row.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div style={{ marginBottom: "16px" }}>
      {categories.includes("cast") ? section("Cast", cast) : null}
      {categories.includes("locations") ? section("Locations", places) : null}
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
  onAddNew,
  addLabel,
  addPlaceholder,
  addDescriptionPlaceholder,
  busy,
  error,
  promptPlaceholder,
  topExtra,
  mode = "pick",
  onDoneBuild,
  doneLabel,
  doneBusy,
}: {
  title: string;
  subtitle: string;
  items: string[];
  labelOf?: (id: string) => string;
  candidatesOf: (id: string) => { id: string; fileName: string; approved: boolean }[];
  imageSrc: (id: string, c: { id: string; fileName: string; approved: boolean }) => string;
  onGenerate: (id: string, customPrompt?: string) => void;
  onApprove: (id: string, candidateId: string) => void;
  /** Adds a speaker/scene the screenplay never named — no dialogue yet, just a face/place. */
  onAddNew: (name: string, description?: string) => void;
  addLabel: string;
  addPlaceholder: string;
  /** Cast only — a name alone ("Tomato") isn't enough to draw a face from;
   * locations skip this since the place name is usually descriptive enough. */
  addDescriptionPlaceholder?: string;
  busy: boolean;
  error: string;
  promptPlaceholder: string;
  /** Picks from an earlier step (e.g. cast) kept visible above this step's own picks. */
  topExtra?: ReactNode;
  /** "build": freeform roster growing from zero via "+", done on request —
   * no fixed target list to complete. "pick" (default): a fixed list from
   * the screenplay, one candidate per item, advances on its own once every
   * item has an approved pick. */
  mode?: "pick" | "build";
  onDoneBuild?: () => void;
  doneLabel?: string;
  doneBusy?: boolean;
}) {
  // Start on the first thing still needing a pick. Reused cast arrives already
  // approved, and opening on an item that is done makes you tap past it.
  const [cursor, setCursor] = useState(() => {
    const firstOpen = items.findIndex((id) => !candidatesOf(id).some((c) => c.approved));
    return firstOpen === -1 ? 0 : firstOpen;
  });
  const [customPrompt, setCustomPrompt] = useState("");
  const requested = useRef<Record<string, boolean>>({});
  const prevItemCount = useRef(items.length);
  const current = items[cursor];
  const candidates = current ? candidatesOf(current) : [];

  // "+ Add another" grows items — jump straight to the new one instead of
  // leaving the cursor on whatever was open before, which is now stale.
  useEffect(() => {
    if (items.length > prevItemCount.current) {
      setCursor(items.length - 1);
    }
    prevItemCount.current = items.length;
  }, [items.length]);

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

  if (!current && mode !== "build") return null;

  return (
    <ActiveStepPanel
      title={title}
      subtitle={items.length ? `${subtitle} (${cursor + 1}/${items.length})` : subtitle}
    >
      {topExtra}
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
              // Sits on the page background rather than in a boxed panel with
              // its own scrollbar — an inner scroller fights the page and hides
              // the picks it is meant to show.
              marginBottom: "12px",
            }}
          >
            {picked.map(({ id, chosen }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCursor(items.indexOf(id))}
                aria-label={`Edit ${labelOf ? labelOf(id) : id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "6px 8px",
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
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
                <span style={{ marginLeft: "auto", color: "var(--chrome-dim)", fontSize: "11px" }}>
                  Edit
                </span>
                <span style={{ color: "var(--acid)", fontSize: "13px" }}>✓</span>
              </button>
            ))}
          </div>
        );
      })()}

      <AddAnotherRow
        label={addLabel}
        placeholder={addPlaceholder}
        descriptionPlaceholder={addDescriptionPlaceholder}
        busy={busy}
        onAdd={onAddNew}
      />

      {!current ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--chrome-dim)", fontSize: "13px" }}>
          Nothing here yet — {addLabel.replace(/^Add /i, "add ")} above to start.
        </div>
      ) : (
      <>
      <div style={{ color: "var(--acid)", fontWeight: 700, marginBottom: "8px" }}>
        {labelOf ? labelOf(current) : current}
      </div>
      {candidates.length ? (
        <SingleCandidateCard
          candidate={candidates[0]!}
          imageSrc={(c) => imageSrc(current, c)}
          busy={busy}
          onApprove={(c) => {
            onApprove(current, c.id);
            if (mode === "pick" && cursor < items.length - 1) setCursor((n) => n + 1);
          }}
          onReroll={() => onGenerate(current, customPrompt || undefined)}
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
        <InlineBusy label="Generating" />
      )}
      {/* Nothing exists yet to steer on the first load of a batch, so the
          tweak row is just clutter until there is something on screen —
          shown once candidates (or a failure) actually land. It stays after
          that: it's the one control that lets a batch be re-rolled toward a
          specific look. */}
      {candidates.length || (!busy && error) ? (
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
      ) : null}
      </>
      )}
      {mode === "build" ? (
        <div style={{ marginTop: "16px" }}>
          <MobilePrimaryButton disabled={!items.length || doneBusy} onClick={() => onDoneBuild?.()}>
            {doneBusy ? "Working…" : doneLabel || "Next"}
          </MobilePrimaryButton>
        </div>
      ) : null}
    </ActiveStepPanel>
  );
}

function AddAnotherRow({
  label,
  placeholder,
  descriptionPlaceholder,
  busy,
  onAdd,
}: {
  label: string;
  placeholder: string;
  /** Cast only — asks for a short name plus a separate look/description,
   * since a name alone ("Tomato") gives the face generator nothing to draw. */
  descriptionPlaceholder?: string;
  busy: boolean;
  onAdd: (name: string, description?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: "8px 2px",
          marginBottom: "10px",
          background: "none",
          border: "none",
          color: "var(--chrome-dim)",
          fontSize: "13px",
        }}
      >
        + {label}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid var(--line)",
          background: "var(--panel-2)",
          color: "var(--chrome)",
          fontSize: "13px",
        }}
      />
      {descriptionPlaceholder ? (
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={descriptionPlaceholder}
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid var(--line)",
            background: "var(--panel-2)",
            color: "var(--chrome)",
            fontSize: "13px",
          }}
        />
      ) : null}
      <button
        type="button"
        disabled={busy || !name.trim()}
        onClick={() => {
          onAdd(name.trim(), description.trim() || undefined);
          setName("");
          setDescription("");
          setOpen(false);
        }}
        style={{
          padding: "10px 14px",
          borderRadius: "8px",
          border: "none",
          background: "var(--acid)",
          color: "var(--void)",
          fontSize: "13px",
          fontWeight: 600,
        }}
      >
        Add
      </button>
    </div>
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
