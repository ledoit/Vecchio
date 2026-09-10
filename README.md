# Vecchio

Live-synced **text** across your devices — Menhir **Concurrency** line. Same session-code pattern as Strob: create a 4-character room, open it on Mac, Windows, or iOS Safari, and edit one shared textarea (prompts, notes, clipboard-sized state).

**Bookmark:** [https://vecchio-menhir-holdings.vercel.app](https://vecchio-menhir-holdings.vercel.app)

## Stack

- **Next.js** (App Router) on **Vercel** (free hobby tier)
- **PartyKit** (free tier) — WebSocket room per session code
- No accounts; anyone with the code can read and edit

Photos and richer state can layer on later (Blob, Supabase, etc.). v1 is text only.

## Develop

```bash
cd Menhir/Concurrency/Vecchio
pnpm install
cp .env.example .env.local
pnpm dev
```

Next.js: [http://localhost:3000](http://localhost:3000) · PartyKit: port 1999.

Create a session, copy the link, open it in another tab or on your phone (same Wi‑Fi for local PartyKit).

## Deploy

1. **PartyKit** — `pnpm party:deploy` → note host (e.g. `vecchio-party.<user>.partykit.dev`).
2. **Vercel** — import repo, preset Next.js, `pnpm install` / `pnpm build`.
3. Env on Vercel (Production + Preview): `NEXT_PUBLIC_PARTYKIT_HOST=vecchio-party.ledoit.partykit.dev` (no `https://`). Optional server fallback: `PARTYKIT_HOST` with the same value.
4. **Redeploy** the frontend after setting env — `NEXT_PUBLIC_*` is baked at build time.

**Symptom:** Mac shows “Live” (local dev) but iOS/Windows stuck on “Connecting…” on the Vercel URL → env var missing; remote browsers were trying `localhost:1999`.

CLI: `pnpm vercel link` then `pnpm vercel:prod`.

## Why web + PartyKit (not a desktop app)

- Works on **Mac, Windows, and iOS** without separate builds or app-store friction.
- **PWA-ready** — add to home screen on iOS for a pseudo-app.
- Strob already proves this stack in Menhir; Vecchio drops controller/viewer split so every peer is equal (good for moving AI prompts between machines).

A native menubar clip sync tool could be a future complement; it would not replace “open this code on the iPad” as cleanly as a URL.

## Security

Sessions are **unlisted, not secret**: anyone who guesses or sees the 4-character code can read and edit. Do not put passwords or private data you would not paste into a shared doc link.


## License

All Rights Reserved © Menhir Holdings
