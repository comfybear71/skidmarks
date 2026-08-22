"use client";

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  MobilePrimaryButton,
  MobileTextInput,
  ShimmerText,
  mobileCard,
  mobileMediaFrame,
} from "./MobileUi";
import { episodeTemplateFromJob } from "@/lib/mobilePasteParse";
import type { CastBand } from "@/lib/castBands";
import { useMobileAssist } from "./useMobileAssist";
import { SingleCandidateCard } from "./SingleCandidateCard";
import { CastVoiceRow } from "./CastVoiceRow";
import { PlateReviewEditor } from "./PlateReviewEditor";
import { MusicVideoSongCuts } from "./MusicVideoSongCuts";
import { isMusicVideoSongJob, musicVideoCreditLine } from "@/lib/musicVideoSong";
import {
  allCastApproved,
  allLocationsApproved,
  canLockEpisode,
  candidateLookPrompt,
  faceCandidateTakes,
  latestCandidate,
  preferredCandidate,
} from "@/lib/mobileJobReady";
import { mobileLocationStillUrl, mobilePlacePreviewUrl } from "@/lib/mobileCandidateUrls";
import { getShowStylePreset } from "@/lib/showStylePresets";
import { styleRealismLabel } from "@/lib/types";
import { MOBILE_STITCH_MOVIES } from "@/lib/mobilePipeline";
import { episodePlateCounts } from "@/lib/mobilePlateGraph";
import { episodeJobShots, episodeQueuedClips } from "@/lib/mobileScratch";
import {
  clearLivePlateDrag,
  peekLivePlateDrag,
  readPlateDrag,
} from "@/lib/crashPlateDrag";
import { queuedSavedClips } from "@/lib/mobileClipQueue";
import { isJoKeyboardWarrior } from "@/lib/mobileImageMotion";
import type { CrashStoryDoc } from "@/lib/crashStoryTypes";
import type { MobileGenJob, MobileImageCandidate } from "@/lib/mobileGenJob";
import { readApiJson, studioFetchError } from "@/lib/studioFetchError";

