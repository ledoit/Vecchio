export type SessionState = {
  text: string;
  updatedAt: number;
};

export type ServerMessage =
  | { type: "sync"; state: SessionState; peerCount: number }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "patch"; text: string }
  | { type: "clear" };

export function createInitialState(): SessionState {
  return { text: "", updatedAt: Date.now() };
}
