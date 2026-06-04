"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useTextSession } from "@/hooks/useTextSession";
import {
  isValidSessionCode,
  normalizeSessionCode,
} from "@/lib/session-code";

export default function SessionPage() {
  const params = useParams();
  const code = normalizeSessionCode(String(params.code ?? ""));
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [linkCopied, setLinkCopied] = useState(false);

  const {
    state,
    peerCount,
    connected,
    status,
    errorMessage,
    setText,
    clearText,
  } = useTextSession({
    room: code,
  });

  const sessionUrl = useMemo(() => {
    if (typeof window === "undefined") return `/${code}`;
    return `${window.location.origin}/${code}`;
  }, [code]);

  const copyText = useCallback(async () => {
    if (!state.text) return;
    try {
      await navigator.clipboard.writeText(state.text);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy"), 2000);
    } catch {
      setCopyLabel("Failed");
      setTimeout(() => setCopyLabel("Copy"), 2000);
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

  const onDelete = useCallback(() => {
    if (state.text && !window.confirm("Clear all text in this session?")) {
      return;
    }
    clearText();
  }, [clearText, state.text]);

  if (!isValidSessionCode(code)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-900 text-stone-300">
        <div className="text-center">
          <p>Invalid session code.</p>
          <Link
            href="/"
            className="mt-4 inline-block text-stone-400 underline"
          >
            Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-stone-900">
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-700 px-4 py-3">
        <Link
          href="/"
          className="text-sm font-medium text-stone-400 hover:text-stone-200"
        >
          Vecchio
        </Link>
        <span className="font-mono text-lg tracking-widest text-stone-100">
          {code}
        </span>
        <button
          type="button"
          onClick={copyLink}
          className="rounded-lg border border-stone-600 px-2.5 py-1 text-xs text-stone-300 hover:bg-stone-800"
        >
          {linkCopied ? "Link copied" : "Copy link"}
        </button>
        <span
          className={`ml-auto text-xs ${
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

      <div className="flex flex-1 flex-col gap-3 p-4">
        <textarea
          value={state.text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a prompt, note, or anything you want on every device…"
          spellCheck={false}
          className="min-h-[50vh] flex-1 resize-y rounded-xl border border-stone-600 bg-stone-950 p-4 font-mono text-sm leading-relaxed text-stone-100 outline-none focus:border-stone-400"
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyText}
            disabled={!state.text}
            className="rounded-lg bg-stone-600 px-4 py-2 text-sm font-medium text-stone-50 hover:bg-stone-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copyLabel}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-900/80 bg-red-950/50 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-900/40"
          >
            Delete
          </button>
        </div>
      </div>
    </main>
  );
}
