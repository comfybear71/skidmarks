import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { getEnv } from "./env";
import {
  ensureSwapDirs,
  resolveChainedSwapTargetPath,
  resolveSourceFacePath,
  resolveSwapTargetPath,
  saveSwapResult,
  swapGalleryDir,
  type SwapTargetRef,
} from "./swapCards";
import type { ShowStyleId } from "./showStylePresets";
import { friendlySwapError } from "./swapErrors";

const execFileAsync = promisify(execFile);

function pythonBin() {
  return process.env.SWAP_PYTHON || process.env.MORPH_PYTHON || "python";
}

function scriptPath() {
  return path.join(process.cwd(), "scripts", "face_swap.py");
}

export type SwapEngineStatus = {
  configured: boolean;
  facefusionScript: string;
  facefusionPython: string;
  hint: string;
};

export function getSwapEngineStatus(): SwapEngineStatus {
  const facefusionScript = getEnv("FACEFUSION_SCRIPT");
  const facefusionPython = getEnv("FACEFUSION_PYTHON") || "python";
  const configured = Boolean(facefusionScript && fs.existsSync(facefusionScript));
  return {
    configured,
    facefusionScript,
    facefusionPython,
    hint: configured
      ? "Ready — Run swap puts your real photo on the plate."
      : "Face swap not wired up yet — use Import swap if you ran it yourself.",
  };
}

export async function runFaceSwap(opts: {
  styleId: ShowStyleId;
  castKey: string;
  castName: string;
  sourceKey: string;
  target: SwapTargetRef;
  castOrder?: string[];
}): Promise<{ label: ReturnType<typeof saveSwapResult> }> {
  const sourcePath = resolveSourceFacePath(opts.styleId, opts.sourceKey);
  if (!sourcePath) throw new Error("Source face missing — pick cast on Characters");

  const castOrder = opts.castOrder?.length ? opts.castOrder : [opts.castKey];
  const castIndex = Math.max(0, castOrder.indexOf(opts.castKey));
  const chained = resolveChainedSwapTargetPath(
    opts.styleId,
    opts.target,
    opts.castKey,
    castOrder,
  );
  const targetPath =
    chained || resolveSwapTargetPath(opts.styleId, opts.target);
  if (!targetPath) throw new Error("Target still missing — pick a plate with a face to replace");

  ensureSwapDirs(opts.styleId);
  const outPath = path.join(swapGalleryDir(opts.styleId), `_tmp_${Date.now()}.png`);

  const ffScript = getEnv("FACEFUSION_SCRIPT");
  const ffPython = getEnv("FACEFUSION_PYTHON") || "python";

  const args = [
    scriptPath(),
    "--source",
    sourcePath,
    "--target",
    targetPath,
    "--output",
    outPath,
    "--facefusion-python",
    ffPython,
    "--cast-index",
    String(castIndex),
  ];
  if (ffScript) args.push("--facefusion-script", ffScript);

  let stdout = "";
  try {
    const result = await execFileAsync(pythonBin(), args, {
      timeout: 300_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    stdout = result.stdout;
  } catch (e: unknown) {
    const err = e as { stderr?: string; stdout?: string; message?: string };
    const bit =
      [err.stderr, err.stdout, err.message].filter(Boolean).join("\n").trim() ||
      "Face swap failed";
    throw new Error(friendlySwapError(bit));
  }

  let parsed: { ok?: boolean; error?: string; engine?: string; output?: string } = {};
  try {
    parsed = JSON.parse(String(stdout).trim().split("\n").pop() || "{}");
  } catch {
    /* ignore */
  }
  if (parsed.ok === false) {
    throw new Error(friendlySwapError(parsed.error || "Face swap failed"));
  }

  const resultPath = parsed.output && fs.existsSync(parsed.output) ? parsed.output : outPath;
  if (!fs.existsSync(resultPath)) {
    throw new Error(parsed.error || "Swap output missing — check FaceFusion install");
  }

  const ext = path.extname(resultPath) || ".png";
  const label = saveSwapResult({
    styleId: opts.styleId,
    castKey: opts.castKey,
    castName: opts.castName,
    sourceKey: opts.sourceKey,
    target: opts.target,
    resultBuffer: fs.readFileSync(resultPath),
    ext,
    engine: parsed.engine,
  });

  try {
    if (resultPath === outPath || resultPath.includes("swap_out_")) {
      fs.unlinkSync(resultPath);
    }
  } catch {
    /* temp file cleanup optional */
  }

  return { label };
}
