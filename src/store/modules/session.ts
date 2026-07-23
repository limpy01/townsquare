import type {
  LegacyAction,
  LegacyGetter,
  LegacyMutation,
} from "../legacy-vuex";
import { pinia } from "../../pinia";
import { useAudioStore } from "../../stores/audio";
import { useDistributionStore } from "../../stores/distribution";
import { useLegacyOptionsStore } from "../../stores/legacy-options";
import { useReviewStore } from "../../stores/review";
import { useTimerStore } from "../../stores/timer";
import { useVotingStore } from "../../stores/voting";
import { useSessionSettingsStore } from "../../stores/session-settings";

const state = () => ({
  sessionId: "",
  StId: null,
  stSecret: "",
  isSpectator: false,
  playerId: "",
  playerName: "",
  playerAvatar: "default.webp",
  claimedSeat: -1,
  isRole: {
    wraith: {
      active: false, // player
      using: false, // player
      st: 0, // st
      player: 0, // st
      prob: 0.05, // st
      probMax: 0.1, // st
    },
  },
  messageQueue: [],
  messageUniqueQueue: [],
  chatHistory: [],
  groupChats: [],
});

const getters: Record<string, LegacyGetter> = {};

const actions: Record<string, LegacyAction> = {};

// mutations helper functions
const set =
  (key: string): LegacyMutation =>
  (state, val) => {
    state[key] = val;
  };

