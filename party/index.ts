import type * as Party from "partykit/server";
import { hashPin, isValidPin, normalizePin, verifyPin } from "./lib/pin";
import {
  createInitialState,
  IDLE_EXPIRE_MS,
  type ClientMessage,
  type ServerMessage,
  type SessionState,
} from "../src/lib/session-state";

type RoomMeta = {
  pinHash: string | null;
};

type ConnState = {
  unlocked: boolean;
};

const STATE_KEY = "state";
const META_KEY = "meta";

export default class TextSessionServer implements Party.Server {
  private state: SessionState = createInitialState();
  private meta: RoomMeta = { pinHash: null };

  constructor(readonly room: Party.Room) {}

  async onStart() {
    const saved = await this.room.storage.get<SessionState>(STATE_KEY);
    const savedMeta = await this.room.storage.get<RoomMeta>(META_KEY);
    if (saved) this.state = saved;
    if (savedMeta) this.meta = savedMeta;
  }

  async onConnect(conn: Party.Connection) {
    conn.setState({ unlocked: !this.state.pinned });
    await this.room.storage.deleteAlarm();
    this.send(conn, this.syncPayload(conn));
  }

  async onClose() {
    this.broadcastSync();
    await this.maybeScheduleExpiry();
  }

  async onAlarm() {
    if (this.state.pinned) return;
    const peers = [...this.room.getConnections()];
    if (peers.length > 0) return;

    this.state = createInitialState();
    this.meta = { pinHash: null };
    await this.room.storage.delete(STATE_KEY);
    await this.room.storage.delete(META_KEY);
    await this.removeFromRegistry();
  }

  async onRequest(req: Party.Request) {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    const body = (await req.json()) as { pin?: string };
    const pin = normalizePin(body.pin ?? "");
    if (!isValidPin(pin) || !this.meta.pinHash) {
      return Response.json({ ok: false }, { status: 401 });
    }
    const ok = await verifyPin(this.room.id, pin, this.meta.pinHash);
    return Response.json({ ok });
  }

  async onMessage(raw: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      this.send(sender, { type: "error", message: "Invalid message" });
      return;
    }

    if (msg.type === "unlock") {
      await this.handleUnlock(sender, msg.pin);
      return;
    }

    if (msg.type === "pin") {
      await this.handlePin(sender, msg.pin);
      return;
    }

    if (msg.type === "unpin") {
      await this.handleUnpin(sender, msg.pin);
      return;
    }

    if (!this.isAuthorized(sender)) {
      this.send(sender, { type: "error", message: "PIN required" });
      return;
    }

    if (msg.type === "clear") {
      this.state = { ...createInitialState(), pinned: this.state.pinned };
      if (this.state.pinned) this.state.expiresAt = null;
      await this.persist();
      this.broadcastSync();
      return;
    }

    if (msg.type === "patch") {
      if (typeof msg.text !== "string") {
        this.send(sender, { type: "error", message: "Invalid patch" });
        return;
      }
      const maxLen = 200_000;
      const text =
        msg.text.length > maxLen ? msg.text.slice(0, maxLen) : msg.text;
      this.state = {
        ...this.state,
        text,
        updatedAt: Date.now(),
        expiresAt: this.state.pinned ? null : this.state.expiresAt,
      };
      await this.persist();
      this.broadcastSync();
    }
  }

  private async handleUnlock(sender: Party.Connection, rawPin: string) {
    const pin = normalizePin(rawPin);
    if (!this.state.pinned || !this.meta.pinHash) {
      sender.setState({ unlocked: true });
      this.send(sender, { type: "unlocked" });
      this.send(sender, this.syncPayload(sender));
      return;
    }
    if (!isValidPin(pin) || !(await verifyPin(this.room.id, pin, this.meta.pinHash))) {
      this.send(sender, { type: "error", message: "Wrong PIN" });
      return;
    }
    sender.setState({ unlocked: true });
    this.send(sender, { type: "unlocked" });
    this.send(sender, this.syncPayload(sender));
  }

  private async handlePin(sender: Party.Connection, rawPin: string) {
    if (!this.isAuthorized(sender)) {
      this.send(sender, { type: "error", message: "PIN required" });
      return;
    }
    const pin = normalizePin(rawPin);
    if (!isValidPin(pin)) {
      this.send(sender, { type: "error", message: "PIN must be 4 digits" });
      return;
    }
    this.meta.pinHash = await hashPin(this.room.id, pin);
    this.state = { ...this.state, pinned: true, expiresAt: null };
    await this.room.storage.deleteAlarm();
    await this.persist();
    await this.addToRegistry();
    sender.setState({ unlocked: true });
    this.broadcastSync();
  }

  private async handleUnpin(sender: Party.Connection, rawPin: string) {
    const pin = normalizePin(rawPin);
    if (!this.meta.pinHash || !isValidPin(pin)) {
      this.send(sender, { type: "error", message: "Wrong PIN" });
      return;
    }
    if (!(await verifyPin(this.room.id, pin, this.meta.pinHash))) {
      this.send(sender, { type: "error", message: "Wrong PIN" });
      return;
    }
    this.meta.pinHash = null;
    this.state = { ...this.state, pinned: false, expiresAt: null };
    await this.persist();
    await this.removeFromRegistry();
    sender.setState({ unlocked: true });
    this.broadcastSync();
    await this.maybeScheduleExpiry();
  }

  private isAuthorized(conn: Party.Connection): boolean {
    if (!this.state.pinned) return true;
    const s = conn.state as ConnState | null;
    return s?.unlocked === true;
  }

  private syncPayload(conn: Party.Connection): ServerMessage {
    const peerCount = [...this.room.getConnections()].length;
    return {
      type: "sync",
      state: this.publicState(peerCount),
      peerCount,
      locked: this.state.pinned && !this.isAuthorized(conn),
    };
  }

  private publicState(peerCount: number): SessionState {
    const expiresAt =
      this.state.pinned || peerCount > 0 ? null : this.state.expiresAt;
    return { ...this.state, expiresAt };
  }

  private async persist() {
    await this.room.storage.put(STATE_KEY, this.state);
    await this.room.storage.put(META_KEY, this.meta);
  }

  private async maybeScheduleExpiry() {
    if (this.state.pinned) return;
    const peers = [...this.room.getConnections()];
    if (peers.length > 0) {
      this.state.expiresAt = null;
      await this.persist();
      return;
    }
    const expiresAt = Date.now() + IDLE_EXPIRE_MS;
    this.state.expiresAt = expiresAt;
    await this.room.storage.setAlarm(expiresAt);
    await this.persist();
    this.broadcastSync();
  }

  private async registryFetch(
    path: string,
    init?: RequestInit,
  ): Promise<Response> {
    return this.room.context.parties.registry.get("global").fetch(path, init);
  }

  private async addToRegistry() {
    const res = await this.registryFetch("/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: this.room.id }),
    });
    if (!res.ok) {
      console.error("registry add failed", this.room.id, await res.text());
    }
  }

  private async removeFromRegistry() {
    await this.registryFetch("/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: this.room.id }),
    });
  }

  private send(conn: Party.Connection, message: ServerMessage) {
    conn.send(JSON.stringify(message));
  }

  private broadcastSync() {
    const peerCount = [...this.room.getConnections()].length;
    for (const conn of this.room.getConnections()) {
      const payload: ServerMessage = {
        type: "sync",
        state: this.publicState(peerCount),
        peerCount,
        locked: this.state.pinned && !this.isAuthorized(conn),
      };
      conn.send(JSON.stringify(payload));
    }
  }
}

TextSessionServer satisfies Party.Worker;
