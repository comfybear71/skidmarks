import { NextResponse } from "next/server";
import { seedDap } from "@/lib/seedDap";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = seedDap();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