const mutations: Record<string, LegacyMutation> = {
  setPlayerId: set("playerId"),
  setStId: set("stId"),
  setStSecret: set("stSecret"),
  setSpectator: set("isSpectator"),
  setPlayerVotes(_state, playerVotes) {
    useVotingStore(pinia).setPlayerVotes(playerVotes);
  },
  setVotingSpeed(_state, votingSpeed) {
    useVotingStore(pinia).setVotingSpeed(votingSpeed);
  },
  setVoteInProgress(_state, isVoteInProgress) {
    useVotingStore(pinia).setVoteInProgress(isVoteInProgress);
  },
  setMarkedPlayer(state, markedPlayer) {
    useVotingStore(pinia).setMarkedPlayer(markedPlayer, {
      isSecretVote: useVotingStore(pinia).isSecretVote,
    });
  },
  setNomination(state, nomination) {
    useVotingStore(pinia).setNomination(nomination, {
      isSecretVote: useVotingStore(pinia).isSecretVote,
      claimedSeat: state.claimedSeat,
    });
  },
  setVoteHistoryAllowed(_state, isVoteHistoryAllowed) {
    useVotingStore(pinia).setVoteHistoryAllowed(isVoteHistoryAllowed);
  },
  setSecretVote(_state, isSecretVote) {
    useVotingStore(pinia).setSecretVote(isSecretVote);
  },
  setBootlegger(_state, bootlegger) {
    useSessionSettingsStore(pinia).setBootlegger(bootlegger);
  },
  setUseOldOrder(_state, useOldOrder) {
    useLegacyOptionsStore(pinia).setUseOldOrder(useOldOrder);
  },
  setUseOldRole(_state, useOldRole) {
    useLegacyOptionsStore(pinia).setUseOldRole(useOldRole);
  },
  setIsReview(_state, isReview) {
    useReviewStore(pinia).setReview(isReview);
  },
  claimSeat: set("claimedSeat"),
  distributeRoles(_state, active) {
    useDistributionStore(pinia).setRoles(active);
  },
  distributeTypes(_state, active) {
    useDistributionStore(pinia).setTypes(active);
  },
  distributeBluffs(_state, { val }) {
    useDistributionStore(pinia).setBluffs(val);
  },
  distributeGrimoire(_state, { val }) {
    useDistributionStore(pinia).setGrimoire(val);
  },
  setSessionId(state, sessionId) {
    state.sessionId = sessionId
      .toLocaleLowerCase()
      .replace(/[^0-9a-z]/g, "")
      .substr(0, 10);
  },
  setPlayerName(state, name) {
    state.playerName = name;
  },
  nomination(state, nomination = {}) {
    useVotingStore(pinia).setNomination(nomination, {
      isSecretVote: useVotingStore(pinia).isSecretVote,
      claimedSeat: state.claimedSeat,
    });
  },
  /**
   * Create an entry in the vote history log. Requires current player array because it might change later in the game.
   * Only stores votes that were completed.
   * @param state
   * @param players
   */
  addHistory(state, players) {
    const voting = useVotingStore(pinia);
    const entry = voting.createHistoryEntry(players, {
      isVoteHistoryAllowed: voting.isVoteHistoryAllowed,
      isSpectator: state.isSpectator,
    });
    if (entry) this.commit("session/addVotes", entry);
  },
  addVotes(_state, entry) {
    useVotingStore(pinia).addVotes(entry);
  },
  addVoteSelected(state, payload) {
    const voting = useVotingStore(pinia);
    voting.addVoteSelected(payload, {
      isVoteHistoryAllowed: voting.isVoteHistoryAllowed,
      isSpectator: state.isSpectator,
    });
  },
  setVoteSelected(_state, selection) {
    useVotingStore(pinia).setVoteSelected(selection);
  },
  clearVoteHistory(_state, voteIndexes = null) {
    useVotingStore(pinia).clearVoteHistory(voteIndexes);
  },
  /**
   * Store a vote with and without syncing it to the live session.
   * This is necessary in order to prevent infinite voting loops.
   * @param state
   * @param vote
   */
  vote(_state, vote) {
    useVotingStore(pinia).vote(vote);
  },
  voteSync(_state, vote) {
    useVotingStore(pinia).vote(vote);
  },
  lockVote(_state, lock) {
    useVotingStore(pinia).lockVote(lock);
  },
  createChatHistory(state, playerId) {
    if (playerId === "") return;
    if (chatIndex(state, playerId) >= 0) return; // do nothing if it already exists
    state.chatHistory[state.chatHistory.length] = { id: playerId, chat: [] };
  },
  updateChatSent(state, chatContent) {
    if (state.isSpectator && chatContent.sendingPlayerId != state.playerId)
      return;
    this.commit("session/addMessageQueue", {
      type: "direct",
      playerId: chatContent.receivingPlayerId,
      command: "chat",
      params: chatContent,
      id: new Date().getTime(),
    });
  },
  updateChatReceived(state, { message, playerId }) {
    if (state.isSpectator && playerId != state.stId) return;
    const playerIndex = chatIndex(state, playerId);
    const oldMessages = state.chatHistory[playerIndex]["chat"];
    state.chatHistory[playerIndex] = {
      id: playerId,
      chat: [...oldMessages, message],
    };
  },
  addMessageQueue(state, { type, playerId, command, params, id }) {
    state.messageQueue.push({ type, playerId, command, params, id });
  },
  deleteMessageQueue(state, index) {
    if (state.messageQueue.length === 0) return;
    state.messageQueue.splice(index, 1);
  },
  checkUniqueMessage(state, feedback) {
    if (state.messageUniqueQueue[feedback])
      clearTimeout(state.messageUniqueQueue[feedback]);
    state.messageUniqueQueue[feedback] = setTimeout(
      () => {
        delete state.messageUniqueQueue[feedback];
      },
      1000 * 60 * 3,
    );
  },
  addGroupChat(state, { chatId, players, playerIds, keep }) {
    if (state.groupChats.length >= 20) return;

    if (!!playerIds && !players) {
      players = this.state.players.players.filter((player: any) =>
        playerIds.includes(player.id),
      );
    }

    const groupIndex = state.groupChats.findIndex(
      (group: any) => group.id === chatId,
    );
    // 提供id则加入已存在的群聊，否则创建新的群聊
    if (groupIndex !== -1) {
      state.groupChats[groupIndex].players = [
        ...state.groupChats[groupIndex].players,
        ...players,
      ];
      players.forEach((player: any) => {
        this.commit("players/update", {
          player,
          property: "chatGroup",
          value: chatId,
        });
      });
      return;
    }

    // 最多允许20个群聊（默认名字）
    const pattern = /^群聊(1[0-9]|20|[1-9])$/;
    const names = state.groupChats.map((group: any) => group.name);
    const allSuffixes = names
      .filter((name: any) => pattern.test(name))
      .map((name: any) => name.replace(/^群聊/, ""))
      .map(Number);
    const maxIndex = Math.max(...allSuffixes);
    const index = maxIndex + 1;
    let name = "群聊" + index;
    if (index > 20 || names.includes(name)) {
      for (let i = 1; i <= 21; i++) {
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
      players,
    });
    players.forEach((player: any) => {
      this.commit("players/update", {
        player,
        property: "chatGroup",
        value: chatId,
      });
    });
  },
  removeGroupChat(state, { chatId }) {
    const index = state.groupChats.findIndex(
      (group: any) => group.id === chatId,
    );
    if (index === -1) return;

    state.groupChats[index].players.forEach((player: any) => {
      this.commit("players/update", {
        player,
        property: "chatGroup",
        value: "",
      });
    });
    state.groupChats.splice(index, 1);
  },
  removeGroupChatMember(state, { chatId, player, playerId }) {
    const groupIndex = state.groupChats.findIndex(
      (group: any) => group.id === chatId,
    );
    if (groupIndex === -1) return;

    if (!!playerId && !player) {
      const playerArray = this.state.players.players.filter(
        (player: any) => playerId === player.id,
      );
      if (playerArray.length == 0) return;
      player = playerArray[0];
    }

    const playerIndex = state.groupChats[groupIndex].players.findIndex(
      (item: any) => item.id == player.id,
    );
    if (playerIndex === -1) return;
    this.commit("players/update", {
      player: state.groupChats[groupIndex].players[playerIndex],
      property: "chatGroup",
      value: "",
    });
    state.groupChats[groupIndex].players.splice(playerIndex, 1);
  },
  toggleGroupKeep(state, chatId) {
    const index = state.groupChats.findIndex(
      (group: any) => group.id === chatId,
    );
    if (index === -1) return;

    const group = state.groupChats[index];
    state.groupChats[index].keep = !group.keep;
  },
  setPlayerAvatar(state) {
    state.playerAvatar = "";
  },
  updatePlayerAvatar(state, link) {
    state.playerAvatar = link;
  },
  setIsRole(state, { role, property, value, st }) {
    if (!state.isRole[role]) return;
    if (property === "using" && !st) return; // using会请求说书人统一更改，说书人不会使用using属性
    state.isRole[role][property] = value;
  },
  setTimer(_state, timer) {
    useTimerStore(pinia).setTimer(timer);
  },
  startTimer(_state, time) {
    useTimerStore(pinia).startTimer(time);
  },
  stopTimer() {
    useTimerStore(pinia).stopTimer();
  },
  setTalking(state, { seatNum, isTalking }) {
    if (seatNum < 0 || seatNum >= this.state.players.players.length) return;
    if (
      !this.state.players.players[seatNum].id ||
      this.state.players.players[seatNum].id != state.playerId
    )
      return;
    useAudioStore(pinia).setTalking(isTalking);
    this.commit("players/setIsTalking", { seatNum, isTalking });
  },
};

function chatIndex(state: any, playerId: any) {
  for (let i = 0; i < state.chatHistory.length; i++) {
    if (state.chatHistory[i]["id"] === playerId) {
      return i;
    }
  }
  return -1;
}

const sessionModule: any = {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};

export default sessionModule;
