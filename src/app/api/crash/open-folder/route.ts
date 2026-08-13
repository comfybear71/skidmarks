import { NextResponse } from "next/server";
import { execFile, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { MOVIES_ROOT } from "@/lib/paths";

export const runtime = "nodejs";

function resolveUnderMoviesRoot(raw: string): string | null {
  const abs = path.resolve(raw.trim());
  const root = path.resolve(MOVIES_ROOT);
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return abs;
}

function openInExplorer(target: string): Promise<void> {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    // Quote after comma — required when path contains spaces (MY MOVIES).
    return new Promise((resolve, reject) => {
      const child = spawn("explorer.exe", [`/select,"${target}"`], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.on("error", reject);
      child.unref();
      resolve();
    });
  }
  return new Promise((resolve, reject) => {
    execFile("cmd.exe", ["/c", "start", "", target], { windowsHide: true }, (err) =>
      err ? reject(err) : resolve(),
    );
  });
}

/** POST { path } — open folder in Windows Explorer (MY MOVIES only). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { path?: string };
    const abs = body.path ? resolveUnderMoviesRoot(body.path) : null;
    if (!abs) {
      return NextResponse.json(
        { error: "Path must be under MY MOVIES" },
        { status: 400 },
      );
    }
    const target = fs.existsSync(abs)
      ? abs
      : fs.existsSync(path.dirname(abs))
        ? path.dirname(abs)
        : null;
    if (!target) {
      return NextResponse.json({ error: "Folder not found on disk" }, { status: 404 });
    }

    await openInExplorer(target);

    return NextResponse.json({ ok: true, opened: target });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
