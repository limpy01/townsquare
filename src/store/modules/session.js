/**
 * Handle a vote request.
 * If the vote is from a seat that is already locked, ignore it.
 * @param state session state
 * @param index seat of the player in the circle
 * @param vote true or false
 */

import Vue from "vue";

const handleVote = (state, [index, vote]) => {
  if (!state.nomination) return;
  state.votes = [...state.votes];
  state.votes[index] = vote === undefined ? 0 : vote;
};

const state = () => ({
  sessionId: "",
  StId: null,
  rooms: null,
  isHostAllowed: null,
  hostTimeout: null,
  isJoinAllowed: null,
  joinTimeout: null,
  isSpectator: false,
  isReconnecting: false,
  playerCount: 0,
  ping: 0,
  playerId: "",
  playerName:"",
  playerAvatar: "default.webp",
  claimedSeat: -1,
  nomination: false,
  playerVotes: 1,
  isRole: {
    wraith: {
      active: false, // player
      using: false, // player
      st: 0, // st
      player: 0, // st
      prob: 0.05, // st
      probMax: 0.1 // st
    }
  },
  votes: [],
  lockedVote: 0,
  votingSpeed: 500,
  isVoteInProgress: false,
  isSecretVote: false,
  voteHistory: [],
  voteSelected: [],
  markedPlayer: -1,
  isVoteHistoryAllowed: true,
  isRolesDistributed: false,
  isTypesDistributed: false,
  isBluffsDistributed: false,
  isGrimoireDistributed: false,
  isUseOldOrder: {
    pithag: false,
    professor: false
  },
  isUseOldRole: {
    balloonist: false,
    acrobat: false,
    lilmonsta: false,
    alchemist: false,
    lycanthrope: false
  },
  isReview: false,
  isChatOpen: false,
  isTyping: false,
  messageQueue: [],
  messageUniqueQueue: [],
  chatHistory: [],
  newStMessage: [0],
  groupChats: [],
  inputType: "",
  inputModal: "",
  inputData: {},
  inputResolver: null,
  inputRejecter: null,
  bootlegger: "",
  timer: 480,
  startTime: null,
  lastUpdateTime: null,
  interval: null,
  isTalking: false,
  listeningFrame: null
});

const getters = {};

const actions = {};

// mutations helper functions
const set = key => (state, val) => {
  state[key] = val;
};

