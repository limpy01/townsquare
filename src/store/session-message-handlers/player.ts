import type { SessionInboundTarget } from "../session-message-target";

export function handlePlayerMessage(
  target: SessionInboundTarget,
  command: string | undefined,
  params: unknown,
): boolean {
  switch (command) {
    case "player":
      target._updatePlayer(params);
      return true;
    case "swap":
      if (target._isSpectator) target.applyIncomingPlayerSwap(params);
      return true;
    case "move":
      if (target._isSpectator) target.applyIncomingPlayerMove(params);
      return true;
    case "remove":
      if (target._isSpectator) target.applyIncomingPlayerRemove(params);
      return true;
    case "pronouns":
      target._updatePlayerPronouns(params);
      return true;
    case "setTalking":
      target._handleSetTalking(params);
      return true;
    default:
      return false;
  }
}
