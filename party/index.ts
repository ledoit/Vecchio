import type * as Party from "partykit/server";
import {
  createInitialState,
  type ClientMessage,
  type ServerMessage,
  type SessionState,
} from "../src/lib/session-state";

export default class TextSessionServer implements Party.Server {
  private state: SessionState = createInitialState();

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    this.send(conn, this.syncPayload());
  }

  onClose() {
    this.broadcastSync();
  }

  onMessage(raw: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      this.send(sender, { type: "error", message: "Invalid message" });
      return;
    }

    if (msg.type === "clear") {
      this.state = { text: "", updatedAt: Date.now() };
      this.broadcastSync();
      return;
    }

    if (msg.type === "patch") {
      if (typeof msg.text !== "string") {
        this.send(sender, { type: "error", message: "Invalid patch" });
        return;
      }
      const maxLen = 200_000;
      const text = msg.text.length > maxLen ? msg.text.slice(0, maxLen) : msg.text;
      this.state = { text, updatedAt: Date.now() };
      this.broadcastSync();
    }
  }

  private syncPayload(): ServerMessage {
    return {
      type: "sync",
      state: this.state,
      peerCount: [...this.room.getConnections()].length,
    };
  }

  private send(conn: Party.Connection, message: ServerMessage) {
    conn.send(JSON.stringify(message));
  }

  private broadcastSync() {
    this.room.broadcast(JSON.stringify(this.syncPayload()));
  }
}

TextSessionServer satisfies Party.Worker;
