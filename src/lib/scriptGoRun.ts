/**
 * Script Go — park the old wave, blade the saved clock, draw each still,
 * hang the same in/out, then cook. One [name] per plate.
 *
 * Same job only. Does not delete media. Does not feed the
 * song mp3 into H3 / GROK. Long breaks cook LTX mute.
 */

import type { MobileGenJob } from "./mobileGenJob";
import { GROK_I2V_ID } from "./grokI2v";
import { MINIMAX_H3_ID } from "./minimaxH3";
import { cookDurationFromHungBar } from "./musicVideoTrack";
import { readApiJson, studioFetchError } from "./studioFetchError";
import type { ScriptGoEngine } from "./scriptGo";

export const SCRIPT_GO_FRESH = "script-fresh";
export const SCRIPT_GO_BLADE = "script-blade";

export type ScriptGoBladeItem = {
  shotId: string;
  beatId: string;
  startMs: number;
  endMs: number;
  who: string;
  kind: string;
  engine: string;
  staging: string;
};

type JsonBag = {
  ok?: boolean;
  job?: MobileGenJob;
  error?: string;
  pending?: boolean;
  items?: ScriptGoBladeItem[];
  count?: number;
  parked?: number;
  plateFile?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function clipEngineId(engine: string): "ltx" | typeof MINIMAX_H3_ID | typeof GROK_I2V_ID {
  if (engine === "h3") return MINIMAX_H3_ID;
  if (engine === "grok") return GROK_I2V_ID;
  return "ltx";
}

function isHardStopError(msg: string): boolean {
  return /credit|balance|quota|payment|insufficient|not on this studio|drop the song|lock the episode|type \[|need a location|couldn't read this pack/i.test(
    msg,
  );
}

function isMissingEngineError(msg: string): boolean {
  return /h3 is not on this studio|grok is not on this studio/i.test(msg);
}

export async function scriptGoJson(
  path: string,
  body: Record<string, unknown>,
  baseUrl = "",
): Promise<JsonBag> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await readApiJson<JsonBag>(res);
  if (!res.ok) {
    throw new Error(data.error?.trim() || studioFetchError(new Error(""), `Request failed (${res.status})`));
  }
  return data;
}

async function drawStill(opts: {
  jobId: string;
  shotId: string;
  staging: string;
  baseUrl: string;
  cancelled?: () => boolean;
}): Promise<JsonBag> {
  const start = await scriptGoJson(
    "/api/crash/mobile/plate",
    {
      jobId: opts.jobId,
      shotId: opts.shotId,
      action: "draw-start",
      staging: opts.staging,
      summary: opts.staging,
    },
    opts.baseUrl,
  );
  if (!start.pending) return start;
  for (let i = 0; i < 90; i++) {
    if (opts.cancelled?.()) return start;
    await sleep(2000);
    const poll = await scriptGoJson(
      "/api/crash/mobile/plate",
      { jobId: opts.jobId, shotId: opts.shotId, action: "draw-poll" },
      opts.baseUrl,
    );
    if (!poll.pending) return poll;
  }
  throw new Error("Draw is still cooking. The episode is still there — tap Go again.");
}

async function pollClip(opts: {
  jobId: string;
  cutId: string;
  beatId: string;
  shotId: string;
  baseUrl: string;
  cancelled?: () => boolean;
}): Promise<JsonBag> {
  let last: JsonBag = {};
  for (let i = 0; i < 80; i++) {
    if (opts.cancelled?.()) return last;
    last = await scriptGoJson(
      "/api/crash/mobile/song",
      {
        action: "clip-poll",
        jobId: opts.jobId,
        cutId: opts.cutId,
        beatId: opts.beatId,
        shotId: opts.shotId,
      },
      opts.baseUrl,
    );
    if (!last.pending) return last;
    await sleep(2500);
  }
  throw new Error("Still cooking. The episode is still there — tap Go again.");
}

function cutForPlate(job: MobileGenJob | undefined, shotId: string) {
  return (job?.scratchSong?.cuts || []).find((c) => (c.shotId || "").trim() === shotId);
}

