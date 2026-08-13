import fs from "fs";
import path from "path";
import { DATA_DIR, LOCATIONS_DIR, LOCATIONS_FILE } from "./paths";
import { retireDir, retireFile } from "./retire";
import type {
  Location,
  LocationPlateAttempt,
  LocationRef,
  Room,
} from "./types";
import { emptyLocation, emptyLocationPlate, emptyRoom, newId } from "./types";

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(LOCATIONS_DIR))
    fs.mkdirSync(LOCATIONS_DIR, { recursive: true });
  if (!fs.existsSync(LOCATIONS_FILE)) {
    fs.writeFileSync(
      LOCATIONS_FILE,
      JSON.stringify({ locations: [] }, null, 2),
    );
  }
}

function roomPlatesDir(locId: string, roomId: string) {
  return path.join(LOCATIONS_DIR, locId, "rooms", roomId, "plates");
}
function roomParkedDir(locId: string, roomId: string) {
  return path.join(LOCATIONS_DIR, locId, "rooms", roomId, "parked");
}
function roomRefsDir(locId: string, roomId: string) {
  return path.join(LOCATIONS_DIR, locId, "rooms", roomId, "refs");
}
function houseRefsDir(locId: string) {
  return path.join(LOCATIONS_DIR, locId, "refs");
}
/** Legacy flat plates folder (pre-rooms) */
function legacyPlatesDir(locId: string) {
  return path.join(LOCATIONS_DIR, locId, "plates");
}

function normalizeRoom(r: Room): Room {
  return {
    ...r,
    references: r.references || [],
    plateAttempts: (r.plateAttempts || []).map((a) => ({
      ...a,
      styleRealism: a.styleRealism ?? 60,
      source: a.source || (a.fileName ? "upload" : "text"),
    })),
  };
}

function normalize(l: Location): Location {
  let rooms = (l.rooms || []).map(normalizeRoom);

  // Migrate old single-plate locations into a Main room
  if (
    rooms.length === 0 &&
    (l.plateAttempts?.length || l.approvedPlateId)
  ) {
    rooms = [
      normalizeRoom(
        emptyRoom({
          name: "Main",
          notes: l.notes || "",
          lookNote: l.lookNote || "",
          plateAttempts: l.plateAttempts || [],
          approvedPlateId: l.approvedPlateId || "",
          approved: Boolean(
            l.approvedPlateId ||
              (l.plateAttempts || []).some((a) => a.status === "approved"),
          ),
          references: [],
        }),
      ),
    ];
  }

  const approved = rooms.some((r) => r.approved);
  return {
    ...l,
    characterIds: l.characterIds || [],
    references: l.references || [],
    plateAttempts: [],
    approvedPlateId: "",
    rooms,
    approved,
  };
}

