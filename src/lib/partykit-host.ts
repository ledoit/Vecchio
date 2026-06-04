/** Strip scheme/trailing slash from a PartyKit hostname. */
export function normalizePartyKitHost(raw: string): string {
  return raw
    .trim()
    .replace(/^(https?|wss?):\/\//, "")
    .replace(/\/$/, "");
}

export function getPartyKitHostFromEnv(): string {
  const raw =
    process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? process.env.PARTYKIT_HOST ?? "";
  return raw ? normalizePartyKitHost(raw) : "";
}

/** Client-side: baked NEXT_PUBLIC at build, or localhost when developing. */
export function getPartyKitHost(): string {
  const fromBuild = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  if (fromBuild) return normalizePartyKitHost(fromBuild);

  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "localhost:1999";
    }
  }

  return "";
}

export function isLocalPartyKitHost(host: string): boolean {
  return (
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.")
  );
}
