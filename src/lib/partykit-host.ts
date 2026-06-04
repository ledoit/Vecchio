export function getPartyKitHost(): string {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  if (host) return host;
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "localhost:1999";
  }
  return "localhost:1999";
}
