"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  MobilePrimaryButton,
  MobileTextInput,
  ShimmerText,
  mobileCard,
  mobileMediaFrame,
} from "./MobileUi";
import { episodeTemplateFromJob } from "@/lib/mobilePasteParse";
import { useMobileAssist } from "./useMobileAssist";
import { SingleCandidateCard } from "./SingleCandidateCard";
import { CastVoiceRow } from "./CastVoiceRow";
import { PlateReviewEditor } from "./PlateReviewEditor";
import {
  allCastApproved,
  allLocationsApproved,
  canLockEpisode,
  candidateLookPrompt,
  faceCandidateTakes,
  latestCandidate,
  preferredCandidate,
} from "@/lib/mobileJobReady";
import { mobileLocationStillUrl } from "@/lib/mobileCandidateUrls";
import { getShowStylePreset } from "@/lib/showStylePresets";
import { styleRealismLabel } from "@/lib/types";
import { MOBILE_STITCH_MOVIES } from "@/lib/mobilePipeline";
import { episodeJobShots, episodeQueuedClips } from "@/lib/mobileScratch";
import { queuedSavedClips } from "@/lib/mobileClipQueue";
import { isJoKeyboardWarrior } from "@/lib/mobileImageMotion";
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
  headerRight,
  children,
}: {
  label: string;
  headerRight?: ReactNode;
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
        <span style={{ flex: 1 }}>{label}</span>
        {headerRight}
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
  onRemove,
}: {
  src: string;
  label: string;
  picked?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      style={{
        flex: "0 0 auto",
        width: "72px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        position: "relative",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
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
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            position: "absolute",
            top: "-4px",
            left: "-4px",
            width: "20px",
            height: "20px",
            borderRadius: "999px",
            border: "none",
            background: "rgba(0,0,0,0.78)",
            color: "var(--chrome)",
            fontSize: "14px",
            lineHeight: 1,
            zIndex: 1,
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function CollapseToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? "Collapse to thumbnails" : "Expand"}
      style={{
        flex: "0 0 auto",
        padding: "2px 8px",
        borderRadius: "2px",
        border: "1px solid var(--line)",
        background: "transparent",
        color: "var(--chrome-dim)",
        fontSize: "10px",
        letterSpacing: "0.06em",
        textTransform: "none",
        cursor: "pointer",
      }}
    >
      {open ? "▾ Collapse" : "▸ Expand"}
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
  promptLabel = "Look",
  hideUpload,
  extra,
  onGenerate,
  onApprove,
  onUpload,
  onRemove,
}: {
  styleId: string;
  label: string;
  candidates: MobileImageCandidate[];
  imageSrc: (c: MobileImageCandidate) => string;
  busy: boolean;
  error: string;
  promptPlaceholder: string;
  promptLabel?: string;
  /** No "drop a photo" strip — CAST has voice in this card; Places go to
   * Add to plate. More still nudges the still on screen. */
  hideUpload?: boolean;
  /** Extra content rendered after the Look row — the per-character voice
   * control, so face/look/voice are one card instead of three. */
  extra?: ReactNode;
  onGenerate: (customPrompt?: string) => void;
  onApprove: (candidateId: string) => void;
  onUpload: (file: File) => void;
  onRemove?: (candidateId: string) => void;
}) {
  const takes = faceCandidateTakes(candidates);
  const seed = preferredCandidate(takes);
  const [customPrompt, setCustomPrompt] = useState(seed?.prompt || "");
  const [focusId, setFocusId] = useState<string | null>(seed?.id || null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const promptAssist = useMobileAssist(
    "image_prompt",
    styleId,
    () => customPrompt,
    setCustomPrompt,
    label,
  );
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || busy || takes.length) return;
    asked.current = true;
    onGenerate();
  }, [busy, takes.length, onGenerate]);

  const newest = latestCandidate(takes);
  const focused =
    takes.find((c) => c.id === focusId) || newest || null;
  const focusIndex = focused ? takes.findIndex((c) => c.id === focused.id) : -1;
  const canUndo = focusIndex > 0;

  const takeFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setFocusId(null);
    onUpload(file);
  };

  return (
    <div
      style={{
        marginTop: "10px",
        outline: !hideUpload && dragOver ? "2px dashed var(--acid)" : "none",
        outlineOffset: "4px",
        borderRadius: "12px",
      }}
      onDragOver={
        hideUpload
          ? undefined
          : (e) => {
              e.preventDefault();
              setDragOver(true);
            }
      }
      onDragLeave={hideUpload ? undefined : () => setDragOver(false)}
      onDrop={
        hideUpload
          ? undefined
          : (e) => {
              e.preventDefault();
              setDragOver(false);
              takeFile(e.dataTransfer.files[0]);
            }
      }
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
          onReroll={() => {
            setFocusId(null);
            onGenerate(customPrompt || undefined);
          }}
          onRemove={onRemove ? () => onRemove(focused.id) : undefined}
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
      {takes.length ? (
        <div
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            padding: "12px 8px 2px",
            touchAction: "pan-x pan-y",
            overscrollBehaviorX: "contain",
          }}
        >
          {takes.map((c, i) => (
            <ThumbTile
              key={c.id}
              src={imageSrc(c)}
              label={c.approved ? "Picked" : `${i + 1}`}
              picked={focused?.id === c.id}
              onClick={() => {
                setFocusId(c.id);
                setCustomPrompt(c.prompt || "");
              }}
              onRemove={onRemove && !busy ? () => onRemove(c.id) : undefined}
            />
          ))}
        </div>
      ) : null}
      {takes.length || error ? (
        <div style={{ marginTop: "10px" }}>
          <div
            style={{
              color: "var(--chrome-dim)",
              fontSize: "10px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            {promptLabel}
          </div>
          <MobileTextInput
            value={customPrompt}
            onChange={setCustomPrompt}
            placeholder={promptPlaceholder}
            multiline
            rows={2}
            onAi={() => void promptAssist.runAssist()}
            aiBusy={promptAssist.aiBusy}
          />
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "8px",
              alignItems: "center",
              flexWrap: "nowrap",
              overflowX: "auto",
              touchAction: "pan-x pan-y",
            }}
          >
            <button
              type="button"
              disabled={busy || !canUndo}
              onClick={() => {
                if (focusIndex <= 0) return;
                const prev = takes[focusIndex - 1]!;
                setFocusId(prev.id);
                setCustomPrompt(prev.prompt || "");
              }}
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                background: "transparent",
                color: canUndo && !busy ? "var(--chrome)" : "var(--chrome-dim)",
                fontSize: "13px",
                flex: "0 0 auto",
                whiteSpace: "nowrap",
              }}
            >
              Undo
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setFocusId(null);
                onGenerate(customPrompt || undefined);
              }}
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                background: "transparent",
                color: "var(--chrome)",
                fontSize: "13px",
                flex: "0 0 auto",
                whiteSpace: "nowrap",
              }}
            >
              More
            </button>
            {extra || null}
          </div>
        </div>
      ) : null}
      {hideUpload ? null : (
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
      )}
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
  lockingScript,
  onGenerateCast,
  onApproveCast,
  onMakeCharacterPlate,
  onAddCast,
  onUploadCast,
  onGenerateLocation,
  onApproveLocation,
  onAddLocation,
  onUploadLocation,
  onRemoveCast,
  onRemoveLocation,
  onDropScript,
  onGenerateVideo,
  onRetryError,
  onJobChange,
}: {
  job: MobileGenJob;
  characterIds: Record<string, string>;
  busy: boolean;
  error: string;
  lockingScript: boolean;
  onGenerateCast: (name: string, customPrompt?: string) => void;
  onApproveCast: (name: string, candidateId: string) => void | Promise<boolean | void>;
  onMakeCharacterPlate: (name: string) => void | Promise<void>;
  onAddCast: (name: string, description?: string, file?: File) => void;
  onUploadCast: (name: string, file: File) => void;
  onGenerateLocation: (sceneId: string, customPrompt?: string) => void;
  onApproveLocation: (sceneId: string, candidateId: string) => void;
  onAddLocation: (name: string) => void;
  onUploadLocation: (sceneId: string, file: File) => void;
  onRemoveCast: (name: string, candidateId: string) => void;
  onRemoveLocation: (sceneId: string, candidateId: string) => void;
  onDropScript: (script: string) => void;
  onGenerateVideo: () => void;
  onRetryError: () => void;
  onJobChange: (job: MobileGenJob) => void;
}) {
  const [adding, setAdding] = useState<"cast" | "location" | null>(null);
  const [openCast, setOpenCast] = useState<string | null>(null);
  const [openPlace, setOpenPlace] = useState<string | null>(null);
  const [castOpen, setCastOpen] = useState(true);
  const [locationsOpen, setLocationsOpen] = useState(true);
  const [platesOpen, setPlatesOpen] = useState(true);
  const [addingPlateFor, setAddingPlateFor] = useState<string | null>(null);
  const [addPlateError, setAddPlateError] = useState("");
  const [addPlateDoneFor, setAddPlateDoneFor] = useState<string | null>(null);
  const [scriptDraft, setScriptDraft] = useState("");

  async function addLocationToPlate(sceneId: string) {
    setAddingPlateFor(sceneId);
    setAddPlateError("");
    try {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, action: "add", sceneId }),
      });
      const data = (await res.json()) as { error?: string; job?: MobileGenJob; shotId?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't add a plate there");
      if (data.job) onJobChange(data.job);
      setAddPlateDoneFor(sceneId);
      setPlatesOpen(true);
    } catch (e) {
      setAddPlateError(e instanceof Error ? e.message : "Couldn't add a plate there");
    } finally {
      setAddingPlateFor(null);
    }
  }
  const episodeHint = [
    `Vibe: ${job.prompt}`,
    `Cast (spell these names exactly, nobody else): ${job.speakers.join(", ")}`,
    ...job.speakers.map((name) => {
      const look = candidateLookPrompt(job.castCandidates, name);
      return look ? `Look · ${name}: ${look}` : `Look · ${name}: (picked, no words saved)`;
    }),
    `Places (every Place: line must be one of these, spelled exactly): ${job.scenes.map((s) => s.placeName).join(" | ")}`,
    ...job.scenes.map((scene) => {
      const look = candidateLookPrompt(job.locationCandidates, scene.id);
      return look
        ? `Place · ${scene.placeName}: ${look}`
        : `Place · ${scene.placeName}: (picked, no words saved)`;
    }),
    "Every shot needs a Plate: line — who sits, leans, presents. Willing bodies. Not a lineup. Not pinning anyone down.",
    ...(job.speakers.some((n) => isJoKeyboardWarrior(n))
      ? [
          "CRAZY BIG HOLE JO: Action and Plate have her holding her phone, staring at the screen like a crazed maniac, texting while she talks — unless a shot already names a different held prop (pie, racket).",
        ]
      : []),
  ].join("\n");
  const episodeAssist = useMobileAssist(
    "episode",
    job.styleId,
    () => scriptDraft,
    setScriptDraft,
    episodeHint,
  );

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
  useEffect(() => {
    if (!scriptDraft.trim() && job.scenes.length) {
      setScriptDraft(episodeTemplateFromJob(job));
    }
  }, [job.id, job.scenes.length, job.speakers.length, job.prompt, scriptDraft]);

  const canWrite =
    allCastApproved(job) &&
    allLocationsApproved(job) &&
    canLockEpisode(job.phase);

  const plated = episodeJobShots(job).filter((s) => s.plateFile && s.plateFile !== "__error__");
  const episodeShots = episodeJobShots(job);
  const queued = episodeQueuedClips({ ...job, clips: queuedSavedClips(job.clips) });
  const vibePreset = getShowStylePreset(job.styleId);
  const vibeRealism = job.styleRealism ?? vibePreset.defaultRealism;

  return (
    <div style={{ padding: "12px 16px 48px" }}>
      <TreeBranch label="Vibe">
        <div style={{ ...mobileCard, padding: "12px 14px" }}>
          <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--chrome)" }}>{job.prompt}</div>
          <div style={{ color: "var(--chrome-dim)", fontSize: "12px", marginTop: "4px" }}>
            {vibePreset.label} · {vibeRealism} · {styleRealismLabel(vibeRealism)}
          </div>
        </div>
        <a
          href={job.id ? `/scratch?job=${encodeURIComponent(job.id)}` : "/scratch"}
          style={{
            ...mobileCard,
            display: "block",
            padding: "12px 14px",
            color: "var(--acid)",
            fontSize: "13px",
            fontWeight: 700,
            textDecoration: "none",
            marginTop: "8px",
          }}
        >
          Scratch — one plate, knobs, many positions
        </a>
      </TreeBranch>

      <TreeBranch label="Cast" headerRight={<CollapseToggle open={castOpen} onToggle={() => setCastOpen((v) => !v)} />}>
        <div
          style={{
            display: "flex",
            gap: "10px",
            overflowX: "auto",
            padding: "2px 2px 6px",
            touchAction: "pan-x pan-y",
            overscrollBehaviorX: "contain",
          }}
        >
          <PlusTile
            label="Add a character"
            onClick={() => {
              setCastOpen(true);
              setAdding("cast");
              setOpenCast(null);
            }}
          />
          {job.speakers.map((name) => {
            const takes = faceCandidateTakes(job.castCandidates[name]);
            const chosen = takes.find((c) => c.approved);
            const pending = latestCandidate(takes);
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
                  setCastOpen(true);
                  setAdding(null);
                  setOpenCast(name);
                }}
              />
            );
          })}
        </div>
        {castOpen && adding === "cast" ? (
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
        {castOpen && castFocus && adding !== "cast" ? (
          <CandidatePicker
            key={`cast-${castFocus}`}
            styleId={job.styleId}
            label={castFocus}
            candidates={job.castCandidates[castFocus] || []}
            imageSrc={(c) => castFaceUrl(job, castFocus, c.fileName, characterIds)}
            busy={busy}
            error={error}
            promptPlaceholder="e.g. more like a grumpy dad"
            promptLabel="Look"
            hideUpload
            extra={<CastVoiceRow key={castFocus} jobId={job.id} styleId={job.styleId} name={castFocus} />}
            onGenerate={(p) => onGenerateCast(castFocus, p)}
            onApprove={(id) => {
              void (async () => {
                const ok = await onApproveCast(castFocus, id);
                if (ok !== false) await onMakeCharacterPlate(castFocus);
                setOpenCast(null);
              })();
            }}
            onUpload={(file) => onUploadCast(castFocus, file)}
            onRemove={(id) => onRemoveCast(castFocus, id)}
          />
        ) : null}
      </TreeBranch>

      <TreeBranch
        label="Locations"
        headerRight={<CollapseToggle open={locationsOpen} onToggle={() => setLocationsOpen((v) => !v)} />}
      >
        <div
          style={{
            display: "flex",
            gap: "10px",
            overflowX: "auto",
            padding: "2px 2px 6px",
            touchAction: "pan-x pan-y",
            overscrollBehaviorX: "contain",
          }}
        >
          <PlusTile
            label="Add a location"
            onClick={() => {
              setLocationsOpen(true);
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
                  setLocationsOpen(true);
                  setAdding(null);
                  setOpenPlace(scene.id);
                }}
              />
            );
          })}
        </div>
        {locationsOpen && adding === "location" ? (
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
        {locationsOpen && placeFocus && adding !== "location" ? (
          <CandidatePicker
            key={`place-${placeFocus}`}
            styleId={job.styleId}
            label={job.scenes.find((s) => s.id === placeFocus)?.placeName || placeFocus}
            candidates={job.locationCandidates[placeFocus] || []}
            imageSrc={(c) => locationStillUrl(job, c.fileName)}
            busy={busy}
            error={error}
            promptPlaceholder="e.g. Mars, a dive bar, outer space"
            promptLabel="Place"
            hideUpload
            extra={
              job.folderName ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <MobilePrimaryButton
                    size="chip"
                    disabled={addingPlateFor === placeFocus}
                    onClick={() => void addLocationToPlate(placeFocus)}
                  >
                    {addingPlateFor === placeFocus ? "…" : "Add to plate"}
                  </MobilePrimaryButton>
                  {addPlateDoneFor === placeFocus ? (
                    <span style={{ fontSize: "11px", color: "var(--acid)" }}>Added — see Plates below</span>
                  ) : null}
                  {addPlateError ? (
                    <span style={{ fontSize: "11px", color: "var(--magenta-hot)" }}>{addPlateError}</span>
                  ) : null}
                </div>
              ) : null
            }
            onGenerate={(p) => onGenerateLocation(placeFocus, p)}
            onApprove={(id) => {
              onApproveLocation(placeFocus, id);
              setOpenPlace(null);
            }}
            onUpload={(file) => onUploadLocation(placeFocus, file)}
            onRemove={(id) => onRemoveLocation(placeFocus, id)}
          />
        ) : null}
      </TreeBranch>

      <TreeBranch
        label="Plates"
        headerRight={<CollapseToggle open={platesOpen} onToggle={() => setPlatesOpen((v) => !v)} />}
      >
        {lockingScript ? (
          <div style={{ padding: "8px 0 16px" }}>
            <ShimmerText style={{ fontSize: "14px", fontWeight: 600 }}>Locking the episode…</ShimmerText>
            <div style={{ color: "var(--chrome-dim)", fontSize: "12px", marginTop: "4px" }}>
              Plates and audio come from what you pasted.
            </div>
          </div>
        ) : null}

        {platesOpen && canWrite && !lockingScript && !job.folderName ? (
          <div style={{ marginBottom: "12px" }}>
            <div style={{ color: "var(--chrome-dim)", fontSize: "12px", marginBottom: "8px" }}>
              {job.folderName
                ? "A short draft already landed. Paste yours and lock to replace it — faces and places stay."
                : "Template is your places. AI drafts the story and beats from this cast. Tweak it until it is right. Lock it — plates, audio, then Comfy. Same pack opens in Crash Lab."}
            </div>
            <MobileTextInput
              value={scriptDraft}
              onChange={setScriptDraft}
              placeholder="EPISODE: …"
              multiline
              rows={14}
              onAi={() => void episodeAssist.runAssist()}
              aiBusy={episodeAssist.aiBusy}
            />
            {episodeAssist.aiError ? (
              <div style={{ color: "var(--magenta-hot)", fontSize: "12px", marginTop: "6px" }}>
                {episodeAssist.aiError}
              </div>
            ) : null}
            <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <MobilePrimaryButton
                tone="ghost"
                disabled={busy || episodeAssist.aiBusy}
                onClick={() => void episodeAssist.runAssist()}
              >
                {episodeAssist.aiBusy ? "Drafting…" : "AI the story"}
              </MobilePrimaryButton>
              <MobilePrimaryButton
                disabled={busy || episodeAssist.aiBusy || !scriptDraft.trim()}
                onClick={() => onDropScript(scriptDraft)}
              >
                {busy ? "Locking…" : "Lock the episode"}
              </MobilePrimaryButton>
            </div>
          </div>
        ) : null}

        {job.folderName ? (
          <div style={{ color: "var(--chrome-dim)", fontSize: "12px", margin: "0 0 10px" }}>
            Crash Lab: Open <span style={{ color: "var(--acid)" }}>{job.folderName}</span>
          </div>
        ) : null}

        {job.phase === "plates" ? (
          <div style={{ padding: "4px 0 12px" }}>
            <ShimmerText style={{ fontSize: "14px", fontWeight: 600 }}>Opening the shot strip…</ShimmerText>
          </div>
        ) : null}

        {job.phase === "review" || job.phase === "animate" || job.phase === "stitch" || job.phase === "done" || job.phase === "error" ? (
          <PlateReviewEditor
            job={job}
            onJobChange={onJobChange}
            collapsed={!platesOpen}
            onExpand={() => setPlatesOpen(true)}
          />
        ) : null}

        {platesOpen && job.phase === "review" ? (
          <div style={{ marginTop: "12px" }}>
            <div style={{ color: "var(--chrome-dim)", fontSize: "12px", marginBottom: "10px" }}>
              {plated.length}/{episodeShots.length} plated · {queued.length}{" "}
              {queued.length === 1 ? "line queued" : "lines queued"}
              {queued.length === 0 && plated.length
                ? " — Save the spoken line (Play appears) before Generate video"
                : queued.length
                  ? ` — Generate sends Saved mp3s (stacks under the plate; tap again to render again)`
                  : ""}
            </div>
            {job.error ? (
              <div style={{ color: "var(--magenta-hot)", fontSize: "13px", marginBottom: "10px" }}>
                {job.error}
              </div>
            ) : null}
            {job.clips.some((c) => c.clipStatus === "error" && c.error) ? (
              <div style={{ color: "var(--magenta-hot)", fontSize: "12px", marginBottom: "10px" }}>
                {job.clips
                  .filter((c) => c.clipStatus === "error" && c.error)
                  .map((c) => c.error)
                  .join(" · ")}
              </div>
            ) : null}
            {plated.length || busy ? (
              <MobilePrimaryButton disabled={busy || !plated.length} onClick={onGenerateVideo}>
                {busy ? "Sending…" : "Generate video"}
              </MobilePrimaryButton>
            ) : null}
          </div>
        ) : null}

        {platesOpen && job.phase === "animate" ? (
          <div style={{ padding: "8px 0" }}>
            <ShimmerText style={{ fontSize: "14px", fontWeight: 600 }}>
              {queued.length
                ? `Animating… ${queued.filter((c) => c.clipStatus === "done" || c.clipStatus === "error").length}/${queued.length}`
                : "Animating… no lines queued"}
            </ShimmerText>
            {queued.length ? (
              <div
                className="m-animate-meter"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={queued.length}
                aria-valuenow={
                  queued.filter((c) => c.clipStatus === "done" || c.clipStatus === "error").length
                }
                aria-label="Animate progress"
              >
                {queued.map((c) => {
                  const done = c.clipStatus === "done";
                  const err = c.clipStatus === "error";
                  const run = c.clipStatus === "running";
                  return (
                    <span
                      key={c.beatId}
                      className={`m-animate-meter-cell${done ? " is-done" : ""}${err ? " is-error" : ""}${run ? " is-run" : ""}`}
                      title={`${c.speaker || "line"} · ${c.clipStatus}`}
                    />
                  );
                })}
              </div>
            ) : null}
            {job.error ? (
              <div style={{ color: "var(--magenta-hot)", fontSize: "13px", margin: "8px 0" }}>
                {job.error}
              </div>
            ) : null}
          </div>
        ) : null}

        {platesOpen && MOBILE_STITCH_MOVIES && job.phase === "stitch" ? (
          <div style={{ padding: "8px 0" }}>
            <ShimmerText style={{ fontSize: "14px", fontWeight: 600 }}>Stitching…</ShimmerText>
          </div>
        ) : null}

        {platesOpen && job.phase === "done" && job.finalVideoFile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
            <video
              src={`/api/crash/mobile/final?jobId=${job.id}`}
              controls
              playsInline
              style={{ ...mobileMediaFrame }}
            />
          </div>
        ) : null}

        {job.phase === "error" ? (
          <div style={{ marginTop: "8px" }}>
            <div style={{ color: "var(--magenta-hot)", fontSize: "13px", marginBottom: "10px" }}>
              {job.error || "Something went wrong"}
            </div>
            <MobilePrimaryButton onClick={onRetryError}>Check again</MobilePrimaryButton>
          </div>
        ) : null}

        {!canWrite &&
        !lockingScript &&
        !job.folderName &&
        !job.shots.length &&
        job.phase !== "plates" &&
        job.phase !== "error" ? (
          <div style={{ color: "var(--chrome-dim)", fontSize: "13px", padding: "4px 0 8px" }}>
            Add a character and a place above. Paste the episode here when the row is picked.
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
