"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  MobileAiButton,
  MobilePrimaryButton,
  MobileTextInput,
  ShimmerText,
  mobileCard,
} from "./MobileUi";
import { useMobileAssist } from "./useMobileAssist";
import { SingleCandidateCard } from "./SingleCandidateCard";
import { PlateReviewEditor } from "./PlateReviewEditor";
import { StoryFeed } from "./StoryFeed";
import { allCastApproved, allLocationsApproved, latestCandidate } from "@/lib/mobileJobReady";
import { characterPlateFileUrl } from "@/lib/characterPlatePrompt";
import { mobileLocationStillUrl } from "@/lib/mobileCandidateUrls";
import { getShowStylePreset } from "@/lib/showStylePresets";
import { styleRealismLabel } from "@/lib/types";
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
  return mobileLocationStillUrl(job, fileName);
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
  styleId,
  nameKind,
  namePlaceholder,
  descriptionPlaceholder,
  busy,
  onAdd,
  onCancel,
}: {
  styleId: string;
  nameKind: "cast_look" | "location";
  namePlaceholder: string;
  descriptionPlaceholder?: string;
  busy: boolean;
  onAdd: (name: string, description?: string, file?: File) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const acceptPhoto = nameKind === "cast_look";
  const nameAssist = useMobileAssist(
    nameKind === "location" ? "location" : "cast_look",
    styleId,
    () => (descriptionPlaceholder ? description : name),
    descriptionPlaceholder ? setDescription : setName,
    name.trim() || undefined,
  );

  const takePhoto = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
  };

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  return (
    <div
      style={{
        ...mobileCard,
        padding: "12px",
        marginTop: "10px",
        outline: dragOver ? "2px dashed var(--acid)" : "none",
        outlineOffset: "4px",
      }}
      onDragOver={
        acceptPhoto
          ? (e) => {
              e.preventDefault();
              setDragOver(true);
            }
          : undefined
      }
      onDragLeave={acceptPhoto ? () => setDragOver(false) : undefined}
      onDrop={
        acceptPhoto
          ? (e) => {
              e.preventDefault();
              setDragOver(false);
              takePhoto(e.dataTransfer.files[0]);
            }
          : undefined
      }
    >
      <MobileTextInput
        value={name}
        onChange={setName}
        placeholder={namePlaceholder}
        onAi={descriptionPlaceholder ? undefined : () => void nameAssist.runAssist()}
        aiBusy={nameAssist.aiBusy}
      />
      {descriptionPlaceholder ? (
        <div style={{ marginTop: "8px" }}>
          <MobileTextInput
            value={description}
            onChange={setDescription}
            placeholder={descriptionPlaceholder}
            multiline
            onAi={() => void nameAssist.runAssist()}
            aiBusy={nameAssist.aiBusy}
          />
        </div>
      ) : null}
      {acceptPhoto ? (
        <div style={{ marginTop: "10px" }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              takePhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            style={{
              width: "100%",
              padding: photoUrl ? "8px" : "10px",
              borderRadius: "8px",
              border: "1px dashed var(--line)",
              background: "transparent",
              color: "var(--chrome-dim)",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textAlign: "left",
            }}
          >
            {photoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl}
                  alt=""
                  style={{
                    width: "56px",
                    height: "72px",
                    objectFit: "cover",
                    borderRadius: "6px",
                    flex: "0 0 auto",
                  }}
                />
                <span>This still is them. Add puts it in the tree — More nudges it.</span>
              </>
            ) : (
              <span>{dragOver ? "Drop it here" : "Drop their photo — or tap to choose"}</span>
            )}
          </button>
        </div>
      ) : null}
      {nameAssist.aiError ? (
        <div style={{ color: "var(--magenta-hot)", fontSize: "12px", marginTop: "6px" }}>
          {nameAssist.aiError}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
        <MobilePrimaryButton
          disabled={busy || !name.trim()}
          onClick={() => onAdd(name.trim(), description.trim() || undefined, photo || undefined)}
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
  styleId,
  label,
  candidates,
  imageSrc,
  busy,
  error,
  promptPlaceholder,
  onGenerate,
  onApprove,
  onUpload,
}: {
  styleId: string;
  label: string;
  candidates: MobileImageCandidate[];
  imageSrc: (c: MobileImageCandidate) => string;
  busy: boolean;
  error: string;
  promptPlaceholder: string;
  onGenerate: (customPrompt?: string) => void;
  onApprove: (candidateId: string) => void;
  onUpload: (file: File) => void;
}) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const prevLen = useRef(candidates.length);
  const promptAssist = useMobileAssist(
    "image_prompt",
    styleId,
    () => customPrompt,
    setCustomPrompt,
    label,
  );
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || busy || candidates.length) return;
    asked.current = true;
    onGenerate();
  }, [busy, candidates.length, onGenerate]);

  useEffect(() => {
    if (candidates.length > prevLen.current) {
      const last = latestCandidate(candidates);
      if (last) {
        setFocusId(last.id);
        if (last.prompt) setCustomPrompt(last.prompt);
      }
    }
    prevLen.current = candidates.length;
  }, [candidates]);

  const newest = latestCandidate(candidates);
  const focused =
    candidates.find((c) => c.id === focusId) || newest || null;
  const focusIndex = focused ? candidates.findIndex((c) => c.id === focused.id) : -1;
  const canUndo = focusIndex > 0;

  const takeFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    onUpload(file);
  };

  return (
    <div
      style={{
        marginTop: "10px",
        outline: dragOver ? "2px dashed var(--acid)" : "none",
        outlineOffset: "4px",
        borderRadius: "12px",
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        takeFile(e.dataTransfer.files[0]);
      }}
    >
      <div style={{ color: "var(--acid)", fontWeight: 700, fontSize: "13px", marginBottom: "8px" }}>
        {label}
      </div>
      {focused ? (
        <SingleCandidateCard
          candidate={focused}
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
      {candidates.length > 1 ? (
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", padding: "10px 2px 2px" }}>
          {candidates.map((c, i) => (
            <ThumbTile
              key={c.id}
              src={imageSrc(c)}
              label={c.approved ? "Picked" : `${i + 1}`}
              picked={focused?.id === c.id}
              onClick={() => {
                setFocusId(c.id);
                setCustomPrompt(c.prompt || "");
              }}
            />
          ))}
        </div>
      ) : null}
      {candidates.length || error ? (
        <div style={{ display: "flex", gap: "8px", marginTop: "10px", alignItems: "center" }}>
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
          <MobileAiButton
            onClick={() => void promptAssist.runAssist()}
            busy={promptAssist.aiBusy}
          />
          <button
            type="button"
            disabled={busy || !canUndo}
            onClick={() => {
              if (focusIndex <= 0) return;
              const prev = candidates[focusIndex - 1]!;
              setFocusId(prev.id);
              setCustomPrompt(prev.prompt || "");
            }}
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              background: "transparent",
              color: canUndo && !busy ? "var(--chrome)" : "var(--chrome-dim)",
              fontSize: "13px",
            }}
          >
            Undo
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onGenerate(customPrompt || undefined);
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
      <div style={{ marginTop: "8px" }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            takeFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            border: "1px dashed var(--line)",
            background: "transparent",
            color: "var(--chrome-dim)",
            fontSize: "12px",
          }}
        >
          {dragOver ? "Drop it here" : "Drop a photo — or tap to choose. More nudges the still on screen."}
        </button>
      </div>
      {promptAssist.aiError ? (
        <div style={{ color: "var(--magenta-hot)", fontSize: "12px", marginTop: "6px" }}>
          {promptAssist.aiError}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Vibe Director desk — one scrolling tree. You set the vibe, then direct
 * cast, places, and plates. Nothing is replaced when you move on.
 */
export function StudioTree({
  job,
  characterIds,
  busy,
  error,
  writingScript,
  onGenerateCast,
  onApproveCast,
  onMakeCharacterPlate,
  onAddCast,
  onUploadCast,
  onGenerateLocation,
  onApproveLocation,
  onAddLocation,
  onUploadLocation,
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
  onMakeCharacterPlate: (name: string) => void;
  onAddCast: (name: string, description?: string, file?: File) => void;
  onUploadCast: (name: string, file: File) => void;
  onGenerateLocation: (sceneId: string, customPrompt?: string) => void;
  onApproveLocation: (sceneId: string, candidateId: string) => void;
  onAddLocation: (name: string) => void;
  onUploadLocation: (sceneId: string, file: File) => void;
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
  const vibePreset = getShowStylePreset(job.styleId);
  const vibeRealism = job.styleRealism ?? vibePreset.defaultRealism;

  return (
    <div style={{ padding: "12px 16px 28px", overflowY: "auto", flex: 1, minHeight: 0 }}>
      <TreeBranch label="Vibe">
        <div style={{ ...mobileCard, padding: "12px 14px" }}>
          <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--chrome)" }}>{job.prompt}</div>
          <div style={{ color: "var(--chrome-dim)", fontSize: "12px", marginTop: "4px" }}>
            {vibePreset.label} · {vibeRealism} · {styleRealismLabel(vibeRealism)}
          </div>
        </div>
      </TreeBranch>

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
            const pending = latestCandidate(job.castCandidates[name]);
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
            styleId={job.styleId}
            nameKind="cast_look"
            namePlaceholder="e.g. Tomato"
            descriptionPlaceholder="What do they look like? e.g. a heavy metal tomato"
            busy={busy}
            onAdd={(name, description, file) => {
              onAddCast(name, description, file);
              setAdding(null);
              setOpenCast(name);
            }}
            onCancel={() => setAdding(null)}
          />
        ) : null}
        {castFocus && adding !== "cast" ? (
          <CandidatePicker
            key={`cast-${castFocus}`}
            styleId={job.styleId}
            label={castFocus}
            candidates={job.castCandidates[castFocus] || []}
            imageSrc={(c) => castFaceUrl(job, castFocus, c.fileName, characterIds)}
            busy={busy}
            error={error}
            promptPlaceholder="e.g. more like a grumpy dad"
            onGenerate={(p) => onGenerateCast(castFocus, p)}
            onApprove={(id) => {
              onApproveCast(castFocus, id);
              onMakeCharacterPlate(castFocus);
              setOpenCast(null);
            }}
            onUpload={(file) => onUploadCast(castFocus, file)}
          />
        ) : null}
        {job.speakers.map((name) => {
          const row = job.characterPlates?.[name];
          if (!row) return null;
          return (
            <div key={`plate-${name}`} style={{ marginTop: "12px" }}>
              <div
                style={{
                  color: "var(--chrome-dim)",
                  fontSize: "11px",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                Character plate · {name}
              </div>
              {row?.status === "pending" ? (
                <div style={{ color: "var(--chrome-dim)", fontSize: "13px", padding: "8px 0" }}>
                  <ShimmerText>Locking {name} for the series</ShimmerText>
                </div>
              ) : row?.status === "error" ? (
                <div style={{ color: "var(--magenta-hot)", fontSize: "12px" }}>
                  {row.error || "Couldn't make the character plate"}
                </div>
              ) : row?.fileName ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={characterPlateFileUrl(job.styleId, row.fileName)}
                  alt={`${name} character plate`}
                  style={{
                    width: "100%",
                    borderRadius: "10px",
                    display: "block",
                    border: "1px solid var(--line)",
                  }}
                />
              ) : null}
            </div>
          );
        })}
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
            const pending = latestCandidate(job.locationCandidates[scene.id]);
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
            styleId={job.styleId}
            nameKind="location"
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
            styleId={job.styleId}
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
            onUpload={(file) => onUploadLocation(placeFocus, file)}
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
