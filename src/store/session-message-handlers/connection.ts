import type { LegacyFeedback } from "@townsquare/contracts/legacy-envelope";
import type { SessionInboundTarget } from "../session-message-target";

export function handleConnectionMessage(
  target: SessionInboundTarget,
  command: string | undefined,
  params: unknown,
): boolean {
  switch (command) {
    case "alertPopup":
      target._alertPopup(params);
      return true;
    case "allowHost":
      target._handleAllowHost(params);
      return true;
    case "allowJoin":
      target._handleAllowJoin(params);
      return true;
    case "getGamestate":
      target.sendGamestate(params);
      return true;
    case "getStId":
      target.sendStId(params);
      return true;
    case "stId":
      target._updateStId(params);
      return true;
    case "claim":
      target._updateSeat(params);
      target._createChatHistory(params);
      return true;
    case "leaveSeat":
      target._updateLeaveSeat();
      return true;
    case "ping":
      target._handlePing(params);
      return true;
    case "pong":
      target._handlePong(params);
      return true;
    case "feedback":
      target._deleteFromQueue(params);
      return true;
    case "bye":
      target._handleBye(params);
      return true;
    default:
      return false;
  }
}
