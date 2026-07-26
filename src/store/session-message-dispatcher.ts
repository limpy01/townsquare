import type { LegacyFeedback } from "@townsquare/contracts/legacy-envelope";
import { handleChatMessage } from "./session-message-handlers/chat";
import { handleConnectionMessage } from "./session-message-handlers/connection";
import { handleGameStateMessage } from "./session-message-handlers/game-state";
import { handlePlayerMessage } from "./session-message-handlers/player";
import { handleVotingMessage } from "./session-message-handlers/voting";
import type { SessionInboundTarget } from "./session-message-target";

export type { SessionInboundTarget } from "./session-message-target";

/** Route v1 input by behavior domain before it reaches the LiveSession target. */
export function dispatchSessionInboundMessage(
  target: SessionInboundTarget,
  command: string | undefined,
  params: unknown,
  feedback: LegacyFeedback | undefined,
): void {
  if (handleConnectionMessage(target, command, params)) return;
  if (handleGameStateMessage(target, command, params)) return;
  if (handlePlayerMessage(target, command, params)) return;
  if (handleVotingMessage(target, command, params)) return;
  handleChatMessage(target, command, params, feedback);
}
