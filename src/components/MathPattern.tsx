"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_MATH_PATTERN_PARAMS,
  MATH_PATTERN_MODES,
  MATH_PATTERN_MODE_LABELS,
  MATH_PATTERN_PALETTES,
  MATH_PATTERN_PALETTE_LABELS,
  clampMathPatternParams,
  randomMathPatternParams,
  type MathPatternParams,
} from "@/lib/mathPatternShader";
import {
  compileMathPatternProgram,
  destroyMathPatternProgram,
  startMathPatternLoop,
  type MathPatternProgram,
} from "@/lib/mathPatternShader";

type SliderKey = "bands" | "hardEdges" | "warp" | "zoom" | "fold" | "hueShift" | "intensity" | "speed";

const SLIDERS: Array<{ key: SliderKey; label: string }> = [
  { key: "bands", label: "Bands" },
  { key: "hardEdges", label: "Hard edges" },
  { key: "warp", label: "Warp" },
  { key: "zoom", label: "Zoom" },
  { key: "fold", label: "Mirror fold" },
  { key: "hueShift", label: "Hue shift" },
  { key: "intensity", label: "Intensity" },
  { key: "speed", label: "Speed" },
];

export type MathPatternProps = {
  className?: string;
  style?: React.CSSProperties;
  initialParams?: Partial<MathPatternParams>;
};

export function MathPattern({ className, style, initialParams }: MathPatternProps) {
  const initialParamsValue = clampMathPatternParams(initialParams || {});
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paramsRef = useRef<MathPatternParams>(initialParamsValue);
  const [params, setParamsState] = useState<MathPatternParams>(initialParamsValue);
  const [compileError, setCompileError] = useState<string | null>(null);

  function setParams(next: Partial<MathPatternParams>) {
    const merged = clampMathPatternParams({ ...paramsRef.current, ...next });
    paramsRef.current = merged;
    setParamsState(merged);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { antialias: true, preserveDrawingBuffer: true });
    if (!gl) {
      setCompileError("This browser has no WebGL2 — MATH patterns need Chrome, Edge, or Firefox.");
      return;
    }
    const compiled = compileMathPatternProgram(gl);
    if ("error" in compiled) {
      setCompileError(compiled.error);
      return;
    }
    const prog: MathPatternProgram = compiled;
    setCompileError(null);

    const loopHandle = startMathPatternLoop(gl, canvas, prog, () => paramsRef.current, 960, 540);

    return () => {
      loopHandle.stop();
      destroyMathPatternProgram(gl, prog);
    };
    // Runs once: the loop reads paramsRef every tick, so slider changes never
    // tear down or reset the animation clock.
  }, []);

  function shuffle() {
    setParams(randomMathPatternParams());
  }

  function saveFrame() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `math-pattern-${params.mode}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function setCalmExcited(mode: "calm" | "excited") {
    setParams(mode === "excited" ? { intensity: 0.9, speed: 0.85 } : { intensity: 0.2, speed: 0.35 });
  }

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 10, ...style }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#000", borderRadius: 6, overflow: "hidden" }}>
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
        {compileError ? (
          <div
            role="alert"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              color: "#ff6666",
              background: "rgba(0,0,0,0.85)",
              fontSize: 12,
              fontFamily: "monospace",
              textAlign: "center",
              whiteSpace: "pre-wrap",
            }}
          >
            {compileError}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {MATH_PATTERN_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setParams({ mode })}
            style={chipStyle(params.mode === mode)}
          >
            {MATH_PATTERN_MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {MATH_PATTERN_PALETTES.map((palette) => (
          <button
            key={palette}
            type="button"
            onClick={() => setParams({ palette })}
            style={chipStyle(params.palette === palette)}
          >
            {MATH_PATTERN_PALETTE_LABELS[palette]}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {SLIDERS.map(({ key, label }) => (
          <label key={key} style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11 }}>
            <span>{label}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={params[key]}
              onChange={(e) => setParams({ [key]: Number(e.target.value) } as Partial<MathPatternParams>)}
            />
          </label>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button type="button" onClick={() => setCalmExcited("calm")} style={chipStyle(params.intensity <= 0.2 && params.speed <= 0.35)}>
          Calm sine
        </button>
        <button type="button" onClick={() => setCalmExcited("excited")} style={chipStyle(params.intensity >= 0.9)}>
          Excited tangent
        </button>
        <button type="button" onClick={shuffle} style={chipStyle(false)}>
          Shuffle
        </button>
        <button type="button" onClick={saveFrame} style={chipStyle(false)}>
          Save frame
        </button>
        <button type="button" onClick={() => setParams(DEFAULT_MATH_PATTERN_PARAMS)} style={chipStyle(false)}>
          Reset
        </button>
      </div>
    </div>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 4,
    border: `1px solid ${active ? "#7CFC00" : "#444"}`,
    background: "transparent",
    color: active ? "#7CFC00" : "#ccc",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  };
}
