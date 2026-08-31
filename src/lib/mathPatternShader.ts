/**
 * MATH pattern renderer — single-pass WebGL2 fragment shader.
 *
 * Replaces the old fbm-noise + ping-pong feedback engine. The old engine
 * painted smooth Perlin noise straight to brightness, then re-sampled the
 * previous frame with bilinear filtering every tick — a low-pass filter
 * compounding over time. That is where the grain and blur came from.
 *
 * This shader is single-pass: a smooth scalar field per mode is pushed
 * through a *repeating* colour palette (`fract(t)`), and the wrap point of
 * that repeat is what produces a hard edge, at native resolution, with no
 * accumulation buffer at all. `hardEdges` additionally posterizes the field
 * into flat steps for full poster-flat output.
 */

export const MATH_PATTERN_MODES = [
  "marble",
  "ribbons",
  "tunnel",
  "scallop",
  "julia",
  "moire",
  "crystal",
] as const;

export type MathPatternMode = (typeof MATH_PATTERN_MODES)[number];

export const MATH_PATTERN_MODE_LABELS: Record<MathPatternMode, string> = {
  marble: "Liquid marble",
  ribbons: "Ribbons",
  tunnel: "Tunnel",
  scallop: "Scallop",
  julia: "Julia fractal",
  moire: "Moire",
  crystal: "Crystal",
};

export const MATH_PATTERN_PALETTES = ["rainbow", "acid", "neon", "ice", "dmt"] as const;

export type MathPatternPalette = (typeof MATH_PATTERN_PALETTES)[number];

export const MATH_PATTERN_PALETTE_LABELS: Record<MathPatternPalette, string> = {
  rainbow: "Rainbow",
  acid: "Acid",
  neon: "Neon",
  ice: "Ice",
  dmt: "DMT",
};

/** 0..1 normalized controls. Mapped to real shader ranges in drawMathPattern. */
export type MathPatternParams = {
  mode: MathPatternMode;
  palette: MathPatternPalette;
  bands: number;
  hardEdges: number;
  warp: number;
  zoom: number;
  fold: number;
  hueShift: number;
  intensity: number;
  speed: number;
};

/** Each mode's native fold / zoom / bands / warp, applied when the mode is picked. */
export const MATH_PATTERN_MODE_PRESETS: Record<
  MathPatternMode,
  Pick<MathPatternParams, "fold" | "zoom" | "bands" | "warp">
> = {
  marble: { fold: 0.15, zoom: 0.32, bands: 0.2, warp: 0.75 },
  ribbons: { fold: 0.08, zoom: 0.4, bands: 0.22, warp: 0.7 },
  tunnel: { fold: 0.3, zoom: 0.5, bands: 0.62, warp: 0.4 },
  scallop: { fold: 0.12, zoom: 0.55, bands: 0.4, warp: 0.18 },
  julia: { fold: 0.1, zoom: 0.82, bands: 0.35, warp: 0.28 },
  moire: { fold: 0.5, zoom: 0.55, bands: 0.5, warp: 0.5 },
  crystal: { fold: 0.7, zoom: 0.45, bands: 0.35, warp: 0.3 },
};

export const DEFAULT_MATH_PATTERN_PARAMS: MathPatternParams = {
  mode: "marble",
  palette: "rainbow",
  bands: 0.2,
  hardEdges: 0.3,
  warp: 0.75,
  zoom: 0.32,
  fold: 0.15,
  hueShift: 0,
  intensity: 0.6,
  speed: 0.4,
};

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

export function clampMathPatternParams(raw: Partial<MathPatternParams>): MathPatternParams {
  return {
    mode: MATH_PATTERN_MODES.includes(raw.mode as MathPatternMode)
      ? (raw.mode as MathPatternMode)
      : DEFAULT_MATH_PATTERN_PARAMS.mode,
    palette: MATH_PATTERN_PALETTES.includes(raw.palette as MathPatternPalette)
      ? (raw.palette as MathPatternPalette)
      : DEFAULT_MATH_PATTERN_PARAMS.palette,
    bands: clamp01(raw.bands ?? DEFAULT_MATH_PATTERN_PARAMS.bands),
    hardEdges: clamp01(raw.hardEdges ?? DEFAULT_MATH_PATTERN_PARAMS.hardEdges),
    warp: clamp01(raw.warp ?? DEFAULT_MATH_PATTERN_PARAMS.warp),
    zoom: clamp01(raw.zoom ?? DEFAULT_MATH_PATTERN_PARAMS.zoom),
    fold: clamp01(raw.fold ?? DEFAULT_MATH_PATTERN_PARAMS.fold),
    hueShift: clamp01(raw.hueShift ?? DEFAULT_MATH_PATTERN_PARAMS.hueShift),
    intensity: clamp01(raw.intensity ?? DEFAULT_MATH_PATTERN_PARAMS.intensity),
    speed: clamp01(raw.speed ?? DEFAULT_MATH_PATTERN_PARAMS.speed),
  };
}

