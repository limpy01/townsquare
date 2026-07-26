import { readStoredArray } from "./storage";
import {
  isRecord,
  readGroupChats,
  readLegacyRoleState,
  readPlayerIds,
  serializeStoredPlayer,
  storedRoleId,
} from "./persistence-codecs";
import type {
  PersistenceMutation,
  PersistenceRuntimeState,
  PersistenceStorage,
} from "./persistence-types";

type PersistenceWriterOptions = {
  storage: PersistenceStorage;
  getChatHistories(): unknown;
  updatePageTitle(isPublic: boolean): void;
};

const writeJson = (storage: PersistenceStorage, key: string, value: unknown) =>
  storage.setItem(key, JSON.stringify(value));

const runtimeState = (state: unknown): PersistenceRuntimeState =>
  isRecord(state) ? (state as PersistenceRuntimeState) : {};

const payloadRecord = (payload: unknown): Record<string, unknown> | null =>
  isRecord(payload) ? payload : null;

const hasTruthyPayload = (payload: unknown) => Boolean(payload);

export function createPersistenceWriter({
  storage,
  getChatHistories,
  updatePageTitle,
}: PersistenceWriterOptions) {
  return ({ type, payload }: PersistenceMutation, state: unknown): void => {
    const runtime = runtimeState(state);
    switch (type) {
      case "toggleGrimoire": {
        const isPublic = runtime.grimoire?.isPublic === true;
        if (!isPublic) storage.setItem("isGrimoire", "1");
        else storage.removeItem("isGrimoire");
        updatePageTitle(isPublic);
        return;
      }
      case "setLastVersion":
      case "setBackground":
      case "session/setPlayerId":
      case "session/setStSecret":
      case "session/setPlayerName": {
        const key = {
          setLastVersion: "lastVersion",
          setBackground: "background",
          "session/setPlayerId": "playerId",
          "session/setStSecret": "stSecret",
          "session/setPlayerName": "playerName",
        }[type];
        if (!key) return;
        if (typeof payload === "string" && payload)
          storage.setItem(key, payload);
        else storage.removeItem(key);
        return;
      }
      case "toggleMuted":
      case "toggleStatic":
      case "toggleImageOptIn": {
        const field = {
          toggleMuted: ["muted", "isMuted"],
          toggleStatic: ["static", "isStatic"],
          toggleImageOptIn: ["imageOptIn", "isImageOptIn"],
        }[type];
        if (!field) return;
        const [key, stateKey] = field;
        if (!key || !stateKey) return;
        if (runtime.grimoire?.[stateKey as keyof typeof runtime.grimoire])
          storage.setItem(key, "1");
        else storage.removeItem(key);
        return;
      }
      case "setZoom":
        if (typeof payload === "number" && payload !== 0)
          storage.setItem("zoom", String(payload));
        else storage.removeItem("zoom");
        return;
      case "setAudioThreshold":
        if (typeof payload === "string")
          storage.setItem("audioThreshold", payload);
        return;
      case "setSelectedEditions":
        writeJson(storage, "selectedEditions", payload);
        return;
      case "setEdition":
        writeJson(storage, "edition", payload);
        if (runtime.edition?.isOfficial) storage.removeItem("roles");
        return;
      case "setCustomRoles":
        if (!Array.isArray(payload) || payload.length === 0)
          storage.removeItem("roles");
        else writeJson(storage, "roles", payload);
        return;
      case "setStates":
      case "setTeamsNames":
      case "setFirstNight":
      case "setOtherNight":
        writeJson(
          storage,
          {
            setStates: "states",
            setTeamsNames: "teamsNames",
            setFirstNight: "firstNight",
            setOtherNight: "otherNight",
          }[type],
          payload,
        );
        return;
      case "players/setBluff":
      case "players/updateBluff":
        writeJson(
          storage,
          "bluffs",
          (runtime.players?.bluffs ?? []).flatMap((role) => {
            const id = storedRoleId(role);
            return id === undefined ? [] : [id];
          }),
        );
        return;
      case "players/setFabled":
        writeJson(storage, "fabled", runtime.players?.fabled ?? []);
        return;
      case "players/add":
      case "players/update":
      case "players/remove":
      case "players/clear":
      case "players/set":
      case "players/swap":
      case "players/move": {
        const players = runtime.players?.players ?? [];
        if (players.length) {
          writeJson(
            storage,
            "players",
            players.flatMap((player) => {
              const storedPlayer = serializeStoredPlayer(player);
              return storedPlayer ? [storedPlayer] : [];
            }),
          );
        } else storage.removeItem("players");
        return;
      }
      case "session/setSessionId":
        if (typeof payload === "string" && payload) {
          writeJson(storage, "session", [
            runtime.session?.isSpectator === true,
            payload,
          ]);
        } else storage.removeItem("session");
        return;
      case "session/setStId":
        if (typeof payload === "string") storage.setItem("stId", payload);
        return;
      case "session/claimSeat":
        if (typeof payload === "number" && payload >= 0)
          storage.setItem("claimedSeat", String(payload));
        else storage.removeItem("claimedSeat");
        return;
      case "session/setPlayerVotes":
        writeJson(storage, "playerVotes", payload);
        return;
      case "session/addVotes": {
        const vote = payloadRecord(payload);
        if (!vote || vote.save !== true) return;
        vote.save = false;
        const votes = readStoredArray(storage, "votes");
        votes.push(vote);
        writeJson(storage, "votes", votes);
        return;
      }
      case "session/addVoteSelected": {
        const vote = payloadRecord(payload);
        if (!vote || vote.save !== true) return;
        vote.save = false;
        delete vote.players;
        const votes = readStoredArray(storage, "votesSelected");
        votes.push(vote);
        writeJson(storage, "votesSelected", votes);
        return;
      }
      case "session/clearVoteHistory": {
        if (!storage.getItem("votes") || !storage.getItem("votesSelected"))
          return;
        if (!Array.isArray(payload) || payload.length === 0) {
          storage.removeItem("votes");
          storage.removeItem("votesSelected");
          return;
        }
        const indexes = new Set(
          payload.filter((index) => typeof index === "number"),
        );
        writeJson(
          storage,
          "votes",
          readStoredArray(storage, "votes").filter(
            (_, index) => !indexes.has(index),
          ),
        );
        writeJson(
          storage,
          "votesSelected",
          readStoredArray(storage, "votesSelected").filter(
            (_, index) => !indexes.has(index),
          ),
        );
        return;
      }
      case "session/setBootlegger":
        writeJson(storage, "customBootlegger", payload);
        return;
      case "session/createChatHistory":
      case "session/updateChatSent":
      case "session/updateChatReceived": {
        const histories = getChatHistories();
        if (histories) writeJson(storage, "chatHistory", histories);
        else storage.removeItem("chatHistory");
        return;
      }
      case "session/addGroupChat": {
        const groupPayload = payloadRecord(payload);
        if (!groupPayload || (groupPayload.playerIds && !groupPayload.players))
          return;
        const chatId = groupPayload.chatId;
        const playerIds = readPlayerIds(groupPayload.players);
        if (typeof chatId !== "string" || !playerIds) return;
        const groups = readGroupChats(storage);
        const group = groups.find((item) => item.id === chatId);
        if (group) {
          playerIds.forEach((id) => {
            if (!group.playerIds.includes(id)) group.playerIds.push(id);
          });
        } else groups.push({ id: chatId, playerIds, keep: false });
        writeJson(storage, "groupChats", groups);
        return;
      }
      case "session/removeGroupChat": {
        const groupPayload = payloadRecord(payload);
        if (storage.getItem("groupChats") === null || !groupPayload) return;
        const chatId = groupPayload.chatId;
        if (typeof chatId !== "string") return;
        writeJson(
          storage,
          "groupChats",
          readGroupChats(storage).filter((group) => group.id !== chatId),
        );
        return;
      }
      case "session/removeGroupChatMember": {
        const groupPayload = payloadRecord(payload);
        if (
          storage.getItem("groupChats") === null ||
          !groupPayload ||
          (groupPayload.playerIds && !groupPayload.players)
        )
          return;
        const chatId = groupPayload.chatId;
        const player = groupPayload.player;
        if (
          typeof chatId !== "string" ||
          !isRecord(player) ||
          typeof player.id !== "string"
        )
          return;
        const groups = readGroupChats(storage);
        const group = groups.find((item) => item.id === chatId);
        if (!group) return;
        group.playerIds = group.playerIds.filter((id) => id !== player.id);
        writeJson(storage, "groupChats", groups);
        return;
      }
      case "session/toggleGroupKeep": {
        if (
          storage.getItem("groupChats") === null ||
          typeof payload !== "string"
        )
          return;
        const groups = readGroupChats(storage);
        const group = groups.find((item) => item.id === payload);
        if (!group) return;
        group.keep = !group.keep;
        writeJson(storage, "groupChats", groups);
        return;
      }
      case "session/updatePlayerAvatar":
        if (typeof payload === "string")
          storage.setItem("playerAvatar", payload);
        return;
      case "session/setSecretVote":
      case "session/setIsReview":
        writeJson(
          storage,
          type === "session/setSecretVote" ? "secretVote" : "isReview",
          payload,
        );
        return;
      case "session/setUseOldOrder":
      case "session/setUseOldRole":
        if (hasTruthyPayload(payload))
          writeJson(
            storage,
            type === "session/setUseOldOrder" ? "useOldOrder" : "useOldRole",
            payload,
          );
        return;
      case "session/setIsRole": {
        const rolePayload = payloadRecord(payload);
        if (!rolePayload) return;
        const role = rolePayload.role;
        const property = rolePayload.property;
        const value = rolePayload.value;
        if (typeof role !== "string" || typeof property !== "string") return;
        const stored = storage.getItem("isRole") !== null;
        const roleState = stored ? readLegacyRoleState(storage) : {};
        if (!stored && value) roleState[role] = { [property]: value };
        else {
          const currentRole = roleState[role];
          if (!currentRole) return;
          if (!value) {
            delete currentRole[property];
            if (Object.keys(currentRole).length === 0) delete roleState[role];
          } else currentRole[property] = value;
        }
        if (Object.keys(roleState).length === 0) storage.removeItem("isRole");
        else writeJson(storage, "isRole", roleState);
        return;
      }
    }
  };
}