export function listLocations(): Location[] {
  ensure();
  const raw = JSON.parse(fs.readFileSync(LOCATIONS_FILE, "utf8")) as {
    locations: Location[];
  };
  return (raw.locations || [])
    .map(normalize)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getLocation(id: string): Location | null {
  return listLocations().find((l) => l.id === id) ?? null;
}

export function saveLocation(location: Location): Location {
  ensure();
  const all = listLocations();
  const next = normalize({
    ...location,
    updatedAt: new Date().toISOString(),
  });
  const idx = all.findIndex((l) => l.id === next.id);
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  fs.writeFileSync(
    LOCATIONS_FILE,
    JSON.stringify({ locations: all }, null, 2),
  );
  return next;
}

export function createLocation(partial?: Partial<Location>): Location {
  const l = emptyLocation(partial);
  fs.mkdirSync(houseRefsDir(l.id), { recursive: true });
  // Default first room so Generate has a target
  const room = emptyRoom({ name: "Main", lookNote: l.lookNote || "" });
  l.rooms = [room];
  fs.mkdirSync(roomPlatesDir(l.id, room.id), { recursive: true });
  return saveLocation(l);
}

export function deleteLocation(id: string): boolean {
  ensure();
  const all = listLocations().filter((l) => l.id !== id);
  fs.writeFileSync(
    LOCATIONS_FILE,
    JSON.stringify({ locations: all }, null, 2),
  );
  retireDir(path.join(LOCATIONS_DIR, id));
  return true;
}

export function addRoom(
  locationId: string,
  partial?: Partial<Room>,
): { location: Location; room: Room } | null {
  const l = getLocation(locationId);
  if (!l) return null;
  const room = emptyRoom(partial);
  fs.mkdirSync(roomPlatesDir(locationId, room.id), { recursive: true });
  fs.mkdirSync(roomRefsDir(locationId, room.id), { recursive: true });
  l.rooms = [...l.rooms, room];
  return { location: saveLocation(l), room };
}

export function updateRoom(
  locationId: string,
  roomId: string,
  patch: Partial<Room>,
): Location | null {
  const l = getLocation(locationId);
  if (!l) return null;
  l.rooms = l.rooms.map((r) =>
    r.id === roomId
      ? normalizeRoom({
          ...r,
          ...patch,
          id: roomId,
          updatedAt: new Date().toISOString(),
        })
      : r,
  );
  return saveLocation(l);
}

export function deleteRoom(locationId: string, roomId: string): Location | null {
  const l = getLocation(locationId);
  if (!l) return null;
  if (l.rooms.length <= 1) {
    throw new Error("Keep at least one room");
  }
  retireDir(path.join(LOCATIONS_DIR, locationId, "rooms", roomId));
  l.rooms = l.rooms.filter((r) => r.id !== roomId);
  return saveLocation(l);
}

export function getRoom(locationId: string, roomId: string): Room | null {
  const l = getLocation(locationId);
  return l?.rooms.find((r) => r.id === roomId) ?? null;
}

export function addLocationRef(
  locationId: string,
  opts: { buffer: Buffer; ext?: string; label?: string; roomId?: string },
): { location: Location; reference: LocationRef } | null {
  const l = getLocation(locationId);
  if (!l) return null;
  const id = newId("lref");
  const ext = opts.ext || ".png";
  const fileName = `${id}${ext.startsWith(".") ? ext : `.${ext}`}`;
  const dir = opts.roomId
    ? roomRefsDir(locationId, opts.roomId)
    : houseRefsDir(locationId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), opts.buffer);
  const reference: LocationRef = {
    id,
    fileName,
    label: opts.label?.trim() || fileName,
    createdAt: new Date().toISOString(),
  };
  if (opts.roomId) {
    l.rooms = l.rooms.map((r) =>
      r.id === opts.roomId
        ? { ...r, references: [reference, ...r.references] }
        : r,
    );
  } else {
    l.references = [reference, ...l.references];
  }
  return { location: saveLocation(l), reference };
}

