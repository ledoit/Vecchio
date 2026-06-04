"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  generateSessionCode,
  isValidSessionCode,
  normalizeSessionCode,
} from "@/lib/session-code";

export default function HomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createSession = () => {
    const code = generateSessionCode();
    router.push(`/s/${code}`);
  };

  const joinSession = () => {
    const code = normalizeSessionCode(joinCode);
    if (!isValidSessionCode(code)) {
      setError("Enter a 4-character session code (A–Z, 2–9).");
      return;
    }
    setError(null);
    router.push(`/s/${code}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-stone-900 px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-stone-100">
            Vecchio
          </h1>
          <p className="mt-2 text-stone-400">
            Shared text across your devices. Create a session, open the same
            code on another machine, paste a prompt and keep editing in sync.
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
          {error && (
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
      </div>
    </main>
  );
}
