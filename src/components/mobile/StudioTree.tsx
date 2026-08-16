"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  MobilePrimaryButton,
  MobileTextInput,
  ShimmerText,
  mobileCard,
} from "./MobileUi";
import { SingleCandidateCard } from "./SingleCandidateCard";
import { PlateReviewEditor } from "./PlateReviewEditor";
import { StoryFeed } from "./StoryFeed";
import { allCastApproved, allLocationsApproved } from "@/lib/mobileJobReady";
import type { MobileGenJob, MobileImageCandidate } from "@/lib/mobileGenJob";

function castFaceUrl(
  job: MobileGenJob,
  name: string,
  fileName: string,
  characterIds: Record<string, string>,
): string {
  return (
    `/api/crash/mobile/cast-face?styleId=${encodeURIComponent(job.styleId)}` +
    `&folderName=${encodeURIComponent(job.folderName || job.id)}` +
    `&characterId=${encodeURIComponent(characterIds[name] || "")}` +
    `&fileName=${encodeURIComponent(fileName)}`
  );
}

function locationStillUrl(job: MobileGenJob, fileName: string): string {
  return `/api/crash/gen/file?name=${encodeURIComponent(fileName)}`;
}

function TreeBranch({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginBottom: "22px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          margin: "0 0 10px",
          color: "var(--chrome-dim)",
          fontSize: "11px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: "var(--acid)", fontSize: "12px" }}>▸</span>
        {label}
      </div>
      <div
        style={{
          marginLeft: "8px",
          paddingLeft: "12px",
          borderLeft: "1px solid var(--line)",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function ThumbTile({
  src,
  label,
  picked,
  onClick,
}: {
  src: string;
  label: string;
  picked?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: "0 0 auto",
        width: "72px",
        padding: 0,
        border: "none",
        background: "none",
        color: "var(--chrome)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
      }}
    >
      <span style={{ position: "relative", width: "72px", height: "72px" }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            style={{
              width: "72px",
              height: "72px",
              objectFit: "cover",
              borderRadius: "10px",
              display: "block",
              border: picked ? "2px solid var(--acid)" : "2px solid transparent",
            }}
          />
        ) : (
          <span
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "10px",
              display: "block",
              background: "var(--panel-2)",
              border: "2px solid var(--line)",
            }}
          />
        )}
        {picked ? (
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
        ) : null}
      </span>
      <span
        style={{
          fontSize: "11px",
          color: "var(--chrome-dim)",
          width: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "center",
        }}
      >
        {label}
      </span>
    </button>
  );
}

function PlusTile({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: "0 0 auto",
        width: "72px",
        height: "72px",
        borderRadius: "10px",
        border: "1px dashed var(--line)",
        background: "transparent",
        color: "var(--acid)",
        fontSize: "28px",
        fontWeight: 400,
        lineHeight: 1,
      }}
      aria-label={label}
    >
      +
    </button>
  );
}

