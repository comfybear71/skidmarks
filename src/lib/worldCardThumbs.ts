import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import { activePackDir } from "./crashActivePack";
import {
  DEFAULT_SHOW_STYLE,
  SHOW_STYLE_PRESETS,
  type ShowStyleId,
} from "./showStylePresets";
import { parsePlacePromptLabel } from "./worldPlaceTypes";
import type { WorldPlaceTypeId } from "./worldPlaceTypes";

export const WORLD_CARDS_DIR = path.join(CRASH_DIR, "world-cards");

export type WorldCardThumbLabel = {
  name: string;
  brief: string;
  placeType: WorldPlaceTypeId;
};

export function worldCardManifestPath(styleId: ShowStyleId): string {
  return path.join(worldCardGalleryDir(styleId), "manifest.json");
}

export function readWorldCardManifest(
  styleId: ShowStyleId,
): Record<string, WorldCardThumbLabel> {
  const p = worldCardManifestPath(styleId);
  if (!fs.existsSync(p)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Record<
      string,
      WorldCardThumbLabel
    >;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

/** Sorted place names from World cards manifest. */
export function livePlaceNames(styleId: ShowStyleId): string[] {
  const manifest = readWorldCardManifest(styleId);
  return Object.values(manifest)
    .map((l) => l.name?.trim() || "")
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function writeWorldCardManifestLabel(
  styleId: ShowStyleId,
  thumbKey: string,
  label: WorldCardThumbLabel,
): Record<string, WorldCardThumbLabel> {
  ensureWorldCardDirs(styleId);
  const manifest = readWorldCardManifest(styleId);
  manifest[thumbKey] = label;
  fs.writeFileSync(worldCardManifestPath(styleId), JSON.stringify(manifest, null, 2));
  return manifest;
}

export type WorldCardThumbRef = {
  key: string;
  mtime: number;
};

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const SAFE_NAME = /^[\w.\-]+$/;

export function worldCardGalleryDir(styleId: ShowStyleId): string {
  return path.join(WORLD_CARDS_DIR, styleId);
}

export function ensureWorldCardDirs(styleId: ShowStyleId): void {
  for (const d of [WORLD_CARDS_DIR, worldCardGalleryDir(styleId)]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

export function parseWorldCardId(raw: string | null): ShowStyleId | null {
  if (!raw) return null;
  return SHOW_STYLE_PRESETS.some((p) => p.id === raw) ? (raw as ShowStyleId) : null;
}

export function worldCardKeepersPath(styleId: ShowStyleId): string {
  return path.join(worldCardGalleryDir(styleId), "gallery-keepers.json");
}

/** Filenames World tiles may show. Missing file = show all (legacy). Never deletes disk files. */
export function readWorldCardKeepers(styleId: ShowStyleId): string[] | null {
  const p = worldCardKeepersPath(styleId);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as {
      files?: unknown;
    };
    if (!Array.isArray(raw.files)) return null;
    const files = raw.files.filter(
      (f): f is string => typeof f === "string" && SAFE_NAME.test(f),
    );
    return files.length ? files : null;
  } catch {
    return null;
  }
}

export function addWorldCardKeeper(styleId: ShowStyleId, fileName: string): void {
  if (!SAFE_NAME.test(fileName)) return;
  ensureWorldCardDirs(styleId);
  const existing = readWorldCardKeepers(styleId) || [];
  if (existing.includes(fileName)) return;
  const files = [...existing, fileName];
  fs.writeFileSync(
    worldCardKeepersPath(styleId),
    JSON.stringify(
      {
        _comment:
          "World gallery keepers only — other images stay on disk but hidden from World tiles. Never delete files to thin the gallery.",
        files,
      },
      null,
      2,
    ),
  );
}

export function listWorldCardThumbs(styleId: ShowStyleId): WorldCardThumbRef[] {
  const out: WorldCardThumbRef[] = [];
  const galleryDir = worldCardGalleryDir(styleId);
  if (!fs.existsSync(galleryDir)) return out;
  for (const f of fs.readdirSync(galleryDir)) {
    if (f === "manifest.json" || f === "gallery-keepers.json") continue;
    if (!IMAGE_EXT.test(f) || !SAFE_NAME.test(f)) continue;
    out.push({
      key: `g:${f}`,
      mtime: fs.statSync(path.join(galleryDir, f)).mtimeMs,
    });
  }
  out.sort((a, b) => a.mtime - b.mtime);
  return out;
}

/** World UI list — keepers only when gallery-keepers.json exists. */
export function listWorldCardThumbsWithLabels(styleId: ShowStyleId): {
  key: string;
  mtime: number;
  name?: string;
  brief?: string;
  placeType?: WorldPlaceTypeId;
}[] {
  const keepers = readWorldCardKeepers(styleId);
  // Only label keepers (or all if no keepers file) — never auto-promote junk into tiles.
  syncWorldCardManifestFromDisk(styleId, keepers || undefined);
  const manifest = readWorldCardManifest(styleId);
  const all = listWorldCardThumbs(styleId);
  const filtered = keepers
    ? all.filter((t) => keepers.includes(t.key.slice(2)))
    : all;
  return filtered.map((t) => ({
    ...t,
    name: manifest[t.key]?.name,
    brief: manifest[t.key]?.brief,
    placeType: manifest[t.key]?.placeType ?? "social_public",
  }));
}

/** Guess bucket from filename / title — used when placeType was never saved. */
export function guessWorldPlaceType(
  fileName: string,
  title?: string,
): WorldPlaceTypeId {
  const s = `${fileName} ${title || ""}`.toLowerCase();
  if (
    /\b(hell|mars|void|space.?station|dream|unreal|speculative)\b/.test(s)
  ) {
    return "speculative_unreal";
  }
  if (
    /\b(pyramid|ruin|temple|castle|museum|church|cathedral|sacred|historic)\b/.test(
      s,
    )
  ) {
    return "historic_sacred";
  }
  if (
    /\b(park|beach|desert|forest|coast|cliff|sky|bush|gum|roadside|wild|natural)\b/.test(
      s,
    )
  ) {
    return "natural_wild";
  }
  if (
    /\b(bedroom|house|home|flat|kitchen|lounge|hotel|domestic|crack_house)\b/.test(
      s,
    )
  ) {
    return "domestic_private";
  }
  if (
    /\b(street|pavement|alley|car.?park|depot|factory|office|industrial|bank|urban|town)\b/.test(
      s,
    )
  ) {
    return "urban_industrial";
  }
  if (
    /\b(pub|cafe|shop|bar|market|stadium|scout|chip|bus.?shelter)\b/.test(s)
  ) {
    return "social_public";
  }
  return "social_public";
}

/**
 * Ensure listed images have a manifest row + placeType.
 * When `onlyFiles` is set, only those names (World keepers) — never promote the whole disk dump.
 * Does not delete files.
 */
export function syncWorldCardManifestFromDisk(
  styleId: ShowStyleId,
  onlyFiles?: string[],
): void {
  ensureWorldCardDirs(styleId);
  let thumbs = listWorldCardThumbs(styleId);
  if (onlyFiles?.length) {
    const allow = new Set(onlyFiles);
    thumbs = thumbs.filter((t) => allow.has(t.key.slice(2)));
  }
  if (!thumbs.length) return;
  const manifest = readWorldCardManifest(styleId);
  let changed = false;
  for (const t of thumbs) {
    const fileName = t.key.slice(2);
    const prev = manifest[t.key];
    const nice = KEEPER_DISPLAY[fileName];
    const name =
      nice?.name ||
      prev?.name?.trim() ||
      fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
    const guessed =
      nice?.placeType || guessWorldPlaceType(fileName, name);
    if (prev?.placeType && prev.name && !nice) {
      if (
        prev.placeType === "social_public" &&
        guessed !== "social_public"
      ) {
        manifest[t.key] = { ...prev, placeType: guessed };
        changed = true;
      }
      continue;
    }
    const next: WorldCardThumbLabel = {
      name,
      brief: nice?.brief || prev?.brief?.trim() || name,
      placeType: nice?.placeType || prev?.placeType || guessed,
    };
    if (
      !prev ||
      prev.name !== next.name ||
      prev.brief !== next.brief ||
      prev.placeType !== next.placeType
    ) {
      manifest[t.key] = next;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(
      worldCardManifestPath(styleId),
      JSON.stringify(manifest, null, 2),
    );
  }
}

/** Clear titles for known keepers (World tiles). */
const KEEPER_DISPLAY: Record<
  string,
  { name: string; brief: string; placeType: WorldPlaceTypeId }
> = {
  "park.png": {
    name: "Park",
    brief: "Park",
    placeType: "natural_wild",
  },
  "cliff_top_coast_path.png": {
    name: "Cliff top",
    brief: "Cliff top coast path",
    placeType: "natural_wild",
  },
  "place_v3_cafe_1786364969464.png": {
    name: "Cafe strip awning",
    brief: "Cafe strip awning",
    placeType: "social_public",
  },
  "dirty_dog_pub.png": {
    name: "Dirty Dog pub",
    brief: "Dirty Dog pub",
    placeType: "social_public",
  },
  "place_v3_flat_1786364953933.png": {
    name: "Flat",
    brief: "Flat interior",
    placeType: "domestic_private",
  },
  "dap_bedroom.png": {
    name: "Dap bedroom",
    brief: "Dap bedroom",
    placeType: "domestic_private",
  },
  "place_v3_street_1786364960666.png": {
    name: "High street wet",
    brief: "High street wet",
    placeType: "urban_industrial",
  },
  "place_v3_depot_1786364990902.png": {
    name: "Depot",
    brief: "Depot",
    placeType: "urban_industrial",
  },
  "place_v3_hell_1786364997694.png": {
    name: "Hell",
    brief: "Hell",
    placeType: "speculative_unreal",
  },
  "place_v3_shop_1786364984333.png": {
    name: "Shop",
    brief: "Shop",
    placeType: "social_public",
  },
  "place_v3_bank_1786364976692.png": {
    name: "Bank",
    brief: "Bank",
    placeType: "urban_industrial",
  },
  "suburban_street_main.png": {
    name: "Suburban street",
    brief: "Suburban street",
    placeType: "urban_industrial",
  },
};

export function resolveWorldCardThumbPath(
  styleId: ShowStyleId,
  key: string,
): string | null {
  if (!key.startsWith("g:")) return null;
  const f = key.slice(2);
  if (!SAFE_NAME.test(f)) return null;
  const gallery = path.join(worldCardGalleryDir(styleId), f);
  if (fs.existsSync(gallery)) return gallery;
  const pack = activePackDir();
  if (pack) {
    const packPlace = path.join(pack, "images", "places", f);
    if (fs.existsSync(packPlace)) return packPlace;
  }
  return null;
}

function readImageFile(
  filePath: string,
): { buf: Buffer; contentType: string; fileName: string } | null {
  if (!fs.existsSync(filePath)) return null;
  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : "image/png";
  return {
    buf: fs.readFileSync(filePath),
    contentType,
    fileName: path.basename(filePath),
  };
}

export function readWorldCardThumbByKey(
  styleId: ShowStyleId,
  key: string,
): { buf: Buffer; contentType: string; fileName: string } | null {
  const filePath = resolveWorldCardThumbPath(styleId, key);
  if (!filePath) return null;
  return readImageFile(filePath);
}

export function saveGenStillAsWorldCard(opts: {
  genFileName: string;
  styleId: ShowStyleId;
  prompt?: string;
  placeType: WorldPlaceTypeId;
}): {
  thumbPath: string;
  thumbKey: string;
  label?: WorldCardThumbLabel;
} {
  if (!/^[\w.\-]+$/.test(opts.genFileName)) {
    throw new Error("Bad gen file name");
  }
  const src = path.join(CRASH_DIR, "gen", opts.genFileName);
  if (!fs.existsSync(src)) {
    throw new Error("Generated file missing — Generate first");
  }
  ensureWorldCardDirs(opts.styleId);
  const thumbName = `place_${Date.now()}${path.extname(src) || ".png"}`;
  const dest = path.join(worldCardGalleryDir(opts.styleId), thumbName);
  fs.copyFileSync(src, dest);
  const thumbKey = `g:${thumbName}`;
  addWorldCardKeeper(opts.styleId, thumbName);

  let label: WorldCardThumbLabel | undefined;
  const prompt = opts.prompt?.trim();
  if (prompt) {
    const parsed = parsePlacePromptLabel(prompt);
    label = { ...parsed, placeType: opts.placeType };
    writeWorldCardManifestLabel(opts.styleId, thumbKey, label);
  }

  return { thumbPath: dest, thumbKey, label };
}

/** Upload a place PNG from disk / Explorer into the world gallery. */
export function saveUploadAsWorldCard(opts: {
  buffer: Buffer;
  ext: string;
  styleId: ShowStyleId;
  /** Prefer keeping original basename when it already looks like place_*.png */
  preferredFileName?: string;
  name?: string;
  brief?: string;
  placeType?: WorldPlaceTypeId;
}): {
  thumbPath: string;
  thumbKey: string;
  label: WorldCardThumbLabel;
} {
  ensureWorldCardDirs(opts.styleId);
  const ext = opts.ext.startsWith(".") ? opts.ext : `.${opts.ext}`;
  let thumbName = "";
  const preferred = String(opts.preferredFileName || "").trim();
  if (preferred && SAFE_NAME.test(preferred) && IMAGE_EXT.test(preferred)) {
    thumbName = preferred;
  } else {
    thumbName = `place_${Date.now()}${ext || ".png"}`;
  }
  const dest = path.join(worldCardGalleryDir(opts.styleId), thumbName);
  // Same file already in gallery — reuse key, don't duplicate.
  if (!fs.existsSync(dest)) {
    fs.writeFileSync(dest, opts.buffer);
  }
  const thumbKey = `g:${thumbName}`;
  addWorldCardKeeper(opts.styleId, thumbName);
  const existing = readWorldCardManifest(opts.styleId)[thumbKey];
  const parsed = parsePlacePromptLabel(
    opts.brief?.trim() || opts.name?.trim() || thumbName,
  );
  const label: WorldCardThumbLabel = existing || {
    name: opts.name?.trim() || parsed.name || thumbName,
    brief: opts.brief?.trim() || parsed.brief || "",
    placeType: opts.placeType || "social_public",
  };
  writeWorldCardManifestLabel(opts.styleId, thumbKey, label);
  return { thumbPath: dest, thumbKey, label };
}

export function listWorldCardStatus(): {
  id: ShowStyleId;
  hasThumb: boolean;
  thumbs: {
    key: string;
    mtime: number;
    name?: string;
    brief?: string;
    placeType?: WorldPlaceTypeId;
  }[];
}[] {
  return SHOW_STYLE_PRESETS.map((p) => {
    const thumbs = listWorldCardThumbsWithLabels(p.id);
    return {
      id: p.id,
      hasThumb: thumbs.length > 0,
      thumbs,
    };
  });
}

export function defaultWorldCardId(): ShowStyleId {
  return DEFAULT_SHOW_STYLE;
}
