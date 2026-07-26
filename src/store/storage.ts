import {
  parseTownsquareStorageVersion,
  townsquareStorageVersion,
  townsquareStorageVersionKey,
} from "@townsquare/contracts/local-storage";

type MutableStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

type StoredValueSchema<T> = {
  safeParse(
    value: unknown,
  ): { success: true; data: T } | { success: false; error: unknown };
};

export function readStoredJson<T>(
  storage: Pick<Storage, "getItem">,
  key: string,
  fallback: T,
): T {
  const raw = storage.getItem(key);
  if (raw === null) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch (_) {
    return fallback;
  }
}

/** Read a JSON value only when it satisfies its versioned persistence contract. */
export function readStoredWithSchema<T>(
  storage: Pick<Storage, "getItem">,
  key: string,
  schema: StoredValueSchema<T>,
): T | null {
  const raw = storage.getItem(key);
  if (raw === null) return null;

  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function readStoredArray(
  storage: Pick<Storage, "getItem">,
  key: string,
): unknown[] {
  const value = readStoredJson<unknown>(storage, key, []);
  return Array.isArray(value) ? value : [];
}

export function readStoredRecord(
  storage: Pick<Storage, "getItem">,
  key: string,
): Record<string, unknown> {
  const value = readStoredJson<unknown>(storage, key, {});
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export const townsquareStorageKeys = [
  "audioThreshold",
  "background",
  "bluffs",
  "chatHistory",
  "claimedSeat",
  "customBootlegger",
  "edition",
  "fabled",
  "firstNight",
  "groupChats",
  "imageOptIn",
  "isGrimoire",
  "isReview",
  "isRole",
  "lastVersion",
  "muted",
  "otherNight",
  "playerAvatar",
  "playerId",
  "playerName",
  "playerProfileImage",
  "playerVotes",
  "players",
  "roles",
  "secretVote",
  "selectedEditions",
  "session",
  "stId",
  "stSecret",
  "states",
  "static",
  "teamsNames",
  townsquareStorageVersionKey,
  "useOldOrder",
  "useOldRole",
  "votes",
  "votesSelected",
  "zoom",
] as const;

/**
 * Apply key-only migrations without parsing or rewriting unrelated legacy
 * values. A failed write leaves the original key untouched for a later retry.
 */
export function migrateTownsquareStorage(storage: MutableStorage): boolean {
  if (
    parseTownsquareStorageVersion(
      storage.getItem(townsquareStorageVersionKey),
    ) >= townsquareStorageVersion
  )
    return false;

  const legacyAvatar = storage.getItem("playerProfileImage");
  const currentAvatar = storage.getItem("playerAvatar");

  try {
    if (legacyAvatar !== null && currentAvatar === null) {
      storage.setItem("playerAvatar", legacyAvatar);
    }
    storage.setItem(
      townsquareStorageVersionKey,
      String(townsquareStorageVersion),
    );
    if (legacyAvatar !== null) storage.removeItem("playerProfileImage");
    return true;
  } catch {
    return false;
  }
}

export function clearTownsquareStorage(storage: Pick<Storage, "removeItem">) {
  townsquareStorageKeys.forEach((key) => storage.removeItem(key));
}
