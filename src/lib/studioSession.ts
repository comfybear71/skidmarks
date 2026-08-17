import {
  STUDIO_SESSION_COOKIE,
  findStudioUserById,
  sessionSecret,
  studioUsersConfigured,
  type StudioUser,
} from "./studioUsers";

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return b64url(sig);
}

export type StudioSession = {
  id: string;
  email: string;
  exp: number;
};

export async function signStudioSession(user: StudioUser, ttlMs = 1000 * 60 * 60 * 24 * 30): Promise<string> {
  const exp = Date.now() + ttlMs;
  const body = `${user.id}.${exp}`;
  const sig = await hmac(body);
  return `${body}.${sig}`;
}

export async function verifyStudioSession(token: string | undefined | null): Promise<StudioSession | null> {
  if (!studioUsersConfigured()) return null;
  const raw = String(token || "").trim();
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [id, expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (!id || !Number.isFinite(exp) || exp < Date.now()) return null;
  const expected = await hmac(`${id}.${expRaw}`);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  const user = findStudioUserById(id);
  if (!user) return null;
  return { id: user.id, email: user.email, exp };
}

export function readSessionCookie(cookieHeader: string | null): string {
  if (!cookieHeader) return "";
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === STUDIO_SESSION_COOKIE) return decodeURIComponent(rest.join("=") || "");
  }
  return "";
}

export function sessionCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${STUDIO_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`;
}

export function clearSessionCookieHeader(): string {
  return `${STUDIO_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
