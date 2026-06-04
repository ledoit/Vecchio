export function normalizePin(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export const PIN_STORAGE_KEY = (code: string) => `vecchio-pin-${code}`;
