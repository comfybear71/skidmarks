import { NextResponse } from "next/server";
import {
  listStylePlaceholders,
  placeholderFileUrl,
} from "@/lib/crashPlaceholders";
import {
  DEFAULT_SHOW_STYLE,
  SHOW_STYLE_PRESETS,
  type ShowStyleId,
} from "@/lib/showStylePresets";

export const runtime = "nodejs";

/** GET ?styleId=sunny_banks — preset cast + place slots and whether PNG exists. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("styleId") || DEFAULT_SHOW_STYLE;
  const styleId = (
    SHOW_STYLE_PRESETS.some((p) => p.id === raw) ? raw : DEFAULT_SHOW_STYLE
  ) as ShowStyleId;

  const { cast, places } = listStylePlaceholders(styleId);
  return NextResponse.json({
    styleId,
    cast: cast.map((s) => ({
      ...s,
      url: s.hasImage ? placeholderFileUrl(styleId, "cast", s.id) : null,
    })),
    places: places.map((s) => ({
      ...s,
      url: s.hasImage ? placeholderFileUrl(styleId, "places", s.id) : null,
    })),
    dropPaths: {
      cast: `data/crash/placeholders/${styleId}/cast/{id}.png`,
      places: `data/crash/placeholders/${styleId}/places/{id}.png`,
    },
  });
}
