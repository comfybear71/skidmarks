import fs from "fs";
import path from "path";
import { cursorCastKeys } from "./cursorPopulateConfig";
import type { CursorShotPlan } from "./cursorPopulateTypes";
import { CRASH_DIR } from "./paths";
import type { ShowStyleId } from "./showStylePresets";
import { getSwapEngineStatus, runFaceSwap } from "./swapRun";
import { readSwapManifest, resolveSwapResultPath } from "./swapCards";

function resolveCastKey(
  castKeys: Record<string, string>,
  name: string,
): string | undefined {
  if (castKeys[name]) return castKeys[name];
  const lower = name.trim().toLowerCase();
  for (const [label, key] of Object.entries(castKeys)) {
    if (label.trim().toLowerCase() === lower) return key;
  }
  return undefined;
}

/** FaceFusion — swap every cast face onto a fresh AI plate, overwrite the cplate in gen/. */
export async function swapDeepfakePlate(
  styleId: ShowStyleId,
  plan: CursorShotPlan,
  plateFile: string,
): Promise<void> {
  const engine = getSwapEngineStatus();
  if (!engine.configured) {
    throw new Error(
      engine.hint ||
        "FaceFusion not set up — add FACEFUSION_SCRIPT to your environment variables",
    );
  }

  const castKeys = cursorCastKeys(styleId);
  const order: string[] = [];
  for (const name of plan.cast) {
    const key = resolveCastKey(castKeys, name);
    if (!key) throw new Error(`No cast key for FaceFusion swap: ${name}`);
    order.push(key);
  }
  if (!order.length) {
    throw new Error(`No cast listed for swap on ${plan.shotId}`);
  }

  const target = { kind: "gen" as const, fileName: plateFile };
  for (let i = 0; i < order.length; i += 1) {
    const castKey = order[i]!;
    const castName = plan.cast[i] || castKey;
    await runFaceSwap({
      styleId,
      castKey,
      castName,
      sourceKey: castKey,
      target,
      castOrder: order,
    });
  }

  const lastKey = order[order.length - 1]!;
  const resultFile = readSwapManifest(styleId)[lastKey]?.resultFile;
  if (!resultFile) {
    throw new Error(`FaceFusion swap failed for ${plateFile}`);
  }
  const src = resolveSwapResultPath(styleId, resultFile);
  if (!src) throw new Error(`Swap output missing for ${plateFile}`);
  fs.copyFileSync(src, path.join(CRASH_DIR, "gen", plateFile));
}
