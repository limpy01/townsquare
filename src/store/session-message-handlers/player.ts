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
      if (target._isSpectator) target._store.commit("players/swap", params);
      return true;
    case "move":
      if (target._isSpectator) target._store.commit("players/move", params);
      return true;
    case "remove":
      if (target._isSpectator) target._store.commit("players/remove", params);
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