function AddForm({
  namePlaceholder,
  descriptionPlaceholder,
  busy,
  onAdd,
  onCancel,
}: {
  namePlaceholder: string;
  descriptionPlaceholder?: string;
  busy: boolean;
  onAdd: (name: string, description?: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <div style={{ ...mobileCard, padding: "12px", marginTop: "10px" }}>
      <MobileTextInput value={name} onChange={setName} placeholder={namePlaceholder} />
      {descriptionPlaceholder ? (
        <div style={{ marginTop: "8px" }}>
          <MobileTextInput
            value={description}
            onChange={setDescription}
            placeholder={descriptionPlaceholder}
            multiline
          />
        </div>
      ) : null}
      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
        <MobilePrimaryButton
          disabled={busy || !name.trim()}
          onClick={() => onAdd(name.trim(), description.trim() || undefined)}
        >
          Add
        </MobilePrimaryButton>
        <MobilePrimaryButton tone="ghost" onClick={onCancel}>
          Cancel
        </MobilePrimaryButton>
      </div>
    </div>
  );
}

function CandidatePicker({
  label,
  candidates,
  imageSrc,
  busy,
  error,
  promptPlaceholder,
  onGenerate,
  onApprove,
}: {
  label: string;
  candidates: MobileImageCandidate[];
  imageSrc: (c: MobileImageCandidate) => string;
  busy: boolean;
  error: string;
  promptPlaceholder: string;
  onGenerate: (customPrompt?: string) => void;
  onApprove: (candidateId: string) => void;
}) {
  const [customPrompt, setCustomPrompt] = useState("");
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || busy || candidates.length) return;
    asked.current = true;
    onGenerate();
  }, [busy, candidates.length, onGenerate]);

  return (
    <div style={{ marginTop: "10px" }}>
      <div style={{ color: "var(--acid)", fontWeight: 700, fontSize: "13px", marginBottom: "8px" }}>
        {label}
      </div>
      {candidates.length ? (
        <SingleCandidateCard
          candidate={candidates[0]!}
          imageSrc={imageSrc}
          busy={busy}
          onApprove={(c) => onApprove(c.id)}
          onReroll={() => onGenerate(customPrompt || undefined)}
        />
      ) : busy || !error ? (
        <div style={{ color: "var(--chrome-dim)", fontSize: "13px", padding: "16px 0" }}>
          <ShimmerText>Generating</ShimmerText>
        </div>
      ) : (
        <MobilePrimaryButton
          onClick={() => {
            asked.current = false;
            onGenerate();
          }}
        >
          Try again
        </MobilePrimaryButton>
      )}
      {candidates.length || error ? (
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
              onGenerate(customPrompt || undefined);
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
    </div>
  );
}

/**
 * One scrolling desk: Cast, then Locations, then Plates. Nothing in the
 * tree is replaced when you move on — scroll back up to add another.
 */
export function StudioTree({
  job,
  characterIds,
  busy,
  error,
  writingScript,
  onGenerateCast,
  onApproveCast,
  onAddCast,
  onGenerateLocation,
  onApproveLocation,
  onAddLocation,
  onWriteScript,
  onGenerateVideo,
  onRetryError,
  onJobChange,
}: {
  job: MobileGenJob;
  characterIds: Record<string, string>;
  busy: boolean;
  error: string;
  writingScript: boolean;
  onGenerateCast: (name: string, customPrompt?: string) => void;
  onApproveCast: (name: string, candidateId: string) => void;
  onAddCast: (name: string, description?: string) => void;
  onGenerateLocation: (sceneId: string, customPrompt?: string) => void;
  onApproveLocation: (sceneId: string, candidateId: string) => void;
  onAddLocation: (name: string) => void;
  onWriteScript: () => void;
  onGenerateVideo: () => void;
  onRetryError: () => void;
  onJobChange: (job: MobileGenJob) => void;
}) {
  const [adding, setAdding] = useState<"cast" | "location" | null>(null);
  const [openCast, setOpenCast] = useState<string | null>(null);
  const [openPlace, setOpenPlace] = useState<string | null>(null);

  const firstOpenCast = job.speakers.find((n) => !job.castCandidates[n]?.some((c) => c.approved));
  const firstOpenPlace = job.scenes.find((s) => !job.locationCandidates[s.id]?.some((c) => c.approved));
  const castFocus = openCast || firstOpenCast || null;
  const placeFocus = openPlace || firstOpenPlace?.id || null;

  useEffect(() => {
    if (job.speakers.length && !openCast && firstOpenCast) setOpenCast(firstOpenCast);
  }, [job.speakers.length, firstOpenCast, openCast]);
  useEffect(() => {
    if (job.scenes.length && !openPlace && firstOpenPlace) setOpenPlace(firstOpenPlace.id);
  }, [job.scenes.length, firstOpenPlace, openPlace]);

  const canWrite =
    allCastApproved(job) &&
    allLocationsApproved(job) &&
    (job.phase === "cast_build" || job.phase === "location_build");

  const plated = job.shots.filter((s) => s.plateFile && s.plateFile !== "__error__");

  return (
    <div style={{ padding: "12px 16px 28px", overflowY: "auto", flex: 1, minHeight: 0 }}>
      <TreeBranch label="Cast">
        <div style={{ display: "flex", gap: "10px", overflowX: "auto", padding: "2px 2px 6px" }}>
          <PlusTile
            label="Add a character"
            onClick={() => {
              setAdding("cast");
              setOpenCast(null);
            }}
          />
          {job.speakers.map((name) => {
            const chosen = (job.castCandidates[name] || []).find((c) => c.approved);
            const pending = (job.castCandidates[name] || [])[0];
            const src = chosen
              ? castFaceUrl(job, name, chosen.fileName, characterIds)
              : pending
                ? castFaceUrl(job, name, pending.fileName, characterIds)
                : "";
            return (
              <ThumbTile
                key={name}
                src={src}
                label={name}
                picked={Boolean(chosen)}
                onClick={() => {
                  setAdding(null);
                  setOpenCast(name);
                }}
              />
            );
          })}
        </div>
        {adding === "cast" ? (
          <AddForm
            namePlaceholder="e.g. Tomato"
            descriptionPlaceholder="What do they look like? e.g. a heavy metal tomato"
            busy={busy}
            onAdd={(name, description) => {
              onAddCast(name, description);
              setAdding(null);
              setOpenCast(name);
            }}
            onCancel={() => setAdding(null)}
          />
        ) : null}
        {castFocus && adding !== "cast" ? (
          <CandidatePicker
            key={`cast-${castFocus}`}
            label={castFocus}
            candidates={job.castCandidates[castFocus] || []}
            imageSrc={(c) => castFaceUrl(job, castFocus, c.fileName, characterIds)}
            busy={busy}
            error={error}
            promptPlaceholder="e.g. more like a grumpy dad"
            onGenerate={(p) => onGenerateCast(castFocus, p)}
            onApprove={(id) => {
              onApproveCast(castFocus, id);
              setOpenCast(null);
            }}
          />
        ) : null}
      </TreeBranch>

      <TreeBranch label="Locations">
        <div style={{ display: "flex", gap: "10px", overflowX: "auto", padding: "2px 2px 6px" }}>
          <PlusTile
            label="Add a location"
            onClick={() => {
              setAdding("location");
              setOpenPlace(null);
            }}
          />
          {job.scenes.map((scene) => {
            const chosen = (job.locationCandidates[scene.id] || []).find((c) => c.approved);
            const pending = (job.locationCandidates[scene.id] || [])[0];
            const file = chosen?.fileName || pending?.fileName || "";
            return (
              <ThumbTile
                key={scene.id}
                src={file ? locationStillUrl(job, file) : ""}
                label={scene.placeName}
                picked={Boolean(chosen)}
                onClick={() => {
                  setAdding(null);
                  setOpenPlace(scene.id);
                }}
              />
            );
          })}
        </div>
        {adding === "location" ? (
          <AddForm
            namePlaceholder="e.g. a desert base camp"
            busy={busy}
            onAdd={(name) => {
              onAddLocation(name);
              setAdding(null);
            }}
            onCancel={() => setAdding(null)}
          />
        ) : null}
        {placeFocus && adding !== "location" ? (
          <CandidatePicker
            key={`place-${placeFocus}`}
            label={job.scenes.find((s) => s.id === placeFocus)?.placeName || placeFocus}
            candidates={job.locationCandidates[placeFocus] || []}
            imageSrc={(c) => locationStillUrl(job, c.fileName)}
            busy={busy}
            error={error}
            promptPlaceholder="e.g. Mars, a dive bar, outer space"
            onGenerate={(p) => onGenerateLocation(placeFocus, p)}
            onApprove={(id) => {
              onApproveLocation(placeFocus, id);
              setOpenPlace(null);
            }}
          />
        ) : null}
      </TreeBranch>

      <TreeBranch label="Plates">
        {writingScript ? (
          <div style={{ padding: "8px 0 16px" }}>
            <ShimmerText style={{ fontSize: "14px", fontWeight: 600 }}>Writing the script…</ShimmerText>
            <div style={{ color: "var(--chrome-dim)", fontSize: "12px", marginTop: "4px" }}>
              Lines land on the plates once they are built.
            </div>
          </div>
        ) : null}

        {canWrite && !writingScript ? (
          <div style={{ marginBottom: "12px" }}>
            <MobilePrimaryButton disabled={busy} onClick={onWriteScript}>
              {busy ? "Writing…" : "Write the script"}
            </MobilePrimaryButton>
          </div>
        ) : null}

        {job.phase === "plates" ? (
          <div style={{ padding: "4px 0 12px" }}>
            <ShimmerText style={{ fontSize: "14px", fontWeight: 600 }}>Building the shots…</ShimmerText>
            <StoryFeed job={job} />
          </div>
        ) : null}

        {plated.length && (job.phase === "review" || job.phase === "animate" || job.phase === "stitch" || job.phase === "done" || job.phase === "error") ? (
          <PlateReviewEditor job={job} />
        ) : null}

        {job.phase === "review" ? (
          <div style={{ marginTop: "12px" }}>
            <div style={{ color: "var(--chrome-dim)", fontSize: "12px", marginBottom: "10px" }}>
              {plated.length}/{job.shots.length} plated · {job.clips.length} lines
            </div>
            <MobilePrimaryButton disabled={busy} onClick={onGenerateVideo}>
              {busy ? "Casting voices…" : "Generate video"}
            </MobilePrimaryButton>
          </div>
        ) : null}

        {(job.phase === "animate" || job.phase === "stitch") && (
          <div style={{ padding: "8px 0" }}>
            <ShimmerText style={{ fontSize: "14px", fontWeight: 600 }}>
              {job.phase === "animate"
                ? `Animating… ${job.clips.filter((c) => c.clipStatus !== "pending").length}/${job.clips.length}`
                : "Stitching…"}
            </ShimmerText>
            <StoryFeed job={job} onClipUploaded={onJobChange} />
          </div>
        )}

        {job.phase === "done" && job.finalVideoFile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
            <video
              src={`/api/crash/mobile/final?jobId=${job.id}`}
              controls
              playsInline
              style={{ width: "100%", borderRadius: "12px", background: "#000" }}
            />
          </div>
        ) : null}

        {job.phase === "error" ? (
          <div style={{ marginTop: "8px" }}>
            <div style={{ color: "var(--magenta-hot)", fontSize: "13px", marginBottom: "10px" }}>
              {job.error || "Something went wrong"}
            </div>
            <StoryFeed job={job} onClipUploaded={onJobChange} />
            <MobilePrimaryButton onClick={onRetryError}>Check again</MobilePrimaryButton>
          </div>
        ) : null}

        {!canWrite &&
        !writingScript &&
        !plated.length &&
        job.phase !== "plates" &&
        job.phase !== "error" ? (
          <div style={{ color: "var(--chrome-dim)", fontSize: "13px", padding: "4px 0 8px" }}>
            Add a character and a place above. The plates hang here after the script.
          </div>
        ) : null}
      </TreeBranch>

      {error ? (
        <div
          style={{
            marginTop: "8px",
            padding: "10px",
            borderRadius: "8px",
            background: "rgba(255,26,140,0.12)",
            color: "var(--magenta-hot)",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
