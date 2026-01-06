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
  isTalking: false
};

const state = () => ({
  players: [],
  fabled: [],
  bluffs: [],
  firstNightOrder: [],
  otherNightOrder: []
});

const getters = {
  alive({ players }) {
    return players.filter(player => !player.isDead).length;
  },
  nonTravelers({ players }) {
    const nonTravelers = players.filter(
      player => player.role.team !== "traveler"
    );
    return Math.min(nonTravelers.length, 15);
  },
  // calculate a Map of player => night order
  nightOrder({ players, fabled, firstNightOrder, otherNightOrder }) {
    const firstNight = [0];
    const otherNight = [0];
    const firstNightRoles = players.map(player => player.role).filter(role => role.firstNight > 0).map(role => role.id);
    const customFirstNight = firstNightRoles.every(role => firstNightOrder.includes(role));
    const otherNightRoles = players.map(player => player.role).filter(role => role.otherNight > 0).map(role => role.id);
    const customOtherNight = otherNightRoles.every(role => otherNightOrder.includes(role));
    players.forEach(({ role }) => {
      if (customFirstNight && firstNightOrder.indexOf(role.id) > -1 && role.firstNight) {
        firstNight.push(firstNightOrder.indexOf(role.id));
      } else if (role.firstNight && !firstNight.includes(role.firstNight)) {
        firstNight.push(role.firstNight);
      }
      if (customOtherNight && otherNightOrder.indexOf(role.id) > -1 && role.otherNight) {
        otherNight.push(otherNightOrder.indexOf(role.id));
      } else if (role.otherNight && !otherNight.includes(role.otherNight)) {
        otherNight.push(role.otherNight);
      }
    });
    fabled.forEach(role => {
      if (customFirstNight && firstNightOrder.indexOf(role.id) > -1 && role.firstNight) {
        firstNight.push(firstNightOrder.indexOf(role.id));
      } else if (role.firstNight && !firstNight.includes(role.firstNight)) {
        firstNight.push(role.firstNight);
      }
      if (customOtherNight && otherNightOrder.indexOf(role.id) > -1 && role.otherNight) {
        otherNight.push(otherNightOrder.indexOf(role.id));
      } else if (role.otherNight && !otherNight.includes(role.otherNight)) {
        otherNight.push(role.otherNight);
      }
    });
    firstNight.sort((a, b) => a - b);
    otherNight.sort((a, b) => a - b);
    const nightOrder = new Map();
    players.forEach(player => {
      const first = Math.max(customFirstNight ? firstNight.indexOf(firstNightOrder.indexOf(player.role.id)) : firstNight.indexOf(player.role.firstNight), 0);
      const other = Math.max(customOtherNight ? otherNight.indexOf(otherNightOrder.indexOf(player.role.id)) : otherNight.indexOf(player.role.otherNight), 0);
      nightOrder.set(player, { first, other });
    });
    fabled.forEach(role => {
      const first = Math.max(customFirstNight ? firstNight.indexOf(firstNightOrder.indexOf(role.id)) : firstNight.indexOf(role.firstNight), 0);
      const other = Math.max(customOtherNight ? otherNight.indexOf(otherNightOrder.indexOf(role.id)) : otherNight.indexOf(role.otherNight), 0);
      nightOrder.set(role, { first, other });
    });
    return nightOrder;
  }
};

const actions = {
  randomize({ state, commit }) {
    const players = state.players
      .map(a => [Math.random(), a])
      .sort((a, b) => a[0] - b[0])
      .map(a => a[1]);
    commit("set", players);
  },
  clearRoles({ state, commit, rootState }) {
    let players;
    if (rootState.session.isSpectator) {
      players = state.players.map(player => {
        if (player.role.team !== "traveler") {
          player.role = {};
        }
        player.reminders = [];
        return player;
      });
    } else {
      players = state.players.map(({ name, id, pronouns, image, chatGroup }) => ({
        ...NEWPLAYER,
        name,
        id,
        pronouns,
        image,
        chatGroup
      }));
      commit("setFabled", { fabled: [] });
    }
    commit("set", players);
    commit("setBluff");
  },
  realivePlayers({state, commit}) {
    state.players.forEach(player => {
      commit("update", {player, property: "isDead", value: false});
    });
  }
};