export function randomMathPatternParams(rand: () => number = Math.random): MathPatternParams {
  const mode = MATH_PATTERN_MODES[Math.floor(rand() * MATH_PATTERN_MODES.length)];
  const palette = MATH_PATTERN_PALETTES[Math.floor(rand() * MATH_PATTERN_PALETTES.length)];
  const preset = MATH_PATTERN_MODE_PRESETS[mode];
  const jitter = () => (rand() - 0.5) * 0.16;
  return clampMathPatternParams({
    mode,
    palette,
    bands: preset.bands + jitter(),
    hardEdges: 0.35 + rand() * 0.5,
    warp: preset.warp + jitter(),
    zoom: preset.zoom + jitter(),
    fold: preset.fold + jitter(),
    hueShift: rand(),
    intensity: 0.5 + rand() * 0.35,
    speed: 0.3 + rand() * 0.5,
  });
}

export const MATH_VERT_SRC = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const MATH_FRAG_SRC = `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uMode;
uniform float uPalette;
uniform float uBands;
uniform float uHardEdges;
uniform float uWarp;
uniform float uZoom;
uniform float uFold;
uniform float uHueShift;
uniform float uIntensity;
uniform float uSpeed;

out vec4 fragColor;

vec3 palette(float t, int pal) {
  vec3 a = vec3(0.5);
  vec3 b = vec3(0.5);
  vec3 c = vec3(1.0);
  vec3 d = vec3(0.0, 0.33, 0.67);
  if (pal == 1) {
    a = vec3(0.5); b = vec3(0.5); c = vec3(1.0, 1.5, 2.0); d = vec3(0.1, 0.4, 0.6);
  } else if (pal == 2) {
    a = vec3(0.5); b = vec3(0.5); c = vec3(2.0, 1.0, 3.0); d = vec3(0.5, 0.2, 0.25);
  } else if (pal == 3) {
    a = vec3(0.6, 0.7, 0.9); b = vec3(0.3, 0.3, 0.4); c = vec3(1.0); d = vec3(0.0, 0.15, 0.3);
  } else if (pal == 4) {
    a = vec3(0.55); b = vec3(0.45); c = vec3(3.0, 2.0, 1.0); d = vec3(0.0, 0.2, 0.5);
  }
  return a + b * cos(6.28318 * (c * t + d));
}

vec2 mirrorFold(vec2 p, float sectors) {
  float ang = atan(p.y, p.x);
  float rad = length(p);
  float wedge = 6.28318 / max(1.0, sectors);
  float a = mod(ang + 3.14159, wedge);
  a = abs(a - wedge * 0.5);
  return vec2(cos(a), sin(a)) * rad;
}

float fieldMarble(vec2 p, float t, float warp) {
  vec2 q = p;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    q += warp * 0.9 * vec2(sin(q.y * 1.7 + t * 0.4 + fi), cos(q.x * 1.7 - t * 0.35 + fi));
  }
  return sin(q.x * 1.1 + q.y * 0.7) * 0.5 + cos(q.x * 0.6 - q.y * 1.3) * 0.5;
}

float fieldRibbons(vec2 p, float t, float warp) {
  return sin(p.x * 2.0 + sin(p.y * 1.3 + t * 0.5) * 2.2 * warp + t * 0.6);
}

float fieldTunnel(vec2 p, float t, float warp) {
  float ang = atan(p.y, p.x);
  float rad = length(p) + 0.001;
  return 1.0 / (rad + 0.15) - t * 1.4 + ang * warp * 2.2;
}

float fieldScallop(vec2 p, float warp, float t) {
  vec2 q = p;
  float row = floor(q.y);
  q.x += mod(row, 2.0) * 0.5 + sin(t * 0.15) * warp * 0.15;
  vec2 cellId = floor(q);
  vec2 center = vec2(cellId.x + 0.5, cellId.y + 1.0);
  return distance(q, center);
}

float fieldJulia(vec2 p, float t, float warp) {
  vec2 z = p;
  vec2 c = vec2(0.355 + warp * 0.08 * sin(t * 0.13), 0.355 + warp * 0.08 * cos(t * 0.11));
  float m = 0.0;
  for (int i = 0; i < 48; i++) {
    if (dot(z, z) > 16.0) break;
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    m += 1.0;
  }
  return m / 48.0;
}

float fieldMoire(vec2 p, float t, float warp, float fold) {
  float g1 = sin(p.x * 7.0);
  float ang = fold * 1.4 + t * 0.06;
  float g2 = sin((p.x * cos(ang) + p.y * sin(ang)) * 7.0 * (1.0 + warp * 0.4));
  return g1 * g2;
}

float fieldCrystal(vec2 p, float t, float warp, float fold) {
  vec2 q = mirrorFold(p, floor(mix(3.0, 12.0, fold)));
  return length(q) - t * 0.12 + sin(q.x * 3.0 + t * 0.2) * warp * 0.45;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uRes.x / uRes.y;
  p *= mix(2.6, 0.4, uZoom);

  float t = uTime * mix(0.15, 1.6, uSpeed);
  int mode = int(floor(uMode + 0.5));

  float field;
  if (mode == 1) {
    field = fieldRibbons(p, t, uWarp);
  } else if (mode == 2) {
    field = fieldTunnel(p, t, uWarp);
  } else if (mode == 3) {
    field = fieldScallop(p, uWarp, t);
  } else if (mode == 4) {
    field = fieldJulia(p, t, uWarp);
  } else if (mode == 5) {
    field = fieldMoire(p, t, uWarp, uFold);
  } else if (mode == 6) {
    field = fieldCrystal(p, t, uWarp, uFold);
  } else {
    field = fieldMarble(p, t, uWarp);
  }

  float bandsCount = mix(2.0, 40.0, uBands);
  float bandsT = field * bandsCount;
  float steps = mix(96.0, 5.0, uHardEdges);
  float quantized = floor(bandsT * steps) / steps;
  float finalT = mix(bandsT, quantized, uHardEdges);

  int pal = int(floor(uPalette + 0.5));
  vec3 col = palette(fract(finalT + uHueShift), pal);
  col *= mix(0.55, 1.7, uIntensity);
  col = pow(clamp(col, 0.0, 1.0), vec3(0.85));

  fragColor = vec4(col, 1.0);
}
`;

