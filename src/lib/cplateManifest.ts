import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import { formatCplateLabel } from "./cplateLabel";
import type { ShowStyleId } from "./showStylePresets";

export type CplateMeta = {
  fileName: string;
  styleId?: ShowStyleId;
  castNames: string[];
  placeName?: string;
  people: number;
  createdAt: number;
};

const MANIFEST = path.join(CRASH_DIR, "gen", "cplate-manifest.json");

export function readCplateManifest(): Record<string, CplateMeta> {
  if (!fs.existsSync(MANIFEST)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Record<string, CplateMeta>;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function saveCplateMeta(meta: Omit<CplateMeta, "createdAt"> & { createdAt?: number }): void {
  const dir = path.dirname(MANIFEST);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const manifest = readCplateManifest();
  manifest[meta.fileName] = {
    ...meta,
    placeName: meta.placeName?.trim().slice(0, 36),
    createdAt: meta.createdAt ?? Date.now(),
  };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
}

/** "Margot + Andrew · Pyramid · 8 Aug 5:41 am" or fallback to timestamp tag */
export function formatCplateDisplayName(fileName: string, mtime?: number): string {
  const meta = readCplateManifest()[fileName];
  if (meta) {
    const who =
      meta.castNames.length > 0
        ? meta.castNames.length > 4
          ? `${meta.castNames.slice(0, 3).join(" + ")} + ${meta.castNames.length - 3} more`
          : meta.castNames.join(" + ")
        : meta.people === 1
          ? "1 person"
          : `${meta.people} people`;
    const where = meta.placeName?.trim() ? ` · ${meta.placeName.trim()}` : "";
    const when = new Date(meta.createdAt || mtime || 0).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return `${who}${where} · ${when}`;
  }
  return formatCplateLabel(fileName, mtime);
}

export function getCplateMeta(fileName: string): CplateMeta | null {
  return readCplateManifest()[fileName] ?? null;
}

/** Hide a plate from the dropdown — file moved to gen/retired/, not deleted. */
export function retireCplate(fileName: string): boolean {
  if (!/^cplate_[\w.\-]+\.(png|jpe?g|webp)$/i.test(fileName)) return false;
  const genDir = path.join(CRASH_DIR, "gen");
  const src = path.join(genDir, fileName);
  if (!fs.existsSync(src)) return false;
  const retiredDir = path.join(genDir, "retired");
  if (!fs.existsSync(retiredDir)) fs.mkdirSync(retiredDir, { recursive: true });
  fs.renameSync(src, path.join(retiredDir, fileName));
  const manifest = readCplateManifest();
  delete manifest[fileName];
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  return true;
}