const mutations = {
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
      this.commit("players/selfUpdate", {player, property, value});
    }
  },
  selfUpdate(state, {player, property, value}) {
    switch (property) {
      case "id":
        this.commit("session/setPlayerVotes", player.votes);
        break;
      case "votes":
        this.commit("session/setPlayerVotes", value);
        break;
    }
  },
  add(state, {name}) {
    state.players.push({
      ...NEWPLAYER,
      name
    });
    if (state.fabled.length === 0) {
      this.commit("players/setFabled", {fabled: []})
    }
  },
  remove(state, index) {
    state.players.splice(index, 1);
  },
  empty(state, {player}) {
    this.commit("players/update", {
      player,
      property: 'id',
      value: ''
    });
    this.commit("players/update", {
      player,
      property: 'name',
      value: ''
    });
    this.commit("players/update", {
      player,
      property: 'image',
      value: ''
    });
    this.commit("players/update", {
      player,
      property: 'isWraith',
      value: false
    });
    this.commit("players/update", {
      player,
      property: 'isUsingWraith',
      value: false
    });
  },
  swap(state, [from, to]) {

    [state.players[from], state.players[to]] = [
      state.players[to],
      state.players[from]
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
  setFabled(state, { index, fabled, stImage, stName, emptyFabled = false} = {}) {
    if (!stImage) stImage = this.state.session.playerAvatar === "default.webp" ? "default_storyteller.webp" : this.state.session.playerAvatar;
    if (!stName) stName = this.state.session.playerName;
    if (index !== undefined) {
      if (index == 0) return; // do not ever remove the first fabled i.e. storyteller

      // 传奇角色页面的私货商人将恢复默认描述
      if (state.fabled[index].id === "bootlegger") {
        state.fabled[index].ability = "这个剧本包含有自制角色或自制规则。";
      }

      state.fabled.splice(index, 1);
    } else if (fabled) {
      const fabledStoryteller = {
        "id": "storyteller",
        "image": ("https://botcgrimoire.top/avatars/" + stImage),
        "firstNightReminder": "",
        "otherNightReminder": "",
        "reminders": [],
        "setup": false,
        "name": stName,
        "team": "fabled",
        "ability": "点击和说书人私聊。"
      };

      // 加入自定义私货商人描述
      const customBootlegger = this.state.session.bootlegger;
      if (fabled.id === "bootlegger" & !!customBootlegger) {
        fabled.ability = customBootlegger;
      }
      // 空数组时恢复默认描述
      if (Array.isArray(fabled) & fabled.length === 0 & state.fabled.length > 0) {
        for(let i=0;i<state.fabled.length;i++) {
          if (state.fabled[i].id === "bootlegger") {
            this.commit("players/setFabled", { index: i });
            break;
          }
        }
      }

      // add storyteller fabled to allow direct messages
      if (!Array.isArray(fabled)) {
        // if (fabled.length === 0 && fabled.id != "storyteller") state.fabled.push(fabledStoryteller);
        state.fabled.push(fabled);
      } else {
        // add in Story Teller if there isn't already one
        if (!emptyFabled && (fabled.length > 0 && fabled[0].id != "storyteller" || fabled.length === 0)){
          fabled.unshift(fabledStoryteller)
        }
        state.fabled = fabled;
      }
    }
  },
  setFirstNight(state, firstNight) {
    state.firstNightOrder = firstNight;
  },
  setOtherNight(state, otherNight) {
    state.otherNightOrder = otherNight;
  },
  setPlayerMessage(state, {playerId, num}) {
    const playersId = [];
    state.players.forEach(player => {
      playersId.push(player["id"]);
    });
    const playerIndex = playersId.indexOf(playerId);
    if (num > 0){
      state.players[playerIndex].newMessages += num;
    } else{
      state.players[playerIndex].newMessages = num;
    }
    
  },
  setImage(state, image) { //image is an url
    state.image = image;
  },
  setIsTalking(state, {seatNum, isTalking}) {
    if (seatNum >= state.players.length) return;
    if (!state.players[seatNum].id || state.players[seatNum].id != this.state.session.playerId) return;
    const player = state.players[seatNum];
    player.isTalking = isTalking;
  }
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
};
