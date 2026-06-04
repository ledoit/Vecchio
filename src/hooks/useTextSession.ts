"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import usePartySocket from "partysocket/react";
import {
  getPartyKitHost,
  isLocalPartyKitHost,
} from "@/lib/partykit-host";
import { PIN_STORAGE_KEY, isValidPin, normalizePin } from "@/lib/pin";
import {
  createInitialState,
  type ClientMessage,
  type ServerMessage,
  type SessionState,
} from "@/lib/session-state";

const PATCH_DEBOUNCE_MS = 120;
const CONNECT_TIMEOUT_MS = 12_000;

type UseTextSessionOptions = {
  room: string;
};

type ConnectionStatus = "loading" | "live" | "connecting" | "error";

async function resolvePartyKitHost(): Promise<string> {
  const baked = getPartyKitHost();
  if (baked) return baked;

  if (typeof window === "undefined") return "";

  try {
    const res = await fetch("/api/realtime-host", { cache: "no-store" });
    if (!res.ok) return "";
    const data = (await res.json()) as { host?: string };
    return data.host?.trim() ?? "";
  } catch {
    return "";
  }
}

export function useTextSession({ room }: UseTextSessionOptions) {
  const [state, setState] = useState<SessionState>(createInitialState);
  const [peerCount, setPeerCount] = useState(0);
  const [locked, setLocked] = useState(false);
  const [host, setHost] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const localEditRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTextRef = useRef<string | null>(null);
  const unlockSentRef = useRef(false);

  const sendUnlock = useCallback(
    (socket: { send: (data: string) => void }, pin: string) => {
      const msg: ClientMessage = { type: "unlock", pin: normalizePin(pin) };
      socket.send(JSON.stringify(msg));
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMessage(null);
    setHost(null);
    unlockSentRef.current = false;

    void resolvePartyKitHost().then((resolved) => {
      if (cancelled) return;
      if (!resolved) {
        setStatus("error");
        setErrorMessage(
          "Realtime server is not configured. Set NEXT_PUBLIC_PARTYKIT_HOST on Vercel, then redeploy.",
        );
        return;
      }
      if (
        typeof window !== "undefined" &&
        window.location.protocol === "https:" &&
        isLocalPartyKitHost(resolved)
      ) {
        setStatus("error");
        setErrorMessage(
          "Production site is pointing at a local PartyKit host. Fix NEXT_PUBLIC_PARTYKIT_HOST on Vercel.",
        );
        return;
      }
      setHost(resolved);
      setStatus("connecting");
    });

    return () => {
      cancelled = true;
    };
  }, [room]);

  const socket = usePartySocket({
    host: host ?? "placeholder.partykit.dev",
    room: room.toUpperCase(),
    enabled: Boolean(host),
    onOpen() {
      setStatus("live");
      setErrorMessage(null);
      if (!unlockSentRef.current && typeof window !== "undefined") {
        const stored = sessionStorage.getItem(PIN_STORAGE_KEY(room));
        if (stored && isValidPin(stored)) {
          unlockSentRef.current = true;
          sendUnlock(socket, stored);
        }
      }
    },
    onClose() {
      if (host) setStatus("connecting");
      unlockSentRef.current = false;
    },
    onError() {
      setStatus("error");
      setErrorMessage(
        "Could not connect to the realtime server. Check network/VPN or PartyKit status.",
      );
    },
    onMessage(evt) {
      const data = JSON.parse(evt.data) as ServerMessage;
      if (data.type === "sync") {
        if (!localEditRef.current) {
          setState(data.state);
        }
        setPeerCount(data.peerCount);
        setLocked(data.locked);
      } else if (data.type === "unlocked") {
        setLocked(false);
      } else if (data.type === "error") {
        setErrorMessage(data.message);
      }
    },
  });

  useEffect(() => {
    if (!host || status === "live" || status === "error") return;
    const timer = setTimeout(() => {
      setStatus((current) => {
        if (current !== "connecting") return current;
        setErrorMessage(
          `Still connecting to ${host}. Confirm PartyKit is deployed and env vars are set.`,
        );
        return "error";
      });
    }, CONNECT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [host, status]);

  const flushPatch = useCallback(() => {
    const text = pendingTextRef.current;
    if (text === null || status !== "live" || locked) return;
    pendingTextRef.current = null;
    const msg: ClientMessage = { type: "patch", text };
    socket.send(JSON.stringify(msg));
    localEditRef.current = false;
  }, [socket, status, locked]);

  const setText = useCallback(
    (text: string) => {
      if (locked) return;
      localEditRef.current = true;
      setState((prev) => ({ ...prev, text, updatedAt: Date.now() }));
      pendingTextRef.current = text;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(flushPatch, PATCH_DEBOUNCE_MS);
    },
    [flushPatch, locked],
  );

  const clearText = useCallback(() => {
    if (locked) return;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    pendingTextRef.current = null;
    localEditRef.current = false;
    setState((prev) => ({
      ...createInitialState(),
      pinned: prev.pinned,
      expiresAt: prev.expiresAt,
    }));
    if (status === "live") {
      const msg: ClientMessage = { type: "clear" };
      socket.send(JSON.stringify(msg));
    }
  }, [socket, status, locked]);

  const unlock = useCallback(
    (pin: string) => {
      if (!isValidPin(normalizePin(pin))) {
        setErrorMessage("Enter a 4-digit PIN");
        return;
      }
      const normalized = normalizePin(pin);
      sessionStorage.setItem(PIN_STORAGE_KEY(room), normalized);
      unlockSentRef.current = true;
      sendUnlock(socket, normalized);
    },
    [room, socket, sendUnlock],
  );

  const pinSession = useCallback(
    (pin: string) => {
      if (status !== "live" || locked) return;
      const normalized = normalizePin(pin);
      const msg: ClientMessage = { type: "pin", pin: normalized };
      socket.send(JSON.stringify(msg));
      sessionStorage.setItem(PIN_STORAGE_KEY(room), normalized);
      unlockSentRef.current = true;
      sendUnlock(socket, normalized);
    },
    [socket, status, locked, room, sendUnlock],
  );

  const unpinSession = useCallback(
    (pin: string) => {
      if (status !== "live") return;
      const msg: ClientMessage = { type: "unpin", pin: normalizePin(pin) };
      socket.send(JSON.stringify(msg));
      sessionStorage.removeItem(PIN_STORAGE_KEY(room));
    },
    [socket, status, room],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    localEditRef.current = false;
    pendingTextRef.current = null;
    unlockSentRef.current = false;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, [room]);

  const connected = status === "live";

  return {
    state,
    peerCount,
    connected,
    locked,
    status,
    errorMessage,
    partykitHost: host,
    setText,
    clearText,
    unlock,
    pinSession,
    unpinSession,
    clearError: () => setErrorMessage(null),
  };
}