export async function runScriptGo(opts: {
  jobId: string;
  baseUrl?: string;
  onJob?: (job: MobileGenJob) => void;
  onNote?: (msg: string) => void;
  cancelled?: () => boolean;
}): Promise<MobileGenJob | null> {
  const baseUrl = (opts.baseUrl || "").replace(/\/$/, "");
  const jobId = opts.jobId.trim();
  let live: MobileGenJob | null = null;
  const note = (msg: string) => opts.onNote?.(msg);
  const take = (job?: MobileGenJob) => {
    if (!job) return;
    live = job;
    opts.onJob?.(job);
  };

  note("Parking clips — wave stays empty until the script hangs");
  const fresh = await scriptGoJson(
    "/api/crash/mobile/song",
    { action: SCRIPT_GO_FRESH, jobId },
    baseUrl,
  );
  take(fresh.job);
  if (opts.cancelled?.()) return live;

  note("Hanging the script clock");
  const blade = await scriptGoJson(
    "/api/crash/mobile/song",
    { action: SCRIPT_GO_BLADE, jobId },
    baseUrl,
  );
  take(blade.job);
  const items = blade.items || [];
  if (!items.length) {
    throw new Error("Script has no named rows to hang.");
  }

  for (let i = 0; i < items.length; i++) {
    if (opts.cancelled?.()) {
      note(`Stopped at ${i} of ${items.length}`);
      return live;
    }
    const item = items[i]!;
    const clock = `${Math.floor(item.startMs / 1000)}s`;
    note(`Draw ${i + 1}/${items.length} · ${item.who} · ${clock}`);
    const drawn = await drawStill({
      jobId,
      shotId: item.shotId,
      staging: item.staging,
      baseUrl,
      cancelled: opts.cancelled,
    });
    take(drawn.job);
    if (opts.cancelled?.()) return live;

    const hung = await scriptGoJson(
      "/api/crash/mobile/track",
      {
        action: "set-plate-timing",
        jobId,
        plateId: item.shotId,
        startMs: item.startMs,
        endMs: item.endMs,
        sortIndex: i,
      },
      baseUrl,
    );
    take(hung.job);
    const cut = cutForPlate(hung.job || live || undefined, item.shotId);
    if (!cut?.id) {
      throw new Error(`Couldn't hang ${item.who} at ${clock}.`);
    }

    let engine = (item.engine || "ltx") as ScriptGoEngine;
    const cook = cookDurationFromHungBar(
      { startMs: item.startMs, endMs: item.endMs },
      engine === "h3" ? "h3" : engine === "grok" ? "grok" : "ltx",
    );
    if ("error" in cook) {
      throw new Error(cook.error);
    }
    const mute = item.kind !== "sing";
    note(
      `Cook ${i + 1}/${items.length} · ${engine.toUpperCase()}${mute ? " mute" : ""} · ${cook.durationSec}s`,
    );

    const send = async (pick: ScriptGoEngine) =>
      scriptGoJson(
        "/api/crash/mobile/song",
        {
          action: "run",
          jobId,
          cutId: cut.id,
          beatId: item.beatId,
          shotId: item.shotId,
          clipEngine: clipEngineId(pick),
          durationSec: cook.durationSec,
          ...(mute || pick !== "ltx" ? { mute: true } : {}),
        },
        baseUrl,
      );

    try {
      const raw = await send(engine);
      take(raw.job);
      if (raw.pending) {
        const polled = await pollClip({
          jobId,
          cutId: cut.id,
          beatId: item.beatId,
          shotId: item.shotId,
          baseUrl,
          cancelled: opts.cancelled,
        });
        take(polled.job);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isMissingEngineError(msg) && engine !== "ltx") {
        note(`${engine.toUpperCase()} is off — cooking LTX mute`);
        engine = "ltx";
        const raw = await send("ltx");
        take(raw.job);
        if (raw.pending) {
          const polled = await pollClip({
            jobId,
            cutId: cut.id,
            beatId: item.beatId,
            shotId: item.shotId,
            baseUrl,
            cancelled: opts.cancelled,
          });
          take(polled.job);
        }
        continue;
      }
      if (isHardStopError(msg)) throw e;
      note(`Failed ${i + 1}/${items.length}: ${msg}`);
      throw e;
    }
  }

  note(`Done · ${items.length} clips from the script`);
  return live;
}
