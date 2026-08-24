import fs from "fs";
import path from "path";
import { CRASH_DIR } from "./paths";
import { useCloudStore } from "./cloudEnv";
import { listNeonCastBands, saveNeonCastBand } from "./neonStore";
import type { ShowStyleId } from "./showStylePresets";

/**
 * Saved cast groups ("bands") — a named list of member names on a show, so
 * a recurring cast (e.g. "THE JACK ASH BAND") can be added to a new episode
 * in one tap. This stores the grouping only; faces still come from each
 * name's existing show-level cast card via findReusableCastCards.
 */
export type CastBand = {
  name: string;
  members: string[];
};

export { matchCastBand } from "./castBandMatch";

function localBandsPath(styleId: ShowStyleId): string {
  return path.join(CRASH_DIR, "bands", `${styleId}.json`);
}

function readLocalBands(styleId: ShowStyleId): CastBand[] {
  const fp = localBandsPath(styleId);
  if (!fs.existsSync(fp)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(fp, "utf8")) as Record<string, string[]>;
    return Object.entries(raw)
      .map(([name, members]) => ({ name, members: Array.isArray(members) ? members : [] }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

function writeLocalBand(styleId: ShowStyleId, name: string, members: string[]): void {
  const fp = localBandsPath(styleId);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  const raw: Record<string, string[]> = fs.existsSync(fp)
    ? (JSON.parse(fs.readFileSync(fp, "utf8")) as Record<string, string[]>)
    : {};
  raw[name] = members;
  fs.writeFileSync(fp, JSON.stringify(raw, null, 2));
}

export async function listCastBands(styleId: ShowStyleId): Promise<CastBand[]> {
  if (useCloudStore()) {
    const rows = await listNeonCastBands(styleId);
    return rows.map((r) => ({ name: r.name, members: r.members }));
  }
  return readLocalBands(styleId);
}

export async function saveCastBand(
  styleId: ShowStyleId,
  name: string,
  members: string[],
): Promise<void> {
  const trimmedName = name.trim();
  const trimmedMembers = members.map((m) => m.trim()).filter(Boolean);
  if (!trimmedName || !trimmedMembers.length) {
    throw new Error("Need a band name and at least one cast member");
  }
  if (useCloudStore()) {
    await saveNeonCastBand(styleId, trimmedName, trimmedMembers);
    return;
  }
  writeLocalBand(styleId, trimmedName, trimmedMembers);
}
