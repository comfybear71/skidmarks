import fs from "fs";
import path from "path";
import { CRASH_DIR, CRASH_FILE, DATA_DIR } from "./paths";
import { newId } from "./types";

import { CRASH_PRESETS, type CrashPresetId } from "./crashPresets";

export type CrashPreset = CrashPresetId;

export type CrashVehicleRef = {
  id: string;
  fileName: string;
  label: string;
  createdAt: string;
};

export type CrashTake = {
  id: string;
  status: "pending" | "approved" | "rejected";
  fileName: string;
  preset: CrashPreset | "composite";
  note: string;
  createdAt: string;
};

/** Layer on the Crash Lab board — you place it; AI doesn't. */
export type CrashLayer = {
  id: string;
  kind: "vehicle" | "person" | "fx" | "bg";
  fileName: string;
  label: string;
  /** Centre X as fraction of canvas width (0–1) */
  x: number;
  /** Centre Y as fraction of canvas height (0–1) */
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
};

export type CrashPersonRef = {
  id: string;
  fileName: string;
  label: string;
  createdAt: string;
};

export type CrashJobKind = "morph" | "smash";

export type CrashJob = {
  id: string;
  title: string;
  /** morph = first skeleton; smash = old bus work (kept on disk) */
  kind: CrashJobKind;
  characterId: string;
  preset: CrashPreset;
  vehicleRefs: CrashVehicleRef[];
  approvedVehicleId: string;
  /** Your pick of who gets hit — cutout / body plate, NOT Character Lab glam face */
  personRefs: CrashPersonRef[];
  approvedPersonId: string;
  layers: CrashLayer[];
  takes: CrashTake[];
  approvedTakeId: string;
  createdAt: string;
  updatedAt: string;
};

export { CRASH_PRESETS };
function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CRASH_DIR)) fs.mkdirSync(CRASH_DIR, { recursive: true });
  if (!fs.existsSync(CRASH_FILE)) {
    fs.writeFileSync(CRASH_FILE, JSON.stringify({ jobs: [] }, null, 2));
  }
}

export function jobDir(jobId: string) {
  return path.join(CRASH_DIR, jobId);
}

export function jobAssetsDir(jobId: string) {
  return path.join(jobDir(jobId), "assets");
}

export function jobTakesDir(jobId: string) {
  return path.join(jobDir(jobId), "takes");
}

function normalize(j: CrashJob): CrashJob {
  const kind: CrashJobKind =
    j.kind === "morph" || j.kind === "smash"
      ? j.kind
      : j.title === "Morph"
        ? "morph"
        : "smash";
  return {
    ...j,
    title: j.title || "Crash job",
    kind,
    characterId: j.characterId || "",
    preset: j.preset || "in_front_of_nose",
    vehicleRefs: j.vehicleRefs || [],
    approvedVehicleId: j.approvedVehicleId || "",
    personRefs: j.personRefs || [],
    approvedPersonId: j.approvedPersonId || "",
    layers: j.layers || [],
    takes: j.takes || [],
    approvedTakeId: j.approvedTakeId || "",
  };
}

