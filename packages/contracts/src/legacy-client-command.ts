import { z } from "zod";

/**
 * Top-level v1 commands accepted by the WebSocket server. Payloads retain
 * their legacy shapes and are validated by their dedicated command handlers.
 */
export const legacyClientCommandSchema = z.enum([
  "bluff",
  "bootlegger",
  "clearVoteHistory",
  "direct",
  "edition",
  "fabled",
  "firstNight",
  "grimoire",
  "gs",
  "isNight",
  "isReview",
  "isVoteHistoryAllowed",
  "isVoteInProgress",
  "lock",
  "marked",
  "move",
  "nomination",
  "otherNight",
  "ping",
  "player",
  "pronouns",
  "remove",
  "request",
  "secretVote",
  "setTalking",
  "setTimer",
  "stId",
  "startTimer",
  "states",
  "stopTimer",
  "swap",
  "teamsNames",
  "uploadFile",
  "useOldOrder",
  "useOldRole",
  "vote",
  "votingSpeed",
]);

export type LegacyClientCommand = z.infer<typeof legacyClientCommandSchema>;

export function isLegacyClientCommand(
  command: string,
): command is LegacyClientCommand {
  return legacyClientCommandSchema.safeParse(command).success;
}
