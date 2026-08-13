import { NextResponse } from "next/server";
import { hfTokenPresent, hfWhoAmI } from "@/lib/huggingface";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — is HF_TOKEN set and valid? Never returns the token. */
export async function GET() {
  if (!hfTokenPresent()) {
    return NextResponse.json({
      ok: false,
      connected: false,
      error: "Missing HF_TOKEN in MY MOVIES\\.env",
    });
  }

  const result = await hfWhoAmI();
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      connected: false,
      error: result.error,
    });
  }

  return NextResponse.json({
    ok: true,
    connected: true,
    user: result.user.name,
    fullname: result.user.fullname || "",
  });
}
