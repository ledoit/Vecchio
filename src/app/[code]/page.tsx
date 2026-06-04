"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import {
  IconCopy,
  IconEdit,
  IconEye,
  IconPin,
  IconTrash,
} from "@/components/icons";
import { useTextSession } from "@/hooks/useTextSession";
import { isValidPin, normalizePin } from "@/lib/pin";
import { IDLE_EXPIRE_MS } from "@/lib/session-state";
import {
  isValidSessionCode,
  normalizeSessionCode,
} from "@/lib/session-code";

type ViewMode = "edit" | "preview";

const insetIconBtn =
  "inline-flex items-center justify-center rounded-md border border-stone-600 bg-stone-800/95 p-2 text-stone-200 shadow-sm backdrop-blur hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40";

function formatExpiry(expiresAt: number | null): string | null {
  if (expiresAt == null) return null;
  const sec = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  if (sec <= 0) return "expiring…";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function SessionPage() {
  const params = useParams();
  const code = normalizeSessionCode(String(params.code ?? ""));
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [pinDraft, setPinDraft] = useState("");
  const [unlockPin, setUnlockPin] = useState("");
  const [showPinForm, setShowPinForm] = useState(false);
  const [expiryLabel, setExpiryLabel] = useState<string | null>(null);
  const undoSnapshotRef = useRef<string | null>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const unlockInputRef = useRef<HTMLInputElement>(null);

  const {
    state,
    peerCount,
    connected,
    locked,
    status,
    errorMessage,
    setText,
    clearText,
    unlock,
    pinSession,
    unpinSession,
    clearError,
  } = useTextSession({ room: code });

  const sessionUrl = useMemo(() => {
    if (typeof window === "undefined") return `/${code}`;
    return `${window.location.origin}/${code}`;
  }, [code]);

  useEffect(() => {
    if (state.pinned || state.expiresAt == null) {
      setExpiryLabel(null);
      return;
    }
    const tick = () => setExpiryLabel(formatExpiry(state.expiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.pinned, state.expiresAt]);

  const copyText = useCallback(async () => {
    if (!state.text) return;
    try {
      await navigator.clipboard.writeText(state.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [state.text]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sessionUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [sessionUrl]);

  const onDeleteText = useCallback(() => {
    if (!state.text) return;
    undoSnapshotRef.current = state.text;
    clearText();
  }, [clearText, state.text]);

  const undoDelete = useCallback(() => {
    const snapshot = undoSnapshotRef.current;
    if (snapshot === null) return;
    undoSnapshotRef.current = null;
    setText(snapshot);
  }, [setText]);

  const onTextChange = useCallback(
    (text: string) => {
      undoSnapshotRef.current = null;
      setText(text);
    },
    [setText],
  );

  useEffect(() => {
    undoSnapshotRef.current = null;
  }, [code]);

  useEffect(() => {
    if (showPinForm && !locked) {
      pinInputRef.current?.focus();
    }
  }, [showPinForm, locked]);

  useEffect(() => {
    if (locked) {
      unlockInputRef.current?.focus();
    }
  }, [locked]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (locked) return;
      if (!(e.metaKey || e.ctrlKey) || e.key !== "z" || e.shiftKey) return;
      if (undoSnapshotRef.current === null) return;
      e.preventDefault();
      undoDelete();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locked, undoDelete]);

  const onUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    unlock(unlockPin);
  };

  const onPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const pin = normalizePin(pinDraft);
    if (!isValidPin(pin)) return;
    if (state.pinned) {
      unpinSession(pin);
    } else {
      pinSession(pin);
    }
    setShowPinForm(false);
    setPinDraft("");
  };

  const iconBtn =
    "inline-flex items-center justify-center rounded-lg p-2 transition-colors";

  if (!isValidSessionCode(code)) {
    return (
      <main className="flex h-dvh items-center justify-center overflow-hidden overscroll-none bg-stone-900 text-stone-300">
        <div className="text-center">
          <p>Invalid session code.</p>
          <Link href="/" className="mt-4 inline-block text-stone-400 underline">
            Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-dvh max-h-dvh flex-col overflow-hidden overscroll-none bg-stone-900">
      <header className="flex flex-wrap items-center gap-2 border-b border-stone-700 px-4 py-3">
        <Link
          href="/"
          className="text-sm font-medium text-stone-400 hover:text-stone-200"
        >
          Vecchio
        </Link>
        <span className="font-mono text-lg tracking-widest text-stone-100">
          {code}
        </span>
        {state.pinned && (
          <span className="rounded bg-amber-900/50 px-2 py-0.5 text-xs text-amber-200">
            Pinned
          </span>
        )}
        {expiryLabel && (
          <span
            className="text-xs text-stone-500"
            title={`Clears after ${IDLE_EXPIRE_MS / 60000}m with nobody connected`}
          >
            Clears in {expiryLabel}
          </span>
        )}

        <button
          type="button"
          onClick={copyLink}
          className="rounded-lg border border-stone-600 px-2.5 py-1 text-xs text-stone-300 hover:bg-stone-800"
        >
          {linkCopied ? "Link copied" : "Copy link"}
        </button>

        <button
          type="button"
          title={state.pinned ? "Unpin (keeps on home, no auto-clear)" : "Pin to home"}
          aria-label={state.pinned ? "Unpin session" : "Pin session"}
          onClick={() => setShowPinForm((v) => !v)}
          className={`${iconBtn} border border-stone-600 text-stone-300 hover:bg-stone-800 ${state.pinned ? "text-amber-300" : ""}`}
        >
          <IconPin className="h-4 w-4" />
        </button>

        {showPinForm && !locked && (
          <form
            onSubmit={onPinSubmit}
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={pinInputRef}
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinDraft}
              onChange={(e) => setPinDraft(normalizePin(e.target.value))}
              placeholder={state.pinned ? "PIN" : "4-digit PIN"}
              className="w-24 rounded-lg border border-stone-600 bg-stone-900 px-2 py-1 text-center font-mono text-sm tracking-widest text-stone-100 outline-none focus:border-stone-400"
            />
            <button
              type="submit"
              disabled={!isValidPin(normalizePin(pinDraft))}
              className="rounded-lg border border-stone-600 px-2 py-1 text-xs text-stone-200 hover:bg-stone-800 disabled:opacity-40"
            >
              {state.pinned ? "Unpin" : "Pin"}
            </button>
          </form>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            title="Edit"
            aria-label="Edit"
            onClick={() => setViewMode("edit")}
            className={`${iconBtn} ${viewMode === "edit" ? "bg-stone-600 text-stone-50" : "text-stone-400 hover:bg-stone-800"}`}
          >
            <IconEdit className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Preview markdown"
            aria-label="Preview markdown"
            onClick={() => setViewMode("preview")}
            className={`${iconBtn} ${viewMode === "preview" ? "bg-stone-600 text-stone-50" : "text-stone-400 hover:bg-stone-800"}`}
          >
            <IconEye className="h-4 w-4" />
          </button>
        </div>

        <span
          className={`w-full text-right text-xs sm:ml-2 sm:w-auto ${
            connected
              ? "text-emerald-500"
              : status === "error"
                ? "text-red-400"
                : "text-amber-500"
          }`}
        >
          {connected
            ? `Live · ${peerCount} device${peerCount === 1 ? "" : "s"}`
            : status === "loading"
              ? "Loading…"
              : status === "error"
                ? "Offline"
                : "Connecting…"}
        </span>
      </header>

      {errorMessage && (
        <p className="border-b border-red-900/50 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {errorMessage}
        </p>
      )}

      {locked ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <p className="text-stone-300">
            This session is pinned. Enter the 4-digit PIN to continue.
          </p>
          <form
            onSubmit={onUnlockSubmit}
            className="flex w-full max-w-xs flex-col gap-3"
          >
            <input
              ref={unlockInputRef}
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={unlockPin}
              onChange={(e) => setUnlockPin(normalizePin(e.target.value))}
              placeholder="••••"
              className="rounded-lg border border-stone-600 bg-stone-950 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-stone-100 outline-none focus:border-stone-400"
            />
            <button
              type="submit"
              className="rounded-lg bg-stone-600 py-2.5 font-medium text-stone-50 hover:bg-stone-500"
            >
              Unlock
            </button>
          </form>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <div className="session-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-stone-600 bg-stone-950">
            <div className="absolute bottom-3 right-3 z-10 flex gap-1.5">
              <button
                type="button"
                title={copied ? "Copied" : "Copy text"}
                aria-label={copied ? "Copied" : "Copy text"}
                disabled={!state.text}
                onClick={copyText}
                className={insetIconBtn}
              >
                <IconCopy className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Clear text (⌘Z / Ctrl+Z to undo)"
                aria-label="Clear text"
                disabled={!state.text}
                onClick={onDeleteText}
                className={insetIconBtn}
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </div>

            {viewMode === "edit" ? (
              <textarea
                value={state.text}
                onChange={(e) => onTextChange(e.target.value)}
                placeholder="Paste a Cursor answer, prompt, or markdown…"
                spellCheck={false}
                className="min-h-0 flex-1 resize-none border-0 bg-transparent px-4 py-4 pb-[var(--session-inset-pad)] font-mono text-sm leading-relaxed text-stone-100 outline-none focus:ring-0"
              />
            ) : (
              <div
                className="session-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 pb-[var(--session-inset-pad)]"
              >
                <MarkdownPreview content={state.text} />
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
