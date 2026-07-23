import type { LegacyAction, LegacyMutation } from "../legacy-vuex";
import { pinia } from "../../pinia";
import { usePlayersStore } from "../../stores/players";

const NEWPLAYER = {
  name: "",
  id: "",
  image: "",
  role: {},
  isAllowRole: true,
  isWraith: false,
  isUsingWraith: false,
  reminders: [],
  stReminders: [],
  isVoteless: false,
  isSecretVoteless: false,
  isDead: false,
  votes: 1,
  pronouns: "",
  newMessages: 0,
  chatGroup: "",
  isTalking: false,
};

const playerStateKeys = [
  "players",
  "fabled",
  "bluffs",
  "firstNightOrder",
  "otherNightOrder",
  "image",
] as const;

const state = () => {
  const legacyState: Record<string, unknown> = {};
  const players = usePlayersStore(pinia);
  for (const key of playerStateKeys) {
    Object.defineProperty(legacyState, key, {
      enumerable: true,
      get: () => players[key],
      set: (value) => {
        players[key] = value as never;
      },
    });
  }
  return legacyState;
};

const actions: Record<string, LegacyAction> = {
  randomize({ state, commit }) {
    const players = state.players
      .map((a: any) => [Math.random(), a])
      .sort((a: any, b: any) => a[0] - b[0])
      .map((a: any) => a[1]);
    commit("set", players);
  },
  clearRoles({ state, commit, rootState }) {
    let players;
    if (rootState.session.isSpectator) {
      players = state.players.map((player: any) => {
        if (player.role.team !== "traveler") {
          player.role = {};
        }
        player.reminders = [];
        return player;
      });
    } else {
      players = state.players.map(
        ({ name, id, pronouns, image, chatGroup }: any) => ({
          ...NEWPLAYER,
          name,
          id,
          pronouns,
          image,
          chatGroup,
        }),
      );
      commit("setFabled", { fabled: [] });
    }
    commit("set", players);
    commit("setBluff");
  },
  realivePlayers({ state, commit }) {
    state.players.forEach((player: any) => {
      commit("update", { player, property: "isDead", value: false });
    });
  },
};

const mutations: Record<string, LegacyMutation> = {
  clear(state, emptyFabled = false) {
    state.players = [];
    state.bluffs = [];
    this.commit("players/setFabled", { fabled: [], emptyFabled });
    // state.fabled = [];
  },
  set(state, players = []) {
    state.players = players;
  },
  /**
  The update mutation also has a property for isFromSockets
  this property can be addded to payload object for any mutations
  then can be used to prevent infinite loops when a property is
  able to be set from multiple different session on websockets.
  An example of this is in the sendPlayerPronouns and _updatePlayerPronouns
  in socket.js.
   */
  update(state, { player, property, value }) {
    const index = state.players.indexOf(player);
    if (index >= 0) {
      state.players[index][property] = value;
    }
    if (player.id === this.state.session.playerId) {
      this.commit("players/selfUpdate", { player, property, value });
    }
  },
  selfUpdate(state, { player, property, value }) {
    switch (property) {
      case "id":
        this.commit("session/setPlayerVotes", player.votes);
        break;
      case "votes":
        this.commit("session/setPlayerVotes", value);
        break;
    }
  },
  add(state, { name }) {
    state.players.push({
      ...NEWPLAYER,
      name,
    });
    if (state.fabled.length === 0) {
      this.commit("players/setFabled", { fabled: [] });
    }
  },
  remove(state, index) {
    state.players.splice(index, 1);
  },
  empty(state, { player }) {
    this.commit("players/update", {
      player,
      property: "id",
      value: "",
    });
    this.commit("players/update", {
      player,
      property: "name",
      value: "",
    });
    this.commit("players/update", {
      player,
      property: "image",
      value: "",
    });
    this.commit("players/update", {
      player,
      property: "isWraith",
      value: false,
    });
    this.commit("players/update", {
      player,
      property: "isUsingWraith",
      value: false,
    });
  },
  swap(state, [from, to]) {
    [state.players[from], state.players[to]] = [
      state.players[to],
      state.players[from],
    ];
    // hack: "modify" the array so that Vue notices something changed
    state.players.splice(0, 0);
  },
  move(state, [from, to]) {
    state.players.splice(to, 0, state.players.splice(from, 1)[0]);
  },
  setBluff(state, { index, role } = {}) {
    if (index !== undefined) {
      state.bluffs.splice(index, 1, role);
    } else {
      state.bluffs = [];
    }
  },
  updateBluff(state, bluffs) {
    state.bluffs = bluffs;
  },
  setFabled(_state, payload = {}) {
    usePlayersStore(pinia).setFabled(payload);
  },
  setFirstNight(state, firstNight) {
    state.firstNightOrder = firstNight;
  },
  setOtherNight(state, otherNight) {
    state.otherNightOrder = otherNight;
  },
  setPlayerMessage(state, { playerId, num }) {
    const playersId: any[] = [];
    state.players.forEach((player: any) => {
      playersId.push(player["id"]);
    });
    const playerIndex = playersId.indexOf(playerId);
    if (num > 0) {
      state.players[playerIndex].newMessages += num;
    } else {
      state.players[playerIndex].newMessages = num;
    }
  },
  setImage(state, image) {
    //image is an url
    state.image = image;
  },
  setIsTalking(state, { seatNum, isTalking }) {
    if (seatNum >= state.players.length) return;
    if (
      !state.players[seatNum].id ||
      state.players[seatNum].id != this.state.session.playerId
    )
      return;
    const player = state.players[seatNum];
    player.isTalking = isTalking;
  },
};

const playersModule: any = {
  namespaced: true,
  state,
  actions,
  mutations,
};

export default playersModule;
