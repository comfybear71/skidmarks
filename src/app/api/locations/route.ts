import { NextResponse } from "next/server";
import { createLocation, listLocations } from "@/lib/locations";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ locations: listLocations() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    slug?: string;
    notes?: string;
    lookNote?: string;
    characterIds?: string[];
  };
  const name = body.name?.trim() || "New location";
  const slug =
    body.slug?.trim() ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") ||
    "location";
  const location = createLocation({
    name,
    slug,
    notes: body.notes?.trim() || "",
    lookNote: body.lookNote?.trim() || "",
    characterIds: body.characterIds || [],
  });
  return NextResponse.json({ location });
}
