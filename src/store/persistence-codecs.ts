import { readStoredArray, readStoredRecord } from "./storage";
import type { PersistenceStorage } from "./persistence-types";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const storedRoleId = (role: unknown): string | undefined =>
  isRecord(role) && typeof role.id === "string" ? role.id : undefined;

export const serializeStoredPlayer = (player: unknown) => {
  if (!isRecord(player)) return null;
  const { role, ...storedPlayer } = player;
  return {
    ...storedPlayer,
    role: storedRoleId(role) ?? {},
  };
};

export type LegacyGroupChat = {
  id: string;
  playerIds: string[];
  keep: boolean;
};

export type LegacyRoleState = Record<string, Record<string, unknown>>;

export const readGroupChats = (storage: PersistenceStorage) =>
  readStoredArray(storage, "groupChats").flatMap((group): LegacyGroupChat[] => {
    if (
      !isRecord(group) ||
      typeof group.id !== "string" ||
      !Array.isArray(group.playerIds) ||
      !group.playerIds.every((playerId) => typeof playerId === "string")
    )
      return [];

    return [
      {
        id: group.id,
        playerIds: group.playerIds,
        keep: group.keep === true,
      },
    ];
  });

export const readPlayerIds = (players: unknown): string[] | undefined => {
  if (!Array.isArray(players)) return undefined;
  const playerIds = players.flatMap((player) => {
    if (!isRecord(player) || typeof player.id !== "string") return [];
    return [player.id];
  });
  return playerIds.length === players.length ? playerIds : undefined;
};

export const readLegacyRoleState = (
  storage: PersistenceStorage,
): LegacyRoleState =>
  Object.entries(readStoredRecord(storage, "isRole")).reduce<LegacyRoleState>(
    (roleState, [role, state]) => {
      if (isRecord(state)) roleState[role] = state;
      return roleState;
    },
    {},
  );
