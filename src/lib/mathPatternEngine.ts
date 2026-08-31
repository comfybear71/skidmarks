/**
 * Browser math field — single-pass WebGL2 shader, no feedback buffer.
 * Not LTX. Not H3. Not a plate.
 */
import {
  MATH_PATTERN_PREVIEW_CYCLE_SEC,
  interpolateMathPatternStage,
  mathPatternPhaseId,
  mathPatternPhaseValue,
  mathPatternStageParams,
  type MathPatternSettings,
} from "./mathPatternMotion";
import {
  compileMathPatternProgram,
  destroyMathPatternProgram,
  drawMathPattern,
  resizeMathPatternCanvas,
  type MathPatternParams,
  type MathPatternProgram,
} from "./mathPatternShader";

export const MATH_PATTERN_WIDTH = 640;
export const MATH_PATTERN_HEIGHT = 360;

export type MathPatternTick = {
  phase: number;
  phaseId: ReturnType<typeof mathPatternPhaseId>;
  elapsedSec: number;
};

export type MathPatternRuntime = {
  canvas: HTMLCanvasElement;
  backend: "webgl" | "canvas";
  start: () => void;
  stop: () => void;
  setSettings: (settings: MathPatternSettings) => void;
  setCycleSec: (sec: number) => void;
  resetClock: () => void;
  frame: () => void;
  destroy: () => void;
};

const PALETTE_COEFFS: Array<{
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
  d: [number, number, number];
}> = [
  { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1, 1, 1], d: [0, 0.33, 0.67] },
  { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1, 1.5, 2], d: [0.1, 0.4, 0.6] },
  { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [2, 1, 3], d: [0.5, 0.2, 0.25] },
  { a: [0.6, 0.7, 0.9], b: [0.3, 0.3, 0.4], c: [1, 1, 1], d: [0, 0.15, 0.3] },
  { a: [0.55, 0.55, 0.55], b: [0.45, 0.45, 0.45], c: [3, 2, 1], d: [0, 0.2, 0.5] },
];

function paletteRgb(t: number, paletteIndex: number): [number, number, number] {
  const { a, b, c, d } = PALETTE_COEFFS[paletteIndex] || PALETTE_COEFFS[0];
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    out[i] = a[i] + b[i] * Math.cos(6.28318 * (c[i] * t + d[i]));
  }
  return out;
}

/** Closed-form "liquid marble" field — no fbm, so no smooth-noise blur. */
function fieldMarble(x: number, y: number, t: number, warp: number): number {
  let qx = x;
  let qy = y;
  for (let i = 0; i < 3; i++) {
    const nqx = qx + warp * 0.9 * Math.sin(qy * 1.7 + t * 0.4 + i);
    const nqy = qy + warp * 0.9 * Math.cos(qx * 1.7 - t * 0.35 + i);
    qx = nqx;
    qy = nqy;
  }
  return Math.sin(qx * 1.1 + qy * 0.7) * 0.5 + Math.cos(qx * 0.6 - qy * 1.3) * 0.5;
}

function stageParamsNow(settings: MathPatternSettings, phase: number): MathPatternParams {
  const outbreak = mathPatternStageParams(settings.outbreak);
  const shift = mathPatternStageParams(settings.shift);
  const dissolve = mathPatternStageParams(settings.dissolve);
  const intensityBase = settings.emotion === "excited" ? 0.9 : 0.2;
  const speedBase = settings.emotion === "excited" ? 0.85 : 0.35;
  const mixed = interpolateMathPatternStage(
    phase,
    { ...outbreak, intensity: intensityBase, speed: speedBase },
    { ...shift, intensity: intensityBase, speed: speedBase },
    { ...dissolve, intensity: intensityBase, speed: speedBase },
  );
  return mixed;
}

/**
 * Degraded fallback for browsers without WebGL2 — a single closed-form
 * field (no fbm, no accumulation buffer) run through the same repeating
 * palette + posterize as the shader, drawn at native resolution with no
 * smoothing so it stays crisp rather than blurred by an upscale.
 */
