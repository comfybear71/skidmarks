import { NextResponse } from "next/server";
import { listCharacters } from "@/lib/characters";
import {
  cursorCastKeys,
  pickNextCursorGag,
} from "@/lib/cursorGagCatalog";
import type { CursorPopulateConfig } from "@/lib/cursorPopulateTypes";
import { parseStyleCardId } from "@/lib/styleCardThumbs";

export const runtime = "nodejs";

const JUNK_NAME =
  /^(character|cast\s*\d*|untitled|file|still|image|photo|download|jum)$/i;

function isRealCastName(name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  if (JUNK_NAME.test(n)) return false;
  return true;
}

function castNamesFromConfig(cfg: CursorPopulateConfig): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const shot of cfg.shotPlans) {
    for (const n of shot.cast) {
      const name = String(n || "").trim();
      if (!isRealCastName(name) || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

function approvedLabNames(): string[] {
  return listCharacters()
    .filter((c) => c.approved)
    .map((c) => c.name.trim())
    .filter(isRealCastName);
}

/** GET ?styleId= — cast names for CURSOR smoke (Lab approved + gag). No junk. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const styleId = parseStyleCardId(url.searchParams.get("styleId"));
  if (!styleId) {
    return NextResponse.json({ error: "Need styleId" }, { status: 400 });
  }

  const next = pickNextCursorGag(styleId);
  const gagLabel = next?.campaignLabel || "Next test gag";
  const fromGag = next ? castNamesFromConfig(next.config) : [];
  const fromLab = approvedLabNames();
  const fromKeys = Object.keys(cursorCastKeys(styleId)).filter(isRealCastName);

  // Gag cast first (episode), then Lab approved, then preset keys. Never default main to Idea leftovers.
  const seen = new Set<string>();
  const castNames: string[] = [];
  for (const n of [...fromGag, ...fromLab, ...fromKeys]) {
    if (seen.has(n)) continue;
    seen.add(n);
    castNames.push(n);
  }

  const mainName = fromGag[0] || fromLab[0] || castNames[0] || "";

  return NextResponse.json({
    ok: true,
    styleId,
    gagLabel,
    mainName,
    castNames,
    remaining: Boolean(next),
  });
}
