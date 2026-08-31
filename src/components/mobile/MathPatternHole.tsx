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

export function MathPatternHole({
  jobId,
  shotId,
  disabled,
}: {
  jobId: string;
  shotId: string;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<MathPatternRuntime | null>(null);
  const settingsRef = useRef<MathPatternSettings>({ ...MATH_PATTERN_DEFAULTS });
  const [settings, setSettings] = useState<MathPatternSettings>(() =>
    readMathPatternSettings(jobId, shotId),
  );
  const [phaseLabel, setPhaseLabel] = useState("outbreak");
  const [backend, setBackend] = useState("");

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

  function patch(next: Partial<MathPatternSettings>) {
    setSettings((prev) => normalizeMathPatternSettings({ ...prev, ...next }));
  }

  function pickEmotion(emotion: MathPatternEmotion) {
    if (disabled) return;
    patch({ emotion });
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
        Now: {phaseLabel}
        {backend ? ` · ${backend}` : ""}
      </p>
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