export type MathPatternUniforms = {
  uRes: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uMode: WebGLUniformLocation | null;
  uPalette: WebGLUniformLocation | null;
  uBands: WebGLUniformLocation | null;
  uHardEdges: WebGLUniformLocation | null;
  uWarp: WebGLUniformLocation | null;
  uZoom: WebGLUniformLocation | null;
  uFold: WebGLUniformLocation | null;
  uHueShift: WebGLUniformLocation | null;
  uIntensity: WebGLUniformLocation | null;
  uSpeed: WebGLUniformLocation | null;
};

export type MathPatternProgram = {
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  uniforms: MathPatternUniforms;
};

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): { shader: WebGLShader } | { error: string } {
  const shader = gl.createShader(type);
  if (!shader) return { error: "createShader returned null" };
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || "unknown shader error";
    gl.deleteShader(shader);
    return { error: log };
  }
  return { shader };
}

export function compileMathPatternProgram(
  gl: WebGL2RenderingContext,
): MathPatternProgram | { error: string } {
  const vs = compileShader(gl, gl.VERTEX_SHADER, MATH_VERT_SRC);
  if ("error" in vs) return { error: `vertex shader: ${vs.error}` };
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, MATH_FRAG_SRC);
  if ("error" in fs) return { error: `fragment shader: ${fs.error}` };

  const program = gl.createProgram();
  if (!program) return { error: "createProgram returned null" };
  gl.attachShader(program, vs.shader);
  gl.attachShader(program, fs.shader);
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || "unknown link error";
    return { error: `link: ${log}` };
  }

  const vao = gl.createVertexArray();
  if (!vao) return { error: "createVertexArray returned null" };
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const uniforms: MathPatternUniforms = {
    uRes: gl.getUniformLocation(program, "uRes"),
    uTime: gl.getUniformLocation(program, "uTime"),
    uMode: gl.getUniformLocation(program, "uMode"),
    uPalette: gl.getUniformLocation(program, "uPalette"),
    uBands: gl.getUniformLocation(program, "uBands"),
    uHardEdges: gl.getUniformLocation(program, "uHardEdges"),
    uWarp: gl.getUniformLocation(program, "uWarp"),
    uZoom: gl.getUniformLocation(program, "uZoom"),
    uFold: gl.getUniformLocation(program, "uFold"),
    uHueShift: gl.getUniformLocation(program, "uHueShift"),
    uIntensity: gl.getUniformLocation(program, "uIntensity"),
    uSpeed: gl.getUniformLocation(program, "uSpeed"),
  };

  return { program, vao, uniforms };
}

