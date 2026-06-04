export function normalizePin(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export async function hashPin(roomId: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${roomId}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPin(
  roomId: string,
  pin: string,
  storedHash: string,
): Promise<boolean> {
  const hash = await hashPin(roomId, normalizePin(pin));
  return hash === storedHash;
}
