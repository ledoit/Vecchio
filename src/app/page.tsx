"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { isValidPin, normalizePin, PIN_STORAGE_KEY } from "@/lib/pin";
import {
  generateSessionCode,
  isValidSessionCode,
  normalizeSessionCode,
} from "@/lib/session-code";

export default function HomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pinnedCodes, setPinnedCodes] = useState<string[]>([]);
  const [selectedPinned, setSelectedPinned] = useState<string | null>(null);
  const [pinnedPin, setPinnedPin] = useState("");
  const [pinnedLoading, setPinnedLoading] = useState(false);
  const pinnedPinInputRef = useRef<HTMLInputElement>(null);

  const loadPinned = useCallback(() => {
    void fetch("/api/pinned", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { codes?: string[] }) => setPinnedCodes(data.codes ?? []))
      .catch(() => setPinnedCodes([]));
  }, []);

  useEffect(() => {
    loadPinned();
    const onFocus = () => loadPinned();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadPinned]);

  useEffect(() => {
    if (selectedPinned) {
      pinnedPinInputRef.current?.focus();
    }
  }, [selectedPinned]);

  const createSession = () => {
    const code = generateSessionCode();
    router.push(`/${code}`);
  };

  const joinSession = () => {
    const code = normalizeSessionCode(joinCode);
    if (!isValidSessionCode(code)) {
      setError("Enter a 4-character session code (A–Z, 2–9).");
      return;
    }
    setError(null);
    router.push(`/${code}`);
  };

  const openPinned = useCallback(
    async (code: string) => {
      const pin = normalizePin(pinnedPin);
      if (!isValidPin(pin)) {
        setError("Enter the 4-digit PIN for this pinned session.");
        return;
      }
      setPinnedLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/pinned/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, pin }),
        });
        const data = (await res.json()) as { ok?: boolean };
        if (!data.ok) {
          setError("Wrong PIN for that session.");
          return;
        }
        sessionStorage.setItem(PIN_STORAGE_KEY(code), pin);
        router.push(`/${code}`);
      } catch {
        setError("Could not verify PIN.");
      } finally {
        setPinnedLoading(false);
      }
    },
    [pinnedPin, router],
  );

  return (
    <main className="flex h-dvh max-h-dvh flex-col items-center justify-center overflow-y-auto overscroll-none bg-stone-900 px-4 py-10">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-stone-100">
            Vecchio
          </h1>
          <p className="mt-2 text-stone-400">
            Shared text across devices. Unpinned rooms clear after 5 minutes
            empty; pinned rooms stay on the home page and never auto-clear.
          </p>
        </div>

        <button
          type="button"
          onClick={createSession}
          className="w-full rounded-xl bg-stone-600 py-3 text-lg font-semibold text-stone-50 hover:bg-stone-500"
        >
          Create session
        </button>

        <div className="space-y-3 rounded-xl border border-stone-700 bg-stone-950 p-4">
          <label
            htmlFor="code"
            className="block text-left text-sm text-stone-400"
          >
            Session code
          </label>
          <input
            id="code"
            value={joinCode}
            onChange={(e) =>
              setJoinCode(normalizeSessionCode(e.target.value))
            }
            maxLength={4}
            placeholder="ABCD"
            className="w-full rounded-lg border border-stone-600 bg-stone-900 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-stone-100 uppercase outline-none focus:border-stone-400"
            onKeyDown={(e) => {
              if (e.key === "Enter") joinSession();
            }}
          />
          {error && !selectedPinned && (
            <p className="text-left text-sm text-red-400">{error}</p>
          )}
          <button
            type="button"
            onClick={joinSession}
            className="w-full rounded-lg border border-stone-600 py-2.5 text-sm font-medium text-stone-100 hover:bg-stone-800"
          >
            Join session
          </button>
        </div>

        {pinnedCodes.length === 0 && (
          <p className="text-center text-xs text-stone-600">
            No pinned sessions yet. Pin a room from its toolbar (local dev: run{" "}
            <code className="text-stone-500">pnpm dev</code> so PartyKit registry
            works).
          </p>
        )}

        {pinnedCodes.length > 0 && (
          <div className="space-y-3 rounded-xl border border-amber-900/40 bg-stone-950 p-4 text-left">
            <p className="text-sm font-medium text-amber-200/90">
              Pinned sessions
            </p>
            <p className="text-xs text-stone-500">
              Pinned rooms need a PIN to open (from here or via the room link).
            </p>
            <ul className="flex flex-wrap gap-2">
              {pinnedCodes.map((code) => (
                <li key={code}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPinned(code);
                      setPinnedPin("");
                      setError(null);
                    }}
                    className={`rounded-lg border px-3 py-1.5 font-mono text-sm tracking-widest ${
                      selectedPinned === code
                        ? "border-amber-600 bg-amber-950/50 text-amber-100"
                        : "border-stone-600 text-stone-300 hover:bg-stone-800"
                    }`}
                  >
                    {code}
                  </button>
                </li>
              ))}
            </ul>
            {selectedPinned && (
              <div className="flex flex-col gap-2 pt-1">
                <input
                  ref={pinnedPinInputRef}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinnedPin}
                  onChange={(e) => setPinnedPin(normalizePin(e.target.value))}
                  placeholder="PIN"
                  className="w-full rounded-lg border border-stone-600 bg-stone-900 px-4 py-2 text-center font-mono text-xl tracking-[0.5em] text-stone-100 outline-none focus:border-stone-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void openPinned(selectedPinned);
                  }}
                />
                {error && (
                  <p className="text-sm text-red-400">{error}</p>
                )}
                <button
                  type="button"
                  disabled={pinnedLoading || !isValidPin(normalizePin(pinnedPin))}
                  onClick={() => void openPinned(selectedPinned)}
                  className="w-full rounded-lg bg-amber-800/80 py-2 text-sm font-medium text-amber-50 hover:bg-amber-700/80 disabled:opacity-40"
                >
                  {pinnedLoading ? "Checking…" : `Open ${selectedPinned}`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
