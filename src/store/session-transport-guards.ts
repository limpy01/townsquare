import { legacySetTalkingPayloadSchema } from "@townsquare/contracts/legacy-client-command";
import type { LegacySetTalkingPayload } from "@townsquare/contracts/legacy-client-command";

export type LegacyRuntimeRole = {
  id: string;
  team?: string;
  [key: string]: unknown;
};

export type ChatOutboxPayload = {
  message: string;
  sendingPlayerId?: string;
  receivingPlayerId: string;
};

export type TargetedDistribution = {
  all?: boolean | undefined;
  role?: string | undefined;
  seatNum?: number | undefined;
  playerId?: string | undefined;
};

export type AddGroupChatPayload = {
  chatId: string;
  players: Array<{ id: string; name?: string | undefined }>;
};

export const gameStatePlayerProperties = [
  "name",
  "id",
  "image",
  "stReminders",
  "isDead",
  "isSecretVoteless",
  "isVoteless",
  "pronouns",
  "votes",
] as const;

export const isLegacyRuntimeRole = (
  value: unknown,
): value is LegacyRuntimeRole =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Record<string, unknown>).id === "string";

export function isChatOutboxPayload(
  value: unknown,
): value is ChatOutboxPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).message === "string" &&
    ((value as Record<string, unknown>).sendingPlayerId === undefined ||
      typeof (value as Record<string, unknown>).sendingPlayerId === "string") &&
    typeof (value as Record<string, unknown>).receivingPlayerId === "string"
  );
}

export function isAddGroupChatPayload(
  value: unknown,
): value is AddGroupChatPayload {
  if (typeof value !== "object" || value === null) return false;
  const payload = value as Record<string, unknown>;
  const players = payload.players;
  return (
    typeof payload.chatId === "string" &&
    Array.isArray(players) &&
    players.every(
      (player) =>
        typeof player === "object" &&
        player !== null &&
        typeof (player as Record<string, unknown>).id === "string",
    )
  );
}

export function isSessionOutboundState(
  value: unknown,
): value is { session: { sessionId: unknown } } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).session === "object" &&
    (value as Record<string, unknown>).session !== null
  );
}

export function parseSetTalkingPayload(
  value: unknown,
): LegacySetTalkingPayload | null {
  const parsed = legacySetTalkingPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const isTimerSeconds = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
