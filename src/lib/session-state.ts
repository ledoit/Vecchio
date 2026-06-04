export const IDLE_EXPIRE_MS = 5 * 60 * 1000;

export type SessionState = {
  text: string;
  updatedAt: number;
  pinned: boolean;
  /** When the room will clear if still empty; null when pinned or while peers connected */
  expiresAt: number | null;
};

export type ServerMessage =
  | {
      type: "sync";
      state: SessionState;
      peerCount: number;
      locked: boolean;
    }
  | { type: "unlocked" }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "patch"; text: string }
  | { type: "clear" }
  | { type: "pin"; pin: string }
  | { type: "unpin"; pin: string }
  | { type: "unlock"; pin: string };

export function createInitialState(): SessionState {
  return {
    text: "",
    updatedAt: Date.now(),
    pinned: false,
    expiresAt: null,
  };
}
