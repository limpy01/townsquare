import type { SessionInboundTarget } from "../session-message-target";

export function handleGameStateMessage(
  target: SessionInboundTarget,
  command: string | undefined,
  params: unknown,
): boolean {
  switch (command) {
    case "edition":
      target._updateEdition(params);
      return true;
    case "states":
      target._updateStates(params);
      return true;
    case "teamsNames":
      target._updateTeamsNames(params);
      return true;
    case "firstNight":
      target._updateFirstNight(params);
      return true;
    case "otherNight":
      target._updateOtherNight(params);
      return true;
    case "fabled":
      target._updateFabled(params);
      return true;
    case "syncPlayersStatus":
      target._handleSyncPlayerStatus(params);
      return true;
    case "gs":
      target._updateGamestate(params);
      return true;
    case "bluff":
      target._updateBluff(params);
      return true;
    case "grimoire":
      target._updateGrimoire(params);
      return true;
    case "isRole":
      target._updateIsRole(params);
      return true;
    case "usingRole":
      target._updateUsingRole(params);
      return true;
    default:
      return false;
  }
}
