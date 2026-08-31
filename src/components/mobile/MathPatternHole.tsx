"use client";

import { useEffect, useRef, useState } from "react";
import {
  MATH_PATTERN_DEFAULTS,
  muteMvMathFoldLines,
  muteMvMathFoldSummary,
  muteMvMathMotionLabel,
  normalizeMathPatternSettings,
  readMathPatternSettings,
  writeMathPatternSettings,
  type MathPatternEmotion,
  type MathPatternSettings,
} from "@/lib/mathPatternMotion";
import {
  createMathPatternRuntime,
  registerMathPatternPreview,
  unregisterMathPatternPreview,
  type MathPatternRuntime,
} from "@/lib/mathPatternEngine";
import {
  DEFAULT_MATH_PATTERN_PARAMS,
  MATH_PATTERN_MODES,
  MATH_PATTERN_MODE_LABELS,
  MATH_PATTERN_PALETTES,
  MATH_PATTERN_PALETTE_LABELS,
  randomMathPatternParams,
  type MathPatternParams,
} from "@/lib/mathPatternShader";

export type MathPatternPlate = { fileName: string; label: string };

const SLIDERS: Array<{ key: keyof MathPatternParams & string; label: string }> = [
  { key: "bands", label: "Bands" },
  { key: "hardEdges", label: "Hard edges" },
  { key: "warp", label: "Warp" },
  { key: "zoom", label: "Zoom" },
  { key: "fold", label: "Mirror fold" },
  { key: "hueShift", label: "Hue shift" },
];

