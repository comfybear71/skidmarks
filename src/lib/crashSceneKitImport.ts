import path from "path";
import {
  addCastFace,
  addCastMember,
  getCastMember,
  setCastFaceStatus,
  updateCastMember,
} from "./episodeCast";
import {
  addLocationPlate,
  createLocation,
  getLocation,
  saveLocation,
  setLocationPlateStatus,
} from "./locations";
import { getEpisode } from "./store";
import {
  parseStyleCardId,
  readStyleCardManifest,
  readStyleCardThumbByKey,
} from "./styleCardThumbs";
import type { Episode, Location } from "./types";
import {
  parseWorldCardId,
  readWorldCardManifest,
  readWorldCardThumbByKey,
} from "./worldCardThumbs";

function extFromFileName(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return ".jpg";
  if (ext === ".webp") return ".webp";
  return ".png";
}

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Copy a Crash style-card face into episode cast (match by name, lock face). */
export function importStyleCardIntoEpisodeCast(opts: {
  episodeId: string;
  styleId: string;
  thumbKey: string;
  name?: string;
  approve?: boolean;
}): { episode: Episode; castId: string; attemptId: string; created: boolean } {
  const ep = getEpisode(opts.episodeId);
  if (!ep) throw new Error("Episode not found");
  const styleId = parseStyleCardId(opts.styleId);
  if (!styleId) throw new Error("Bad show style");
  const thumbKey = String(opts.thumbKey || "").trim();
  if (!thumbKey) throw new Error("Need thumb key");

  const file = readStyleCardThumbByKey(styleId, thumbKey);
  if (!file) throw new Error("Crash face missing — lock it in Crash Lab first");

  const manifest = readStyleCardManifest(styleId);
  const label = manifest[thumbKey];
  const name =
    opts.name?.trim() ||
    label?.name?.trim() ||
    "Crash cast";
  const brief = label?.brief?.trim() || "";

  const existing = (ep.cast || []).find(
    (c) => normName(c.name) === normName(name),
  );
  let castId = existing?.id || "";
  let created = false;
  let episode = ep;

  if (!castId) {
    const next = addCastMember(opts.episodeId, {
      name,
      roleNote: brief,
    });
    if (!next) throw new Error("Could not add cast");
    episode = next;
    const added = (next.cast || []).find(
      (c) => normName(c.name) === normName(name),
    );
    if (!added) throw new Error("Cast add failed");
    castId = added.id;
    created = true;
  } else if (brief) {
    const m = getCastMember(opts.episodeId, castId);
    if (m && !(m.roleNote || "").trim()) {
      const patched = updateCastMember(opts.episodeId, castId, {
        roleNote: brief,
      });
      if (patched) episode = patched;
    }
  }

  const face = addCastFace(opts.episodeId, castId, {
    note: `Crash Lab · ${styleId} · ${thumbKey}`,
    buffer: file.buf,
    ext: extFromFileName(file.fileName),
    styleRealism: 60,
    source: "upload",
  });
  if (!face) throw new Error("Could not copy face");

  let attemptId = face.attempt.id;
  episode = face.episode;
  if (opts.approve !== false) {
    const locked = setCastFaceStatus(
      opts.episodeId,
      castId,
      attemptId,
      "approved",
    );
    if (locked) episode = locked;
  }

  return { episode, castId, attemptId, created };
}

/** Copy a Crash world-card place into Location Lab (create place or add to room). */
export function importWorldCardIntoLocation(opts: {
  styleId: string;
  thumbKey: string;
  locationId?: string;
  roomId?: string;
  name?: string;
  characterIds?: string[];
  approve?: boolean;
}): {
  location: Location;
  roomId: string;
  attemptId: string;
  createdLocation: boolean;
} {
  const styleId = parseWorldCardId(opts.styleId);
  if (!styleId) throw new Error("Bad show style");
  const thumbKey = String(opts.thumbKey || "").trim();
  if (!thumbKey) throw new Error("Need thumb key");

  const file = readWorldCardThumbByKey(styleId, thumbKey);
  if (!file) throw new Error("Crash place missing — lock it in Crash Lab first");

  const manifest = readWorldCardManifest(styleId);
  const label = manifest[thumbKey];
  const name =
    opts.name?.trim() ||
    label?.name?.trim() ||
    "Crash place";
  const brief = label?.brief?.trim() || "";

  let location: Location | null = null;
  let roomId = "";
  let createdLocation = false;

  if (opts.locationId?.trim()) {
    location = getLocation(opts.locationId.trim());
    if (!location) throw new Error("Place not found");
    roomId =
      opts.roomId?.trim() ||
      location.rooms[0]?.id ||
      "";
    if (!roomId) throw new Error("Place has no room");
  } else {
    location = createLocation({
      name,
      slug:
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "") || "crash_place",
      lookNote: brief,
      notes: `Imported from Crash Lab (${styleId})`,
      characterIds: opts.characterIds?.filter(Boolean) || [],
    });
    createdLocation = true;
    roomId = location.rooms[0]?.id || "";
    if (!roomId) throw new Error("New place missing room");
    if (brief) {
      location = saveLocation({
        ...location,
        rooms: location.rooms.map((r, i) =>
          i === 0 ? { ...r, lookNote: brief, name: r.name || "Main" } : r,
        ),
      });
    }
  }

  const plate = addLocationPlate(location.id, {
    roomId,
    note: `Crash Lab · ${styleId} · ${thumbKey}`,
    buffer: file.buf,
    ext: extFromFileName(file.fileName),
    styleRealism: 60,
    source: "upload",
  });
  if (!plate) throw new Error("Could not copy place plate");

  let attemptId = plate.attempt.id;
  location = plate.location;
  if (opts.approve !== false) {
    const locked = setLocationPlateStatus(
      location.id,
      roomId,
      attemptId,
      "approved",
    );
    if (locked) location = locked;
  }

  return { location, roomId, attemptId, createdLocation };
}
