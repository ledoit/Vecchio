import { NextResponse } from "next/server";
import { getPartyKitHostFromEnv } from "@/lib/partykit-host";

export const dynamic = "force-dynamic";

export function GET() {
  const host = getPartyKitHostFromEnv();
  if (!host) {
    return NextResponse.json(
      { error: "PARTYKIT_HOST not configured" },
      { status: 503 },
    );
  }
  return NextResponse.json({ host });
}