export function MathPatternHole({
  jobId,
  shotId,
  plates,
  disabled,
}: {
  jobId: string;
  shotId: string;
  plates?: MathPatternPlate[];
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<MathPatternRuntime | null>(null);
  const settingsRef = useRef<MathPatternSettings>({ ...MATH_PATTERN_DEFAULTS });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string>("");
  const [settings, setSettings] = useState<MathPatternSettings>(() =>
    readMathPatternSettings(jobId, shotId),
  );
  const [phaseLabel, setPhaseLabel] = useState("outbreak");
  const [backend, setBackend] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const imageUrl =
    uploadedUrl ||
    (settings.imageFileName
      ? `/api/crash/gen/file?name=${encodeURIComponent(settings.imageFileName)}`
      : "");

  useEffect(() => {
    setSettings(readMathPatternSettings(jobId, shotId));
  }, [jobId, shotId]);

  useEffect(() => {
    settingsRef.current = settings;
    writeMathPatternSettings(jobId, shotId, settings);
    runtimeRef.current?.setSettings(settings);
  }, [jobId, settings, shotId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const runtime = createMathPatternRuntime(canvas, (tick) => {
      setPhaseLabel(tick.phaseId);
    });
    if (!runtime) {
      setBackend("dead");
      return;
    }
    runtime.setSettings(settingsRef.current);
    runtime.start();
    runtimeRef.current = runtime;
    setBackend(runtime.backend);
    registerMathPatternPreview(jobId, shotId, runtime, () => settingsRef.current);
    return () => {
      unregisterMathPatternPreview(jobId, shotId);
      runtime.destroy();
      runtimeRef.current = null;
    };
  }, [jobId, shotId]);

  useEffect(() => {
    if (!imageUrl) {
      runtimeRef.current?.setImage(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) runtimeRef.current?.setImage(img);
    };
    img.onerror = () => {
      if (!cancelled) setImageError("Couldn't load that image.");
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function patch(next: Partial<MathPatternSettings>) {
    setSettings((prev) => normalizeMathPatternSettings({ ...prev, ...next }));
  }

  function pickEmotion(emotion: MathPatternEmotion) {
    if (disabled) return;
    patch({ emotion });
  }

  const manual = settings.manual || null;
  const activeParams = manual || DEFAULT_MATH_PATTERN_PARAMS;

  function patchManual(next: Partial<MathPatternParams>) {
    if (disabled) return;
    setSettings((prev) =>
      normalizeMathPatternSettings({
        ...prev,
        manual: { ...(prev.manual || DEFAULT_MATH_PATTERN_PARAMS), ...next },
      }),
    );
  }

  function shuffleManual() {
    if (disabled) return;
    setSettings((prev) => normalizeMathPatternSettings({ ...prev, manual: randomMathPatternParams() }));
  }

  function useSchedule() {
    if (disabled) return;
    setSettings((prev) => normalizeMathPatternSettings({ ...prev, manual: null }));
  }

  function pickPlateImage(fileName: string) {
    if (disabled) return;
    setImageError("");
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    }
    setUploadedUrl("");
    patch({ imageFileName: fileName });
  }

  function clearImage() {
    if (disabled) return;
    setImageError("");
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    }
    setUploadedUrl("");
    patch({ imageFileName: "" });
  }

  function handleUpload(file: File) {
    setImageError("");
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    patch({ imageFileName: "" });
    setUploadedUrl(url);
  }

  return (
    <div className="m-plate-motion-hole" data-engine="math">
      <div className="m-plate-motion-label">{muteMvMathMotionLabel()}</div>
      <details className="m-plate-motion-fold">
        <summary>{muteMvMathFoldSummary()}</summary>
        <div className="m-plate-motion-fold-body">
          {muteMvMathFoldLines().map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </details>
      <canvas
        ref={canvasRef}
        className="m-math-canvas"
        aria-label="Live mathematical pattern. Not the plate."
      />
      <p className="m-math-phase">
        Now: {manual ? "manual" : phaseLabel}
        {backend ? ` · ${backend}` : ""}
        {imageUrl ? " · photo" : ""}
      </p>

      <div className="m-plate-h3-chips" role="group" aria-label="MATH mode">
        {MATH_PATTERN_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            className={`m-plate-h3-chip${activeParams.mode === mode ? " is-on" : ""}`}
            disabled={disabled}
            onClick={() => patchManual({ mode })}
          >
            {MATH_PATTERN_MODE_LABELS[mode]}
          </button>
        ))}
      </div>
      <div className="m-plate-h3-chips" role="group" aria-label="MATH palette">
        {MATH_PATTERN_PALETTES.map((palette) => (
          <button
            key={palette}
            type="button"
            className={`m-plate-h3-chip${activeParams.palette === palette ? " is-on" : ""}`}
            disabled={disabled}
            onClick={() => patchManual({ palette })}
          >
            {MATH_PATTERN_PALETTE_LABELS[palette]}
          </button>
        ))}
      </div>
      <div className="m-math-sliders">
        {SLIDERS.map(({ key, label }) => (
          <label key={key} className="m-math-slider">
            <span>{label}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              disabled={disabled}
              value={activeParams[key] as number}
              onChange={(e) => patchManual({ [key]: Number(e.target.value) } as Partial<MathPatternParams>)}
            />
          </label>
        ))}
      </div>
      <div className="m-plate-h3-chips" role="group" aria-label="MATH manual actions">
        <button type="button" className="m-plate-h3-chip" disabled={disabled} onClick={shuffleManual}>
          Shuffle
        </button>
        <button
          type="button"
          className={`m-plate-h3-chip${!manual ? " is-on" : ""}`}
          disabled={disabled}
          onClick={useSchedule}
          title="Drive the look from the three schedule boxes below instead of the sliders"
        >
          Auto (schedule)
        </button>
      </div>

      <div className="m-plate-h3-chips" role="group" aria-label="MATH emotion">
        <button
          type="button"
          className={`m-plate-h3-chip${settings.emotion === "calm" ? " is-on" : ""}`}
          disabled={disabled}
          onClick={() => pickEmotion("calm")}
        >
          Calm sine
        </button>
        <button
          type="button"
          className={`m-plate-h3-chip${settings.emotion === "excited" ? " is-on" : ""}`}
          disabled={disabled}
          onClick={() => pickEmotion("excited")}
        >
          Excited tangent
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleUpload(file);
        }}
      />
      <p className="m-math-image-label">Start from an image — tap a plate, or + to upload</p>
      {imageError ? <p className="m-grok-attach-err">{imageError}</p> : null}
      <div className="m-plate-h3-lasts" role="group" aria-label="MATH source image">
        <button
          type="button"
          className="m-plate-h3-last"
          disabled={disabled}
          title="Add a photo"
          onClick={() => fileRef.current?.click()}
        >
          <span className="m-plate-h3-last-thumb m-plate-h3-last-none" aria-hidden>
            +
          </span>
          <span>Upload</span>
        </button>
        <button
          type="button"
          className={`m-plate-h3-last${!imageUrl ? " is-on" : ""}`}
          disabled={disabled}
          onClick={clearImage}
        >
          <span className="m-plate-h3-last-thumb m-plate-h3-last-none" aria-hidden />
          <span>None (math)</span>
        </button>
        {(plates || []).map((plate) => (
          <button
            key={plate.fileName}
            type="button"
            className={`m-plate-h3-last${settings.imageFileName === plate.fileName ? " is-on" : ""}`}
            disabled={disabled}
            title={plate.label}
            onClick={() => pickPlateImage(plate.fileName)}
          >
            <span
              className="m-plate-h3-last-thumb"
              style={{
                backgroundImage: `url(/api/crash/gen/file?name=${encodeURIComponent(plate.fileName)})`,
              }}
              aria-hidden
            />
            <span>{plate.label}</span>
          </button>
        ))}
      </div>

      <label className="m-math-phase-box">
        <span>Frame 0 — outbreak</span>
        <textarea
          rows={3}
          disabled={disabled}
          value={settings.outbreak}
          onChange={(e) => patch({ outbreak: e.target.value })}
        />
      </label>
      <label className="m-math-phase-box">
        <span>Frame 40 — crystallization</span>
        <textarea
          rows={3}
          disabled={disabled}
          value={settings.shift}
          onChange={(e) => patch({ shift: e.target.value })}
        />
      </label>
      <label className="m-math-phase-box">
        <span>Frame 80 — dissolve</span>
        <textarea
          rows={3}
          disabled={disabled}
          value={settings.dissolve}
          onChange={(e) => patch({ dissolve: e.target.value })}
        />
      </label>
    </div>
  );
}