const mutations = {
  setIsJoinAllowed: set("isJoinAllowed"),
  setIsHostAllowed: set("isHostAllowed"),
  setPlayerId: set("playerId"),
  setStId: set("stId"),
  setSpectator: set("isSpectator"),
  setReconnecting: set("isReconnecting"),
  setPlayerCount: set("playerCount"),
  setPing: set("ping"),
  setPlayerVotes: set("playerVotes"),
  setVotingSpeed: set("votingSpeed"),
  setVoteInProgress: set("isVoteInProgress"),
  setMarkedPlayer(state, {val, force}) {
    if (!force && state.isSecretVote && val >= 0) return;
    state.markedPlayer = val;
  },
  setNomination: set("nomination"),
  setVoteHistoryAllowed: set("isVoteHistoryAllowed"),
  setListeningFrame: set("listeningFrame"),
  setChatOpen: set("isChatOpen"),
  setTyping: set("isTyping"),
  setInputType: set("inputType"),
  setInputModal: set("inputModal"),
  setInputData: set("inputData"),
  setSecretVote: set("isSecretVote"),
  setBootlegger: set("bootlegger"),
  setUseOldOrder: set("isUseOldOrder"),
  setUseOldRole: set("isUseOldRole"),
  setIsReview: set("isReview"),
  setInputResolver(state, resolver) {
    state.inputResolver = resolver;
  },
  setInputRejecter(state, rejecter) {
    state.inputRejecter = rejecter;
  },
  clearInputHandlers(state) { // New mutation for cleanup
    state.inputResolver = null;
    state.inputRejecter = null;
  },
  claimSeat: set("claimedSeat"),
  distributeRoles: set("isRolesDistributed"),
  distributeTypes: set("isTypesDistributed"),
  distributeBluffs(state, {val}){
    state.isBluffsDistributed = val;
  },
  distributeGrimoire(state, {val}){
    state.isGrimoireDistributed = val;
  },
  setSessionId(state, sessionId) {
    state.sessionId = sessionId
      .toLocaleLowerCase()
      .replace(/[^0-9a-z]/g, "")
      .substr(0, 10);
  },
  setPlayerName(state, name){
    state.playerName = name;
  },
  nomination(
    state,
    { nomination, votes, votingSpeed, lockedVote, isVoteInProgress, nominatedPlayer = null } = {}
  ) {
    state.nomination = nomination || false;
    if (!!nomination && !!nominatedPlayer && state.isSecretVote && nominatedPlayer.role.team != 'traveler') {
      for(let i=0; i<votes.length; i++) {
        if (i != state.claimedSeat) {votes[i] = false}
      }
    }
    state.votes = votes || [];
    state.votingSpeed = votingSpeed || state.votingSpeed;
    state.lockedVote = lockedVote || 0;
    state.isVoteInProgress = isVoteInProgress || false;
    
  },
  /**
   * Create an entry in the vote history log. Requires current player array because it might change later in the game.
   * Only stores votes that were completed.
   * @param state
   * @param players
   */
  addHistory(state, players) {
    if (!state.isVoteHistoryAllowed && state.isSpectator) return;
    if (!state.nomination || state.lockedVote <= players.length) return;
    const isExile = players[state.nomination[1]].role.team === "traveler";
    const votedPlayers = Array.from(players).filter((player, index) => state.votes[index]);
    votedPlayers.forEach(player => {
      player.seat = players.indexOf(player) + 1;
      player.votes = state.votes[players.indexOf(player)];
    });
    this.commit("session/addVotes", {
      timestamp: new Date(),
      nominator: (state.nomination[0] + 1).toString() + ". " + (players[state.nomination[0]].id ? players[state.nomination[0]].name : ""),
      nominee: (state.nomination[1] + 1).toString() + ". " + (players[state.nomination[1]].id ? players[state.nomination[1]].name : ""),
      type: isExile ? "流放" : "处决",
      mode: state.isSecretVote ? "闭眼" : "睁眼",
      votes: state.votes.filter(item => typeof item === "number").reduce((item, sum) => item + sum, 0),
      majority: Math.ceil(
        players.filter(player => !player.isDead || isExile).length / 2
      ),
      votedPlayers: votedPlayers
        .map(({ seat, name, votes }) => (seat + ". " + name + (votes > 1 ? " *" + votes + "票" : ""))),
      save: true
    })
  },
  addVotes(state, {timestamp, nominator, nominee, type, mode, votes, majority, votedPlayers, save}) {
    // 重写时间
    const newTime = save ? timestamp : new Date(timestamp);
    state.voteHistory.push({
      timestamp: newTime,
      nominator,
      nominee,
      type,
      mode,
      votes,
      majority,
      votedPlayers
    });
  },
  addVoteSelected(state, {selected, players, save}) {
    if (save && !players && !state.isVoteHistoryAllowed && state.isSpectator) return;
    if (save && !players && (!state.nomination || state.lockedVote <= players.length)) return;
    state.voteSelected.push(selected);
  },
  setVoteSelected(state, {index, value}) {
    Vue.set(state.voteSelected, index, value);
  },
  clearVoteHistory(state, voteIndex = null) {
    if (voteIndex == null || voteIndex.length === 0) {
      state.voteHistory = [];
      state.voteSelected = [];
      return;
    }
    else {
      state.voteHistory = state.voteHistory.filter((_, index) => !voteIndex.includes(index));
      state.voteSelected = state.voteSelected.filter((_, index) => !voteIndex.includes(index));
    }
  },
  /**
   * Store a vote with and without syncing it to the live session.
   * This is necessary in order to prevent infinite voting loops.
   * @param state
   * @param vote
   */
  vote: handleVote,
  voteSync: handleVote,
  lockVote(state, lock) {
    state.lockedVote = lock !== undefined ? lock : state.lockedVote + 1;
  },
  createChatHistory(state, playerId){
    if (playerId === "") return;
    if (chatIndex(state, playerId) >= 0) return; // do nothing if it already exists
    Vue.set(state.chatHistory, state.chatHistory.length, {id: playerId, chat: []});
  },
  updateChatSent(state, chatContent){
    if (state.isSpectator && chatContent.sendingPlayerId != state.playerId) return;
    this.commit("session/addMessageQueue", {type: "direct", playerId:chatContent.receivingPlayerId, command: "chat", params:chatContent, id: new Date().getTime()})
  },
  updateChatReceived(state, {message, playerId}){
    if (state.isSpectator && playerId != state.stId) return;
    const playerIndex = chatIndex(state, playerId);
    const oldMessages = state.chatHistory[playerIndex]["chat"];
    Vue.set(state.chatHistory, playerIndex, {id: playerId, chat: [...oldMessages, message]})
  },
  addMessageQueue(state, {type, playerId, command, params, id}) {
    state.messageQueue.push({type, playerId, command, params, id});
  },
  deleteMessageQueue(state, index) {
    if (state.messageQueue.length  === 0) return;
    state.messageQueue.splice(index, 1);
  },
  checkUniqueMessage(state, feedback) {
    if (state.messageUniqueQueue[feedback]) clearTimeout(state.messageUniqueQueue[feedback]);
    state.messageUniqueQueue[feedback] = setTimeout(() => {
      delete state.messageUniqueQueue[feedback];
    }, 1000 * 60 * 3)
  },
  setStMessage(state, num) {
    if (num > 0){
      const newNum = state.newStMessage[0] += num;
      Vue.set(state.newStMessage, 0, newNum);
    } else{
      const newNum = state.newStMessage[0] = num;
      Vue.set(state.newStMessage, 0, newNum);
    }
  },
  addGroupChat(state, {chatId, players, playerIds, keep}) {
    if (state.groupChats.length >= 20) return;

    if (!!playerIds && !players) {
      players = this.state.players.players.filter(player => playerIds.includes(player.id));
    }

    const groupIndex = state.groupChats.findIndex(group => group.id === chatId);
    // 提供id则加入已存在的群聊，否则创建新的群聊
    if (groupIndex !== -1) {
      state.groupChats[groupIndex].players = [...state.groupChats[groupIndex].players, ...players];
      players.forEach(player => {
        this.commit("players/update", {player, property: "chatGroup", value: chatId});
      });
      return;
    }

    // 最多允许20个群聊（默认名字）
    const pattern = /^群聊(1[0-9]|20|[1-9])$/;
    const names = state.groupChats.map(group => group.name);
    const allSuffixes = names
      .filter(name => pattern.test(name))
      .map(name => name.replace(/^群聊/,""))
      .map(Number);
    const maxIndex = Math.max(...allSuffixes);
    const index = maxIndex + 1;
    let name = "群聊" + index;
    if (index > 20 || names.includes(name)) {
      for (let i=1; i<=21; i++) {
        if (!allSuffixes.includes(i)) {
          name = "群聊" + i;
          break;
        }
      }
    }
    // initialise group chats
    state.groupChats.push({
      id: chatId, 
      name: names.length === 0 ? "群聊1" : name, 
      keep: keep === undefined ? false : keep,
      players
    });
    players.forEach(player => {
      this.commit("players/update", {
        player,
        property: "chatGroup",
        value: chatId
      });
    });
  },
  removeGroupChat(state, {chatId}) {
    const index = state.groupChats.findIndex(group => group.id === chatId);
    if (index === -1) return;
    
    state.groupChats[index].players.forEach(player => {
      this.commit("players/update", {player, property: "chatGroup", value: ""});
    });
    state.groupChats.splice(index, 1);
  },
  removeGroupChatMember(state, {chatId, player, playerId}) {
    const groupIndex = state.groupChats.findIndex(group => group.id === chatId);
    if (groupIndex === -1) return;

    if (!!playerId && !player) {
      const playerArray = this.state.players.players.filter(player => playerId === player.id);
      if (playerArray.length == 0) return;
      player = playerArray[0];
    }

    const playerIndex = state.groupChats[groupIndex].players.findIndex(item => item.id == player.id);
    if (playerIndex === -1) return;
    this.commit("players/update", {
      player: state.groupChats[groupIndex].players[playerIndex], 
      property: "chatGroup", 
      value: ""
    });
    state.groupChats[groupIndex].players.splice(playerIndex, 1);
    
  },
  toggleGroupKeep(state, chatId) {
    const index = state.groupChats.findIndex(group => group.id === chatId);
    if (index === -1) return;

    const group = state.groupChats[index];
    state.groupChats[index].keep = !group.keep;
  },
  setPlayerAvatar(state){
    state.playerAvatar = "";
  },
  updatePlayerAvatar(state, link){
    state.playerAvatar = link;
  },
  setIsRole(state, {role, property, value, st}) {
    if (!state.isRole[role]) return;
    if (property === 'using' && !st) return; // using会请求说书人统一更改，说书人不会使用using属性
    state.isRole[role][property] = value;
  },
  startTimer(state, time){
    if (time) state.timer = time;
    state.startTime = Date.now();
    state.lastUpdateTime = Date.now(); // Initialize last update time
    
    state.interval = setInterval(() => {
      const now = Date.now();
      const elapsedSinceLastUpdate = now - state.lastUpdateTime;

      // Calculate how many full seconds have passed
      const secondsPassed = elapsedSinceLastUpdate / 1000;

      if (secondsPassed > 0) {
          state.timer -= secondsPassed; // Decrement by the actual seconds passed
          state.lastUpdateTime = now; // Update the last update time
      }

      if (state.timer <= 0) {
          state.timer = 0;
          clearInterval(state.interval);
      }
    }, 1000);
  },
  stopTimer(state){
    clearInterval(state.interval);
  },
  setTalking(state, {seatNum, isTalking}){
    if (seatNum < 0 || seatNum >= this.state.players.players.length ) return;
    if (!this.state.players.players[seatNum].id || this.state.players.players[seatNum].id != state.playerId) return;
    state.isTalking = isTalking;
    this.commit("players/setIsTalking", {seatNum, isTalking});
  }
};


function chatIndex(state, playerId) {
  for (let i = 0; i < state.chatHistory.length; i++) {
    if (state.chatHistory[i]["id"] === playerId) {
      return i;
    }
  }
  return -1;
}


export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
};
