import type { LegacyFeedback } from "@townsquare/contracts/legacy-envelope";
import type { SessionInboundTarget } from "../session-message-target";

export function handleChatMessage(
  target: SessionInboundTarget,
  command: string | undefined,
  params: unknown,
  feedback: LegacyFeedback | undefined,
): boolean {
  switch (command) {
    case "chat":
      target._handleChat(params, feedback);
      return true;
    case "addGroupChat":
      target._handleAddGroupChat(params, feedback);
      return true;
    case "removeGroupChat":
      target._handleRemoveGroupChat(feedback);
      return true;
    case "removeGroupChatMember":
      target._handleRemoveGroupChatMember(params, feedback);
      return true;
    case "avatarReceived":
      target._avatarReceived(params);
      return true;
    default:
      return false;
  }
}