export function drawMathPattern(
  gl: WebGL2RenderingContext,
  prog: MathPatternProgram,
  args: { timeSec: number; width: number; height: number; params: MathPatternParams },
): void {
  const { params } = args;
  gl.viewport(0, 0, args.width, args.height);
  gl.useProgram(prog.program);
  gl.bindVertexArray(prog.vao);
  gl.uniform2f(prog.uniforms.uRes, args.width, args.height);
  gl.uniform1f(prog.uniforms.uTime, args.timeSec);
  gl.uniform1f(prog.uniforms.uMode, MATH_PATTERN_MODES.indexOf(params.mode));
  gl.uniform1f(prog.uniforms.uPalette, MATH_PATTERN_PALETTES.indexOf(params.palette));
  gl.uniform1f(prog.uniforms.uBands, params.bands);
  gl.uniform1f(prog.uniforms.uHardEdges, params.hardEdges);
  gl.uniform1f(prog.uniforms.uWarp, params.warp);
  gl.uniform1f(prog.uniforms.uZoom, params.zoom);
  gl.uniform1f(prog.uniforms.uFold, params.fold);
  gl.uniform1f(prog.uniforms.uHueShift, params.hueShift);
  gl.uniform1f(prog.uniforms.uIntensity, params.intensity);
  gl.uniform1f(prog.uniforms.uSpeed, params.speed);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
}

export function destroyMathPatternProgram(gl: WebGL2RenderingContext, prog: MathPatternProgram): void {
  gl.deleteVertexArray(prog.vao);
  gl.deleteProgram(prog.program);
}

export type MathPatternLoopHandle = { stop: () => void };

/**
 * Plain (non-component) RAF loop — kept outside any React component so the
 * clock (`performance.now`) and the RAF callback aren't subject to the
 * render-purity lint rules. `getParams` is read fresh every tick, so a
 * caller can update params via a ref without tearing the loop down.
 */
export function startMathPatternLoop(
  gl: WebGL2RenderingContext,
  canvas: HTMLCanvasElement,
  prog: MathPatternProgram,
  getParams: () => MathPatternParams,
  fallbackWidth: number,
  fallbackHeight: number,
): MathPatternLoopHandle {
  let raf = 0;
  const startedAt = performance.now();
  function loop() {
    const { width, height } = resizeMathPatternCanvas(canvas, fallbackWidth, fallbackHeight);
    const timeSec = (performance.now() - startedAt) / 1000;
    drawMathPattern(gl, prog, { timeSec, width, height, params: getParams() });
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  return {
    stop() {
      cancelAnimationFrame(raf);
    },
  };
}

/** Cap DPR at 2.5 so a phone/retina display doesn't get upscaled 2-3x. */
export function resizeMathPatternCanvas(
  canvas: HTMLCanvasElement,
  fallbackWidth: number,
  fallbackHeight: number,
): { width: number; height: number } {
  const dpr = Math.min(2.5, (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1);
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  const width = cw > 0 ? Math.max(1, Math.round(cw * dpr)) : fallbackWidth;
  const height = ch > 0 ? Math.max(1, Math.round(ch * dpr)) : fallbackHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height };
}
