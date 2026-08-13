import fs from "fs";
import path from "path";
import type { CursorPopulateConfig } from "./cursorPopulateTypes";
import { CRASH_DIR } from "./paths";
import type { ShowStyleId } from "./showStylePresets";

function promptPopulatePath(styleId: ShowStyleId): string {
  return path.join(CRASH_DIR, "story", styleId, "prompt_populate.json");
}

export function readPromptPopulateConfig(
  styleId: ShowStyleId,
): { campaignLabel: string; config: CursorPopulateConfig } | null {
  const fp = promptPopulatePath(styleId);
  if (!fs.existsSync(fp)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(fp, "utf8")) as {
      campaignLabel?: string;
      config?: CursorPopulateConfig;
    };
    if (raw?.campaignLabel && raw?.config?.styleId === styleId) {
      return { campaignLabel: raw.campaignLabel, config: raw.config };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writePromptPopulateConfig(
  styleId: ShowStyleId,
  campaignLabel: string,
  config: CursorPopulateConfig,
): void {
  const fp = promptPopulatePath(styleId);
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    fp,
    JSON.stringify({ campaignLabel, config }, null, 2),
    "utf8",
  );
}
