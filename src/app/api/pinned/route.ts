import { NextResponse } from "next/server";
import { getPartyKitHostFromEnv } from "@/lib/partykit-host";
import { fetchPinnedCodes } from "@/lib/partykit-http";

export const dynamic = "force-dynamic";

export async function GET() {
  const host = getPartyKitHostFromEnv();
  if (!host) {
    return NextResponse.json({ codes: [] });
  }
  const codes = await fetchPinnedCodes(host);
  return NextResponse.json({ codes });
}
