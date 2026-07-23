import type WebSocket from "ws";

import type { LegacyFeedback } from "@townsquare/contracts";

export interface TownSquareSocket extends WebSocket {
  hostDenied: boolean;
  isHost: boolean;
  messageCount: number;
  playerId: string;
  roomId: string;
  windowStartedAt: number;
}

export interface Room {
  host: TownSquareSocket | null;
  hostToken: string | null;
  id: string;
  players: Map<string, TownSquareSocket>;
}

export interface PendingMessage {
  feedback: LegacyFeedback;
  message: unknown;
}
