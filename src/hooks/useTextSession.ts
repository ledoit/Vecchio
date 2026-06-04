"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import usePartySocket from "partysocket/react";
import { getPartyKitHost } from "@/lib/partykit-host";
import {
  createInitialState,
  type ClientMessage,
  type ServerMessage,
  type SessionState,
} from "@/lib/session-state";

const PATCH_DEBOUNCE_MS = 120;

type UseTextSessionOptions = {
  room: string;
};

export function useTextSession({ room }: UseTextSessionOptions) {
  const [state, setState] = useState<SessionState>(createInitialState);
  const [peerCount, setPeerCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const localEditRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTextRef = useRef<string | null>(null);

  const socket = usePartySocket({
    host: getPartyKitHost(),
    room: room.toUpperCase(),
    onOpen() {
      setConnected(true);
    },
    onClose() {
      setConnected(false);
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

  const flushPatch = useCallback(() => {
    const text = pendingTextRef.current;
    if (text === null) return;
    pendingTextRef.current = null;
    const msg: ClientMessage = { type: "patch", text };
    socket.send(JSON.stringify(msg));
    localEditRef.current = false;
  }, [socket]);

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
    const msg: ClientMessage = { type: "clear" };
    socket.send(JSON.stringify(msg));
  }, [socket]);

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

  return { state, peerCount, connected, setText, clearText };
}
