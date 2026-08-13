import fs from "fs";
import path from "path";
import { CRASH_DIR } from "@/lib/paths";
import { formatCplateLabel } from "@/lib/cplateLabel";
import { listMorphDraft, morphDraftDir } from "@/lib/morph";

const IMG_EXT = /\.(png|jpe?g|webp)$/i;

export type CrashLabImageSource = "gen" | "draft";

export type CrashLabImage = {
  id: string;
  source: CrashLabImageSource;
  fileName: string;
  url: string;
  label: string;
};

function safeFileName(name: string): boolean {
  return /^[\w.\-]+$/.test(name);
}

export function listCrashGenImages(): CrashLabImage[] {
  const dir = path.join(CRASH_DIR, "gen");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => IMG_EXT.test(n))
    .map((n) => {
      const st = fs.statSync(path.join(dir, n));
      return { n, mtime: st.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime)
    .map(({ n, mtime }) => ({
      id: `gen:${n}`,
      source: "gen" as const,
      fileName: n,
      url: `/api/crash/gen/file?name=${encodeURIComponent(n)}`,
      label: formatCplateLabel(n, mtime),
    }));
}

/** Gen stills + Morph draft tray — images only. */
export function listCrashLabImages(): CrashLabImage[] {
  const gen = listCrashGenImages();
  const draft = listMorphDraft().map((d) => ({
    id: `draft:${d.fileName}`,
    source: "draft" as const,
    fileName: d.fileName,
    url: d.url,
    label: d.fileName.replace(/^step_\d+_/, "").replace(/\.[^.]+$/, "").slice(-20),
  }));
  return [...gen, ...draft];
}

export function readCrashLabImage(
  source: CrashLabImageSource,
  fileName: string,
): { buffer: Buffer; ext: string } | null {
  if (!safeFileName(fileName)) return null;
  const fp =
    source === "gen"
      ? path.join(CRASH_DIR, "gen", fileName)
      : path.join(morphDraftDir(), fileName);
  if (!fs.existsSync(fp) || !IMG_EXT.test(fileName)) return null;
  const ext = path.extname(fileName).toLowerCase() || ".png";
  return { buffer: fs.readFileSync(fp), ext };
}
