import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import { getEnv } from "./env";

const DEFAULT_LIMIT = 95;

export type VoiceQuota = {
  month: string;
  count: number;
  limit: number;
  remaining: number;
};

function quotaPath(): string {
  const dir = path.join(CRASH_DIR, "voice");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "quota.json");
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

function limit(): number {
  const raw = Number(getEnv("ELEVENLABS_MONTHLY_VOICE_DESIGN_LIMIT"));
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LIMIT;
}

function readRaw(): { month: string; count: number } {
  const p = quotaPath();
  if (!fs.existsSync(p)) return { month: currentMonth(), count: 0 };
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf8")) as {
      month?: string;
      count?: number;
    };
    return {
      month: parsed.month || currentMonth(),
      count: parsed.count ?? 0,
    };
  } catch {
    return { month: currentMonth(), count: 0 };
  }
}

function toQuota(raw: { month: string; count: number }): VoiceQuota {
  const lim = limit();
  return {
    month: raw.month,
    count: raw.count,
    limit: lim,
    remaining: Math.max(0, lim - raw.count),
  };
}

/** Current month's voice-design usage — auto-resets on month rollover. */
export function readVoiceQuota(): VoiceQuota {
  const raw = readRaw();
  if (raw.month !== currentMonth()) {
    return toQuota({ month: currentMonth(), count: 0 });
  }
  return toQuota(raw);
}

/** Call once a voice-design ElevenLabs call succeeds. */
export function recordVoiceDesignGeneration(): VoiceQuota {
  const raw = readRaw();
  const month = currentMonth();
  const count = raw.month === month ? raw.count + 1 : 1;
  fs.writeFileSync(quotaPath(), JSON.stringify({ month, count }, null, 2));
  return toQuota({ month, count });
}