function create2dRuntime(
  canvas: HTMLCanvasElement,
  onTick?: (tick: MathPatternTick) => void,
): MathPatternRuntime | null {
  const ctxMaybe = canvas.getContext("2d", { alpha: false });
  if (!ctxMaybe) return null;
  const ctx = ctxMaybe;

  let settings: MathPatternSettings = { emotion: "calm", outbreak: "", shift: "", dissolve: "" };
  let cycleSec = MATH_PATTERN_PREVIEW_CYCLE_SEC;
  let startedAt = 0;
  let raf = 0;
  let live = false;
  let image: ImageData | null = null;
  let fieldW = 0;
  let fieldH = 0;

  function ensureBuffer(w: number, h: number) {
    if (image && fieldW === w && fieldH === h) return;
    fieldW = w;
    fieldH = h;
    image = ctx.createImageData(w, h);
  }

  function frame() {
    resizeMathPatternCanvas(canvas, MATH_PATTERN_WIDTH, MATH_PATTERN_HEIGHT);
    const w = canvas.width;
    const h = canvas.height;
    ensureBuffer(w, h);
    if (!image) return;

    const elapsedSec = live ? (performance.now() - startedAt) / 1000 : 0;
    const phase = mathPatternPhaseValue(elapsedSec, cycleSec);
    const params = stageParamsNow(settings, phase);
    const paletteIndex = ["rainbow", "acid", "neon", "ice", "dmt"].indexOf(params.palette);
    const bandsCount = 2 + params.bands * 38;
    const steps = 96 - params.hardEdges * 91;
    const t = elapsedSec * (0.15 + params.speed * 1.45);
    const data = image.data;

    for (let y = 0; y < h; y++) {
      const ny = (y / h) * 2 - 1;
      for (let x = 0; x < w; x++) {
        const nx = ((x / w) * 2 - 1) * (w / h) * (2.6 - params.zoom * 2.2);
        const field = fieldMarble(nx, ny * (2.6 - params.zoom * 2.2), t, params.warp);
        const bandsT = field * bandsCount;
        const quantized = Math.floor(bandsT * steps) / steps;
        const finalT = bandsT + (quantized - bandsT) * params.hardEdges;
        const hue = (((finalT + params.hueShift) % 1) + 1) % 1;
        const [r, g, b] = paletteRgb(hue, paletteIndex);
        const bright = 0.55 + params.intensity * 1.15;
        const i = (y * w + x) * 4;
        data[i] = Math.max(0, Math.min(255, r * bright * 255));
        data[i + 1] = Math.max(0, Math.min(255, g * bright * 255));
        data[i + 2] = Math.max(0, Math.min(255, b * bright * 255));
        data[i + 3] = 255;
      }
    }
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(image, 0, 0);
    onTick?.({ phase, phaseId: mathPatternPhaseId(phase), elapsedSec });
  }

  function loop() {
    if (!live) return;
    frame();
    raf = window.requestAnimationFrame(loop);
  }

  return {
    canvas,
    backend: "canvas",
    start() {
      if (live) return;
      live = true;
      startedAt = performance.now();
      loop();
    },
    stop() {
      live = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    },
    setSettings(next) {
      settings = next;
    },
    setCycleSec(sec) {
      cycleSec = sec > 0 ? sec : MATH_PATTERN_PREVIEW_CYCLE_SEC;
    },
    resetClock() {
      startedAt = performance.now();
    },
    frame,
    destroy() {
      live = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}

function createGl2Runtime(
  canvas: HTMLCanvasElement,
  gl: WebGL2RenderingContext,
  onTick?: (tick: MathPatternTick) => void,
): MathPatternRuntime | null {
  const compiled = compileMathPatternProgram(gl);
  if ("error" in compiled) {
    console.error("MATH pattern shader failed to compile:", compiled.error);
    return null;
  }
  const prog: MathPatternProgram = compiled;

  let settings: MathPatternSettings = { emotion: "calm", outbreak: "", shift: "", dissolve: "" };
  let cycleSec = MATH_PATTERN_PREVIEW_CYCLE_SEC;
  let startedAt = 0;
  let raf = 0;
  let live = false;

  function frame() {
    const { width, height } = resizeMathPatternCanvas(canvas, MATH_PATTERN_WIDTH, MATH_PATTERN_HEIGHT);
    const elapsedSec = live ? (performance.now() - startedAt) / 1000 : 0;
    const phase = mathPatternPhaseValue(elapsedSec, cycleSec);
    const params = stageParamsNow(settings, phase);
    drawMathPattern(gl, prog, { timeSec: elapsedSec, width, height, params });
    onTick?.({ phase, phaseId: mathPatternPhaseId(phase), elapsedSec });
  }

  function loop() {
    if (!live) return;
    frame();
    raf = window.requestAnimationFrame(loop);
  }

  return {
    canvas,
    backend: "webgl",
    start() {
      if (live) return;
      live = true;
      startedAt = performance.now();
      loop();
    },
    stop() {
      live = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    },
    setSettings(next) {
      settings = next;
    },
    setCycleSec(sec) {
      cycleSec = sec > 0 ? sec : MATH_PATTERN_PREVIEW_CYCLE_SEC;
    },
    resetClock() {
      startedAt = performance.now();
    },
    frame,
    destroy() {
      live = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      destroyMathPatternProgram(gl, prog);
    },
  };
}

export function createMathPatternRuntime(
  canvas: HTMLCanvasElement,
  onTick?: (tick: MathPatternTick) => void,
): MathPatternRuntime | null {
  resizeMathPatternCanvas(canvas, MATH_PATTERN_WIDTH, MATH_PATTERN_HEIGHT);
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    preserveDrawingBuffer: true,
    antialias: true,
  });
  if (gl) return createGl2Runtime(canvas, gl, onTick);
  return create2dRuntime(canvas, onTick);
}

