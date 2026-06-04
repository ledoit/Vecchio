import {
  isLocalPartyKitHost,
  normalizePartyKitHost,
} from "@/lib/partykit-host";

export function partykitHttpBase(host: string): string {
  const normalized = normalizePartyKitHost(host);
  const protocol = isLocalPartyKitHost(normalized) ? "http" : "https";
  return `${protocol}://${normalized}`;
}

export async function fetchPinnedCodes(host: string): Promise<string[]> {
  const res = await fetch(
    `${partykitHttpBase(host)}/parties/registry/global`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { codes?: string[] };
  return data.codes ?? [];
}

export async function verifySessionPin(
  host: string,
  code: string,
  pin: string,
): Promise<boolean> {
  const res = await fetch(
    `${partykitHttpBase(host)}/parties/main/${code.toUpperCase()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    },
  );
  if (!res.ok) return false;
  const data = (await res.json()) as { ok?: boolean };
  return data.ok === true;
}
