/**
 * Browser math field — fractal noise, kaleidoscope fold, latent-style
 * feedback. Not LTX. Not H3. Not a plate.
 */
import {
  MATH_PATTERN_PREVIEW_CYCLE_SEC,
  mathPatternPhaseId,
  mathPatternPhaseValue,
  mathPatternSeed,
  type MathPatternSettings,
} from "./mathPatternMotion";

export const MATH_PATTERN_WIDTH = 640;
export const MATH_PATTERN_HEIGHT = 360;

const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
uniform float uTime;
uniform float uEmotion;
uniform float uPhase;
uniform float uSeed;
uniform vec2 uRes;
uniform sampler2D uPrev;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 19.19) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    v += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uRes.x / uRes.y;

  float sectors = mix(6.0, 14.0, uEmotion);
  float ang = atan(p.y, p.x);
  float rad = length(p);
  float wedge = 6.2831853 / sectors;
  float fold = abs(mod(ang + 3.14159265, wedge) - wedge * 0.5);
  vec2 k = vec2(cos(fold), sin(fold)) * rad;

  float t = uTime;
  float sine = sin(t * 0.65);
  float tang = tan(clamp(sin(t * 1.7) * 1.05, -1.15, 1.15));
  float wave = mix(sine, tang, uEmotion);

  float n = fbm(k * mix(2.6, 7.4, uEmotion) + vec2(t * 0.12 + uSeed, wave * 0.22));
  float n2 = fbm(k * 4.8 - vec2(t * 0.07, uSeed * 2.0));

  float outbreak = 1.0 - smoothstep(0.0, 0.95, uPhase);
  float crystal = 1.0 - abs(uPhase - 1.0);
  float dissolve = smoothstep(1.05, 2.0, uPhase);

  float fluid = n * outbreak;
  float edge = smoothstep(0.38, 0.62, n) * crystal;
  float gas = n2 * dissolve;
  float v = fluid * 0.75 + edge + gas * 0.55;

  float hue = fract(n + t * 0.028 + wave * 0.04 + uSeed);
  float sat = mix(0.78, 1.0, uEmotion);
  float val = mix(0.42, 1.05, v);
  vec3 col = hsv2rgb(vec3(hue, sat, val));
  col *= mix(0.35, 1.25, v);
  col = mix(col, vec3(0.015, 0.0, 0.03), dissolve * (1.0 - n2));

  float spin = 0.010 + uEmotion * 0.018;
  float c = cos(spin);
  float s = sin(spin);
  vec2 fuv = mat2(c, -s, s, c) * (uv - 0.5);
  fuv *= mix(0.988, 0.972, uEmotion);
  fuv += 0.5;
  vec3 prev = texture2D(uPrev, clamp(fuv, 0.0, 1.0)).rgb;
  col = mix(col, prev, 0.74);

  gl_FragColor = vec4(col, 1.0);
}
`;

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

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function hash2(x: number, y: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 19.19) * 43758.5453;
  return s - Math.floor(s);
}

function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, seed: number): number {
  let v = 0;
  let a = 0.5;
  let px = x;
  let py = y;
  for (let i = 0; i < 5; i++) {
    v += a * vnoise(px, py, seed);
    px *= 2.03;
    py *= 2.03;
    a *= 0.5;
  }
  return v;
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}

function create2dRuntime(
  canvas: HTMLCanvasElement,
  onTick?: (tick: MathPatternTick) => void,
): MathPatternRuntime | null {
  const ctxMaybe = canvas.getContext("2d", { alpha: false });
  if (!ctxMaybe) return null;
  const ctx = ctxMaybe;
  const field = document.createElement("canvas");
  const fw = 160;
  const fh = 90;
  field.width = fw;
  field.height = fh;
  const fctxMaybe = field.getContext("2d", { alpha: false });
  if (!fctxMaybe) return null;
  const fctx = fctxMaybe;
  const w = canvas.width;
  const h = canvas.height;
  const prev = document.createElement("canvas");
  prev.width = w;
  prev.height = h;
  const pctxMaybe = prev.getContext("2d", { alpha: false });
  if (!pctxMaybe) return null;
  const pctx = pctxMaybe;
  pctx.fillStyle = "#000";
  pctx.fillRect(0, 0, w, h);

  let settings: MathPatternSettings = {
    emotion: "calm",
    outbreak: "",
    shift: "",
    dissolve: "",
  };
  let cycleSec = MATH_PATTERN_PREVIEW_CYCLE_SEC;
  let startedAt = 0;
  let raf = 0;
  let live = false;
  const pixels = fctx.createImageData(fw, fh);

  function seedNow(phase: number): number {
    const id = mathPatternPhaseId(phase);
    const text =
      id === "outbreak" ? settings.outbreak : id === "shift" ? settings.shift : settings.dissolve;
    return mathPatternSeed(text);
  }

  function frame() {
    const elapsedSec = live ? (performance.now() - startedAt) / 1000 : 0;
    const phase = mathPatternPhaseValue(elapsedSec, cycleSec);
    const emotion = settings.emotion === "excited" ? 1 : 0;
    const seed = seedNow(phase);
    const data = pixels.data;
    const t = elapsedSec;
    const sine = Math.sin(t * 0.65);
    const tang = Math.tan(Math.max(-1.15, Math.min(1.15, Math.sin(t * 1.7) * 1.05)));
    const wave = sine + (tang - sine) * emotion;
    const sectors = 6 + emotion * 8;
    const wedge = (Math.PI * 2) / sectors;
    const outbreak = 1 - smooth(phase / 0.95);
    const crystal = 1 - Math.abs(phase - 1);
    const dissolve = smooth((phase - 1.05) / 0.95);

    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const nx = ((x / fw) * 2 - 1) * (fw / fh);
        const ny = (y / fh) * 2 - 1;
        const ang = Math.atan2(ny, nx);
        const rad = Math.hypot(nx, ny);
        const fold = Math.abs((((ang + Math.PI) % wedge) + wedge) % wedge - wedge * 0.5);
        const kx = Math.cos(fold) * rad;
        const ky = Math.sin(fold) * rad;
        const scale = 2.6 + emotion * 4.8;
        const n = fbm(kx * scale + t * 0.12 + seed, ky * scale + wave * 0.22, seed);
        const n2 = fbm(kx * 4.8 - t * 0.07, ky * 4.8 - seed * 2, seed);
        const fluid = n * outbreak;
        const edge = (n > 0.38 ? Math.min(1, (n - 0.38) / 0.24) : 0) * crystal;
        const gas = n2 * dissolve;
        const v = fluid * 0.75 + edge + gas * 0.55;
        const hue = ((n + t * 0.028 + wave * 0.04 + seed) % 1 + 1) % 1;
        const [r, g, b] = hsvToRgb(hue, 0.78 + emotion * 0.22, 0.42 + v * 0.63);
        const voidAmt = dissolve * (1 - n2);
        const i = (y * fw + x) * 4;
        data[i] = Math.max(0, Math.min(255, (r * (0.35 + v * 0.9) * (1 - voidAmt) + 4 * voidAmt) * 255));
        data[i + 1] = Math.max(0, Math.min(255, g * (0.35 + v * 0.9) * (1 - voidAmt) * 255));
        data[i + 2] = Math.max(0, Math.min(255, (b * (0.35 + v * 0.9) * (1 - voidAmt) + 8 * voidAmt) * 255));
        data[i + 3] = 255;
      }
    }
    fctx.putImageData(pixels, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(field, 0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = 0.74;
    ctx.translate(w / 2, h / 2);
    ctx.rotate(0.01 + emotion * 0.018);
    ctx.scale(0.988 - emotion * 0.016, 0.988 - emotion * 0.016);
    ctx.drawImage(prev, -w / 2, -h / 2);
    ctx.restore();
    pctx.drawImage(canvas, 0, 0);
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

function smooth(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function createGlRuntime(
  canvas: HTMLCanvasElement,
  gl: WebGLRenderingContext,
  onTick?: (tick: MathPatternTick) => void,
): MathPatternRuntime | null {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(prog, "uTime");
  const uEmotion = gl.getUniformLocation(prog, "uEmotion");
  const uPhase = gl.getUniformLocation(prog, "uPhase");
  const uSeed = gl.getUniformLocation(prog, "uSeed");
  const uRes = gl.getUniformLocation(prog, "uRes");
  const uPrev = gl.getUniformLocation(prog, "uPrev");

  const w = canvas.width;
  const h = canvas.height;
  const textures: WebGLTexture[] = [];
  const fbos: WebGLFramebuffer[] = [];
  for (let i = 0; i < 2; i++) {
    const tex = gl.createTexture();
    const fbo = gl.createFramebuffer();
    if (!tex || !fbo) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    textures.push(tex);
    fbos.push(fbo);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  let write = 0;
  let settings: MathPatternSettings = {
    emotion: "calm",
    outbreak: "",
    shift: "",
    dissolve: "",
  };
  let cycleSec = MATH_PATTERN_PREVIEW_CYCLE_SEC;
  let startedAt = 0;
  let raf = 0;
  let live = false;

  function seedNow(phase: number): number {
    const id = mathPatternPhaseId(phase);
    const text =
      id === "outbreak" ? settings.outbreak : id === "shift" ? settings.shift : settings.dissolve;
    return mathPatternSeed(text);
  }

  function frame() {
    const elapsedSec = live ? (performance.now() - startedAt) / 1000 : 0;
    const phase = mathPatternPhaseValue(elapsedSec, cycleSec);
    const read = 1 - write;
    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[write]);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[read]);
    gl.uniform1f(uTime, elapsedSec);
    gl.uniform1f(uEmotion, settings.emotion === "excited" ? 1 : 0);
    gl.uniform1f(uPhase, phase);
    gl.uniform1f(uSeed, seedNow(phase));
    gl.uniform2f(uRes, w, h);
    gl.uniform1i(uPrev, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.bindTexture(gl.TEXTURE_2D, textures[write]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    write = read;
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
      for (const f of fbos) gl.deleteFramebuffer(f);
      for (const t of textures) gl.deleteTexture(t);
      gl.deleteProgram(prog);
    },
  };
}

export function createMathPatternRuntime(
  canvas: HTMLCanvasElement,
  onTick?: (tick: MathPatternTick) => void,
): MathPatternRuntime | null {
  canvas.width = MATH_PATTERN_WIDTH;
  canvas.height = MATH_PATTERN_HEIGHT;
  const gl = canvas.getContext("webgl", {
    alpha: false,
    preserveDrawingBuffer: true,
    antialias: false,
  });
  if (gl) return createGlRuntime(canvas, gl, onTick);
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
