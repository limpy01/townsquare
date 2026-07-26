import {
  persistedBooleanSchema,
  persistedFiniteNumberSchema,
  persistedSeatSchema,
  persistedSelectedEditionsSchema,
  persistedSessionSchema,
  persistedStringRecordSchema,
  persistedUseOldOrderSchema,
  persistedUseOldRoleSchema,
} from "@townsquare/contracts/local-storage";
import { rolesJSONbyId } from "./selectors";
import {
  readStoredArray,
  readStoredJson,
  readStoredRecord,
  readStoredWithSchema,
} from "./storage";
import {
  isRecord,
  readGroupChats,
  readLegacyRoleState,
} from "./persistence-codecs";
import type { PersistenceStorage, PersistenceStore } from "./persistence-types";

export function hydratePersistence(
  store: PersistenceStore,
  storage: PersistenceStorage,
): void {
  const lastVersion = storage.getItem("lastVersion");
  if (lastVersion) store.commit("setLastVersion", lastVersion);
  const background = storage.getItem("background");
  if (background) store.commit("setBackground", background);
  if (storage.getItem("muted")) store.commit("toggleMuted", true);
  if (storage.getItem("static")) store.commit("toggleStatic", true);
  if (storage.getItem("imageOptIn")) store.commit("toggleImageOptIn", true);
  const zoom = storage.getItem("zoom");
  if (zoom) store.commit("setZoom", parseFloat(zoom));
  const audioThreshold = storage.getItem("audioThreshold");
  if (audioThreshold) store.commit("setAudioThreshold", audioThreshold);
  if (storage.getItem("isGrimoire")) store.commit("toggleGrimoire", false);

  const useOldOrder = readStoredWithSchema(
    storage,
    "useOldOrder",
    persistedUseOldOrderSchema,
  );
  if (useOldOrder) store.commit("session/setUseOldOrder", useOldOrder);
  const useOldRole = readStoredWithSchema(
    storage,
    "useOldRole",
    persistedUseOldRoleSchema,
  );
  if (useOldRole) store.commit("session/setUseOldRole", useOldRole);
  const isReview = readStoredWithSchema(
    storage,
    "isReview",
    persistedBooleanSchema,
  );
  if (isReview !== null) store.commit("session/setIsReview", isReview);
  const selectedEditions = readStoredWithSchema(
    storage,
    "selectedEditions",
    persistedSelectedEditionsSchema,
  );
  if (selectedEditions) store.commit("setSelectedEditions", selectedEditions);

  if (storage.getItem("roles") !== null) {
    store.commit("setCustomRoles", readStoredArray(storage, "roles"));
    store.commit("setEdition", { id: "custom" });
  }
  if (storage.getItem("states"))
    store.commit("setStates", readStoredArray(storage, "states"));
  const teamsNames = readStoredWithSchema(
    storage,
    "teamsNames",
    persistedStringRecordSchema,
  );
  if (teamsNames) store.commit("setTeamsNames", teamsNames);
  if (storage.getItem("firstNight"))
    store.commit("setFirstNight", readStoredArray(storage, "firstNight"));
  if (storage.getItem("otherNight"))
    store.commit("setOtherNight", readStoredArray(storage, "otherNight"));
  if (storage.getItem("edition") !== null)
    store.commit("setEdition", readStoredRecord(storage, "edition"));
  if (storage.getItem("bluffs") !== null) {
    readStoredArray(storage, "bluffs").forEach((role, index) => {
      const roleId = typeof role === "string" ? role : "";
      store.commit("players/setBluff", {
        index,
        role: store.state.roles?.get(roleId) || {},
      });
    });
  }
  if (storage.getItem("fabled") !== null) {
    store.commit("players/setFabled", {
      fabled: readStoredArray(storage, "fabled"),
      emptyFabled: true,
    });
  }
  if (storage.getItem("players")) {
    store.commit(
      "players/set",
      readStoredArray(storage, "players")
        .filter(isRecord)
        .map((player) => {
          const roleId = typeof player.role === "string" ? player.role : "";
          return {
            ...player,
            role:
              store.state.roles?.get(roleId) || rolesJSONbyId.get(roleId) || {},
          };
        }),
    );
  }

  const scalarSessions = [
    ["playerId", "session/setPlayerId"],
    ["stSecret", "session/setStSecret"],
    ["playerName", "session/setPlayerName"],
    ["stId", "session/setStId"],
  ] as const;
  scalarSessions.forEach(([key, command]) => {
    const value = storage.getItem(key);
    if (value) store.commit(command, value);
  });
  const storedClaimedSeat = storage.getItem("claimedSeat");
  if (storedClaimedSeat !== null) {
    const claimedSeat = persistedSeatSchema.safeParse(
      Number(storedClaimedSeat),
    );
    if (claimedSeat.success)
      store.commit("session/claimSeat", claimedSeat.data);
  }
  const session = readStoredWithSchema(
    storage,
    "session",
    persistedSessionSchema,
  );
  if (session) {
    const [spectator, sessionId] = session;
    store.commit("session/setSpectator", spectator);
    store.commit("session/setSessionId", sessionId);
  }
  const playerVotes = readStoredWithSchema(
    storage,
    "playerVotes",
    persistedFiniteNumberSchema,
  );
  if (playerVotes !== null) store.commit("session/setPlayerVotes", playerVotes);
  if (storage.getItem("votes")) {
    readStoredArray(storage, "votes")
      .filter(isRecord)
      .forEach((vote) => {
        store.commit("session/addVotes", vote);
      });
  }
  if (storage.getItem("votesSelected")) {
    readStoredArray(storage, "votesSelected").forEach((vote) => {
      store.commit("session/addVoteSelected", vote);
    });
  }
  if (storage.getItem("customBootlegger")) {
    store.commit(
      "session/setBootlegger",
      readStoredJson(storage, "customBootlegger", ""),
    );
  }
  if (storage.getItem("chatHistory")) {
    readStoredArray(storage, "chatHistory")
      .filter(isRecord)
      .forEach((player) => {
        if (typeof player.id !== "string" || !Array.isArray(player.chat))
          return;
        store.commit("session/createChatHistory", player.id);
        player.chat.forEach((message) =>
          store.commit("session/updateChatReceived", {
            message,
            playerId: player.id,
          }),
        );
      });
  }
  if (storage.getItem("groupChats")) {
    readGroupChats(storage).forEach((group) => {
      store.commit("session/addGroupChat", {
        chatId: group.id,
        playerIds: group.playerIds,
        keep: group.keep,
      });
    });
  }
  const avatar = storage.getItem("playerAvatar");
  if (avatar) store.commit("session/updatePlayerAvatar", avatar);
  const secretVote = readStoredWithSchema(
    storage,
    "secretVote",
    persistedBooleanSchema,
  );
  if (secretVote !== null) store.commit("session/setSecretVote", secretVote);
  if (storage.getItem("isRole")) {
    const roleState = readLegacyRoleState(storage);
    const role = Object.keys(roleState)[0];
    if (!role) return;
    const properties = roleState[role];
    if (!properties) return;
    Object.entries(properties).forEach(([property, value]) => {
      store.commit("session/setIsRole", { role, property, value, st: true });
    });
  }
}
