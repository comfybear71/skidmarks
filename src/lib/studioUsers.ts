/**
 * Allowlisted people. Emails + passwords live in env — whoever is listed
 * can sign in. First entry owns every existing untagged pack (Stuie).
 *
 * STUDIO_USERS=you@x.com:password,mum@x.com:otherpassword
 *
 * Dynamic env lookup — Next 16 inlines process.env.NAME at build time.
 */

export const HOME_OWNER_ID = "stuie";
export const STUDIO_OWNER_HEADER = "x-studio-owner";
export const STUDIO_SESSION_COOKIE = "skidmarks_studio";

function env(name: string): string {
  return String(process.env[name] || "").trim();
}

export type StudioUser = {
  id: string;
  email: string;
  password: string;
};

function slugFromEmail(email: string): string {
  const local = email.split("@")[0] || email;
  return (
    local
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || HOME_OWNER_ID
  );
}

/** First listed person is the home account — existing Neon/Blob stays theirs. */
export function parseStudioUsers(): StudioUser[] {
  const raw = env("STUDIO_USERS");
  if (!raw) return [];
  const seen = new Set<string>();
  const out: StudioUser[] = [];
  for (const part of raw.split(",")) {
    const chunk = part.trim();
    if (!chunk) continue;
    const colon = chunk.indexOf(":");
    if (colon < 1) continue;
    const email = chunk.slice(0, colon).trim().toLowerCase();
    const password = chunk.slice(colon + 1);
    if (!email || !email.includes("@") || !password) continue;
    let id = slugFromEmail(email);
    if (seen.has(id)) id = `${id}-${out.length + 1}`;
    seen.add(id);
    out.push({ id, email, password });
  }
  return out;
}

export function studioUsersConfigured(): boolean {
  return parseStudioUsers().length > 0;
}

export function homeOwnerId(): string {
  return parseStudioUsers()[0]?.id || HOME_OWNER_ID;
}

export function isHomeOwner(ownerId: string | undefined | null): boolean {
  const id = (ownerId || "").trim() || HOME_OWNER_ID;
  return id === homeOwnerId() || id === HOME_OWNER_ID;
}

export function findStudioUserByEmail(email: string): StudioUser | null {
  const want = email.trim().toLowerCase();
  return parseStudioUsers().find((u) => u.email === want) || null;
}

export function findStudioUserById(id: string): StudioUser | null {
  return parseStudioUsers().find((u) => u.id === id) || null;
}

export function sessionSecret(): string {
  return env("STUDIO_SESSION_SECRET") || env("STUDIO_USERS") || "skidmarks-local";
}

export function passwordsMatch(expected: string, got: string): boolean {
  const enc = new TextEncoder();
  const a = enc.encode(String(expected || ""));
  const b = enc.encode(String(got || ""));
  const len = Math.max(a.length, b.length, 1);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a[i] || 0) ^ (b[i] || 0);
  }
  return diff === 0;
}

export function isStudioPublicPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/login") return true;
  if (p === "/api/studio/login") return true;
  if (p === "/api/studio/logout") return true;
  if (p === "/api/studio/me") return true;
  return false;
}
