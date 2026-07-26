import { readStoredArray, readStoredJson, readStoredRecord } from "./storage";
import { pinia } from "../pinia";
import { useChatStore } from "../stores/chat";
import { rolesJSONbyId } from "./selectors";
import { mutationBus } from "./mutation-bus";
type LegacyPersistenceStore = {
  commit(type: string, payload?: any): void;
  state: any;
  getters?: any;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type LegacyGroupChat = {
  id: string;
  playerIds: string[];
  keep: boolean;
};

const readGroupChats = (storage: Pick<Storage, "getItem">) =>
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

const readPlayerIds = (players: unknown) => {
  if (!Array.isArray(players)) return undefined;

  const playerIds = players.flatMap((player) => {
    if (!isRecord(player) || typeof player.id !== "string") return [];
    return [player.id];
  });

  return playerIds.length === players.length ? playerIds : undefined;
};

export default (store: LegacyPersistenceStore) => {
  if (window.location.pathname != "/") return;

  const localStorage: any = window.localStorage;

  const updatePagetitle = (isPublic: any) =>
    // (document.title = `Blood on the Clocktower ${
    //   isPublic ? "Town Square" : "Grimoire"
    // }`);
    (document.title = `编程分享：钟楼谜团魔典——线上的说书人辅助工具（血染钟楼） ${
      isPublic ? "" : ""
    }`);

  // initialize data
  if (localStorage.getItem("lastVersion")) {
    store.commit("setLastVersion", localStorage.getItem("lastVersion"));
  }
  if (localStorage.getItem("background")) {
    store.commit("setBackground", localStorage.background);
  }
  if (localStorage.getItem("muted")) {
    store.commit("toggleMuted", true);
  }
  if (localStorage.getItem("static")) {
    store.commit("toggleStatic", true);
  }
  if (localStorage.getItem("imageOptIn")) {
    store.commit("toggleImageOptIn", true);
  }
  if (localStorage.getItem("zoom")) {
    store.commit("setZoom", parseFloat(localStorage.getItem("zoom")));
  }
  if (localStorage.getItem("audioThreshold")) {
    store.commit("setAudioThreshold", localStorage.getItem("audioThreshold"));
  }
  if (localStorage.getItem("isGrimoire")) {
    store.commit("toggleGrimoire", false);
    updatePagetitle(false);
  }
  if (localStorage.getItem("useOldOrder")) {
    store.commit(
      "session/setUseOldOrder",
      readStoredRecord(localStorage, "useOldOrder"),
    );
  }
  if (localStorage.getItem("useOldRole")) {
    store.commit(
      "session/setUseOldRole",
      readStoredRecord(localStorage, "useOldRole"),
    );
  }
  if (localStorage.getItem("isReview")) {
    store.commit(
      "session/setIsReview",
      readStoredJson(localStorage, "isReview", false),
    );
  }
  if (localStorage.getItem("selectedEditions")) {
    store.commit(
      "setSelectedEditions",
      readStoredRecord(localStorage, "selectedEditions"),
    );
  }
  if (localStorage.roles !== undefined) {
    store.commit("setCustomRoles", readStoredArray(localStorage, "roles"));
    store.commit("setEdition", { id: "custom" });
  }
  if (localStorage.getItem("states")) {
    store.commit("setStates", readStoredArray(localStorage, "states"));
  }
  if (localStorage.getItem("teamsNames")) {
    store.commit("setTeamsNames", readStoredRecord(localStorage, "teamsNames"));
  }
  if (localStorage.getItem("firstNight")) {
    store.commit("setFirstNight", readStoredArray(localStorage, "firstNight"));
  }
  if (localStorage.getItem("otherNight")) {
    store.commit("setOtherNight", readStoredArray(localStorage, "otherNight"));
  }
  if (localStorage.edition !== undefined) {
    // this will initialize state.roles for official editions
    store.commit("setEdition", readStoredRecord(localStorage, "edition"));
  }
  if (localStorage.bluffs !== undefined) {
    readStoredArray(localStorage, "bluffs").forEach((role, index) => {
      store.commit("players/setBluff", {
        index,
        role: store.state.roles.get(role) || {},
      });
    });
  }
  if (localStorage.getItem("playerProfileImage")) {
    localStorage.setItem(
      "playerAvatar",
      localStorage.getItem("playerProfileImage"),
    );
    localStorage.removeItem("playerProfileImage");
  }
  if (localStorage.fabled !== undefined) {
    store.commit("players/setFabled", {
      // fabled: JSON.parse(localStorage.fabled).map(
      //   fabled => store.state.fabled.get(fabled.id) || fabled
      // )
      fabled: readStoredArray(localStorage, "fabled"),
      emptyFabled: true,
    });
  }
  if (localStorage.players) {
    store.commit(
      "players/set",
      readStoredArray(localStorage, "players")
        .filter(isRecord)
        .map((player) => {
          const roleId = typeof player.role === "string" ? player.role : "";
          return {
            ...player,
            role:
              store.state.roles.get(roleId) || rolesJSONbyId.get(roleId) || {},
          };
        }),
    );
  }
  /**** Session related data *****/
  if (localStorage.getItem("playerId")) {
    store.commit("session/setPlayerId", localStorage.getItem("playerId"));
  }
  if (localStorage.getItem("stSecret")) {
    store.commit("session/setStSecret", localStorage.getItem("stSecret"));
  }
  if (localStorage.getItem("playerName")) {
    store.commit("session/setPlayerName", localStorage.getItem("playerName"));
  }
  if (localStorage.getItem("stId")) {
    store.commit("session/setStId", localStorage.getItem("stId"));
  }
  if (localStorage.getItem("claimedSeat")) {
    store.commit(
      "session/claimSeat",
      Number(localStorage.getItem("claimedSeat")),
    );
  }
  if (localStorage.getItem("session")) {
    const [spectator, sessionId] = readStoredArray(localStorage, "session");
    if (typeof spectator === "boolean") {
      store.commit("session/setSpectator", spectator);
    }
    if (typeof sessionId === "string") {
      store.commit("session/setSessionId", sessionId);
    }
  }
  if (localStorage.getItem("playerVotes")) {
    store.commit(
      "session/setPlayerVotes",
      readStoredJson(localStorage, "playerVotes", 1),
    );
  }
  if (localStorage.getItem("votes")) {
    const votes = readStoredArray(localStorage, "votes");
    votes.filter(isRecord).forEach((voteHistory) => {
      store.commit("session/addVotes", voteHistory);
    });
  }
  if (localStorage.getItem("votesSelected")) {
    const votesSelected = readStoredArray(localStorage, "votesSelected");
    votesSelected.forEach((voteSelected) => {
      store.commit("session/addVoteSelected", voteSelected);
    });
  }
  if (localStorage.getItem("customBootlegger")) {
    const customBootlegger = readStoredJson(
      localStorage,
      "customBootlegger",
      "",
    );
    store.commit("session/setBootlegger", customBootlegger);
  }
  if (localStorage.getItem("chatHistory")) {
    const chatHistory = readStoredArray(localStorage, "chatHistory");
    chatHistory.filter(isRecord).forEach((player) => {
      if (typeof player.id !== "string" || !Array.isArray(player.chat)) return;
      store.commit("session/createChatHistory", player.id);
      player.chat.forEach((message) => {
        store.commit("session/updateChatReceived", {
          message,
          playerId: player.id,
        });
      });
    });
  }
  if (localStorage.getItem("groupChats")) {
    readGroupChats(localStorage).forEach((group) => {
      store.commit("session/addGroupChat", {
        chatId: group.id,
        playerIds: group.playerIds,
        keep: group.keep,
      });
    });
  }
  if (localStorage.getItem("playerAvatar")) {
    store.commit(
      "session/updatePlayerAvatar",
      localStorage.getItem("playerAvatar"),
    );
  }
  if (localStorage.getItem("secretVote")) {
    store.commit(
      "session/setSecretVote",
      readStoredJson(localStorage, "secretVote", false),
    );
  }
  if (localStorage.getItem("isRole")) {
    const isRole = readStoredRecord(localStorage, "isRole");
    const role = Object.keys(isRole)[0];
    if (role && isRecord(isRole[role])) {
      for (const property in isRole[role]) {
        store.commit("session/setIsRole", {
          role,
          property,
          value: isRole[role][property],
          st: true,
        });
      }
    }
  }
  // listen to mutations
  return mutationBus.subscribe(({ type, payload }: any, state: any) => {
    switch (type) {
      case "toggleGrimoire":
        if (!state.grimoire.isPublic) {
          localStorage.setItem("isGrimoire", 1);
        } else {
          localStorage.removeItem("isGrimoire");
        }
        updatePagetitle(state.grimoire.isPublic);
        break;
      case "setLastVersion":
        if (payload) {
          localStorage.setItem("lastVersion", payload);
        } else {
          localStorage.removeItem("lastVersion");
        }
        break;
      case "setBackground":
        if (payload) {
          localStorage.setItem("background", payload);
        } else {
          localStorage.removeItem("background");
        }
        break;
      case "toggleMuted":
        if (state.grimoire.isMuted) {
          localStorage.setItem("muted", 1);
        } else {
          localStorage.removeItem("muted");
        }
        break;
      case "toggleStatic":
        if (state.grimoire.isStatic) {
          localStorage.setItem("static", 1);
        } else {
          localStorage.removeItem("static");
        }
        break;
      case "toggleImageOptIn":
        if (state.grimoire.isImageOptIn) {
          localStorage.setItem("imageOptIn", 1);
        } else {
          localStorage.removeItem("imageOptIn");
        }
        break;
      case "setZoom":
        if (payload !== 0) {
          localStorage.setItem("zoom", payload);
        } else {
          localStorage.removeItem("zoom");
        }
        break;
      case "setAudioThreshold":
        localStorage.setItem("audioThreshold", payload);
        break;
      case "setSelectedEditions":
        localStorage.setItem("selectedEditions", JSON.stringify(payload));
        break;
      case "setEdition":
        localStorage.setItem("edition", JSON.stringify(payload));
        if (state.edition.isOfficial) {
          localStorage.removeItem("roles");
        }
        break;
      case "setCustomRoles":
        if (!payload.length) {
          localStorage.removeItem("roles");
        } else {
          localStorage.setItem("roles", JSON.stringify(payload));
        }
        break;
      case "setStates":
        localStorage.setItem("states", JSON.stringify(payload));
        break;
      case "setTeamsNames":
        localStorage.setItem("teamsNames", JSON.stringify(payload));
        break;
      case "setFirstNight":
        localStorage.setItem("firstNight", JSON.stringify(payload));
        break;
      case "setOtherNight":
        localStorage.setItem("otherNight", JSON.stringify(payload));
        break;
      case "players/setBluff":
      case "players/updateBluff":
        localStorage.setItem(
          "bluffs",
          JSON.stringify(state.players.bluffs.map(({ id }: any) => id)),
        );
        break;
      case "players/setFabled":
        localStorage.setItem("fabled", JSON.stringify(state.players.fabled));
        break;
      case "players/add":
      case "players/update":
      case "players/remove":
      case "players/clear":
      case "players/set":
      case "players/swap":
      case "players/move":
        if (state.players.players.length) {
          localStorage.setItem(
            "players",
            JSON.stringify(
              state.players.players.map((player: any) => ({
                ...player,
                // simplify the stored data
                role: player.role.id || {},
              })),
            ),
          );
        } else {
          localStorage.removeItem("players");
        }
        break;
      case "session/setSessionId":
        if (payload) {
          localStorage.setItem(
            "session",
            JSON.stringify([state.session.isSpectator, payload]),
          );
        } else {
          localStorage.removeItem("session");
        }
        break;
      case "session/setPlayerId":
        if (payload) {
          localStorage.setItem("playerId", payload);
        } else {
          localStorage.removeItem("playerId");
        }
        break;
      case "session/setStSecret":
        if (payload) {
          localStorage.setItem("stSecret", payload);
        } else {
          localStorage.removeItem("stSecret");
        }
        break;
      case "session/setPlayerName":
        if (payload) {
          localStorage.setItem("playerName", payload);
        } else {
          localStorage.removeItem("playerName");
        }
        break;
      case "session/setStId":
        localStorage.setItem("stId", payload);
        break;
      case "session/claimSeat":
        if (payload >= 0) {
          localStorage.setItem("claimedSeat", payload);
        } else {
          localStorage.removeItem("claimedSeat");
        }
        break;
      case "session/setPlayerVotes":
        localStorage.setItem("playerVotes", JSON.stringify(payload));
        break;
      case "session/addVotes": {
        if (payload.save) {
          const votes = readStoredArray(localStorage, "votes");
          payload.save = false;
          votes.push(payload);
          localStorage.setItem("votes", JSON.stringify(votes));
        }
        break;
      }
      case "session/addVoteSelected": {
        if (payload.save) {
          const votesSelected = readStoredArray(localStorage, "votesSelected");
          payload.save = false;
          delete payload.players; // players added for conditioning in session
          votesSelected.push(payload);
          localStorage.setItem("votesSelected", JSON.stringify(votesSelected));
        }
        break;
      }
      case "session/clearVoteHistory": {
        if (!localStorage.getItem("votes")) break;
        if (!localStorage.getItem("votesSelected")) break;
        if (!payload || payload.length === 0) {
          localStorage.removeItem("votes");
          localStorage.removeItem("votesSelected");
        } else {
          const votes = readStoredArray(localStorage, "votes");
          const votesSelected = readStoredArray(localStorage, "votesSelected");
          const newVotes = votes.filter(
            (_: any, index: number) => !payload.includes(index),
          );
          const newVotesSelected = votesSelected.filter(
            (_: any, index: number) => !payload.includes(index),
          );
          localStorage.setItem("votes", JSON.stringify(newVotes));
          localStorage.setItem(
            "votesSelected",
            JSON.stringify(newVotesSelected),
          );
        }
        break;
      }
      case "session/setBootlegger":
        localStorage.setItem("customBootlegger", JSON.stringify(payload));
        break;
      case "session/createChatHistory":
      case "session/updateChatSent":
      case "session/updateChatReceived":
        if (useChatStore(pinia).histories) {
          localStorage.setItem(
            "chatHistory",
            JSON.stringify(useChatStore(pinia).histories),
          );
        } else {
          localStorage.removeItem("chatHistory");
        }
        break;
      case "session/addGroupChat":
        {
          if (!isRecord(payload) || (!!payload.playerIds && !payload.players))
            return;

          const chatId = payload.chatId;
          const playerIds = readPlayerIds(payload.players);
          if (typeof chatId !== "string" || !playerIds) return;

          const groupChats = readGroupChats(localStorage);
          const group = groupChats.find((group) => group.id === chatId);
          if (group) {
            playerIds.forEach((id) => {
              if (!group.playerIds.includes(id)) group.playerIds.push(id);
            });
          } else {
            groupChats.push({ id: chatId, playerIds, keep: false });
          }
          localStorage.setItem("groupChats", JSON.stringify(groupChats));
        }
        break;
      case "session/removeGroupChat":
        if (localStorage.groupChats != undefined && isRecord(payload)) {
          const groupChats = readGroupChats(localStorage);
          const newGroupChats = groupChats.filter(
            (group) => group.id !== payload.chatId,
          );
          localStorage.setItem("groupChats", JSON.stringify(newGroupChats));
        }
        break;
      case "session/removeGroupChatMember":
        if (!isRecord(payload) || (!!payload.playerIds && !payload.players))
          return;
        if (localStorage.groupChats != undefined) {
          const chatId = payload.chatId;
          const player = payload.player;
          if (
            typeof chatId !== "string" ||
            !isRecord(player) ||
            typeof player.id !== "string"
          )
            return;

          const groupChats = readGroupChats(localStorage);
          const index = groupChats.findIndex((group) => group.id === chatId);
          const group = groupChats[index];
          if (!group) return;

          group.playerIds = group.playerIds.filter(
            (playerId) => playerId !== player.id,
          );
          localStorage.setItem("groupChats", JSON.stringify(groupChats));
        }
        break;
      case "session/toggleGroupKeep":
        if (
          localStorage.groupChats != undefined &&
          typeof payload === "string"
        ) {
          const groupChats = readGroupChats(localStorage);
          const index = groupChats.findIndex((group) => group.id === payload);
          const group = groupChats[index];
          if (!group) return;

          group.keep = !group.keep;
          localStorage.setItem("groupChats", JSON.stringify(groupChats));
        }
        break;
      case "session/updatePlayerAvatar":
        localStorage.setItem("playerAvatar", payload);
        break;
      case "session/setSecretVote":
        localStorage.setItem("secretVote", JSON.stringify(payload));
        break;
      case "session/setUseOldOrder":
        if (payload)
          localStorage.setItem("useOldOrder", JSON.stringify(payload));
        break;
      case "session/setUseOldRole":
        if (payload)
          localStorage.setItem("useOldRole", JSON.stringify(payload));
        break;
      case "session/setIsReview":
        localStorage.setItem("isReview", JSON.stringify(payload));
        break;
      case "session/setIsRole":
        {
          const role = payload.role;
          const property = payload.property;
          const value = payload.value;
          const stored = localStorage.getItem("isRole") ? true : false;
          const isRole: Record<string, any> = stored
            ? readStoredRecord(localStorage, "isRole")
            : {};
          if (!stored && !!value) {
            // delete when value set to initial, need to pay caution with e.g. []
            isRole[role] = { [property]: value };
          } else if (isRole[role]) {
            if (!value) {
              // delete when value set to initial, need to pay caution with e.g. []
              delete isRole[role][property];
              if (Object.keys(isRole[role]).length === 0) delete isRole[role];
            } else {
              isRole[role][property] = value;
            }
          }
          if (Object.keys(isRole).length === 0) {
            localStorage.removeItem("isRole");
          } else {
            localStorage.setItem("isRole", JSON.stringify(isRole));
          }
        }
        break;
    }
  });
  // console.log(localStorage);
  // localStorage.clear();
};