function pickRecorderMime(): string {
  const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  if (typeof MediaRecorder === "undefined") return "";
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

async function captureCanvasBlob(canvas: HTMLCanvasElement, durationSec: number): Promise<Blob> {
  const stream = canvas.captureStream(30);
  const mime = pickRecorderMime();
  if (typeof MediaRecorder === "undefined") {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error(
      "This browser cannot record a canvas. MATH still plays live — Send needs Chrome or Edge.",
    );
  }
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  const done = new Promise<Blob>((resolve, reject) => {
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    rec.onerror = () => reject(new Error("MATH record failed."));
    rec.onstop = () => {
      resolve(new Blob(chunks, { type: rec.mimeType || mime || "video/webm" }));
    };
  });
  rec.start(250);
  await new Promise((r) => window.setTimeout(r, Math.round(durationSec * 1000)));
  if (rec.state !== "inactive") rec.stop();
  const blob = await done;
  stream.getTracks().forEach((t) => t.stop());
  if (!blob.size) throw new Error("MATH record was empty.");
  return blob;
}

type PreviewEntry = {
  runtime: MathPatternRuntime;
  settings: () => MathPatternSettings;
};

const previews = new Map<string, PreviewEntry>();

export function mathPatternPreviewKey(jobId: string, shotId: string): string {
  return `${(jobId || "").trim()}::${(shotId || "").trim()}`;
}

export function registerMathPatternPreview(
  jobId: string,
  shotId: string,
  runtime: MathPatternRuntime,
  settings: () => MathPatternSettings,
): void {
  previews.set(mathPatternPreviewKey(jobId, shotId), { runtime, settings });
}

export function unregisterMathPatternPreview(jobId: string, shotId: string): void {
  previews.delete(mathPatternPreviewKey(jobId, shotId));
}

/**
 * Record the live hole if it is open. Otherwise cook an offscreen field
 * with the stored schedule. Silent. No plate. Does not open a second
 * WebGL context on the preview canvas.
 */
export async function recordMathPatternForShot(opts: {
  jobId: string;
  shotId: string;
  durationSec: number;
  settings: MathPatternSettings;
}): Promise<Blob> {
  const durationSec = Math.max(1, Math.min(60, opts.durationSec));
  const live = previews.get(mathPatternPreviewKey(opts.jobId, opts.shotId));
  const settings = live?.settings() || opts.settings;
  if (live) {
    live.runtime.setSettings(settings);
    live.runtime.setCycleSec(durationSec);
    live.runtime.resetClock();
    try {
      return await captureCanvasBlob(live.runtime.canvas, durationSec);
    } finally {
      live.runtime.setCycleSec(MATH_PATTERN_PREVIEW_CYCLE_SEC);
    }
  }
  const canvas = document.createElement("canvas");
  const runtime = createMathPatternRuntime(canvas);
  if (!runtime) throw new Error("MATH canvas would not start.");
  runtime.setSettings(settings);
  runtime.setCycleSec(durationSec);
  runtime.resetClock();
  runtime.start();
  try {
    return await captureCanvasBlob(canvas, durationSec);
  } finally {
    runtime.destroy();
  }
}