async function fetchDeskStory(styleId: string, folderName: string): Promise<CrashStoryDoc | null> {
  const res = await fetch(
    `/api/crash/story?styleId=${encodeURIComponent(styleId)}&folderName=${encodeURIComponent(folderName)}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { story?: CrashStoryDoc };
  return data.story || null;
}

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
            top: "-6px",
            left: "-6px",
            width: "22px",
            height: "22px",
            borderRadius: "999px",
            border: "2px solid var(--void)",
            background: "var(--magenta-hot)",
            color: "var(--void)",
            fontSize: "14px",
            fontWeight: 700,
            lineHeight: 1,
            zIndex: 3,
            boxShadow: "0 1px 4px rgba(0,0,0,0.55)",
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

/** Tile with a text glyph instead of a photo — saved bands, save-as-band. */
function GlyphTile({
  glyph,
  label,
  onClick,
  variant,
  disabled,
  title,
}: {
  glyph: string;
  label: string;
  onClick: () => void;
  variant: "solid" | "dashed";
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
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
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: variant === "solid" ? "var(--panel-2)" : "transparent",
          border:
            variant === "solid" ? "2px solid var(--acid)" : "1px dashed var(--line)",
          color: "var(--acid)",
          fontSize: glyph.length > 1 ? "11px" : "24px",
          fontWeight: 700,
          letterSpacing: "0.04em",
          textAlign: "center",
          padding: "6px",
        }}
      >
        {glyph}
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
  const acceptPhoto = true;
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
                <span>
                  {nameKind === "location"
                    ? "This still is the place. Add puts it on Locations."
                    : "This still is them. Add puts it in the tree — More nudges it."}
                </span>
              </>
            ) : (
              <span>
                {dragOver
                  ? "Drop it here"
                  : nameKind === "location"
                    ? "Drop a place photo — or tap to choose"
                    : "Drop their photo — or tap to choose"}
              </span>
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
  skipAutoGenerate,
  onGenerate,
  onApprove,
  onUpload,
  onRemove,
  onDropFromJob,
  dropFromJobLabel,
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
   * Add. More still nudges the still on screen. */
  hideUpload?: boolean;
  /** Extra content under Undo / More — voice on CAST, plate chips on
   * a place. Full width. Never jammed beside those two buttons. */
  extra?: ReactNode;
  /** World gallery lock — do not fire Generate on open. */
  skipAutoGenerate?: boolean;
  onGenerate: (customPrompt?: string) => void;
  onApprove: (candidateId: string) => void;
  onUpload: (file: File) => void;
  onRemove?: (candidateId: string) => void;
  /** Pull this person/place off the job (not just one still take). */
  onDropFromJob?: () => void;
  dropFromJobLabel?: string;
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
    if (skipAutoGenerate || asked.current || busy || takes.length) return;
    asked.current = true;
    onGenerate();
  }, [busy, takes.length, onGenerate, skipAutoGenerate]);

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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "8px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ color: "var(--acid)", fontWeight: 700, fontSize: "13px", flex: 1 }}>{label}</div>
        {onDropFromJob ? (
          <MobilePrimaryButton size="chip" disabled={busy} onClick={onDropFromJob}>
            {dropFromJobLabel || "Remove"}
          </MobilePrimaryButton>
        ) : null}
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
      ) : skipAutoGenerate && !takes.length ? (
        <div style={{ color: "var(--chrome-dim)", fontSize: "13px", padding: "8px 0 4px" }}>
          World place locked. Tap More only if you want a new take.
        </div>
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
          <div className="m-picker-actions">
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
          </div>
          {extra ? <div className="m-picker-extra">{extra}</div> : null}
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
  bands,
  onSaveBand,
  onApplyBand,
  onGenerateLocation,
  onApproveLocation,
  onAddLocation,
  onAddWorldLocation,
  onUploadLocation,
  onRemoveCast,
  onRemoveLocation,
  onDropCast,
  onDropLocation,
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
  /** Saved cast groups for this show — e.g. "THE JACK ASH BAND". */
  bands: CastBand[];
  onSaveBand: (name: string) => void;
  onApplyBand: (name: string) => void;
  onGenerateLocation: (sceneId: string, customPrompt?: string) => void;
  onApproveLocation: (sceneId: string, candidateId: string) => void;
  onAddLocation: (name: string, file?: File) => void;
  /** World gallery thumb → Locations row (drag from Crash Lab World, or file drop). */
  onAddWorldLocation: (thumbKey: string, name?: string) => void;
  onUploadLocation: (sceneId: string, file: File) => void;
  onRemoveCast: (name: string, candidateId: string) => void;
  onRemoveLocation: (sceneId: string, candidateId: string) => void;
  /** Pull a speaker off this job's CAST row (faces stay parked in Blob). */
  onDropCast: (name: string) => void;
  /** Pull a place off this job's Locations row (stills stay parked). */
  onDropLocation: (sceneId: string) => void;
  onDropScript: (script: string) => void;
  onGenerateVideo: () => void;
  onRetryError: () => void;
  onJobChange: (job: MobileGenJob) => void;
}) {
  const [adding, setAdding] = useState<"cast" | "location" | null>(null);
  const [savingBand, setSavingBand] = useState(false);
  const [bandNameDraft, setBandNameDraft] = useState("");
  const [openCast, setOpenCast] = useState<string | null>(null);
  const [openPlace, setOpenPlace] = useState<string | null>(null);
  const [castOpen, setCastOpen] = useState(true);
  const [locationsOpen, setLocationsOpen] = useState(true);
  const [platesOpen, setPlatesOpen] = useState(true);
  const [addingPlateFor, setAddingPlateFor] = useState<string | null>(null);
  const [addPlateError, setAddPlateError] = useState("");
  const [addPlateDoneFor, setAddPlateDoneFor] = useState<string | null>(null);
  const [focusPlateShotId, setFocusPlateShotId] = useState<string | null>(null);
  const [scriptDraft, setScriptDraft] = useState("");
  const [plating, setPlating] = useState(false);
  const [plateGraphHint, setPlateGraphHint] = useState("");
  const [deskStory, setDeskStory] = useState<CrashStoryDoc | null>(null);
  const [worldDropOver, setWorldDropOver] = useState(false);
  const [plateSpeaker, setPlateSpeaker] = useState(job.speakers[0] || "");
  const [binFailedBusy, setBinFailedBusy] = useState(false);
  const [binFailedError, setBinFailedError] = useState("");
  const [vibeEdit, setVibeEdit] = useState(false);
  const [vibeDraft, setVibeDraft] = useState(job.prompt);
  const [artistDraft, setArtistDraft] = useState(job.artist || "");
  const [songDraft, setSongDraft] = useState(job.songTitle || "");
  const [realismDraft, setRealismDraft] = useState(
    job.styleRealism ?? getShowStylePreset(job.styleId).defaultRealism,
  );
  const [vibeBusy, setVibeBusy] = useState(false);
  const [vibeError, setVibeError] = useState("");

  function revealPlates(shotId?: string) {
    setPlatesOpen(true);
    setOpenPlace(null);
    setFocusPlateShotId(shotId?.trim() || null);
    window.requestAnimationFrame(() => {
      document.getElementById("m-plates-strip")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function addLocationToPlate(sceneId: string, speaker: string) {
    const who = speaker.trim();
    setAddingPlateFor(sceneId);
    setAddPlateError("");
    try {
      const res = await fetch("/api/crash/mobile/plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, action: "add", sceneId, speaker: who }),
      });
      const data = (await res.json()) as { error?: string; job?: MobileGenJob; shotId?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't add a plate there");
      if (data.job) onJobChange(data.job);
      setAddPlateDoneFor(sceneId);
      revealPlates(data.shotId);
    } catch (e) {
      setAddPlateError(studioFetchError(e, "Couldn't add a plate there"));
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
  const firstOpenPlace = job.scenes.find(
    (s) =>
      !s.worldThumbKey?.trim() &&
      !job.locationCandidates[s.id]?.some((c) => c.approved),
  );
  const castFocus = openCast || firstOpenCast || null;
  const placeFocus = openPlace || firstOpenPlace?.id || null;
  const placeScene = job.scenes.find((s) => s.id === placeFocus);
  const placePick =
    (placeFocus &&
      ((job.locationCandidates[placeFocus] || []).find((c) => c.approved) ||
        latestCandidate(job.locationCandidates[placeFocus]))) ||
    null;
  const placeLockSrc = placeFocus
    ? mobilePlacePreviewUrl(job, {
        fileName: placePick?.fileName || "",
        worldThumbKey: placeScene?.worldThumbKey || "",
      })
    : "";

  function takeWorldDrop(e: DragEvent) {
    e.preventDefault();
    setWorldDropOver(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const base = (file.name || "place")
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      onAddLocation(base || "Place", file);
      return;
    }
    const payload = readPlateDrag(e) || peekLivePlateDrag();
    clearLivePlateDrag();
    if (!payload || payload.kind !== "world") return;
    if (payload.styleId && payload.styleId !== job.styleId) return;
    onAddWorldLocation(payload.thumbKey, payload.name);
  }

  useEffect(() => {
    if (job.speakers.length && !openCast && firstOpenCast) setOpenCast(firstOpenCast);
  }, [job.speakers.length, firstOpenCast, openCast]);
  useEffect(() => {
    if (job.scenes.length && !openPlace && firstOpenPlace) setOpenPlace(firstOpenPlace.id);
  }, [job.scenes.length, firstOpenPlace, openPlace]);
  useEffect(() => {
    setPlateSpeaker(job.speakers[0] || "");
    setAddPlateError("");
    setAddPlateDoneFor(null);
  }, [placeFocus]);
  useEffect(() => {
    setPlateSpeaker((prev) => {
      if (!prev) return prev;
      if (job.speakers.includes(prev)) return prev;
      return job.speakers[0] || "";
    });
  }, [job.speakers]);
  useEffect(() => {
    if (!scriptDraft.trim() && job.scenes.length) {
      setScriptDraft(episodeTemplateFromJob(job));
    }
  }, [job.id, job.scenes.length, job.speakers.length, job.prompt, scriptDraft]);
  useEffect(() => {
    if (!job.folderName) return;
    let cancelled = false;
    fetchDeskStory(job.styleId, job.folderName)
      .then((s) => {
        if (!cancelled && s) setDeskStory(s);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [job.styleId, job.folderName, job.phase, job.shots.length, job.speakers.join("|")]);

  const canWrite =
    allCastApproved(job) &&
    allLocationsApproved(job) &&
    canLockEpisode(job.phase);

  const plated = episodeJobShots(job, deskStory).filter((s) => s.plateFile && s.plateFile !== "__error__");
  const songPlates = episodeJobShots(job, deskStory).filter((s) => s.plateFile !== "__error__");
  const episodeShots = episodeJobShots(job, deskStory);
  const plateCounts = episodePlateCounts(job, deskStory);
  const unplated = plateCounts.total - plateCounts.done;
  const plateCountsReady = Boolean(deskStory) || !job.folderName;

  async function binFailedClips() {
    setBinFailedError("");
    setBinFailedBusy(true);
    try {
      const res = await fetch("/api/crash/mobile/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, action: "bin-failed" }),
      });
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (data.job) onJobChange(data.job);
    } catch (e) {
      setBinFailedError(studioFetchError(e, "Couldn't bin those clips"));
    } finally {
      setBinFailedBusy(false);
    }
  }

  async function plateTheEpisode() {
    if (plating || (plateCountsReady && !unplated)) return;
    setPlating(true);
    setPlateGraphHint("pick → compile → draw → qa");
    try {
      for (;;) {
        const res = await fetch("/api/crash/mobile/plate-episode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: job.id }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          job?: MobileGenJob;
          done?: boolean;
          node?: string;
          doneCount?: number;
          total?: number;
          speaker?: string;
        };
        if (data.job) onJobChange(data.job);
        if (!res.ok) throw new Error(data.error || "Couldn't plate that shot");
        const n = data.doneCount ?? 0;
        const t = data.total ?? episodeShots.length;
        setPlateGraphHint(
          data.node === "halt_lines"
            ? "halt — your lines next"
            : `loop ${n}/${t}${data.speaker ? ` · ${data.speaker}` : ""}`,
        );
        if (data.done) break;
      }
    } catch (e) {
      setPlateGraphHint(e instanceof Error ? e.message : "Plate graph stopped");
    } finally {
      setPlating(false);
    }
  }
  const queued = episodeQueuedClips({ ...job, clips: queuedSavedClips(job.clips) });
  const vibePreset = getShowStylePreset(job.styleId);
  const vibeRealism = job.styleRealism ?? vibePreset.defaultRealism;
  const credit = musicVideoCreditLine(job);

  async function keepVibe() {
    const nextPrompt = vibeDraft.trim();
    if (!nextPrompt) {
      setVibeError("Need a vibe.");
      return;
    }
    setVibeBusy(true);
    setVibeError("");
    try {
      const res = await fetch(`/api/crash/mobile/job/${encodeURIComponent(job.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: nextPrompt,
          artist: isMusicVideoSongJob(job) ? artistDraft : undefined,
          songTitle: isMusicVideoSongJob(job) ? songDraft : undefined,
          styleRealism: realismDraft,
        }),
      });
      const data = await readApiJson<{ job?: MobileGenJob; error?: string }>(res);
      if (data.job) onJobChange(data.job);
      setVibeEdit(false);
    } catch (e) {
      setVibeError(e instanceof Error ? e.message : "Couldn't keep that vibe");
    } finally {
      setVibeBusy(false);
    }
  }

  return (
    <div style={{ padding: "12px 16px 48px" }}>
      <TreeBranch label="Vibe">
        <div style={{ ...mobileCard, padding: "12px 14px" }}>
          {vibeEdit ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <MobileTextInput
                value={vibeDraft}
                onChange={setVibeDraft}
                placeholder="What's the vibe?"
                multiline
                rows={3}
              />
              {isMusicVideoSongJob(job) ? (
                <>
                  <MobileTextInput value={artistDraft} onChange={setArtistDraft} placeholder="Artist" />
                  <MobileTextInput value={songDraft} onChange={setSongDraft} placeholder="Song" />
                </>
              ) : null}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--chrome-dim)" }}>
                <span>Cartoon</span>
                <span style={{ color: "var(--acid)", fontWeight: 700 }}>
                  {realismDraft} · {styleRealismLabel(realismDraft)}
                </span>
                <span>Photoreal</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={realismDraft}
                onChange={(e) => setRealismDraft(Number(e.target.value))}
                aria-label="Cartoon to photoreal"
                style={{ width: "100%", accentColor: "var(--acid)" }}
              />
              {vibeError ? (
                <div style={{ color: "var(--magenta-hot)", fontSize: "12px" }}>{vibeError}</div>
              ) : null}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <MobilePrimaryButton size="chip" disabled={vibeBusy} onClick={() => void keepVibe()}>
                  {vibeBusy ? "Saving…" : "Save"}
                </MobilePrimaryButton>
                <MobilePrimaryButton
                  size="chip"
                  tone="ghost"
                  disabled={vibeBusy}
                  onClick={() => {
                    setVibeEdit(false);
                    setVibeError("");
                    setVibeDraft(job.prompt);
                    setArtistDraft(job.artist || "");
                    setSongDraft(job.songTitle || "");
                    setRealismDraft(vibeRealism);
                  }}
                >
                  Cancel
                </MobilePrimaryButton>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--chrome)" }}>{job.prompt}</div>
              {credit ? (
                <div style={{ color: "var(--acid)", fontSize: "13px", marginTop: "4px", fontWeight: 600 }}>
                  {credit}
                </div>
              ) : null}
              <div style={{ color: "var(--chrome-dim)", fontSize: "12px", marginTop: "4px" }}>
                {vibePreset.label} · {vibeRealism} · {styleRealismLabel(vibeRealism)}
              </div>
              <div style={{ marginTop: "10px" }}>
                <MobilePrimaryButton
                  size="chip"
                  tone="ghost"
                  onClick={() => {
                    setVibeDraft(job.prompt);
                    setArtistDraft(job.artist || "");
                    setSongDraft(job.songTitle || "");
                    setRealismDraft(vibeRealism);
                    setVibeError("");
                    setVibeEdit(true);
                  }}
                >
                  Edit vibe
                </MobilePrimaryButton>
              </div>
            </>
          )}
        </div>
      </TreeBranch>

      {job.phase === "review" ? (
        <div style={{ margin: "0 0 22px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ color: "var(--chrome-dim)", fontSize: "12px" }}>
            {plateCounts.done}/{plateCounts.total} plated · {queued.length}{" "}
            {queued.length === 1 ? "line queued" : "lines queued"}
            {isMusicVideoSongJob(job)
              ? plated.length
                ? " — drop the song, Add N × 15s on each plate, then Generate cuts"
                : " — draw plates with Position first"
              : queued.length === 0 && plated.length
                ? " — Save the spoken line (Play appears) before Generate video"
                : queued.length
                  ? ` — Generate on a plate sends that line. Generate video sends every Saved mp3`
                  : ""}
          </div>
          {job.error ? (
            <div style={{ color: "var(--magenta-hot)", fontSize: "13px" }}>{job.error}</div>
          ) : null}
          {job.clips.some((c) => c.clipStatus === "error" && c.error) ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ color: "var(--magenta-hot)", fontSize: "12px" }}>
                {job.clips
                  .filter((c) => c.clipStatus === "error" && c.error)
                  .map((c) => c.error)
                  .join(" · ")}
              </div>
              <button
                type="button"
                disabled={binFailedBusy}
                onClick={() => void binFailedClips()}
                style={{
                  alignSelf: "flex-start",
                  padding: "4px 8px",
                  borderRadius: "2px",
                  border: "1px solid var(--acid)",
                  background: "transparent",
                  color: "var(--acid)",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  cursor: binFailedBusy ? "not-allowed" : "pointer",
                  opacity: binFailedBusy ? 0.45 : 1,
                }}
              >
                {binFailedBusy ? "…" : "Bin failed clips"}
              </button>
              {binFailedError ? (
                <div style={{ color: "var(--magenta-hot)", fontSize: "12px" }}>{binFailedError}</div>
              ) : null}
            </div>
          ) : null}
          {plateCounts.total || !plateCountsReady ? (
            <MobilePrimaryButton
              disabled={busy || plating || (plateCountsReady && !unplated)}
              onClick={() => void plateTheEpisode()}
            >
              {plating
                ? plateGraphHint || "Plating…"
                : unplated
                  ? `Plate the episode (${unplated} left)`
                  : "Plate the episode — all plated"}
            </MobilePrimaryButton>
          ) : null}
          {plateGraphHint && !plating ? (
            <div style={{ color: "var(--chrome-dim)", fontSize: "12px" }}>{plateGraphHint}</div>
          ) : null}
          {!isMusicVideoSongJob(job) && (plated.length || busy) ? (
            <MobilePrimaryButton disabled={busy || plating || !plated.length} onClick={onGenerateVideo}>
              {busy ? "Sending…" : "Generate video"}
            </MobilePrimaryButton>
          ) : null}
        </div>
      ) : null}

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
                onRemove={
                  busy
                    ? undefined
                    : () => {
                        if (
                          typeof window !== "undefined" &&
                          !window.confirm(`Remove ${name} from this cast?`)
                        ) {
                          return;
                        }
                        if (openCast === name) setOpenCast(null);
                        onDropCast(name);
                      }
                }
              />
            );
          })}
          {bands.map((band) => (
            <GlyphTile
              key={band.name}
              glyph="♪"
              label={band.name}
              variant="solid"
              disabled={busy}
              title={band.members.join(", ")}
              onClick={() => onApplyBand(band.name)}
            />
          ))}
          {job.speakers.length ? (
            <GlyphTile
              glyph="SAVE"
              label="Save as band"
              variant="dashed"
              disabled={busy}
              onClick={() => setSavingBand(true)}
            />
          ) : null}
        </div>
        {castOpen && savingBand ? (
          <div style={{ display: "flex", gap: "8px", padding: "0 2px 8px", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <MobileTextInput
                value={bandNameDraft}
                onChange={setBandNameDraft}
                placeholder="Band name, e.g. THE JACK ASH BAND"
              />
            </div>
            <button
              type="button"
              disabled={busy || !bandNameDraft.trim()}
              onClick={() => {
                onSaveBand(bandNameDraft.trim());
                setBandNameDraft("");
                setSavingBand(false);
              }}
              style={{
                padding: "6px 10px",
                borderRadius: "2px",
                border: "1px solid var(--acid)",
                background: "var(--acid)",
                color: "#000",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setSavingBand(false);
                setBandNameDraft("");
              }}
              style={{
                padding: "6px 10px",
                borderRadius: "2px",
                border: "1px solid var(--chrome-dim)",
                background: "transparent",
                color: "var(--chrome-dim)",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}
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
            dropFromJobLabel="Remove from cast"
            onDropFromJob={() => {
              if (
                typeof window !== "undefined" &&
                !window.confirm(`Remove ${castFocus} from this cast?`)
              ) {
                return;
              }
              setOpenCast(null);
              onDropCast(castFocus);
            }}
          />
        ) : null}
      </TreeBranch>

      <TreeBranch
        label="Locations"
        headerRight={<CollapseToggle open={locationsOpen} onToggle={() => setLocationsOpen((v) => !v)} />}
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setWorldDropOver(true);
          }}
          onDragLeave={() => setWorldDropOver(false)}
          onDrop={takeWorldDrop}
          style={{
            display: "flex",
            gap: "10px",
            overflowX: "auto",
            padding: "6px 4px",
            touchAction: "pan-x pan-y",
            overscrollBehaviorX: "contain",
            borderRadius: "10px",
            outline: worldDropOver ? "2px dashed var(--acid)" : "1px dashed transparent",
            background: worldDropOver ? "rgba(180,255,0,0.06)" : "transparent",
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
            const worldKey = (scene.worldThumbKey || "").trim();
            const src = mobilePlacePreviewUrl(job, { fileName: file, worldThumbKey: worldKey });
            return (
              <ThumbTile
                key={scene.id}
                src={src}
                label={scene.placeName}
                picked={Boolean(chosen || worldKey)}
                onClick={() => {
                  setLocationsOpen(true);
                  setAdding(null);
                  setOpenPlace(scene.id);
                }}
                onRemove={
                  busy
                    ? undefined
                    : () => {
                        if (
                          typeof window !== "undefined" &&
                          !window.confirm(`Remove ${scene.placeName} from locations?`)
                        ) {
                          return;
                        }
                        if (openPlace === scene.id) setOpenPlace(null);
                        onDropLocation(scene.id);
                      }
                }
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
            onAdd={(name, _description, file) => {
              onAddLocation(name, file);
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
            skipAutoGenerate={Boolean(
              job.scenes.find((s) => s.id === placeFocus)?.worldThumbKey?.trim() ||
                (job.locationCandidates[placeFocus] || []).some((c) => c.approved),
            )}
            extra={
              <>
                {placeLockSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={placeLockSrc} alt="" className="m-place-lock-still" />
                ) : null}
                {placeScene?.worldThumbKey?.trim() || placePick?.approved ? (
                  <div className="m-place-lock-hint">
                    Locked place still. More makes a new take if you want.
                  </div>
                ) : null}
                {job.folderName ? (
                  <div className="m-place-plate-extra">
                    <div className="m-place-plate-hint">
                      {isMusicVideoSongJob(job)
                        ? "Empty is the far-out empty stage. No people. It goes on the song. Or tap a name."
                        : "Tap a name, or Empty. Then Add. The card shows under PLATES."}
                    </div>
                    <div className="m-place-plate-chips">
                      {job.speakers.map((name) => (
                        <button
                          key={name}
                          type="button"
                          disabled={busy || plating}
                          onClick={() => setPlateSpeaker(name)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "8px",
                            border:
                              plateSpeaker === name
                                ? "1px solid var(--acid)"
                                : "1px solid var(--line)",
                            background: "transparent",
                            color: plateSpeaker === name ? "var(--acid)" : "var(--chrome)",
                            fontSize: "12px",
                          }}
                        >
                          {name}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={busy || plating}
                        onClick={() => setPlateSpeaker("")}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border:
                            !plateSpeaker.trim()
                              ? "1px solid var(--acid)"
                              : "1px solid var(--line)",
                          background: "transparent",
                          color: !plateSpeaker.trim() ? "var(--acid)" : "var(--chrome)",
                          fontSize: "12px",
                        }}
                      >
                        Empty
                      </button>
                    </div>
                    <div className="m-place-plate-actions">
                      <MobilePrimaryButton
                        size="chip"
                        busy={addingPlateFor === placeFocus}
                        onClick={() => void addLocationToPlate(placeFocus, plateSpeaker)}
                      >
                        {addingPlateFor === placeFocus
                          ? "Adding…"
                          : plateSpeaker.trim()
                            ? `Add ${plateSpeaker.trim()}`
                            : isMusicVideoSongJob(job)
                              ? "Add empty stage"
                              : "Add empty plate"}
                      </MobilePrimaryButton>
                    </div>
                    {addingPlateFor === placeFocus ? (
                      <ShimmerText style={{ fontSize: "13px", fontWeight: 700 }}>
                        Adding a plate — wait here.
                      </ShimmerText>
                    ) : null}
                    {addPlateDoneFor === placeFocus ? (
                      <div className="m-place-plate-note">Added under PLATES</div>
                    ) : null}
                    {addPlateError ? (
                      <div className="m-place-plate-error">{addPlateError}</div>
                    ) : null}
                  </div>
                ) : null}
              </>
            }
            onGenerate={(p) => onGenerateLocation(placeFocus, p)}
            onApprove={(id) => {
              onApproveLocation(placeFocus, id);
              setOpenPlace(null);
            }}
            onUpload={(file) => onUploadLocation(placeFocus, file)}
            onRemove={(id) => onRemoveLocation(placeFocus, id)}
            dropFromJobLabel="Remove from locations"
            onDropFromJob={() => {
              const scene = job.scenes.find((s) => s.id === placeFocus);
              if (
                typeof window !== "undefined" &&
                !window.confirm(`Remove ${scene?.placeName || "this place"} from locations?`)
              ) {
                return;
              }
              setOpenPlace(null);
              onDropLocation(placeFocus);
            }}
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

        <div id="m-plates-strip">
          {job.folderName ? (
            <PlateReviewEditor
              job={job}
              onJobChange={onJobChange}
              collapsed={!platesOpen}
              onExpand={() => setPlatesOpen(true)}
              defaultPlaceId={placeFocus || undefined}
              focusShotId={focusPlateShotId}
            />
          ) : null}
        </div>

        {platesOpen && isMusicVideoSongJob(job) && job.folderName ? (
          <MusicVideoSongCuts
            job={job}
            story={deskStory}
            plated={songPlates}
            onJobChange={onJobChange}
          />
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <MobilePrimaryButton onClick={onRetryError}>Check again</MobilePrimaryButton>
              {job.clips.some((c) => c.clipStatus === "error") ? (
                <button
                  type="button"
                  disabled={binFailedBusy}
                  onClick={() => void binFailedClips()}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "2px",
                    border: "1px solid var(--acid)",
                    background: "transparent",
                    color: "var(--acid)",
                    fontSize: "12px",
                    cursor: binFailedBusy ? "not-allowed" : "pointer",
                    opacity: binFailedBusy ? 0.45 : 1,
                  }}
                >
                  {binFailedBusy ? "…" : "Bin failed clips"}
                </button>
              ) : null}
            </div>
            {binFailedError ? (
              <div style={{ color: "var(--magenta-hot)", fontSize: "12px", marginTop: "8px" }}>
                {binFailedError}
              </div>
            ) : null}
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
