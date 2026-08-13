import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { CRASH_DIR } from "./paths";
import { newId } from "./types";

const execFileAsync = promisify(execFile);

export function morphRoot() {
  const dir = path.join(CRASH_DIR, "morph");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function morphRunDir(runId: string) {
  const dir = path.join(morphRoot(), runId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function morphKeepersDir() {
  const dir = path.join(morphRoot(), "keepers");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Working tray — survives refresh until Clear. */
export function morphDraftDir() {
  const dir = path.join(morphRoot(), "draft");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export type MorphDraftItem = {
  id: string;
  fileName: string;
  url: string;
};

export type MorphRunResult = {
  runId: string;
  outFile: string;
  relativeUrl: string;
  frames: number;
  seconds: number;
  fps: number;
};

function pythonBin() {
  return process.env.MORPH_PYTHON || "python";
}

function scriptPath() {
  return path.join(process.cwd(), "scripts", "morph_chain.py");
}

function draftManifestPath() {
  return path.join(morphDraftDir(), "manifest.json");
}

function readDraftIds(): string[] {
  const p = draftManifestPath();
  if (!fs.existsSync(p)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as { files?: string[] };
    return Array.isArray(raw.files) ? raw.files : [];
  } catch {
    return [];
  }
}

function writeDraftIds(files: string[]) {
  fs.writeFileSync(
    draftManifestPath(),
    JSON.stringify({ files }, null, 2) + "\n",
    "utf8",
  );
}

export function listMorphDraft(): MorphDraftItem[] {
  const dir = morphDraftDir();
  return readDraftIds()
    .filter((name) => fs.existsSync(path.join(dir, name)))
    .map((fileName) => ({
      id: fileName,
      fileName,
      url: `/api/crash/morph/draft/file?name=${encodeURIComponent(fileName)}`,
    }));
}

export function appendMorphDraft(
  buffers: { buf: Buffer; ext: string }[],
): MorphDraftItem[] {
  const dir = morphDraftDir();
  const files = [...readDraftIds()];
  for (const item of buffers) {
    const ext = item.ext.startsWith(".") ? item.ext : `.${item.ext}`;
    const safe = ext.match(/\.(png|jpe?g|webp)$/i) ? ext.toLowerCase() : ".png";
    const id = `step_${String(files.length).padStart(2, "0")}_${newId("img")}${safe}`;
    fs.writeFileSync(path.join(dir, id), item.buf);
    files.push(id);
  }
  writeDraftIds(files);
  return listMorphDraft();
}

export function reorderMorphDraft(ids: string[]): MorphDraftItem[] {
  const dir = morphDraftDir();
  const existing = new Set(readDraftIds());
  const next = ids.filter((id) => existing.has(id) && fs.existsSync(path.join(dir, id)));
  writeDraftIds(next);
  return listMorphDraft();
}

export function removeMorphDraftItem(id: string): MorphDraftItem[] {
  const dir = morphDraftDir();
  const files = readDraftIds().filter((f) => f !== id);
  const fp = path.join(dir, id);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  writeDraftIds(files);
  return listMorphDraft();
}

export function clearMorphDraft(): void {
  const dir = morphDraftDir();
  for (const name of fs.readdirSync(dir)) {
    fs.unlinkSync(path.join(dir, name));
  }
  writeDraftIds([]);
}

async function execMorphScript(opts: {
  listFile: string;
  outFile: string;
  width: number;
  height: number;
  framesPerStep: number;
  fps: number;
  runId: string;
  hold?: number;
  easing?: string;
  colourMatch?: boolean;
  faceAlign?: boolean;
  ghost?: number;
  audioPath?: string;
}): Promise<MorphRunResult> {
  const progressFile = path.join(morphRoot(), "progress.json");
  fs.writeFileSync(
    progressFile,
    JSON.stringify({
      phase: "start",
      step: 0,
      total: 0,
      label: "Starting morph…",
      pct: 0,
    }) + "\n",
    "utf8",
  );

  const easing = opts.easing || "smoothstep";
  const hold = Math.max(0, Number(opts.hold) || 0);
  const ghost = Math.max(0, Math.min(0.45, Number(opts.ghost) || 0));

  try {
    const args = [
      scriptPath(),
      "--list",
      opts.listFile,
      "--out",
      opts.outFile,
      "--progress",
      progressFile,
      "--width",
      String(opts.width),
      "--height",
      String(opts.height),
      "--frames-per-step",
      String(opts.framesPerStep),
      "--fps",
      String(opts.fps),
      "--hold",
      String(hold),
      "--easing",
      easing,
      "--ghost",
      String(ghost),
    ];
    if (opts.colourMatch) args.push("--colour-match");
    if (opts.faceAlign) args.push("--face-align");

    const { stdout, stderr } = await execFileAsync(pythonBin(), args, {
      timeout: 10 * 60 * 1000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });

    let meta: { ok?: boolean; frames?: number; seconds?: number; fps?: number; error?: string } =
      {};
    const line = (stdout || "").trim().split(/\r?\n/).filter(Boolean).pop() || "";
    try {
      meta = JSON.parse(line);
    } catch {
      meta = {};
    }
    if (!fs.existsSync(opts.outFile)) {
      throw new Error(meta.error || stderr || "Morph produced no mp4");
    }

    await remuxH264(opts.outFile, opts.audioPath);

    fs.writeFileSync(
      progressFile,
      JSON.stringify({
        phase: "done",
        step: 1,
        total: 1,
        label: "Done",
        pct: 100,
      }) + "\n",
      "utf8",
    );

    return {
      runId: opts.runId,
      outFile: opts.outFile,
      relativeUrl: `/api/crash/morph/file?run=${encodeURIComponent(opts.runId)}&name=morph.mp4`,
      frames: meta.frames ?? 0,
      seconds: meta.seconds ?? 0,
      fps: meta.fps ?? opts.fps,
    };
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    let msg = err.message || String(e);
    if (err.stderr) {
      try {
        const parsed = JSON.parse(String(err.stderr).trim().split(/\r?\n/).pop() || "{}");
        if (parsed.error) msg = parsed.error;
      } catch {
        msg = `${msg}\n${err.stderr}`;
      }
    }
    fs.writeFileSync(
      progressFile,
      JSON.stringify({
        phase: "error",
        step: 0,
        total: 0,
        label: msg,
        pct: 0,
      }) + "\n",
      "utf8",
    );
    throw new Error(msg);
  }
}

/** OpenCV mp4v → H.264 so the browser preview works. Optional audio bed. */
async function remuxH264(mp4Path: string, audioPath?: string) {
  const tmp = mp4Path.replace(/\.mp4$/i, ".h264.mp4");
  const hasAudio =
    Boolean(audioPath) &&
    typeof audioPath === "string" &&
    fs.existsSync(audioPath);

  try {
    const args = hasAudio
      ? [
          "-y",
          "-i",
          mp4Path,
          "-i",
          audioPath!,
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-shortest",
          "-movflags",
          "+faststart",
          tmp,
        ]
      : [
          "-y",
          "-i",
          mp4Path,
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          "-an",
          tmp,
        ];
    await execFileAsync("ffmpeg", args, {
      timeout: 180000,
      windowsHide: true,
    });
    if (fs.existsSync(tmp)) {
      fs.copyFileSync(tmp, mp4Path);
      fs.unlinkSync(tmp);
    }
  } catch {
    if (fs.existsSync(tmp)) {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }
}

export function readMorphProgress(): {
  phase: string;
  step: number;
  total: number;
  label: string;
  pct: number;
} {
  const p = path.join(morphRoot(), "progress.json");
  if (!fs.existsSync(p)) {
    return { phase: "idle", step: 0, total: 0, label: "", pct: 0 };
  }
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return { phase: "idle", step: 0, total: 0, label: "", pct: 0 };
  }
}

export type MorphToolsOpts = {
  width?: number;
  height?: number;
  framesPerStep?: number;
  fps?: number;
  hold?: number;
  easing?: "linear" | "smoothstep" | "cosine";
  colourMatch?: boolean;
  faceAlign?: boolean;
  ghost?: number;
  audioPath?: string;
};

/** Morph whatever is currently in the draft tray. */
export async function runMorphFromDraft(
  opts?: MorphToolsOpts,
): Promise<MorphRunResult> {
  const items = listMorphDraft();
  if (items.length < 2) throw new Error("Need at least 2 images in the tray");

  const runId = newId("morph");
  const dir = morphRunDir(runId);
  const inputsDir = path.join(dir, "inputs");
  fs.mkdirSync(inputsDir, { recursive: true });

  const draftDir = morphDraftDir();
  const inputPaths: string[] = [];
  items.forEach((item, i) => {
    const src = path.join(draftDir, item.fileName);
    const ext = path.extname(item.fileName) || ".png";
    const dest = path.join(inputsDir, `step_${String(i).padStart(2, "0")}${ext}`);
    fs.copyFileSync(src, dest);
    inputPaths.push(dest);
  });

  const listFile = path.join(dir, "inputs.txt");
  fs.writeFileSync(listFile, inputPaths.join("\n") + "\n", "utf8");

  let audioPath = opts?.audioPath;
  if (audioPath && !path.isAbsolute(audioPath)) {
    audioPath = path.join(morphRoot(), audioPath);
  }
  if (audioPath && !fs.existsSync(audioPath)) {
    audioPath = undefined;
  }

  return execMorphScript({
    listFile,
    outFile: path.join(dir, "morph.mp4"),
    width: opts?.width ?? 768,
    height: opts?.height ?? 512,
    framesPerStep: opts?.framesPerStep ?? 16,
    fps: opts?.fps ?? 12,
    runId,
    hold: opts?.hold ?? 0,
    easing: opts?.easing ?? "smoothstep",
    colourMatch: Boolean(opts?.colourMatch),
    faceAlign: Boolean(opts?.faceAlign),
    ghost: opts?.ghost ?? 0,
    audioPath,
  }).then((result) => {
    saveLastMorph(result);
    return result;
  });
}

export type LastMorph = {
  runId: string;
  url: string;
  seconds: number;
  frames: number;
  fps: number;
};

function lastMorphPath() {
  return path.join(morphRoot(), "last.json");
}

export function saveLastMorph(result: MorphRunResult) {
  const payload: LastMorph = {
    runId: result.runId,
    url: result.relativeUrl,
    seconds: result.seconds,
    frames: result.frames,
    fps: result.fps,
  };
  fs.writeFileSync(lastMorphPath(), JSON.stringify(payload, null, 2) + "\n", "utf8");
}

export function readLastMorph(): LastMorph | null {
  const p = lastMorphPath();
  if (fs.existsSync(p)) {
    try {
      const raw = JSON.parse(fs.readFileSync(p, "utf8")) as LastMorph;
      if (raw?.runId) {
        const mp4 = path.join(morphRunDir(raw.runId), "morph.mp4");
        if (fs.existsSync(mp4)) {
          return {
            ...raw,
            url:
              raw.url ||
              `/api/crash/morph/file?run=${encodeURIComponent(raw.runId)}&name=morph.mp4`,
          };
        }
      }
    } catch {
      /* fall through */
    }
  }

  // Fallback: newest morph_* folder with morph.mp4 (pre-last.json runs)
  try {
    const root = morphRoot();
    const dirs = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith("morph_"))
      .map((d) => {
        const mp4 = path.join(root, d.name, "morph.mp4");
        const st = fs.existsSync(mp4) ? fs.statSync(mp4) : null;
        return st ? { id: d.name, mtime: st.mtimeMs } : null;
      })
      .filter(Boolean) as { id: string; mtime: number }[];
    dirs.sort((a, b) => b.mtime - a.mtime);
    const hit = dirs[0];
    if (!hit) return null;
    return {
      runId: hit.id,
      url: `/api/crash/morph/file?run=${encodeURIComponent(hit.id)}&name=morph.mp4`,
      seconds: 0,
      frames: 0,
      fps: 12,
    };
  } catch {
    return null;
  }
}

export function copyMorphToKeepers(runId: string, label?: string): string {
  const src = path.join(morphRunDir(runId), "morph.mp4");
  if (!fs.existsSync(src)) throw new Error("No morph.mp4 for that run");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safe = (label || "morph").replace(/[^\w\-]+/g, "_").slice(0, 40);
  const dest = path.join(morphKeepersDir(), `${stamp}_${safe}.mp4`);
  fs.copyFileSync(src, dest);
  return dest;
}
