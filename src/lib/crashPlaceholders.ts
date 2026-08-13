import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import {
  getShowStylePreset,
  type PresetCharacter,
  type PresetPlace,
  type ShowStyleId,
} from "./showStylePresets";

export type PlaceholderKind = "cast" | "places";

export type PlaceholderSlot = {
  id: string;
  name: string;
  hint: string;
  hasImage: boolean;
  fileName?: string;
};

function slotDir(styleId: ShowStyleId, kind: PlaceholderKind): string {
  return path.join(CRASH_DIR, "placeholders", styleId, kind);
}

export function ensurePlaceholderDirs(styleId: ShowStyleId): void {
  for (const kind of ["cast", "places"] as const) {
    const d = slotDir(styleId, kind);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

function findSlotFile(
  styleId: ShowStyleId,
  kind: PlaceholderKind,
  id: string,
): { filePath: string; fileName: string } | null {
  if (!/^[\w-]+$/.test(id)) return null;
  const dir = slotDir(styleId, kind);
  for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
    const fileName = `${id}${ext}`;
    const filePath = path.join(dir, fileName);
    if (fs.existsSync(filePath)) return { filePath, fileName };
  }
  return null;
}

export function placeholderFileUrl(
  styleId: ShowStyleId,
  kind: PlaceholderKind,
  id: string,
): string | null {
  const hit = findSlotFile(styleId, kind, id);
  if (!hit) return null;
  const q = new URLSearchParams({
    styleId,
    kind,
    id,
    name: hit.fileName,
  });
  return `/api/crash/placeholders/file?${q.toString()}`;
}

function mapSlots(
  styleId: ShowStyleId,
  kind: PlaceholderKind,
  defs: PresetCharacter[] | PresetPlace[],
): PlaceholderSlot[] {
  return defs.map((d) => {
    const hit = findSlotFile(styleId, kind, d.id);
    return {
      id: d.id,
      name: d.name,
      hint: "lookHint" in d ? d.lookHint : d.hint,
      hasImage: Boolean(hit),
      fileName: hit?.fileName,
    };
  });
}

export function listStylePlaceholders(styleId: ShowStyleId): {
  cast: PlaceholderSlot[];
  places: PlaceholderSlot[];
} {
  ensurePlaceholderDirs(styleId);
  const preset = getShowStylePreset(styleId);
  return {
    cast: mapSlots(styleId, "cast", preset.presetCast),
    places: mapSlots(styleId, "places", preset.presetPlaces),
  };
}

export function readPlaceholderFile(
  styleId: ShowStyleId,
  kind: PlaceholderKind,
  id: string,
): { buf: Buffer; contentType: string } | null {
  const hit = findSlotFile(styleId, kind, id);
  if (!hit) return null;
  const ext = path.extname(hit.fileName).toLowerCase();
  const contentType =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : "image/png";
  return { buf: fs.readFileSync(hit.filePath), contentType };
}