export function locationRefPath(
  locationId: string,
  fileName: string,
  roomId?: string,
): string | null {
  if (
    !fileName ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  )
    return null;
  const l = getLocation(locationId);
  const candidates = roomId
    ? [
        path.join(roomRefsDir(locationId, roomId), fileName),
        path.join(houseRefsDir(locationId), fileName),
      ]
    : [
        path.join(houseRefsDir(locationId), fileName),
        ...(l?.rooms.map((r) =>
          path.join(roomRefsDir(locationId, r.id), fileName),
        ) || []),
      ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Remove a reference image (room or house level). File archived with location data stays on disk if unlink fails. */
export function removeLocationRef(
  locationId: string,
  refId: string,
): Location | null {
  const l = getLocation(locationId);
  if (!l) return null;
  let fileName = "";
  let roomId: string | undefined;
  const house = l.references.find((r) => r.id === refId);
  if (house) {
    fileName = house.fileName;
    l.references = l.references.filter((r) => r.id !== refId);
  } else {
    for (const r of l.rooms) {
      const hit = r.references.find((x) => x.id === refId);
      if (hit) {
        fileName = hit.fileName;
        roomId = r.id;
        break;
      }
    }
    if (!fileName) return null;
    l.rooms = l.rooms.map((r) =>
      r.id === roomId
        ? { ...r, references: r.references.filter((x) => x.id !== refId) }
        : r,
    );
  }
  const fp = locationRefPath(locationId, fileName, roomId);
  if (fp) {
    try {
      fs.unlinkSync(fp);
    } catch {
      /* keep going — metadata removed */
    }
  }
  return saveLocation(l);
}

export function locationPlatePath(
  locationId: string,
  fileName: string,
  roomId?: string,
): string | null {
  if (
    !fileName ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  )
    return null;
  const candidates: string[] = [];
  if (roomId) {
    candidates.push(path.join(roomPlatesDir(locationId, roomId), fileName));
    candidates.push(path.join(roomParkedDir(locationId, roomId), fileName));
  }
  candidates.push(path.join(legacyPlatesDir(locationId), fileName));
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Copy plate into room parked/ so regen / supersede never loses a keeper. */
function copyPlateToParked(
  locationId: string,
  roomId: string,
  fileName: string,
) {
  if (!fileName) return;
  const src = path.join(roomPlatesDir(locationId, roomId), fileName);
  if (!fs.existsSync(src)) return;
  const dir = roomParkedDir(locationId, roomId);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, fileName);
  if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
}

export function addLocationPlate(
  locationId: string,
  opts: {
    roomId: string;
    note?: string;
    buffer?: Buffer;
    ext?: string;
    styleRealism?: number;
    source?: LocationPlateAttempt["source"];
  },
): { location: Location; attempt: LocationPlateAttempt; room: Room } | null {
  const l = getLocation(locationId);
  if (!l) return null;
  const room = l.rooms.find((r) => r.id === opts.roomId);
  if (!room) return null;
  const style = Math.max(
    0,
    Math.min(100, Number(opts.styleRealism ?? 60) || 60),
  );
  const attempt = emptyLocationPlate({
    note: opts.note?.trim() || "",
    styleRealism: style,
    source: opts.source || (opts.buffer ? "upload" : "text"),
  });
  const dir = roomPlatesDir(locationId, opts.roomId);
  fs.mkdirSync(dir, { recursive: true });
  if (opts.buffer?.length) {
    const ext = opts.ext || ".png";
    attempt.fileName = `${attempt.id}${ext.startsWith(".") ? ext : `.${ext}`}`;
    fs.writeFileSync(path.join(dir, attempt.fileName), opts.buffer);
  }
  room.plateAttempts = [attempt, ...room.plateAttempts];
  room.updatedAt = new Date().toISOString();
  l.rooms = l.rooms.map((r) => (r.id === room.id ? room : r));
  return { location: saveLocation(l), attempt, room };
}

export function setLocationPlateStatus(
  locationId: string,
  roomId: string,
  attemptId: string,
  status: LocationPlateAttempt["status"],
  reason = "",
): Location | null {
  const l = getLocation(locationId);
  if (!l) return null;
  l.rooms = l.rooms.map((room) => {
    if (room.id !== roomId) return room;
    const plateAttempts = room.plateAttempts.map((a) => {
      if (a.id !== attemptId) {
        // New lock — old favourite goes to parked, not the bin
        if (status === "approved" && a.status === "approved") {
          if (a.fileName) copyPlateToParked(locationId, roomId, a.fileName);
          return {
            ...a,
            status: "parked" as const,
            reason: a.reason || "Parked — superseded by new lock",
          };
        }
        return a;
      }
      if (status === "parked" && a.fileName) {
        copyPlateToParked(locationId, roomId, a.fileName);
      }
      return {
        ...a,
        status,
        reason:
          status === "rejected" || status === "parked" ? reason || a.reason : "",
      };
    });
    let approvedPlateId = room.approvedPlateId;
    let approved = room.approved;
    if (status === "approved") {
      approvedPlateId = attemptId;
      approved = true;
    } else if (approvedPlateId === attemptId) {
      const still = plateAttempts.find((a) => a.status === "approved");
      approvedPlateId = still?.id || "";
      approved = Boolean(still);
    }
    return {
      ...room,
      plateAttempts,
      approvedPlateId,
      approved,
      updatedAt: new Date().toISOString(),
    };
  });
  return saveLocation(l);
}

export function deleteLocationPlate(
  locationId: string,
  roomId: string,
  attemptId: string,
): Location | null {
  const l = getLocation(locationId);
  if (!l) return null;
  const room = l.rooms.find((r) => r.id === roomId);
  const gone = room?.plateAttempts.find((a) => a.id === attemptId);
  if (gone?.status === "parked") {
    throw new Error(
      "Parked plates stay forever. Re-Approve if you want it locked again.",
    );
  }
  l.rooms = l.rooms.map((r) => {
    if (r.id !== roomId) return r;
    const target = r.plateAttempts.find((a) => a.id === attemptId);
    if (target?.fileName) {
      retireFile(
        path.join(roomPlatesDir(locationId, roomId), target.fileName),
      );
    }
    const plateAttempts = r.plateAttempts.filter((a) => a.id !== attemptId);
    const approvedPlateId =
      r.approvedPlateId === attemptId ? "" : r.approvedPlateId;
    return {
      ...r,
      plateAttempts,
      approvedPlateId,
      approved: plateAttempts.some((a) => a.status === "approved"),
      updatedAt: new Date().toISOString(),
    };
  });
  return saveLocation(l);
}
