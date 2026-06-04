import type * as Party from "partykit/server";

const STORAGE_KEY = "codes";

export default class RegistryServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  async onRequest(req: Party.Request) {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const codes = (await this.room.storage.get<string[]>(STORAGE_KEY)) ?? [];
      return Response.json({ codes: codes.sort() });
    }

    if (req.method === "POST" && url.pathname.endsWith("/add")) {
      const body = (await req.json()) as { code?: string };
      const code = body.code?.trim().toUpperCase();
      if (!code || code.length !== 4) {
        return Response.json({ error: "Invalid code" }, { status: 400 });
      }
      const codes = (await this.room.storage.get<string[]>(STORAGE_KEY)) ?? [];
      if (!codes.includes(code)) {
        codes.push(code);
        await this.room.storage.put(STORAGE_KEY, codes);
      }
      return Response.json({ ok: true });
    }

    if (req.method === "POST" && url.pathname.endsWith("/remove")) {
      const body = (await req.json()) as { code?: string };
      const code = body.code?.trim().toUpperCase();
      if (!code) {
        return Response.json({ error: "Invalid code" }, { status: 400 });
      }
      const codes = (await this.room.storage.get<string[]>(STORAGE_KEY)) ?? [];
      await this.room.storage.put(
        STORAGE_KEY,
        codes.filter((c) => c !== code),
      );
      return Response.json({ ok: true });
    }

    return new Response("Not found", { status: 404 });
  }
}

RegistryServer satisfies Party.Worker;
