import { NextResponse } from "next/server";
import { readMorphProgress } from "@/lib/morph";

export const runtime = "nodejs";

/** GET — live morph progress while Morph is running */
export async function GET() {
  return NextResponse.json(readMorphProgress());
}