export function listCrashJobs(): CrashJob[] {
  ensure();
  const raw = JSON.parse(fs.readFileSync(CRASH_FILE, "utf8")) as {
    jobs: CrashJob[];
  };
  return (raw.jobs || [])
    .map(normalize)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCrashJob(id: string): CrashJob | null {
  return listCrashJobs().find((j) => j.id === id) ?? null;
}

export function saveCrashJob(job: CrashJob): CrashJob {
  ensure();
  const all = listCrashJobs();
  const next = normalize({
    ...job,
    updatedAt: new Date().toISOString(),
  });
  const idx = all.findIndex((j) => j.id === next.id);
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  fs.writeFileSync(CRASH_FILE, JSON.stringify({ jobs: all }, null, 2) + "\n");
  return next;
}

export function createCrashJob(opts: {
  title?: string;
  characterId?: string;
  preset?: CrashPreset;
  kind?: CrashJobKind;
}): CrashJob {
  ensure();
  const id = newId("crash");
  fs.mkdirSync(jobAssetsDir(id), { recursive: true });
  fs.mkdirSync(jobTakesDir(id), { recursive: true });
  const now = new Date().toISOString();
  const kind = opts.kind || "morph";
  const job: CrashJob = {
    id,
    title: opts.title?.trim() || (kind === "morph" ? "Morph" : "Crash job"),
    kind,
    characterId: opts.characterId || "",
    preset: opts.preset || "blank",
    vehicleRefs: [],
    approvedVehicleId: "",
    personRefs: [],
    approvedPersonId: "",
    layers: [],
    takes: [],
    approvedTakeId: "",
    createdAt: now,
    updatedAt: now,
  };
  return saveCrashJob(job);
}

export function crashAssetPath(
  jobId: string,
  fileName: string,
): string | null {
  if (
    !fileName ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  )
    return null;
  const p = path.join(jobAssetsDir(jobId), fileName);
  return fs.existsSync(p) ? p : null;
}

export function crashTakePath(jobId: string, fileName: string): string | null {
  if (
    !fileName ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  )
    return null;
  const p = path.join(jobTakesDir(jobId), fileName);
  return fs.existsSync(p) ? p : null;
}

export function addCrashVehicleRef(
  jobId: string,
  opts: { buffer: Buffer; ext?: string; label?: string },
): { job: CrashJob; ref: CrashVehicleRef } | null {
  const job = getCrashJob(jobId);
  if (!job) return null;
  const id = newId("cvref");
  const ext = opts.ext || ".png";
  const fileName = `${id}${ext.startsWith(".") ? ext : `.${ext}`}`;
  fs.mkdirSync(jobAssetsDir(jobId), { recursive: true });
  fs.writeFileSync(path.join(jobAssetsDir(jobId), fileName), opts.buffer);
  const ref: CrashVehicleRef = {
    id,
    fileName,
    label: opts.label?.trim() || "Vehicle",
    createdAt: new Date().toISOString(),
  };
  job.vehicleRefs = [ref, ...job.vehicleRefs];
  job.approvedVehicleId = ref.id;
  // Replace vehicle layer file, or add one
  const vLayer = job.layers.find((l) => l.kind === "vehicle");
  if (vLayer) {
    job.layers = job.layers.map((l) =>
      l.kind === "vehicle"
        ? { ...l, fileName, label: ref.label }
        : l,
    );
  } else {
    job.layers.push({
      id: newId("clay"),
      kind: "vehicle",
      fileName,
      label: ref.label,
      x: 0.45,
      y: 0.55,
      scale: 1.1,
      rotation: 0,
      opacity: 1,
    });
  }
  return { job: saveCrashJob(job), ref };
}

export function addCrashPersonRef(
  jobId: string,
  opts: { buffer: Buffer; ext?: string; label?: string },
): { job: CrashJob; ref: CrashPersonRef } | null {
  const job = getCrashJob(jobId);
  if (!job) return null;
  const id = newId("cpref");
  const ext = opts.ext || ".png";
  const fileName = `${id}${ext.startsWith(".") ? ext : `.${ext}`}`;
  fs.mkdirSync(jobAssetsDir(jobId), { recursive: true });
  fs.writeFileSync(path.join(jobAssetsDir(jobId), fileName), opts.buffer);
  const ref: CrashPersonRef = {
    id,
    fileName,
    label: opts.label?.trim() || "Person",
    createdAt: new Date().toISOString(),
  };
  job.personRefs = [ref, ...job.personRefs];
  job.approvedPersonId = ref.id;
  const pLayer = job.layers.find((l) => l.kind === "person");
  if (pLayer) {
    job.layers = job.layers.map((l) =>
      l.kind === "person" ? { ...l, fileName, label: ref.label } : l,
    );
  } else {
    job.layers.push({
      id: newId("clay"),
      kind: "person",
      fileName,
      label: ref.label,
      x: 0.88,
      y: 0.65,
      scale: 0.2,
      rotation: 0,
      opacity: 1,
    });
  }
  return { job: saveCrashJob(job), ref };
}

export function clearCrashPersons(jobId: string): CrashJob | null {
  const job = getCrashJob(jobId);
  if (!job) return null;
  job.personRefs = [];
  job.approvedPersonId = "";
  job.layers = job.layers.filter((l) => l.kind !== "person");
  return saveCrashJob(job);
}

export function addCrashLayerAsset(
  jobId: string,
  opts: {
    buffer: Buffer;
    ext?: string;
    kind: CrashLayer["kind"];
    label?: string;
    x?: number;
    y?: number;
    scale?: number;
  },
): { job: CrashJob; layer: CrashLayer } | null {
  const job = getCrashJob(jobId);
  if (!job) return null;
  const id = newId("clay");
  const ext = opts.ext || ".png";
  const fileName = `${id}${ext.startsWith(".") ? ext : `.${ext}`}`;
  fs.mkdirSync(jobAssetsDir(jobId), { recursive: true });
  fs.writeFileSync(path.join(jobAssetsDir(jobId), fileName), opts.buffer);
  const layer: CrashLayer = {
    id,
    kind: opts.kind,
    fileName,
    label: opts.label?.trim() || opts.kind,
    x: opts.x ?? (opts.kind === "person" ? 0.82 : 0.5),
    y: opts.y ?? (opts.kind === "person" ? 0.62 : 0.5),
    scale: opts.scale ?? (opts.kind === "person" ? 0.18 : 1),
    rotation: 0,
    opacity: 1,
  };
  job.layers = [...job.layers, layer];
  return { job: saveCrashJob(job), layer };
}

export function patchCrashLayers(
  jobId: string,
  layers: CrashLayer[],
): CrashJob | null {
  const job = getCrashJob(jobId);
  if (!job) return null;
  job.layers = layers;
  return saveCrashJob(job);
}

export function setCrashPreset(
  jobId: string,
  preset: CrashPreset,
): CrashJob | null {
  const job = getCrashJob(jobId);
  if (!job) return null;
  job.preset = preset;
  // Nudge person layer for "in front of nose" template
  if (preset === "in_front_of_nose") {
    job.layers = job.layers.map((l) =>
      l.kind === "person"
        ? { ...l, x: 0.88, y: 0.65, scale: Math.min(l.scale, 0.2) }
        : l.kind === "vehicle"
          ? { ...l, x: 0.42, y: 0.55, scale: Math.max(l.scale, 1.05) }
          : l,
    );
  }
  if (preset === "side_only" || preset === "rear_only") {
    job.layers = job.layers.filter((l) => l.kind !== "person");
  }
  return saveCrashJob(job);
}

export function addCrashTake(
  jobId: string,
  opts: {
    buffer: Buffer;
    ext?: string;
    preset?: CrashTake["preset"];
    note?: string;
  },
): { job: CrashJob; take: CrashTake } | null {
  const job = getCrashJob(jobId);
  if (!job) return null;
  const id = newId("ctake");
  const ext = opts.ext || ".png";
  const fileName = `${id}${ext.startsWith(".") ? ext : `.${ext}`}`;
  fs.mkdirSync(jobTakesDir(jobId), { recursive: true });
  fs.writeFileSync(path.join(jobTakesDir(jobId), fileName), opts.buffer);
  const take: CrashTake = {
    id,
    status: "pending",
    fileName,
    preset: opts.preset || job.preset,
    note: opts.note || "",
    createdAt: new Date().toISOString(),
  };
  job.takes = [take, ...job.takes];
  return { job: saveCrashJob(job), take };
}

export function setCrashTakeStatus(
  jobId: string,
  takeId: string,
  status: CrashTake["status"],
): CrashJob | null {
  const job = getCrashJob(jobId);
  if (!job) return null;
  job.takes = job.takes.map((t) =>
    t.id === takeId ? { ...t, status } : t,
  );
  if (status === "approved") job.approvedTakeId = takeId;
  else if (job.approvedTakeId === takeId) {
    const still = job.takes.find((t) => t.status === "approved");
    job.approvedTakeId = still?.id || "";
  }
  return saveCrashJob(job);
}

/** Short locked prompts for AI generate — plain English. */
export function promptForPreset(
  preset: CrashPreset,
  whoName: string,
): string {
  const style =
    "highly detailed stylised 3D animated feature render, clean simplified forms, believable materials, soft overcast lighting, cinematic quality, sharp focus. Not photographic, not a cartoon.";
  if (preset === "side_only") {
    return `${style} Flat side profile of a white coach bus only. Nose on the RIGHT, rear cut off the LEFT. Wet bus terminal, overcast grey. Empty of people. Bus only.`;
  }
  if (preset === "rear_only") {
    return `${style} Camera locked dead behind a white coach bus — rear end only. You see only the back: rear bumper, rear lights, engine door, destination glass at the top if any, twin rear wheels. The side of the bus is completely out of frame — no side windows, no side profile, no three-quarter angle. Straight-on rear view of THIS same white coach. Wet terminal tarmac, soft overcast grey English daylight. Empty of people. Bus rear only.`;
  }
  if (preset === "hell_smash") {
    return `${style} ${whoName || "The asshole"} torn in half by horned demons in volcanic hell — Skidmarks obliteration. Demons with glowing red eyes pulling the body apart. Ash, lava, shredded clothes. Frozen still.`;
  }
  if (preset === "blank") {
    return `${style} Wide cinematic still.`;
  }
  // in_front_of_nose
  return `${style} Wide shot from far away at a wet bus terminal under grey overcast sky. A big white coach bus fills most of the frame, side on, nose pointing right, back end cut off the left. Tiny ${whoName || "person"} stands right in front of the bus nose — in the path of the bus, about to get hit. The person is small. The bus is huge. Terrified. Freeze before impact.`;
}

export function clearCrashVehicles(jobId: string): CrashJob | null {
  const job = getCrashJob(jobId);
  if (!job) return null;
  job.vehicleRefs = [];
  job.approvedVehicleId = "";
  job.layers = job.layers.filter((l) => l.kind !== "vehicle");
  return saveCrashJob(job);
}

export function readCrashTakeBuffer(
  jobId: string,
  takeId: string,
): { buffer: Buffer; ext: string; take: CrashTake } | null {
  const job = getCrashJob(jobId);
  if (!job) return null;
  const take = job.takes.find((t) => t.id === takeId);
  if (!take?.fileName) return null;
  const fp = crashTakePath(jobId, take.fileName);
  if (!fp) return null;
  const ext = path.extname(take.fileName) || ".png";
  return { buffer: fs.readFileSync(fp), ext, take };
}
