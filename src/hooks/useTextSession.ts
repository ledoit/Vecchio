"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import usePartySocket from "partysocket/react";
import {
  getPartyKitHost,
  isLocalPartyKitHost,
} from "@/lib/partykit-host";
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
  const [host, setHost] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const localEditRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTextRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMessage(null);
    setHost(null);

    void resolvePartyKitHost().then((resolved) => {
      if (cancelled) return;
      if (!resolved) {
        setStatus("error");
        setErrorMessage(
          "Realtime server is not configured. Set NEXT_PUBLIC_PARTYKIT_HOST (or PARTYKIT_HOST) on Vercel to your PartyKit host, e.g. vecchio-party.ledoit.partykit.dev, then redeploy.",
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
          "This site is using a local PartyKit host, which other devices cannot reach. Set NEXT_PUBLIC_PARTYKIT_HOST to vecchio-party.ledoit.partykit.dev on Vercel and redeploy.",
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
    },
    onClose() {
      if (host) setStatus("connecting");
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
      }
    },
  });

  useEffect(() => {
    if (!host || status === "live" || status === "error") return;
    const timer = setTimeout(() => {
      setStatus((current) => {
        if (current !== "connecting") return current;
        setErrorMessage(
          `Still connecting to ${host}. If this persists, confirm NEXT_PUBLIC_PARTYKIT_HOST on Vercel matches your PartyKit deploy.`,
        );
        return "error";
      });
    }, CONNECT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [host, status]);

  const flushPatch = useCallback(() => {
    const text = pendingTextRef.current;
    if (text === null || status !== "live") return;
    pendingTextRef.current = null;
    const msg: ClientMessage = { type: "patch", text };
    socket.send(JSON.stringify(msg));
    localEditRef.current = false;
  }, [socket, status]);

  const setText = useCallback(
    (text: string) => {
      localEditRef.current = true;
      setState((prev) => ({ ...prev, text, updatedAt: Date.now() }));
      pendingTextRef.current = text;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(flushPatch, PATCH_DEBOUNCE_MS);
    },
    [flushPatch],
  );

  const clearText = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    pendingTextRef.current = null;
    localEditRef.current = false;
    setState(createInitialState());
    if (status === "live") {
      const msg: ClientMessage = { type: "clear" };
      socket.send(JSON.stringify(msg));
    }
  }, [socket, status]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    localEditRef.current = false;
    pendingTextRef.current = null;
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
    status,
    errorMessage,
    partykitHost: host,
    setText,
    clearText,
  };
}
